import {} from "mocha";
import sinon from "sinon";
import express from "express";
import nock from "nock";
import _ from "lodash";
import supertest from "supertest";
import URI from "urijs";

import buildApp from "../buildApp";

const PROXY_ROOTS = {
    "/api/v0/registry": "http://registry",
    "/preview-map": "http://preview-map/",
    "/map/": "http://map/",
    "/other/foo/bar/": "http://otherplace/foo/bar"
};

describe("proxying", () => {
    let app: express.Application;

    after(() => {
        nock.cleanAll();
    });

    beforeEach(() => {
        app = buildApp({
            listenPort: 80,
            externalUrl: "http://127.0.0.1",
            dbHost: "localhost",
            dbPort: 5432,
            proxyRoutesJson: {
                registry: {
                    to: "http://registry",
                    auth: true
                }
            },
            webProxyRoutesJson: {
                map: "http://map",
                other: "http://otherplace"
            },
            helmetJson: "{}",
            cspJson: "{}",
            corsJson: "{}",
            authorizationApi: "http://127.0.0.1",
            sessionSecret: "secret",
            jwtSecret: "othersecret",
            userId: "123",
            web: "https://127.0.0.1",
            previewMap: "http://preview-map",
            tenantUrl: "http://tenant"
        });
    });

    afterEach(() => {
        if ((<sinon.SinonStub>console.error).restore) {
            (<sinon.SinonStub>console.error).restore();
        }
    });

    _.map(PROXY_ROOTS, (value, key) => {
        describe(`when proxying ${key} to ${value}`, () => {
            it("proxies requests", () => {
                nock(value)
                    .get("/")
                    .reply(200);

                return supertest(app)
                    .get(key)
                    .expect(200);
            });

            it("doesn't pass auth headers through", () => {
                nock(value, {
                    badheaders: ["Authorization"]
                })
                    .get("/")
                    .reply(200);

                return supertest(app)
                    .get(key)
                    .set("Authorization", "blah")
                    .expect(200);
            });

            it("should rewrite host header", () => {
                nock(value, {
                    reqheaders: {
                        host: URI(value).host()
                    }
                })
                    .get("/")
                    .reply(() => {
                        return 200;
                    });

                return supertest(app)
                    .get(key)
                    .set("Host", "test")
                    .expect(200);
            });
        });
    });
});
