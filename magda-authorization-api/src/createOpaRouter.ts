import express from "express";
import { Router } from "express";
import _ from "lodash";
import Database from "./Database";
import { User } from "magda-typescript-common/src/authorization-api/model";
import { getUserSession } from "magda-typescript-common/src/session/GetUserSession";
import OpaCompileResponseParser from "magda-typescript-common/src/OpaCompileResponseParser";
import request from "request-promise-native";
import bodyParser from "body-parser";
import objectPath from "object-path";

export interface OpaRouterOptions {
    opaUrl: string;
    database: Database;
    jwtSecret: string;
}

const opaRoutes = [
    {
        path: "/compile",
        method: "post"
    },
    {
        path: "/compile",
        method: "get"
    },
    {
        path: "/data/*",
        method: "get"
    },
    {
        path: "/data/*",
        method: "post"
    },
    {
        path: "/query",
        method: "get"
    },
    {
        path: "/query",
        method: "post"
    }
];

/**
 *
 * @param options proxyReq: http.ClientRequest,
      req: http.IncomingMessage,
      res: http.ServerResponse,
      options: Server.ServerOptions
 */

export default function createOpaRouter(options: OpaRouterOptions): Router {
    const database = options.database;
    const router: Router = express.Router();
    const jwtSecret: string = options.jwtSecret;
    const opaUrl: string = options.opaUrl;

    router.use(bodyParser.json({ type: "application/json" }));

    function normaliseInputField(reqData: any) {
        if (reqData.input && typeof reqData.input === "object") return;
        reqData.input = {};
    }

    function processQueryParams(req: express.Request, reqData: any) {
        if (!req.query || !Object.keys(req.query).length) return null;

        const { q, input, unknowns, ...otherQueryParams } = req.query;

        if (q && typeof q === "string" && q.length) {
            reqData["query"] = q;
        }

        if (input && typeof input === "string" && input.length) {
            // --- supply whole input object as JSON string through `input` query param
            try {
                const inputData = JSON.parse(input);
                reqData.input = { ...reqData.input, ...inputData };
            } catch (e) {}
        } else {
            /**
             * Supply input as JSON path notion.
             * e.g. input.companyName=ABC&input.people.0.name=Joe will be converted to
             * input = {
             *   "companyName": "ABC",
             *   "people": [{
             *      "name": Joe
             *   }]
             * }
             */
            const data: any = {};
            Object.keys(req.query)
                .filter(key => key.indexOf("input.") === 0)
                .forEach(key => {
                    if (key.replace("input.", "").trim() === "") return;
                    objectPath.set(data, key, req.query[key]);
                });
            if (data.input && Object.keys(data.input).length) {
                reqData.input = { ...reqData.input, ...data.input };
            }
        }

        if (unknowns) {
            // --- could be a string or array of string
            if (_.isString(unknowns) && unknowns.length) {
                reqData["unknowns"] = [unknowns];
            } else if (_.isArray(unknowns) && unknowns.length) {
                reqData["unknowns"] = unknowns;
            }
        }

        if (!otherQueryParams || !Object.keys(otherQueryParams).length)
            return null;

        return otherQueryParams;
    }

    async function appendUserInfoToInput(
        req: express.Request,
        res: express.Response
    ) {
        const userInfo: User = await database.getCurrentUserInfo(
            req,
            jwtSecret
        );

        let reqData: any = {};
        const contentType = req.get("content-type");

        const reqOpts: request.RequestPromiseOptions = {
            method: "post",
            resolveWithFullResponse: true
        };

        // --- merge userInfo into possible income input data via POST
        if (
            typeof req.body === "object" &&
            contentType &&
            contentType.toLowerCase() === "application/json"
        ) {
            reqData = req.body;
        }

        try {
            const reqQueryParams: any = processQueryParams(req, reqData);

            if (reqQueryParams) {
                // --- if still extra query params left, pass to opa
                reqOpts.qs = reqQueryParams;
            }
        } catch (e) {
            throw new Error(`Failed to process query parameters: ${e}`);
        }

        normaliseInputField(reqData);

        reqData.input.user = userInfo;
        reqData.input.user.roles = userInfo.roles.map(role => role.id);

        const sessionClaim = getUserSession(req, jwtSecret).valueOr({});

        reqData.input.user.session = sessionClaim.session;

        reqData.input.timestamp = Date.now();

        reqData.input.extra = await database.getExtraInput();

        reqOpts.json = reqData;

        // console.log(JSON.stringify(reqOpts, null, 2));

        try {
            // -- request's pipe api doesn't work well with chunked response
            const fullResponse = await request(
                `${opaUrl}v1${req.path}`,
                reqOpts
            );
            if (
                req.path === "/compile" &&
                req.query.printRule &&
                fullResponse.statusCode === 200
            ) {
                // --- output human readable rules for debugging / investigation
                // --- AST is good for a program to process but too long for a human to read
                // --- query string parameter `printRule` contains the rule full name that you want to output
                const parser = new OpaCompileResponseParser();
                parser.parse(fullResponse.body);
                res.status(fullResponse.statusCode).send(
                    parser.evaluateRuleAsHumanReadableString(
                        req.query.printRule
                    )
                );
            } else {
                res.status(fullResponse.statusCode).send(fullResponse.body);
            }
        } catch (e) {
            console.error(e);
            res.status(500).send(`Failed to proxy request to OPA`);
        }
    }

    async function proxyRequest(req: express.Request, res: express.Response) {
        try {
            res.set({
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0"
            });
            await appendUserInfoToInput(req, res);
        } catch (e) {
            res.status(e.statusCode || 500).send(
                `Failed to proxy OPA request: ${e}`
            );
        }
    }

    opaRoutes.map(route => {
        if (route.method == "post") {
            router.post(route.path, proxyRequest);
        } else {
            router.get(route.path, proxyRequest);
        }
    });

    return router;
}
