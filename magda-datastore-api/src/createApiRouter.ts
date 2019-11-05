import { ApiError } from "@google-cloud/common";
import {
    createServiceProbe,
    installStatusRouter
} from "@magda/typescript-common/dist/express/status";
import AuthorizedRegistryClient from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
import RegistryClient from "@magda/typescript-common/dist/registry/RegistryClient";
import buildJwt from "@magda/typescript-common/dist/session/buildJwt";
import { getUserId } from "@magda/typescript-common/dist/session/GetUserId";
import * as express from "express";
import ObjectStoreClient from "./ObjectStoreClient";

export interface ApiRouterOptions {
    authApiUrl: string;
    opaUrl: string;
    registryApiUrl: string;
    objectStoreClient: ObjectStoreClient;
    jwtSecret: string;
}

export default function createApiRouter(options: ApiRouterOptions) {
    const router: express.Router = express.Router();

    const status = {
        probes: {
            registry: createServiceProbe(options.registryApiUrl),
            objectStore: options.objectStoreClient.statusProbe
        }
    };
    installStatusRouter(router, status);

    router.get("/data/:recordid/*", async function(req, res) {
        // Pass through the user and tenant to the registry API
        let tenantId = Number.parseInt(req.header("X-Magda-Tenant-Id"), 10);
        if (Number.isNaN(tenantId)) {
            res.status(400).send("X-Magda-Tenant-Id header is required.");
            return;
        }

        const userId = getUserId(req, options.jwtSecret);
        const registry = userId.caseOf({
            just: userId =>
                new AuthorizedRegistryClient({
                    baseUrl: options.registryApiUrl,
                    tenantId: tenantId,
                    jwtSecret: options.jwtSecret,
                    userId: userId
                }),
            nothing: () =>
                new RegistryClient({
                    baseUrl: options.registryApiUrl,
                    tenantId: tenantId
                })
        });

        const recordId = req.params.recordid;
        const record = await registry.getRecord(recordId);
        if (!record || record instanceof Error || record.id === undefined) {
            res.status(404).send(
                "File does not exist or access is unauthorized."
            );
            return;
        }

        // This user has access to this record, so grant them access to
        // this record's files.
        const encodedRootPath = encodeURIComponent(recordId);
        const stream = options.objectStoreClient.getFile(
            encodedRootPath + "/" + req.params[0]
        );

        stream.on("error", e => {
            if (e instanceof ApiError) {
                if (e.code === 404) {
                    res.status(404).send(
                        "No such object for record ID " +
                            recordId +
                            ": " +
                            req.params[0]
                    );
                    return;
                }
            }
            res.status(500).send("Unknown error");
        });
        stream.pipe(res);
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
