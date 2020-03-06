import "isomorphic-fetch";
import buildConnectorManifest from "./buildConnectorManifest";
import K8SApi from "./k8sApi";
import express from "express";
import HttpProxy from "http-proxy";

// Use type merging to add a connectorProxy property to Express's Request object.
declare global {
    namespace Express {
        export interface Request {
            connectorProxy: HttpProxy;
            connectorID: string;
        }
    }
}

export interface Options {
    dockerRepo: string;
    authApiUrl: string;
    imageTag: string;
    registryApiUrl: string;
    pullPolicy: string;
    k8sApi: K8SApi;
    userId: string;
    tenantId: number;
}

export default function buildInteractiveConnectorRouter(options: Options) {
    const k8sApi = options.k8sApi;

    const router: express.Router = express.Router();

    router.use(function(req, res, next) {
        ensureInteractiveConnector(k8sApi, req.connectorID, options)
            .then(function(connectorProxy) {
                req.connectorProxy = connectorProxy;
                next();
            })
            .catch(function(e) {
                res.status(400);
                res.send("Could not connect to Connector.");
            });
    });

    router.get("*", (req, res) => {
        req.connectorProxy.web(req, res);
    });

    return router;
}

const prefixId = (id: string) => `connector-interactive-${id}`;

async function createInteractiveJob(
    k8sApi: K8SApi,
    id: any,
    options: Options
): Promise<any> {
    await k8sApi.deleteJobIfPresent(prefixId(id));

    const configMap = await k8sApi.getConnectorConfigMap();
    if (!configMap[id]) {
        throw new Error("No config for connector ID: " + id);
    }

    return k8sApi.createJob(
        buildConnectorManifest({
            id,
            dockerImage: configMap[id].type,
            dockerImageTag: options.imageTag,
            dockerRepo: options.dockerRepo,
            registryApiUrl: options.registryApiUrl,
            pullPolicy: options.pullPolicy,
            userId: options.userId,
            tenantId: options.tenantId,
            interactive: true
        })
    );
}

function retryUntil<T>(
    op: () => Promise<T>,
    expirationTime: number,
    failureMessage: string
): Promise<T> {
    // This is carefully written to avoid using a bunch of memory even if op() fails really quickly.
    // Things that _won't_ work (they'll use a gig of memory after a few seconds of a
    // fast-failing `op`, at least as of node.js 8.9.0):
    // * Normal promise chaining, i.e. recurse in a catch and return the promise.
    // * This code but without the `setImmediate`. There's no stack overflow, but it will use heaps of memory.
    return new Promise<T>((resolve, reject) => {
        function tryIt() {
            op()
                .then(result => {
                    resolve(result);
                })
                .catch(e => {
                    if (Date.now() < expirationTime) {
                        setImmediate(tryIt);
                    } else {
                        reject(new Error(failureMessage));
                    }
                });
        }

        tryIt();
    });
}

function retryForTime<T>(
    op: () => Promise<T>,
    maxMilliseconds: number,
    failureMessage: string
) {
    const timeLimit = Date.now() + maxMilliseconds;
    return retryUntil(op, timeLimit, failureMessage);
}

function ensureInteractiveConnector(
    k8sApi: K8SApi,
    id: any,
    options: Options
): Promise<HttpProxy> {
    return retryForTime(
        () => ensureInteractiveConnectorOnce(k8sApi, id, options),
        10000,
        "Could not create interactive connector: " + id
    );
}

async function ensureInteractiveConnectorOnce(
    k8sApi: K8SApi,
    id: any,
    options: Options
): Promise<HttpProxy> {
    let job = await k8sApi.getJob(prefixId(id)).catch(e => undefined);

    // A usable interactive job will have job.status.active===1.  If the job is not usable, we need to
    // distinguish between "already completed" and "not yet started".
    if (
        job === undefined ||
        (job.status !== undefined && job.status.succeeded === 1)
    ) {
        // No job or it's already completed - restart the job.
        job = await createInteractiveJob(k8sApi, id, options);
    }

    if (
        job === undefined ||
        job.status === undefined ||
        job.status.active === undefined ||
        job.status.active < 1
    ) {
        throw new Error("Could not create interactive connector: " + id);
    }

    let connectorUrl: string;
    if (k8sApi.apiType === "minikube") {
        // The Admin API is running outside the cluster.
        // We need a Service with a nodePort in order to be able to call into the connector
        // running inside the cluster.

        let service = await k8sApi
            .getService(prefixId(id))
            .catch(e => undefined);
        if (service === undefined) {
            // Service does not exist, create it.

            // We're letting k8s assign a nodePort automatically, since we
            // don't care what it is.  The risk is that it will pick a port that
            // we've explicitly allocated to other pods, those pods will not have started
            // yet when this code runs, and later when they do start they will fail
            // because this service is already bound to their port.  This seems
            // like a fairly remote possibility, and it will only happen in development
            // (never in anything resembling a real deployment), so ¯\_(ツ)_/¯.
            service = await k8sApi.createService({
                apiVersion: "v1",
                kind: "Service",
                metadata: {
                    name: prefixId(id)
                },
                spec: {
                    ports: [
                        {
                            name: "http",
                            port: 80,
                            targetPort: 80
                        }
                    ],
                    type: "NodePort",
                    selector: job.spec.selector.matchLabels
                }
            });
        } else if (
            JSON.stringify(service.spec.selector) !==
            JSON.stringify(job.spec.selector.matchLabels)
        ) {
            // We already have a service, but it's not using the right selector,
            // so we need to recreate it.  Delete it and throw to trigger a retry.
            console.log("bad selector");
            await k8sApi.deleteService(prefixId(id));
            throw new Error(
                "Service exists but has an incorrect selector for interactive connector: " +
                    id
            );
        }

        // Wait a second for Kubernetes to get its act together on this new Service.
        // Without this, the connection attempt below will often hang.
        // See https://github.com/kubernetes/kubernetes/issues/48719
        await new Promise((resolve, reject) => {
            setTimeout(resolve, 1000);
        });

        connectorUrl = `http://${k8sApi.minikubeIP}:${
            service.spec.ports[0].nodePort
        }/v0`;
    } else {
        // The Admin API is running inside the cluster.
        // We just need the IP address of the pod and we can talk to it directly.
        const pods = await k8sApi.getPodsWithSelector(
            job.spec.selector.matchLabels
        );
        const podsWithIP = pods.items.filter(
            (pod: any) => pod.status && pod.status.podIP
        );

        if (podsWithIP.length === 0) {
            throw new Error(
                "Could not find a pod with an IP address for interactive connector: " +
                    id
            );
        }

        const ip = podsWithIP[0].status.podIP;
        connectorUrl = `http://${ip}/v0`;
        console.log(connectorUrl);
    }

    // Access the interactive connector's /status service.
    // This does two things:
    // 1. It makes sure the interactive connector is running.
    // 2. It resets the timeout, guaranteeing that the connector won't shut itself down
    //    before our real request comes through (assuming that the timeout is much longer
    //    than any reasonable single request).
    const status = await fetch(connectorUrl + "/status");
    if (!status.ok) {
        // The job exists and appears to be running, but it's not responding correctly.
        // The most likely cause is that it just timed out and shut down. If that's the
        // case, throwing here should start another iteration that will detect and fix that.
        throw new Error(
            "Could not create a working interactive connector: " + id
        );
    }

    const proxy = HttpProxy.createProxyServer({
        target: connectorUrl
    });

    return proxy;
}
