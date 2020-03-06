import _ from "lodash";

export const getJobs = (jobs: {
    [jobName: string]: {
        startTime: string;
        completionTime: string;
        status: string;
    };
}) => ({
    kind: "JobList",
    apiVersion: "batch/v1",
    metadata: {
        selfLink: "/apis/batch/v1/namespaces/default/jobs",
        resourceVersion: "666055"
    },
    items: _.map(jobs, (value, key) => {
        const id = `connector-${key}`;

        return {
            metadata: {
                name: id,
                namespace: "default",
                selfLink: `/apis/batch/v1/namespaces/default/jobs/${id}`,
                uid: "fd4dc85e-8ee1-11e7-9b8d-08002786fecd",
                resourceVersion: "631553",
                creationTimestamp: "2017-09-01T06:51:32Z",
                labels: {
                    "controller-uid": "fd4dc85e-8ee1-11e7-9b8d-08002786fecd",
                    "job-name": id
                }
            },
            spec: {
                parallelism: 1,
                completions: 1,
                selector: {
                    matchLabels: {
                        "controller-uid": "fd4dc85e-8ee1-11e7-9b8d-08002786fecd"
                    }
                },
                template: {
                    metadata: {
                        name: id,
                        creationTimestamp: null as any,
                        labels: {
                            "controller-uid":
                                "fd4dc85e-8ee1-11e7-9b8d-08002786fecd",
                            "job-name": id
                        }
                    },
                    spec: {
                        volumes: [
                            {
                                name: "config",
                                configMap: {
                                    name: "connector-config",
                                    items: [
                                        {
                                            key: "test.json",
                                            path: "connector.json"
                                        }
                                    ],
                                    defaultMode: 420
                                }
                            }
                        ],
                        containers: [
                            {
                                name: id,
                                image:
                                    "localhost:5000/data61/magda-csw-connector:latest",
                                command: [
                                    "node",
                                    "/usr/src/app/component/dist/index.js",
                                    "--config",
                                    "/etc/config/connector.json",
                                    "--registryUrl",
                                    "http://registry-api/v0"
                                ],
                                resources: {
                                    requests: {
                                        cpu: "0"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        name: "config",
                                        mountPath: "/etc/config"
                                    }
                                ],
                                terminationMessagePath: "/dev/termination-log",
                                terminationMessagePolicy: "File",
                                imagePullPolicy: "Always"
                            }
                        ],
                        restartPolicy: "OnFailure",
                        terminationGracePeriodSeconds: 30,
                        dnsPolicy: "ClusterFirst",
                        securityContext: {},
                        schedulerName: "default-scheduler"
                    }
                }
            },
            status: {
                conditions: [
                    {
                        status: "True",
                        lastProbeTime: "2017-09-04T00:05:27Z",
                        lastTransitionTime: "2017-09-04T00:05:27Z"
                    }
                ],
                startTime: value.startTime,
                completionTime: value.completionTime,
                [value.status]: 1
            }
        };
    })
});

type CrawlerConfig = { type: string; name: string; sourceUrl: string };
export const getConfigMap = (configs: { [name: string]: CrawlerConfig }) => ({
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
        name: "connector-config",
        namespace: "default",
        selfLink: "/api/v1/namespaces/default/configmaps/connector-config",
        uid: "50d08206-8967-11e7-9936-08002786fecd",
        resourceVersion: "609747",
        creationTimestamp: "2017-08-25T07:30:48Z"
    },
    data: _(configs)
        .mapKeys((value: CrawlerConfig, key: string) => key + ".json")
        .mapValues((value: CrawlerConfig, key) => JSON.stringify(value))
        .value()
});
