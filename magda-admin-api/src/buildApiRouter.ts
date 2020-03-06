import express from "express";
import buildConnectorManifest from "./buildConnectorManifest";
import buildInteractiveConnectorRouter from "./buildInteractiveConnectorRouter";
import _ from "lodash";
import K8SApi, { K8SApiType } from "./k8sApi";
import { mustBeAdmin } from "magda-typescript-common/src/authorization-api/authMiddleware";

import {
    installStatusRouter,
    createServiceProbe
} from "magda-typescript-common/src/express/status";

export interface Options {
    dockerRepo: string;
    authApiUrl: string;
    imageTag: string;
    kubernetesApiType: K8SApiType;
    registryApiUrl: string;
    pullPolicy: string;
    jwtSecret: string;
    userId: string;
    tenantId: number;
    namespace?: string;
}

export default function buildApiRouter(options: Options) {
    const router: express.Router = express.Router();
    const prefixId = (id: string) => `connector-${id}`;

    const k8sApi = new K8SApi(options.kubernetesApiType, options.namespace);

    const status = {
        probes: {
            k8s: async () => {
                await k8sApi.getJobs();
                return {
                    ready: true
                };
            },
            auth: createServiceProbe(options.authApiUrl)
        }
    };
    installStatusRouter(router, status);

    router.use(mustBeAdmin(options.authApiUrl, options.jwtSecret));

    router.get("/connectors", (req, res) => {
        Promise.all([k8sApi.getConnectorConfigMap(), k8sApi.getJobs()])
            .then(([connectorConfigMap, jobs]: [any, any]) => {
                const connectorStatus = _(jobs.items)
                    .map((item: any) => ({
                        name: item.metadata.name,
                        status: (() => {
                            if (item.status.active === 1) {
                                return "active";
                            } else if (item.status.succeeded === 1) {
                                return "succeeded";
                            } else if (item.status.failed === 1) {
                                return "failed";
                            } else {
                                return "inactive";
                            }
                        })(),
                        startTime: item.status.startTime,
                        completionTime: item.status.completionTime
                    }))
                    .keyBy((item: any) => item.name.slice("connector-".length))
                    .value();

                const result = _.map(
                    connectorConfigMap,
                    (connector: any, key: string) => {
                        return {
                            ...connector,
                            id: key,
                            job: connectorStatus[key]
                        };
                    }
                );

                res.status(200).send(result);
            })
            .catch((err: Error) => {
                console.error(err);
                res.status(500).send("Error");
            });
    });

    router.get("/connectors/:id", (req, res) => {
        Promise.all([
            k8sApi.getConnectorConfigMap(),
            k8sApi.getJob(prefixId(req.params.id))
        ])
            .then(([connectorConfigMap, job]: [any, any]) => {
                const connectorStatus = {
                    name: job.metadata.name,
                    status: (() => {
                        if (job.status.active === 1) {
                            return "active";
                        } else if (job.status.succeeded === 1) {
                            return "succeeded";
                        } else if (job.status.failed === 1) {
                            return "failed";
                        } else {
                            return "inactive";
                        }
                    })(),
                    startTime: job.status.startTime,
                    completionTime: job.status.completionTime
                };

                const result = {
                    ...connectorConfigMap[req.params.id],
                    id: req.params.id,
                    job: connectorStatus
                };

                res.status(200).send(result);
            })
            .catch((err: Error) => {
                console.error(err);
                res.status(500).send("Error");
            });
    });

    router.put("/connectors/:id", (req, res) => {
        const id = req.params.id;

        k8sApi
            .updateConnectorConfigMap(id, req.body)
            .then((result: any) => res.status(200).send(result))
            .catch((error: Error) => {
                console.error(error);
                res.status(500).send("Error");
            });
    });

    router.delete("/connectors/:id", (req, res) => {
        const id = req.params.id;

        k8sApi
            .deleteJobIfPresent(prefixId(id))
            .then(() => k8sApi.updateConnectorConfigMap(id, null))
            .then((result: any) => res.status(200).send(result))
            .catch((error: Error) => {
                console.error(error);
                res.status(500).send("Error");
            });
    });

    router.post("/connectors/:id/start", (req, res) => {
        const id = req.params.id;

        k8sApi
            .deleteJobIfPresent(prefixId(id))
            .then(() => k8sApi.getConnectorConfigMap())
            .then((configMap: any) => {
                if (!configMap[id]) {
                    res.status(404).send("No config for connector id");
                    return undefined;
                } else {
                    return k8sApi
                        .createJob(
                            buildConnectorManifest({
                                id,
                                dockerImage:
                                    configMap[id].type ||
                                    (configMap[id].image &&
                                        configMap[id].image.name),
                                dockerImageTag: options.imageTag,
                                dockerRepo: options.dockerRepo,
                                registryApiUrl: options.registryApiUrl,
                                pullPolicy: options.pullPolicy,
                                userId: options.userId,
                                tenantId: options.tenantId
                            })
                        )
                        .then((result: any) => {
                            res.status(200).send(result);
                        });
                }
            })
            .catch((err: Error) => {
                console.error(err);
                res.status(500).send("Error");
            });
    });

    router.post("/connectors/:id/stop", (req, res) => {
        const id = req.params.id;

        return k8sApi
            .deleteJob(prefixId(id))
            .then(() => {
                res.status(204).send();
            })
            .catch((err: Error) => {
                console.error(err);

                if ((err as any).code === 404) {
                    res.status(404).send("No running connector " + id);
                } else {
                    res.status(500).send("Error");
                }
            });
    });

    function addConnectorID(req: any, res: any, next: any) {
        req.connectorID = req.params.id;
        next();
    }

    router.use(
        "/connectors/:id/interactive",
        addConnectorID,
        buildInteractiveConnectorRouter({
            dockerRepo: options.dockerRepo,
            authApiUrl: options.authApiUrl,
            imageTag: options.imageTag,
            registryApiUrl: options.registryApiUrl,
            pullPolicy: options.pullPolicy,
            k8sApi,
            userId: options.userId,
            tenantId: options.tenantId
        })
    );

    return router;
}
