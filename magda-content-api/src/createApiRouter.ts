import express from "express";
import _ from "lodash";
import {
    getUser,
    mustBeAdmin
} from "magda-typescript-common/src/authorization-api/authMiddleware";
import buildJwt from "magda-typescript-common/src/session/buildJwt";
import GenericError from "magda-typescript-common/src/authorization-api/GenericError";
import Database, { Query } from "./Database";
import { Maybe } from "tsmonad";
import { Content } from "./model";
import {
    content,
    ContentEncoding,
    ContentItem,
    findContentItemById
} from "./content";

import {
    installStatusRouter,
    createServiceProbe
} from "magda-typescript-common/src/express/status";
import AccessControlError from "magda-typescript-common/src/authorization-api/AccessControlError";

export interface ApiRouterOptions {
    database: Database;
    jwtSecret: string;
    authApiUrl: string;
}

export default function createApiRouter(options: ApiRouterOptions) {
    const database = options.database;

    const router: express.Router = express.Router();

    const status = {
        probes: {
            database: database.check.bind(database),
            auth: createServiceProbe(options.authApiUrl)
        }
    };
    installStatusRouter(router, status);

    const USER = getUser(options.authApiUrl, options.jwtSecret);
    const ADMIN = mustBeAdmin(options.authApiUrl, options.jwtSecret);

    /**
     * @apiGroup Content
     * @api {post} /v0/content/all Get All
     * @apiDescription Get a list of content items and their type.
     *
     * @apiParam (Query) {string} id filter content id by this wildcard pattern. For example: "id=header/*&id=footer/*". Can specify multiple.
     * @apiParam (Query) {string} type filter content mime type by this wildcard pattern. For example: "type=application/*". Can specify multiple.
     * @apiParam (Query) {boolean} inline flag to specify if content should be inlined. Only application/json mime type content is supported now.
     *
     * @apiSuccess {string} result=SUCCESS
     *
     * @apiSuccessExample {json} 200
     *    [
     *        {
     *            "id": ...
     *            "type": ...
     *            "length": ...
     *            "content": ...
     *        },
     *        ...
     *    ]
     */
    router.get("/all", USER, async function(req, res) {
        try {
            const idQuery: Query = {
                field: "id",
                patterns: coerceToArray(req.query.id)
            };
            const typeQuery: Query = {
                field: "type",
                patterns: coerceToArray(req.query.type)
            };

            const inline =
                req.query.inline && req.query.inline.toLowerCase() === "true";
            const inlineContentIfType: string[] = inline
                ? ["application/json", "text/plain"]
                : [];

            // get summary
            let all: any[] = await database.getContentSummary(
                [idQuery, typeQuery],
                inlineContentIfType,
                req.header("X-Magda-Session")
            );

            // filter out privates and non-configurable
            all = all.filter((item: any) => {
                const contentItem = findContentItemById(item.id);

                if (contentItem && contentItem.private) {
                    return req.user && req.user.isAdmin;
                } else {
                    return true;
                }
            });

            // inline
            if (inline) {
                for (const item of all.filter(item => item.content)) {
                    try {
                        switch (item.type) {
                            case "application/json":
                                item.content = JSON.parse(item.content);
                                break;
                        }
                    } catch (e) {
                        item.error = e.message;
                        console.error(e.stack);
                    }
                }
            }

            res.json(all);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    });

    function coerceToArray<T>(thing: T | T[]): T[] {
        if (_.isArray(thing)) {
            return thing;
        } else if (thing) {
            return [thing];
        } else {
            return [];
        }
    }

    /**
     * @apiGroup Content
     * @api {get} /v0/content/:contentId.:format Get Content
     * @apiDescription Returns content by content id.
     *
     * @apiParam {string} contentId id of content item
     * @apiParam {string} format The format to return result with.
     * * If specified format is text, will return content as text/plain
     * * If specified format is json, will return content as application/json.
     * * If specified format is anything else, will return content as saved mime type.
     *
     * @apiSuccessExample {any} 200
     *    Content in format requested
     *
     * @apiError {string} result=FAILED
     *
     * @apiErrorExample {json} 404
     *    {
     *         "result": "FAILED"
     *    }
     *
     * @apiErrorExample {json} 500
     *    {
     *         "result": "FAILED"
     *    }
     */
    router.get("/*", getContent);

    async function getContent(req: any, res: any) {
        const requestContentId = req.path.substr(
            1,
            req.path.lastIndexOf(".") - 1
        );
        const requestFormat = req.path.substr(req.path.lastIndexOf(".") + 1);

        try {
            const contentPromise = await database.getContentById(
                requestContentId,
                req.header("X-Magda-Session")
            );
            const { content, format } = (await contentPromise.caseOf({
                just: content =>
                    Promise.resolve(
                        Maybe.just({
                            format: requestFormat,
                            content
                        })
                    ),
                nothing: async () => {
                    const tempContentId = req.path.substr(1);
                    const tempContentMaybe = await database.getContentById(
                        tempContentId
                    );

                    return tempContentMaybe.map(content => ({
                        format: tempContentId.substr(
                            tempContentId.lastIndexOf(".") + 1
                        ),
                        content
                    }));
                }
            })).valueOrThrow(
                new GenericError(
                    `Unsupported configuration item requested: ${requestContentId}.${requestFormat}`,
                    404
                )
            );

            switch (format) {
                case "json":
                    JSON.parse(content.content);
                    return returnText(res, content, "application/json");
                case "js":
                    return returnText(res, content, "application/javascript");
                case "text":
                    return returnText(res, content, "text/plain");
                case "md":
                    return returnText(res, content, "text/markdown");
                case "css":
                case "html":
                    return returnText(res, content, `text/${format}`);
                default:
                    return returnBinary(res, content);
            }
        } catch (e) {
            res.status(e.statusCode || 500).json({
                result: "FAILED"
            });
            if (e instanceof AccessControlError) {
                console.log(e);
            } else {
                console.error(e);
            }
        }
    }

    Object.entries(content).forEach(function(config: [string, ContentItem]) {
        const [contentId, configurationItem] = config;

        const route = configurationItem.route || `/${contentId}`;
        const body = configurationItem.body || null;
        const verify = configurationItem.verify || null;

        /**
         * @apiGroup Content
         * @api {put} /v0/content/:contentId Update Content
         * @apiDescription Update content by id
         *
         * @apiParam {string} contentId id of content item
         * @apiHeader {string} Content-Type=text/plain mime type of posted content.
         *
         * @apiSuccess {string} result=SUCCESS
         *
         * @apiSuccessExample {json} 200
         *    {
         *         "result": "SUCCESS"
         *    }
         *
         * @apiError {string} result=FAILED
         *
         * @apiErrorExample {json} 400
         *    {
         *         "result": "FAILED"
         *    }
         */

        async function put(req: any, res: any) {
            try {
                let content = req.body;

                switch (configurationItem.encode) {
                    case ContentEncoding.base64:
                        if (!(content instanceof Buffer)) {
                            throw new GenericError(
                                "Can not base64 encode non-raw"
                            );
                        }
                        content = content.toString("base64");
                        break;
                    case ContentEncoding.json:
                        if (
                            typeof content !== "object" &&
                            typeof content !== "string" &&
                            typeof content !== "number" &&
                            typeof content !== "boolean" &&
                            content !== null
                        ) {
                            throw new GenericError(
                                "Can not stringify encode non-json"
                            );
                        }
                        content = JSON.stringify(content);
                        break;
                }

                if (typeof content !== "string") {
                    // if this error is being thrown, also check if body parser is configured with right type
                    throw new GenericError(
                        `Config value is not string yet (${typeof content}). You'll got some work to do.`
                    );
                }

                const contentType =
                    configurationItem.contentType ||
                    req.headers["content-type"] ||
                    "text/plain";

                const finalContentId = req.path.substr(1);

                await database.setContentById(
                    finalContentId,
                    contentType,
                    content
                );

                res.status(201).json({
                    result: "SUCCESS"
                });
            } catch (e) {
                res.status(e.statusCode || 500).json({
                    result: "FAILED"
                });
                console.error(e);
            }
        }

        router.put.apply(
            router,
            ([route, ADMIN, body, verify, put] as any).filter((i: any) => i)
        );

        /**
         * @apiGroup Content
         * @api {delete} /v0/content/:contentId Delete Content
         * @apiDescription Delete content by content id. Must be an admin.
         * Only available for contents with wildcard ids.
         *
         * @apiParam {string} contentId id of content item
         *
         * @apiSuccessExample {any} 200
         *    {
         *         "result": "SUCCESS"
         *    }
         *
         */

        router.delete(route, ADMIN, async function(req, res) {
            const finalContentId = req.path.substr(1);

            await database.deleteContentById(finalContentId);

            res.status(200).json({
                result: "SUCCESS"
            });
        });
    });

    // This is for getting a JWT in development so you can do fake authenticated requests to a local server.
    if (process.env.NODE_ENV !== "production") {
        router.get("/public/jwt", function(req, res) {
            res.status(200);
            res.write(
                "X-Magda-Session: " +
                    buildJwt(
                        options.jwtSecret,
                        "00000000-0000-4000-8000-000000000000"
                    )
            );
            res.send();
        });
    }

    return router;
}

function returnBinary(res: any, content: Content) {
    const buffer = Buffer.from(content.content, "base64");
    res.header("Content-Type", content.type).send(buffer);
}

function returnText(res: any, content: Content, mime: string) {
    res.header("Content-Type", mime).send(content.content);
}
