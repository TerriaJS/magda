import _ from "lodash";
import {} from "mocha";
import { expect } from "chai";
import express from "express";
import sinon from "sinon";
import nock from "nock";
import jsc from "magda-typescript-common/src/test/jsverify";
import * as helpers from "./helpers";
import request from "supertest";

import buildApiRouter from "../buildApiRouter";
import { stateArb } from "./arbitraries";

describe("admin api router", function(this: Mocha.ISuiteCallbackContext) {
    this.timeout(10000);
    const namespace = "THISISANAMESPACE";
    let app: express.Express;
    let k8sApiScope: nock.Scope;
    const jwtSecret = "secret";

    const beforeEachInner = () => {
        k8sApiScope = nock("https://kubernetes.example.com");
        app = buildExpressApp();
    };

    beforeEach(beforeEachInner);

    const afterEachInner = () => {
        k8sApiScope.done();
        nock.cleanAll();
    };

    afterEach(afterEachInner);

    describe("GET /connectors", () => {
        it("should show information about everything recorded in the connector-config map, along with associated jobs if they exist", () => {
            return jsc.assert(
                jsc.forall(stateArb, state => {
                    beforeEachInner();
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        state
                    );
                    helpers.mockJobs(k8sApiScope, 200, namespace, state);

                    return helpers
                        .getConnectors(app, jwtSecret)
                        .then(res => {
                            expect(res.status).to.equal(200);

                            const withConfig = _.filter(
                                state,
                                (value, key) => !_.isUndefined(value.config)
                            );

                            expect(res.body.length).to.equal(withConfig.length);

                            res.body.forEach((connectorRes: any) => {
                                const id = connectorRes.id;

                                const correspondingState = state[id];
                                expect(correspondingState).not.to.be.undefined;

                                expect(connectorRes.name).to.equal(
                                    correspondingState.config.name
                                );
                                expect(connectorRes.sourceUrl).to.equal(
                                    correspondingState.config.sourceUrl
                                );
                                expect(connectorRes.type).to.equal(
                                    correspondingState.config.type
                                );

                                expect(
                                    _.isUndefined(connectorRes.job)
                                ).to.equal(
                                    _.isUndefined(correspondingState.job)
                                );

                                if (!_.isUndefined(correspondingState.job)) {
                                    expect(connectorRes.job.name).to.equal(
                                        `connector-${id}`
                                    );
                                    expect(
                                        connectorRes.job.completionTime
                                    ).to.equal(
                                        correspondingState.job.completionTime
                                    );
                                    expect(connectorRes.job.startTime).to.equal(
                                        correspondingState.job.startTime
                                    );
                                }
                            });

                            afterEachInner();
                        })
                        .then(() => true)
                        .catch(e => {
                            console.error(e);
                            afterEachInner();
                            throw e;
                        });
                })
            );
        });

        describe("should display status", () => {
            ["active", "failed", "succeeded"].forEach(status =>
                it(`${status} when ${status}`, () => {
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        helpers.getStateForStatus(status)
                    );
                    helpers.mockJobs(
                        k8sApiScope,
                        200,
                        namespace,
                        helpers.getStateForStatus(status)
                    );
                    return assertStatus(status);
                })
            );

            ["", "blah", null].forEach(status =>
                it(`inactive for '${status}'`, () => {
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        helpers.getStateForStatus(status)
                    );
                    helpers.mockJobs(
                        k8sApiScope,
                        200,
                        namespace,
                        helpers.getStateForStatus(status)
                    );
                    return assertStatus("inactive");
                })
            );

            function assertStatus(status: string) {
                return helpers.getConnectors(app, jwtSecret).then(res => {
                    expect(res.body[0].job.status).to.equal(status);
                });
            }
        });

        silenceErrorLogs(() => {
            describe("should reply 401 for", () => {
                it("an unauthenticated user", () => {
                    return request(app)
                        .get("/connectors")
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });

                it("an authenticated user who isn't an admin", () => {
                    return helpers
                        .getConnectors(app, jwtSecret, false)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });
            });

            describe("should return 500 for", () => {
                const state = helpers.getBasicState();

                it("a failure to get jobs", () => {
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        state
                    );
                    helpers.mockJobs(k8sApiScope, 500, namespace);
                });

                it("a failure to get connector config", () => {
                    helpers.mockConnectorConfig(k8sApiScope, 500, namespace);
                    helpers.mockJobs(k8sApiScope, 200, namespace, state);
                });

                it("a failure to get both", () => {
                    helpers.mockConnectorConfig(k8sApiScope, 500, namespace);
                    helpers.mockJobs(k8sApiScope, 500, namespace);
                });

                afterEach(() => {
                    return helpers.getConnectors(app, jwtSecret).then(res => {
                        expect(res.status).to.equal(500);
                    });
                });
            });
        });
    });

    describe("PUT /connectors/:id", () => {
        const name = "test";

        const connectorConfig = {
            who: "cares"
        };

        it("should put a new entry in the k8s connector-config configmap", () => {
            const expectedConfigMap = {
                [`${name}.json`]: JSON.stringify(connectorConfig, null, 2)
            };

            k8sApiScope
                .patch(
                    `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                    {
                        data: expectedConfigMap
                    }
                )
                .reply(200, expectedConfigMap);

            return helpers
                .putConnector(app, name, connectorConfig, jwtSecret)
                .then(res => {
                    expect(res.status).to.equal(200);

                    k8sApiScope.done();
                });
        });

        silenceErrorLogs(() => {
            it("should return 500 if k8s call doesn't work", () => {
                k8sApiScope
                    .patch(
                        `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                        () => true
                    )
                    .reply(500, "Oh noes");

                return helpers
                    .putConnector(app, name, connectorConfig, jwtSecret)
                    .then(res => {
                        expect(res.status).to.equal(500);

                        k8sApiScope.done();
                    });
            });

            describe("should reply 401 for", () => {
                it("an unauthenticated user", () => {
                    return request(app)
                        .put(`/connectors/${name}`)
                        .send(connectorConfig)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });

                it("an authenticated user who isn't an admin", () => {
                    return helpers
                        .putConnector(
                            app,
                            name,
                            connectorConfig,
                            jwtSecret,
                            false
                        )
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });
            });
        });
    });

    describe("DELETE /connectors/:id", () => {
        const name = "test";

        describe("should remove the targeted entry from the connector-config configmap", () => {
            it("when the corresponding job isn't present", () => {
                const expectedConfigMap: any = {
                    [`${name}.json`]: null
                };

                k8sApiScope
                    .patch(
                        `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                        {
                            data: expectedConfigMap
                        }
                    )
                    .reply(200, expectedConfigMap);

                helpers.mockJobStatus(k8sApiScope, 404, name, namespace);

                return helpers
                    .deleteConnector(app, name, jwtSecret)
                    .then(res => {
                        expect(res.status).to.equal(200);

                        k8sApiScope.done();
                    });
            });

            it("when the corresponding job is present, and delete the corresponding job first", () => {
                const expectedConfigMap: any = {
                    [`${name}.json`]: null
                };

                helpers.mockJobStatus(
                    k8sApiScope,
                    200,
                    name,
                    namespace,
                    helpers.getBasicState(name)
                );
                helpers.mockDeleteJob(k8sApiScope, 200, name, namespace);
                k8sApiScope
                    .patch(
                        `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                        {
                            data: expectedConfigMap
                        }
                    )
                    .reply(200, expectedConfigMap);

                return helpers
                    .deleteConnector(app, name, jwtSecret)
                    .then(res => {
                        expect(res.status).to.equal(200);

                        k8sApiScope.done();
                    });
            });
        });

        silenceErrorLogs(() => {
            describe("should return 500", () => {
                it("when patch config map call doesn't work", () => {
                    helpers.mockJobStatus(k8sApiScope, 404, name, namespace);
                    k8sApiScope
                        .patch(
                            `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                            () => true
                        )
                        .reply(500, "Oh noes");

                    return helpers
                        .deleteConnector(app, name, jwtSecret)
                        .then(res => {
                            expect(res.status).to.equal(500);

                            k8sApiScope.done();
                        });
                });

                it("when get jobs status call doesn't work", () => {
                    helpers.mockJobStatus(k8sApiScope, 500, name, namespace);
                    k8sApiScope
                        .patch(
                            `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                            () => true
                        )
                        .optionally()
                        .reply(200, {});

                    return helpers
                        .deleteConnector(app, name, jwtSecret)
                        .then(res => {
                            expect(res.status).to.equal(500);
                            k8sApiScope.done();
                        });
                });

                it("when delete job call doesn't work", () => {
                    helpers.mockJobStatus(
                        k8sApiScope,
                        200,
                        name,
                        namespace,
                        helpers.getBasicState(name)
                    );
                    helpers.mockDeleteJob(k8sApiScope, 500, name, namespace);
                    k8sApiScope
                        .patch(
                            `/api/v1/namespaces/${namespace}/configmaps/connector-config`,
                            () => true
                        )
                        .optionally()
                        .reply(200, {});

                    return helpers
                        .deleteConnector(app, name, jwtSecret)
                        .then(res => {
                            expect(res.status).to.equal(500);

                            k8sApiScope.done();
                        });
                });
            });

            describe("should reply 401 for", () => {
                it("an unauthenticated user", () => {
                    return request(app)
                        .delete(`/connectors/${name}`)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });

                it("an authenticated user who isn't an admin", () => {
                    return helpers
                        .deleteConnector(app, name, jwtSecret, false)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });
            });
        });
    });

    describe("POST /connectors/:id/start", () => {
        const name = "test";

        it("should create a new job with values in the config map", () => {
            const tag = "latest";
            const app = buildExpressApp(tag);
            const connectorState = helpers.getStateForStatus("active", name);
            helpers.mockJobStatus(k8sApiScope, 404, name, namespace);
            helpers.mockConnectorConfig(
                k8sApiScope,
                200,
                namespace,
                connectorState
            );
            helpers.mockCreateJob(k8sApiScope, 200, namespace, (body: any) => {
                const metadataMatch = (metadata: any) =>
                    metadata.name === `connector-${name}` &&
                    metadata.magdaMinion === true;

                const jobMetadataMatches = metadataMatch(body.metadata);
                const podMetadataMatches = metadataMatch(
                    body.spec.template.metadata
                );

                const container = body.spec.template.spec.containers[0];
                const imageMatches =
                    container.image === `dockerRepo/type:${tag}`;
                const commandMatches =
                    container.command[5] === "http://registry.example.com";
                const pullPolicyMatches =
                    container.imagePullPolicy === "pullPolicy";

                const configMountMatches =
                    body.spec.template.spec.volumes[0].configMap.items[0]
                        .key === `${name}.json`;

                return (
                    jobMetadataMatches &&
                    podMetadataMatches &&
                    imageMatches &&
                    commandMatches &&
                    pullPolicyMatches &&
                    configMountMatches
                );
            });

            return helpers
                .startConnector(app, name, jwtSecret, true)
                .then(res => {
                    expect(res.status).to.equal(200);
                });
        });

        it("should delete an existing job if one exists", () => {
            const connectorState = helpers.getStateForStatus("active", name);
            helpers.mockJobStatus(
                k8sApiScope,
                200,
                name,
                namespace,
                helpers.getBasicState(name)
            );
            helpers.mockDeleteJob(k8sApiScope, 200, name, namespace);
            helpers.mockConnectorConfig(
                k8sApiScope,
                200,
                namespace,
                connectorState
            );
            helpers.mockCreateJob(k8sApiScope, 200, namespace);
            return helpers
                .startConnector(app, name, jwtSecret, true)
                .then(res => {
                    expect(res.status).to.equal(200);
                });
        });

        silenceErrorLogs(() => {
            describe("should return 500", () => {
                it("if getting existing job status fails", () => {
                    helpers.mockJobStatus(k8sApiScope, 500, name, namespace);
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        helpers.getStateForStatus("active", name),
                        true
                    );
                    helpers.mockCreateJob(
                        k8sApiScope,
                        200,
                        namespace,
                        () => true,
                        true
                    );

                    return helpers
                        .startConnector(app, name, jwtSecret, true)
                        .then(res => {
                            expect(res.status).to.equal(500);
                        });
                });

                it("if getting connector config fails", () => {
                    helpers.mockJobStatus(k8sApiScope, 404, name, namespace);
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        500,
                        namespace,
                        null
                    );
                    helpers.mockCreateJob(
                        k8sApiScope,
                        200,
                        namespace,
                        () => true,
                        true
                    );

                    return helpers
                        .startConnector(app, name, jwtSecret, true)
                        .then(res => {
                            expect(res.status).to.equal(500);
                        });
                });

                it("if deleting existing job fails", () => {
                    const connectorState = helpers.getStateForStatus(
                        "active",
                        name
                    );
                    helpers.mockJobStatus(
                        k8sApiScope,
                        200,
                        name,
                        namespace,
                        connectorState
                    );
                    helpers.mockDeleteJob(k8sApiScope, 500, name, namespace);
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        connectorState,
                        true
                    );
                    helpers.mockCreateJob(
                        k8sApiScope,
                        200,
                        namespace,
                        () => true,
                        true
                    );

                    return helpers
                        .startConnector(app, name, jwtSecret, true)
                        .then(res => {
                            expect(res.status).to.equal(500);
                        });
                });

                it("if creating existing job fails", () => {
                    const connectorState = helpers.getStateForStatus(
                        "active",
                        name
                    );
                    helpers.mockJobStatus(
                        k8sApiScope,
                        200,
                        name,
                        namespace,
                        connectorState
                    );
                    helpers.mockDeleteJob(k8sApiScope, 200, name, namespace);
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        connectorState
                    );
                    helpers.mockCreateJob(
                        k8sApiScope,
                        500,
                        namespace,
                        () => true
                    );

                    return helpers
                        .startConnector(app, name, jwtSecret, true)
                        .then(res => {
                            expect(res.status).to.equal(500);
                        });
                });
            });

            describe("should reply 404 for", () => {
                it("no config available for passed id", () => {
                    const connectorState = helpers.getStateForStatus(
                        "active",
                        "otherJob"
                    );
                    helpers.mockJobStatus(k8sApiScope, 404, name, namespace);
                    helpers.mockConnectorConfig(
                        k8sApiScope,
                        200,
                        namespace,
                        connectorState
                    );
                    helpers.mockCreateJob(
                        k8sApiScope,
                        200,
                        namespace,
                        () => true,
                        true
                    );

                    return helpers
                        .startConnector(app, name, jwtSecret, true)
                        .then(res => {
                            expect(res.status).to.equal(404);
                        });
                });
            });

            describe("should reply 401 for", () => {
                it("an unauthenticated user", () => {
                    return request(app)
                        .post(`/connectors/${name}/start`)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });

                it("an authenticated user who isn't an admin", () => {
                    return helpers
                        .startConnector(app, name, jwtSecret, false)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });
            });
        });
    });

    describe("POST /connectors/:id/stop", () => {
        const name = "test";

        it("should stop a currently running job", () => {
            helpers.mockDeleteJob(k8sApiScope, 200, name, namespace);

            return helpers.stopConnector(app, name, jwtSecret).then(res => {
                expect(res.status).to.equal(204);
            });
        });

        silenceErrorLogs(() => {
            it("should return 404 for a non-running job", () => {
                helpers.mockDeleteJob(k8sApiScope, 404, name, namespace);

                return helpers.stopConnector(app, name, jwtSecret).then(res => {
                    expect(res.status).to.equal(404);
                });
            });

            it("should return 500 if the kubernetes delete job fails", () => {
                helpers.mockDeleteJob(k8sApiScope, 500, name, namespace);

                return helpers.stopConnector(app, name, jwtSecret).then(res => {
                    expect(res.status).to.equal(500);
                });
            });

            describe("should reply 401 for", () => {
                it("an unauthenticated user", () => {
                    return request(app)
                        .post(`/connectors/${name}/stop`)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });

                it("an authenticated user who isn't an admin", () => {
                    return helpers
                        .stopConnector(app, name, jwtSecret, false)
                        .then(res => {
                            expect(res.status).to.equal(401);
                        });
                });
            });
        });
    });

    function silenceErrorLogs(inner: () => void) {
        describe("(with silent console.error or console.warn)", () => {
            beforeEach(() => {
                sinon.stub(console, "error").callsFake(() => {});
                sinon.stub(console, "warn").callsFake(() => {});
            });

            afterEach(() => {
                (console.error as any).restore();
                (console.warn as any).restore();
            });

            inner();
        });
    }

    function buildExpressApp(imageTag: string = "imageTag") {
        const apiRouter = buildApiRouter({
            dockerRepo: "dockerRepo",
            authApiUrl: "http://admin.example.com",
            imageTag,
            kubernetesApiType: "test",
            registryApiUrl: "http://registry.example.com",
            pullPolicy: "pullPolicy",
            namespace,
            jwtSecret: "secret",
            userId: "user",
            tenantId: 0
        });

        const app = express();
        app.use(require("body-parser").json());
        app.use(apiRouter);

        return app;
    }
});
