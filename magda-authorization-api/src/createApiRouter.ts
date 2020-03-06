import express from "express";
import { Maybe } from "tsmonad";

import Database from "./Database";
import { PublicUser } from "magda-typescript-common/src/authorization-api/model";
import { getUserIdHandling } from "magda-typescript-common/src/session/GetUserId";
import GenericError from "magda-typescript-common/src/authorization-api/GenericError";
import AuthError from "magda-typescript-common/src/authorization-api/AuthError";
import { installStatusRouter } from "magda-typescript-common/src/express/status";
import { NodeNotFoundError } from "./NestedSetModelQueryer";

export interface ApiRouterOptions {
    database: Database;
    registryApiUrl: string;
    opaUrl: string;
    jwtSecret: string;
    tenantId: number;
}

/**
 * @apiDefine Auth Authorization API
 */

export default function createApiRouter(options: ApiRouterOptions) {
    const database = options.database;
    const orgQueryer = database.getOrgQueryer();

    const router: express.Router = express.Router();

    const status = {
        probes: {
            database: database.check.bind(database)
        }
    };
    installStatusRouter(router, status);
    installStatusRouter(router, status, "/private");
    installStatusRouter(router, status, "/public");

    function respondWithError(route: string, res: express.Response, e: Error) {
        console.error(`Error happened when processed "${route}"`);
        console.error(e);

        if (e instanceof NodeNotFoundError) {
            res.status(404).json({
                isError: true,
                errorCode: 404,
                errorMessage: e.message || "Could not find resource"
            });
        } else {
            res.status(500).json({
                isError: true,
                errorCode: 500,
                errorMessage: "Internal server error"
            });
        }
    }

    function handleMaybePromise<T>(
        res: express.Response,
        promise: Promise<Maybe<T>>,
        route: string,
        notFoundMessage: string = "Could not find resource"
    ) {
        return promise
            .then(resource =>
                resource.caseOf({
                    just: resource => res.json(resource),
                    nothing: () =>
                        res.status(404).json({
                            isError: true,
                            errorCode: 404,
                            errorMessage: notFoundMessage
                        })
                })
            )
            .catch(e => {
                respondWithError(route, res, e);
            })
            .then(() => res.end());
    }

    const MUST_BE_ADMIN = function(req: any, res: any, next: any) {
        //--- private API requires admin level access
        getUserIdHandling(
            req,
            res,
            options.jwtSecret,
            async (userId: string) => {
                try {
                    const user = (await database.getUser(userId)).valueOrThrow(
                        new AuthError(
                            `Cannot locate user record by id: ${userId}`,
                            401
                        )
                    );
                    if (!user.isAdmin)
                        throw new AuthError(
                            "Only admin users are authorised to access this API",
                            403
                        );
                    req.user = user;
                    next();
                } catch (e) {
                    console.warn(e);
                    if (e instanceof AuthError)
                        res.status(e.statusCode).send(e.message);
                    else res.status(401).send("Not authorized");
                }
            }
        );
    };

    const NO_CACHE = function(req: any, res: any, next: any) {
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0"
        });
        next();
    };

    router.all("/private/*", MUST_BE_ADMIN);

    router.get("/private/users/lookup", function(req, res) {
        const source = req.query.source;
        const sourceId = req.query.sourceId;

        handleMaybePromise(
            res,
            database.getUserByExternalDetails(source, sourceId),
            "/private/users/lookup"
        );
    });

    router.get("/private/users/:userId", function(req, res) {
        const userId = req.params.userId;

        handleMaybePromise(
            res,
            database.getUser(userId),
            "/private/users/:userId"
        );
    });

    router.post("/private/users", async function(req, res) {
        try {
            const user = await database.createUser(req.body);
            res.json(user);
            res.status(201);
        } catch (e) {
            respondWithError("/private/users", res, e);
        }
        res.end();
    });

    /**
     * @apiGroup Auth
     * @api {get} /v0/auth/users/whoami Get Current User
     * @apiDescription Returns current user
     *
     * @apiSuccessExample {json} 200
     *    {
     *        "id":"...",
     *        "displayName":"Fred Nerk",
     *        "email":"fred.nerk@data61.csiro.au",
     *        "photoURL":"...",
     *        "source":"google",
     *        "isAdmin": true
     *    }
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/users/whoami", NO_CACHE, async function(req, res) {
        try {
            const currentUserInfo = await database.getCurrentUserInfo(
                req,
                options.jwtSecret
            );

            res.json(currentUserInfo);
        } catch (e) {
            if (e instanceof GenericError) {
                const data = e.toData();
                res.status(data.errorCode).json(data);
            } else {
                respondWithError("/public/users/whoami", res, e);
            }
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /v0/auth/users/all Get all users
     * @apiDescription Returns all users
     *
     * @apiSuccessExample {json} 200
     *    [{
     *        "id":"...",
     *        "displayName":"Fred Nerk",
     *        "email":"fred.nerk@data61.csiro.au",
     *        "photoURL":"...",
     *        "source":"google",
     *        "isAdmin": true
     *    }]
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/users/all", MUST_BE_ADMIN, async (req, res) => {
        try {
            const items = await database.getUsers();
            res.status(200)
                .json({
                    items
                })
                .end();
        } catch (e) {
            respondWithError("/public/users/all", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /v0/auth/users/:userId Get User By Id
     * @apiDescription Returns user by id
     *
     * @apiParam {string} userId id of user
     *
     * @apiSuccessExample {json} 200
     *    {
     *        "id":"...",
     *        "displayName":"Fred Nerk",
     *        "photoURL":"...",
     *        "isAdmin": true
     *    }
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/users/:userId", NO_CACHE, (req, res) => {
        const userId = req.params.userId;
        const getPublicUser = database.getUser(userId).then(userMaybe =>
            userMaybe.map(user => {
                const publicUser: PublicUser = {
                    id: user.id,
                    photoURL: user.photoURL,
                    displayName: user.displayName,
                    isAdmin: user.isAdmin
                };

                return publicUser;
            })
        );

        handleMaybePromise(res, getPublicUser, "/public/users/:userId");
    });

    /**
     * @apiGroup Auth
     * @api {put} /v0/auth/users/:userId Get User By Id
     * @apiDescription Updates a user.
     *
     * @apiParam {string} userId id of user
     *
     * @apiSuccessExample {json} 200
     *    {
            result: "SUCCESS"
     *    }
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.put("/public/users/:userId", MUST_BE_ADMIN, async (req, res) => {
        const userId = req.params.userId;
        if (userId === req.user.id) {
            throw new AuthError(
                "Cannot change your own details through this endpoint",
                403
            );
        }

        // extract fields
        const { isAdmin } = req.body;
        const update = { isAdmin };

        // update
        try {
            await database.updateUser(userId, update);
            res.status(200).json({
                result: "SUCCESS"
            });
        } catch (e) {
            respondWithError("/public/users/:userId", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /public/orgunits/bylevel/:orgLevel List OrgUnits at certain org tree level
     * @apiDescription
     * List all OrgUnits at certain org tree level
     * Optionally provide a test Org Unit Id that will be used to
     * test the relationship with each of returned orgUnit item.
     * Possible Value: 'ancestor', 'descendant', 'equal', 'unrelated'
     *
     * @apiParam (Path) {string} orgLevel The level number (starts from 1) where org Units of the tree are taken horizontally.
     * @apiParam (Query) {string} relationshipOrgUnitId Optional; The org unit id that is used to test the relationship with each of returned orgUnit item.
     *
     * @apiSuccessExample {string} 200
     *     [{
     *       "id": "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7",
     *       "name": "node 1",
     *       "description": "xxxxxxxx",
     *       "relationship": "unrelated"
     *     },{
     *       "id": "e5f0ed5f-bb00-4e49-89a6-3f044aecc3f7",
     *       "name": "node 2",
     *       "description": "xxxxxxxx",
     *       "relationship": "ancestor"
     *     }]
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/orgunits/bylevel/:orgLevel", async (req, res) => {
        try {
            const orgLevel = req.params.orgLevel;
            const relationshipOrgUnitId = req.query.relationshipOrgUnitId;

            const levelNumber = parseInt(orgLevel);

            if (levelNumber < 1 || isNaN(levelNumber))
                throw new Error(`Invalid level number: ${orgLevel}.`);

            const nodes = await orgQueryer.getAllNodesAtLevel(levelNumber);

            if (relationshipOrgUnitId && nodes.length) {
                for (let i = 0; i < nodes.length; i++) {
                    const r = await orgQueryer.compareNodes(
                        nodes[i]["id"],
                        relationshipOrgUnitId
                    );
                    nodes[i]["relationship"] = r;
                }
            }

            res.status(200).json(nodes);
        } catch (e) {
            respondWithError("GET /public/orgunits/bylevel/:orgLevel", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /public/orgunits Get orgunits by name
     * @apiDescription
     * Gets org units matching a name
     * Optionally provide a test Org Unit Id that will be used to
     * test the relationship with each of returned orgUnit item.
     * Possible Value: 'ancestor', 'descendant', 'equal', 'unrelated'
     *
     * @apiParam (query) {string} nodeName the name of the org unit to look up
     * @apiParam (query) {boolean} leafNodesOnly Whether only leaf nodes should be returned
     * @apiParam (Query) {string} relationshipOrgUnitId Optional; The org unit id that is used to test the relationship with each of returned orgUnit item.
     *
     * @apiSuccessExample {json} 200
     *    [{
     *      "id": "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7",
     *      "name": "other-team",
     *      "description": "The other teams",
     *      "relationship": "unrelated"
     *    }]
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/orgunits", async (req, res) => {
        try {
            const nodeName: string = req.query.nodeName;
            const leafNodesOnly: string = req.query.leafNodesOnly;
            const relationshipOrgUnitId = req.query.relationshipOrgUnitId;

            const nodes = await orgQueryer.getNodes({
                name: nodeName,
                leafNodesOnly: leafNodesOnly === "true"
            });

            if (relationshipOrgUnitId && nodes.length) {
                for (let i = 0; i < nodes.length; i++) {
                    const r = await orgQueryer.compareNodes(
                        nodes[i]["id"],
                        relationshipOrgUnitId
                    );
                    nodes[i]["relationship"] = r;
                }
            }

            res.status(200).json(nodes);
        } catch (e) {
            respondWithError("/public/orgunits", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /v0/orgunits/root Get root organisation
     * @apiDescription Gets the root organisation unit (top of the tree).
     *
     * @apiSuccessExample {json} 200
     *    {
     *      id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *      name: "other-team"
     *      description: "The other teams"
     *    }
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/orgunits/root", async (req, res) => {
        handleMaybePromise(
            res,
            orgQueryer.getRootNode(),
            "GET /public/orgunits/root",
            "Cannot locate the root tree node."
        );
    });

    /**
     * @apiGroup Auth
     * @api {post} /v0/orgunits/root Create root organisation
     * @apiDescription Creates the root organisation unit (top of the tree).
     *
     * @apiParamExample (Body) {json}:
     *     {
     *       id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *       name: "other-team"
     *       description: "The other teams"
     *     }
     *
     * @apiSuccessExample {string} 200
     *     {
     *       "nodeId": "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *     }
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.post("/public/orgunits/root", MUST_BE_ADMIN, async (req, res) => {
        try {
            const nodeId = await orgQueryer.createRootNode(req.body);
            res.status(200).json({ nodeId: nodeId });
        } catch (e) {
            respondWithError("POST /public/orgunits/root", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /public/orgunits/:nodeId Get details for a node
     * @apiDescription Gets the details of the node with this id.
     *
     * @apiParam {string} nodeId id of the node to query
     *
     * @apiSuccessExample {json} 200
     *    {
     *      id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *      name: "other-team"
     *      description: "The other teams"
     *    }
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get("/public/orgunits/:nodeId", async (req, res) => {
        const nodeId = req.params.nodeId;
        handleMaybePromise(
            res,
            orgQueryer.getNodeById(nodeId),
            "GET /public/orgunits/:nodeId",
            `Could not find org unit with id ${nodeId}`
        );
    });

    /**
     * @apiGroup Auth
     * @api {put} /public/orgunits/:nodeId Set details for a node
     * @apiDescription Creates/updates a node at the specified id
     *
     * @apiParam (Path) {string} nodeId id of the node to query
     * @apiParamExample (Body) {json}:
     *     {
     *       id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *       name: "other-team"
     *       description: "The other teams"
     *     }
     *
     * @apiSuccessExample {string} 200
     *     {
     *       "nodeId": "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *     }
     *
     * @apiErrorExample {json} 401/404/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 404, 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.put("/public/orgunits/:nodeId", MUST_BE_ADMIN, async (req, res) => {
        try {
            const nodeId = req.params.nodeId;

            const existingNodeMaybe = await orgQueryer.getNodeById(nodeId);

            existingNodeMaybe.caseOf({
                just: async () => {
                    await orgQueryer.updateNode(nodeId, req.body);
                    res.status(200).json({ nodeId: nodeId });
                },
                nothing: async () => {
                    const newNodeId = await orgQueryer.insertNode(
                        nodeId,
                        req.body
                    );
                    res.status(200).json({ nodeId: newNodeId });
                }
            });
        } catch (e) {
            respondWithError("PUT /public/orgunits/:nodeId", res, e);
        }
    });

    /**
     * @apiGroup Auth
     * @api {get} /public/orgunits/:nodeId/children/immediate Get immediate children for a node
     * @apiDescription Gets all the children immediately below the requested node. If the node doesn't exist, returns an empty list.
     *
     * @apiParam {string} nodeId id of the node to query
     *
     * @apiSuccessExample {json} 200
     *     [{
     *      id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *      name: "other-team"
     *      description: "The other teams"
     *    }]
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get(
        "/public/orgunits/:nodeId/children/immediate",
        MUST_BE_ADMIN,
        async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                const nodes = await orgQueryer.getImmediateChildren(nodeId);
                res.status(200).json(nodes);
            } catch (e) {
                respondWithError(
                    "/public/orgunits/:nodeId/children/immediate",
                    res,
                    e
                );
            }
        }
    );

    /**
     * @apiGroup Auth
     * @api {get} /public/orgunits/:nodeId/children/all Get all children for a node
     * @apiDescription Gets all the children below the requested node recursively. If node doesn't exist, returns an empty list.
     *
     * @apiParam {string} nodeId id of the node to query
     *
     * @apiSuccessExample {json} 200
     *     [{
     *      id: "e5f0ed5f-aa97-4e49-89a6-3f044aecc3f7"
     *      name: "other-team"
     *      description: "The other teams"
     *    }]
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.get(
        "/public/orgunits/:nodeId/children/all",
        MUST_BE_ADMIN,
        async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                const nodes = await orgQueryer.getAllChildren(nodeId);
                res.status(200).json(nodes);
            } catch (e) {
                respondWithError(
                    "/public/orgunits/:nodeId/children/all",
                    res,
                    e
                );
            }
        }
    );

    /**
     * @apiGroup Auth
     * @api {delete} /public/orgunits/:nodeId/subtree Delete subtree
     * @apiDescription Deletes a node and all its children. Will delete the root node if that is the one specified in nodeId.
     *
     * @apiParam {string} nodeId id of the node to delete
     *
     * @apiSuccessExample {json} 200
     *     {
     *       "result": "SUCCESS"
     *     }
     *
     * @apiErrorExample {json} 401/500
     *    {
     *      "isError": true,
     *      "errorCode": 401, //--- or 500 depends on error type
     *      "errorMessage": "Not authorized"
     *    }
     */
    router.delete(
        "/public/orgunits/:nodeId/subtree",
        MUST_BE_ADMIN,
        async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                await orgQueryer.deleteSubTree(nodeId, true);
                res.status(200).json({
                    result: "SUCCESS"
                });
            } catch (e) {
                respondWithError("/public/orgunits/:nodeId/subtree", res, e);
            }
        }
    );

    router.delete(
        "/public/orgunits/:nodeId",
        MUST_BE_ADMIN,
        async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                await orgQueryer.deleteNode(nodeId);
                res.status(200).json(true);
            } catch (e) {
                respondWithError("DELETE /public/orgunits/:nodeId", res, e);
            }
        }
    );

    router.put(
        "/public/orgunits/:nodeId/move/:newParentId",
        MUST_BE_ADMIN,
        async (req, res) => {
            try {
                const nodeId = req.params.nodeId;
                const newParentId = req.params.newParentId;
                await orgQueryer.moveSubTreeTo(nodeId, newParentId);
                res.status(200).json(true);
            } catch (e) {
                res.status(500).send(`Error: ${e}`);
            }
        }
    );

    /**
     * @apiGroup Auth
     * @api {post} /public/opa/extra/input
     * @apiDescription Admin users add extra input for OPA query.
     *
     * @apiParamExample (Body) {json}:
     *     {
     *       id: "nsw-portal"
     *       data: {"last crawl expiration": 1573760909442}
     *     }
     *
     * @apiSuccessExample 200
     *     {
     *     }
     *
     * @apiErrorExample {json} 400/500
     *    {
     *      "isError": true,
     *      "errorCode": 400, //--- or 500 depends on error type
     *      "errorMessage": "Bad request"
     *    }
     */
    router.post("/private/opa/extra/input", MUST_BE_ADMIN, async (req, res) => {
        try {
            const id = req.body.id;
            const data = req.body.data;
            const ok = await database.updateExtraInput(
                req,
                options.jwtSecret,
                id,
                data
            );
            const statusCode = ok ? 200 : 400;
            res.status(statusCode);
        } catch (e) {
            respondWithError("/private/opa/extra/input", res, e);
        }
        res.end();
    });

    // This is for getting a JWT in development so you can do fake authenticated requests to a local server.
    if (process.env.NODE_ENV !== "production") {
        router.get("public/jwt", function(req, res) {
            res.status(200);
            res.write("X-Magda-Session: " + req.header("X-Magda-Session"));
            res.send();
        });
    }

    return router;
}
