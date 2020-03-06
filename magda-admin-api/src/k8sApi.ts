/// <reference types="./missing" />
require("util.promisify/shim")();
import Api from "kubernetes-client";
import fs from "fs";
import { promisify } from "util";
import _ from "lodash";
import path from "path";
import getMinikubeIP from "magda-typescript-common/src/util/getMinikubeIP";
// var request = require('request');
// require('request-debug')(request);

export type K8SApiType = "minikube" | "cluster" | "test";

export default class K8SApi {
    private batchApi: any;
    private coreApi: any;
    public readonly minikubeIP: string;

    constructor(
        public readonly apiType: K8SApiType,
        private namespace: string = "default"
    ) {
        const details = K8SApi.getDetails(apiType);
        this.batchApi = new Api.Batch(details);
        this.coreApi = new Api.Core(details);

        // minikubeIP will only be defined if apiType === "minikube".
        this.minikubeIP = details.minikubeIP;
    }

    getJobs(): Promise<any> {
        const jobs = this.batchApi.ns(this.namespace).jobs;
        return promisify(jobs.get.bind(jobs))();
    }

    getJob(id: string): Promise<any> {
        const jobs = this.batchApi.ns(this.namespace).jobs(id);
        return promisify(jobs.get.bind(jobs))();
    }

    getPodsWithSelector(selector: any): Promise<any> {
        const pods = this.coreApi.ns(this.namespace).pods.matchLabels(selector);
        return promisify(pods.get.bind(pods))();
    }

    getService(id: string): Promise<any> {
        const services = this.coreApi.ns(this.namespace).services(id);
        return promisify(services.get.bind(services))();
    }

    getJobStatus(id: string): Promise<any> {
        const jobs = this.batchApi.ns(this.namespace).jobs(id);
        return promisify(jobs.get.bind(jobs))({
            name: `status`
        });
    }

    createJob(body: any): Promise<any> {
        const jobs = this.batchApi.ns(this.namespace).jobs;
        return promisify(jobs.post.bind(jobs))({
            body
        });
    }

    createService(body: any): Promise<any> {
        const services = this.coreApi.ns(this.namespace).services;
        return promisify(services.post.bind(services))({
            body
        });
    }

    deleteJob(id: string) {
        const jobs = this.batchApi.ns(this.namespace).jobs;

        return promisify(jobs.delete.bind(jobs))({
            name: id,
            body: {
                kind: "DeleteOptions",
                apiVersion: "batch/v1",
                propagationPolicy: "Background"
            }
        });
    }

    deleteJobIfPresent(id: string) {
        return this.getJobStatus(id)
            .then((result: any) => {
                return this.deleteJob(id);
            })
            .catch(e => {
                if (e.code === 404) {
                    return Promise.resolve();
                } else {
                    throw e;
                }
            });
    }

    deleteService(id: string) {
        const services = this.coreApi.ns(this.namespace).services(id);

        return promisify(services.delete.bind(services))();
    }

    getConnectorConfigMap(): Promise<any> {
        const configmaps = this.coreApi.ns(this.namespace).configmaps;

        return promisify(configmaps.get.bind(configmaps))({
            name: "connector-config"
        }).then((result: any) =>
            _(result.data)
                .mapKeys((value: any, key: string) => {
                    return key.slice(0, key.length - 5);
                })
                .mapValues((value: string) => JSON.parse(value))
                .value()
        );
    }

    updateConnectorConfigMap(id: string, newConfig: any) {
        const configmaps = this.coreApi.ns(this.namespace).configmaps;

        return promisify(configmaps.patch.bind(configmaps))({
            name: "connector-config",
            body: {
                data: {
                    [`${id}.json`]:
                        newConfig && JSON.stringify(newConfig, null, 2)
                }
            }
        });
    }

    static getDetails(apiType: K8SApiType) {
        if (apiType === "minikube") {
            const minikubeIP = getMinikubeIP();

            const minikubePath = path.join(
                process.env[
                    process.platform === "win32" ? "USERPROFILE" : "HOME"
                ],
                ".minikube"
            );

            return {
                minikubeIP: minikubeIP,
                url: `https://${minikubeIP}:8443`,
                ca: fs.readFileSync(path.join(minikubePath, "ca.crt")),
                cert: fs.readFileSync(path.join(minikubePath, "apiserver.crt")),
                key: fs.readFileSync(path.join(minikubePath, "apiserver.key"))
            };
        } else if (apiType === "test") {
            return {
                url: "https://kubernetes.example.com"
            };
        } else {
            return Api.config.getInCluster();
        }
    }
}
