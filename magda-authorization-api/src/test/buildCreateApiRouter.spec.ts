import {} from "mocha";
import sinon from "sinon";
import request from "supertest";
import express from "express";
import addJwtSecretFromEnvVar from "magda-typescript-common/src/session/addJwtSecretFromEnvVar";
import { MAGDA_ADMIN_PORTAL_ID } from "magda-typescript-common/src/registry/TenantConsts";
import buildJwt from "magda-typescript-common/src/session/buildJwt";
import fakeArgv from "magda-typescript-common/src/test/fakeArgv";
import createApiRouter from "../createApiRouter";
import { expect } from "chai";
import jsc from "magda-typescript-common/src/test/jsverify";
import mockDatabase from "./mockDatabase";
import mockUserDataStore from "magda-typescript-common/src/test/mockUserDataStore";
import Database from "../Database";
import { userDataArb } from "./arbitraries";
import { Request } from "supertest";

describe("Auth api router", function(this: Mocha.ISuiteCallbackContext) {
    this.timeout(10000);

    let app: express.Express;
    let argv: any;

    before(function() {
        argv = retrieveArgv();
        app = buildExpressApp();
    });

    afterEach(function() {
        mockUserDataStore.reset();
    });

    function retrieveArgv() {
        const argv = addJwtSecretFromEnvVar(
            fakeArgv({
                listenPort: 6014,
                dbHost: "localhost",
                dbPort: 5432,
                jwtSecret: "squirrel"
            })
        );
        return argv;
    }

    function buildExpressApp() {
        const apiRouter = createApiRouter({
            jwtSecret: argv.jwtSecret,
            database: new mockDatabase() as Database,
            opaUrl: process.env["OPA_URL"]
                ? process.env["OPA_URL"]
                : "http://localhost:8181/",
            registryApiUrl: process.env["REGISTRY_API_URL"]
                ? process.env["REGISTRY_API_URL"]
                : "http://localhost:6101/v0",
            tenantId: MAGDA_ADMIN_PORTAL_ID
        });

        const app = express();
        app.use(require("body-parser").json());
        app.use(apiRouter);

        return app;
    }

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

    function setMockRequestSession(req: Request, userId: string) {
        return req.set("X-Magda-Session", buildJwt(argv.jwtSecret, userId));
    }

    describe("POST /private/users", () => {
        silenceErrorLogs(() => {
            it("should return 401 status code without creating a new user if called without sepecifying user ID", async () => {
                const currentMockUserStoreSize = mockUserDataStore.countRecord();

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const req = request(app)
                                .post("/private/users")
                                .send(userData);

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(401);
                            expect(mockUserDataStore.countRecord()).to.equal(
                                currentMockUserStoreSize
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return 403 status code without creating a new user if called as a standard user", async () => {
                const currentMockUserStoreSize = mockUserDataStore.countRecord();
                const standardUserId = mockUserDataStore.getRecordByIndex(1).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const req = request(app)
                                .post("/private/users")
                                .send(userData);

                            setMockRequestSession(req, standardUserId);

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(403);
                            expect(mockUserDataStore.countRecord()).to.equal(
                                currentMockUserStoreSize
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should create a new user if called as an admin user", async () => {
                const adminUserId = mockUserDataStore.getRecordByIndex(0).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();

                            const req = request(app)
                                .post("/private/users")
                                .send(userData);

                            setMockRequestSession(req, adminUserId);

                            const res = await req.then(res => res);
                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");

                            const newUserId: string = res.body.id;
                            expect(res.body).to.deep.equal({
                                ...userData,
                                id: res.body.id
                            });

                            const users = mockUserDataStore.getRecordByUserId(
                                newUserId
                            );
                            expect(users).to.be.an("array").that.is.not.empty;
                            expect(users[0]).to.deep.include(userData);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });
        });
    });

    describe("GET /private/users/lookup", () => {
        silenceErrorLogs(() => {
            it("should return 401 status code if requested without sepecifying user ID", async () => {
                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            mockUserDataStore.createRecord(userData);

                            const { source, sourceId } = userData;
                            const req = request(app)
                                .get("/private/users/lookup")
                                .query({
                                    source,
                                    sourceId
                                });

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(401);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return 403 status code if requested as a standard user", async () => {
                const standardUserId = mockUserDataStore.getRecordByIndex(1).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            mockUserDataStore.createRecord(userData);

                            const { source, sourceId } = userData;
                            const req = request(app)
                                .get("/private/users/lookup")
                                .query({
                                    source,
                                    sourceId
                                });
                            setMockRequestSession(req, standardUserId);
                            const res = await req.then(res => res);

                            expect(res.status).to.equal(403);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return correct user data if queried by `source` & `sourceID` and requested as an admin user", async () => {
                const adminUserId = mockUserDataStore.getRecordByIndex(0).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            mockUserDataStore.createRecord(userData);

                            const { source, sourceId } = userData;
                            const req = request(app)
                                .get("/private/users/lookup")
                                .query({
                                    source,
                                    sourceId
                                });

                            setMockRequestSession(req, adminUserId);

                            const res = await req.then(res => res);
                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");
                            expect(res.body).to.deep.include(userData);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });
        });
    });

    describe("GET /private/users/:userId", () => {
        silenceErrorLogs(() => {
            it("should return 401 status code if requested without sepecifying user ID", async () => {
                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);
                            const req = request(app).get(
                                `/private/users/${userId}`
                            );

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(401);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return 403 status code if requested as a standard user", async () => {
                const standardUserId = mockUserDataStore.getRecordByIndex(1).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/private/users/${userId}`
                            );
                            setMockRequestSession(req, standardUserId);
                            const res = await req.then(res => res);

                            expect(res.status).to.equal(403);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return correct user data if queried by `userId` and requested as an admin user", async () => {
                const adminUserId = mockUserDataStore.getRecordByIndex(0).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/private/users/${userId}`
                            );

                            setMockRequestSession(req, adminUserId);

                            const res = await req.then(res => res);
                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");
                            expect({ id: userId, ...userData }).to.deep.include(
                                res.body
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });
        });
    });

    describe("GET /public/users/:userId", () => {
        silenceErrorLogs(() => {
            it("should return correct user data if queried by `userId` without sepecifying user ID", async () => {
                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/public/users/${userId}`
                            );

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");
                            expect({ id: userId, ...userData }).to.deep.include(
                                res.body
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return correct user data if queried by `userId` and requested as a standard user", async () => {
                const standardUserId = mockUserDataStore.getRecordByIndex(1).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/public/users/${userId}`
                            );
                            setMockRequestSession(req, standardUserId);
                            const res = await req.then(res => res);

                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");
                            expect({ id: userId, ...userData }).to.deep.include(
                                res.body
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return correct user data if queried by `userId` and requested as an admin user", async () => {
                const adminUserId = mockUserDataStore.getRecordByIndex(0).id;

                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/public/users/${userId}`
                            );

                            setMockRequestSession(req, adminUserId);

                            const res = await req.then(res => res);
                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");
                            expect({ id: userId, ...userData }).to.deep.include(
                                res.body
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });
        });
    });

    describe("GET /public/users/whoami", () => {
        silenceErrorLogs(() => {
            it("should return 200 status code without including session header", async () => {
                await jsc.assert(
                    jsc.forall(jsc.nat, async () => {
                        try {
                            mockUserDataStore.reset();
                            const req = request(app).get(
                                "/public/users/whoami"
                            );

                            const res = await req.then(res => res);

                            expect(res.status).to.equal(200);

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });

            it("should return correct user data specified by session header", async () => {
                await jsc.assert(
                    jsc.forall(userDataArb, async userData => {
                        try {
                            mockUserDataStore.reset();
                            const {
                                id: userId
                            } = mockUserDataStore.createRecord(userData);

                            const req = request(app).get(
                                `/public/users/whoami`
                            );
                            setMockRequestSession(req, userId);
                            const res = await req.then(res => res);

                            expect(res.status).to.equal(200);
                            expect(res.body).to.be.a("object");
                            expect(res.body.id).to.be.a("string");

                            const {
                                roles,
                                permissions,
                                managingOrgUnitIds,
                                orgUnit,
                                orgUnitId,
                                ...bodyUserData
                            } = res.body;

                            expect(res.body.roles).to.be.a("array");
                            expect(res.body.permissions).to.be.a("array");
                            expect({ id: userId, ...userData }).to.deep.include(
                                bodyUserData
                            );

                            return true;
                        } catch (e) {
                            throw e;
                        }
                    })
                );
            });
        });
    });
});
