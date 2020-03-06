import {} from "mocha";
import chai from "chai";
import request from "supertest";
import express from "express";
import nock from "nock";
import addJwtSecretFromEnvVar from "magda-typescript-common/src/session/addJwtSecretFromEnvVar";
import fakeArgv from "magda-typescript-common/src/test/fakeArgv";
import createApiRouter from "../createApiRouter";

import mockDatabase from "./mockDatabase";
import Database from "../Database";
import { mockContentData } from "./mockContentStore";

const IMAGE_FORMATS_SUPPORTED = ["png", "gif", "svg"];

describe("Content api router", function(this: Mocha.ISuiteCallbackContext) {
    let app: express.Express;
    let argv: any;
    let agent: request.SuperTest<request.Test>;

    before(function() {
        argv = retrieveArgv();
        app = buildExpressApp();
        agent = request.agent(app);
    });

    function retrieveArgv() {
        const argv = addJwtSecretFromEnvVar(
            fakeArgv({
                listenPort: 6999,
                dbHost: "localhost",
                dbPort: 5432,
                jwtSecret: "squirrel",
                authApiUrl: "http://admin.example.com"
            })
        );
        return argv;
    }

    function buildExpressApp() {
        const apiRouter = createApiRouter({
            jwtSecret: argv.jwtSecret,
            database: (new mockDatabase() as any) as Database,
            authApiUrl: argv.authApiUrl
        });

        const app = express();
        //app.use(require("body-parser").json());
        app.use(apiRouter);

        return app;
    }

    describe("READ", () => {
        it("should return data for existing - text", done => {
            agent
                .get("/text-1.text")
                .expect(200, "ass")
                .expect("Content-Type", /^text\/plain/)
                .end(done);
        });

        it("should return data for existing - json - as text", done => {
            agent
                .get("/json-1.text")
                .expect(200, "null")
                .expect("Content-Type", /^text\/plain/)
                .end(done);
        });

        it("should return data for js files as application/javascript", done => {
            agent
                .get("/js.js")
                .expect(200, "var a = 1;")
                .expect("Content-Type", /^application\/javascript/)
                .end(done);
        });

        it("should return data for existing - json - as json", done => {
            agent
                .get("/json-2.json")
                .expect(200, { acdc: "test" })
                .expect("Content-Type", /^application\/json/)
                .end(done);
        });

        IMAGE_FORMATS_SUPPORTED.forEach(format => {
            it(`should return data for existing - ${format} - as ${format}`, done => {
                agent
                    .get(`/${format}-id.bin`)
                    .expect(200)
                    .end(done);
            });
        });

        it("should return 404 for non-existant", done => {
            agent
                .get("/json-3.json")
                .expect(404)
                .end(done);
        });

        it("should return 500 for other errors", done => {
            agent
                .get("/svg-id.json")
                .expect(500)
                .end(done);
        });

        describe("list", () => {
            it("should see empty list with no params", done => {
                agent
                    .get("/all")
                    .expect(200, [])
                    .end(done);
            });

            it("should see everything when id=*", done => {
                const expectedContent = mockContentData.map(item => ({
                    id: item.id,
                    type: item.type
                }));

                agent
                    .get("/all?id=*")
                    .expect(200, expectedContent)
                    .end(done);
            });

            it("should inline content for json when inline=true", done => {
                agent
                    .get("/all?id=*&inline=true")
                    .expect(({ body }: any) => {
                        for (let i = 0; i < body.length; i++) {
                            const itemInBody = body[i];
                            const itemInMockContent = mockContentData[i];

                            if (itemInMockContent.type === "application/json") {
                                chai.expect(
                                    itemInBody.content || null
                                ).to.deep.equal(
                                    JSON.parse(itemInMockContent.content)
                                );
                            }
                        }

                        return body.some(
                            (item: any) => item.type === "application/json"
                        );
                    })
                    .expect(200, done);
            });

            it("should inline content for plain text when inline=true", done => {
                agent
                    .get("/all?id=*&inline=true")
                    .expect(({ body }: any) => {
                        for (let i = 0; i < body.length; i++) {
                            const itemInBody = body[i];
                            const itemInMockContent = mockContentData[i];

                            if (itemInMockContent.type === "text/plain") {
                                chai.expect(itemInBody.content).to.equal(
                                    itemInMockContent.content
                                );
                            }
                        }

                        return body.some(
                            (item: any) => item.type === "text/plain"
                        );
                    })
                    .expect(200, done);
            });

            it("should NOT inline content for image/png", done => {
                agent
                    .get("/all?id=*&inline=true")
                    .expect(({ body }: any) => {
                        const pngs = body.filter(
                            (item: any) => item.type === "image/png"
                        );

                        return (
                            pngs.length > 0 &&
                            pngs.every((png: any) => !png.content)
                        );
                    })
                    .expect(200, done);
            });
        });
    });

    describe("UPDATE", () => {
        const gifImage = new Buffer(
            "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
            "base64"
        );

        const jwt = require("jsonwebtoken");

        function admin(req: request.Test): request.Test {
            const userId = "1";
            const isAdmin = true;
            nock(argv.authApiUrl)
                .get(`/private/users/${userId}`)
                .reply(200, { isAdmin });
            const id = jwt.sign({ userId: userId }, argv.jwtSecret);
            return req.set("X-Magda-Session", id);
        }

        it("should write and read", done => {
            admin(agent.put("/header/logo"))
                .set("Content-type", "image/gif")
                .send(gifImage)
                .expect(201)
                .then(() => {
                    agent
                        .get("/header/logo.text")
                        .expect(gifImage.toString("base64"))
                        .end(done);
                });
        });

        it("should not write non-existing", done => {
            admin(agent.put("/header/lego"))
                .set("Content-type", "image/gif")
                .send(gifImage)
                .expect(404)
                .end(done);
        });

        it("should not write non-conforming", done => {
            admin(agent.put("/header/logo"))
                .set("Content-type", "text/plain")
                .send(gifImage)
                .expect(500)
                .end(done);
        });

        it("should not write without access", done => {
            agent
                .put("/header/logo")
                .set("Content-type", "image/gif")
                .send(gifImage)
                .expect(401)
                .end(done);
        });

        it("should not delete logo", done => {
            admin(agent.delete("/logo"))
                .expect(404)
                .end(done);
        });

        const CUSTOM_ROUTES = [
            {
                route: "/csv-xxx",
                mime: "text/csv",
                content: gifImage,
                getRoute: "/csv-xxx.text",
                expectedContent: gifImage.toString("base64")
            },
            {
                route: "/emailTemplates/xxx.html",
                mime: "text/html",
                content: "test",
                getRoute: "/emailTemplates/xxx.html",
                expectedContent: "test"
            },
            {
                route: "/emailTemplates/assets/x-y-z.jpg",
                mime: "image/svg+xml",
                content: gifImage,
                getRoute: "/emailTemplates/assets/x-y-z.jpg",
                expectedContent: gifImage.toString("utf8")
            },
            {
                route: "/lang/en/publishersPage/blahface",
                mime: "text/plain",
                content: "Hello!",
                getRoute: "/lang/en/publishersPage/blahface.text",
                expectedContent: "Hello!"
            },
            {
                route: "/favicon.ico",
                mime: "image/x-icon",
                content: gifImage,
                getRoute: "/favicon.ico",
                expectedContent: gifImage.toString("utf8")
            }
        ];

        CUSTOM_ROUTES.forEach(customRoute => {
            it(`should upload and delete with custom routes ${
                customRoute.route
            }`, done => {
                admin(agent.put(customRoute.route))
                    .set("Content-Type", customRoute.mime)
                    .send(customRoute.content)
                    .expect(201)
                    .then(() =>
                        agent
                            .get(customRoute.getRoute)
                            .expect(customRoute.expectedContent)
                    )
                    .then(() =>
                        admin(agent.delete(customRoute.route)).expect(200)
                    )
                    .then(() => agent.get(customRoute.getRoute).expect(404))
                    .then(() => done())
                    .catch(e => done(e));
            });
        });
    });
});
