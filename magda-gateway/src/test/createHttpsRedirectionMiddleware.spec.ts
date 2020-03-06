import {} from "mocha";
//import sinon from "sinon";
import express from "express";
import { expect } from "chai";
import _ from "lodash";
import URI from "urijs";
import supertest from "supertest";
import randomstring from "randomstring";
import createHttpsRedirectionMiddleware from "../createHttpsRedirectionMiddleware";

describe("Test createHttpsRedirectionMiddleware", () => {
    const testHost = "magda.example.com:8080";
    let urlPath = "";
    let urlQuery: any = {};
    let isNextHandlerCalled = false;

    function setupTest(
        enableHttpsRedirection: boolean,
        protocol: string,
        specifiedUrlPath: string = null,
        specifiedUrlQuery: object = null
    ) {
        const app: express.Application = express();
        app.set("trust proxy", true);
        app.use(createHttpsRedirectionMiddleware(enableHttpsRedirection));
        app.use((req, res) => {
            isNextHandlerCalled = true;
            res.send("OK");
        });

        if (specifiedUrlPath) {
            urlPath = specifiedUrlPath;
        }

        if (specifiedUrlQuery) {
            urlQuery = specifiedUrlQuery;
        }

        const testRequest = supertest(app)
            .get(urlPath)
            .query(urlQuery)
            .set("host", testHost);

        if (protocol) {
            testRequest.set("X-Forwarded-Proto", protocol);
        }

        return testRequest;
    }

    beforeEach(() => {
        isNextHandlerCalled = false;
        urlPath = "/" + randomstring.generate();
        urlQuery = {};
        const queryParameterNumber = _.random(1, 10, false);
        for (let i = 0; i < queryParameterNumber; i++) {
            urlQuery[randomstring.generate()] = randomstring.generate();
        }
    });

    describe("`X-Forwarded-Proto` header is http", () => {
        it("should forward request to next request handler if `enableHttpsRedirection` parameter is false", () => {
            const testRequest = setupTest(false, "http");

            return testRequest.expect(200).then(() => {
                expect(isNextHandlerCalled).to.equal(true);
            });
        });

        it("should redirect to the same URL with HTTPS protocol if `enableHttpsRedirection` parameter is true", () => {
            const testRequest = setupTest(true, "http");

            return testRequest
                .expect(301)
                .expect(function(res: supertest.Response) {
                    expect(isNextHandlerCalled).to.equal(false);
                    const location = res.header.location;
                    const uri = new URI(location);
                    expect(uri.protocol()).to.equal("https");
                    expect(uri.host()).to.equal(testHost);
                    expect(uri.pathname()).to.equal(urlPath);
                    expect(uri.search(true)).to.deep.equal(urlQuery);
                });
        });
    });

    describe("`X-Forwarded-Proto` header is https", () => {
        it("should forward request to next request handler if `enableHttpsRedirection` parameter is false", () => {
            const testRequest = setupTest(false, "https");

            return testRequest.expect(200).then(() => {
                expect(isNextHandlerCalled).to.equal(true);
            });
        });

        it("should forward request to next request handler if `enableHttpsRedirection` parameter is true", () => {
            const testRequest = setupTest(true, "https");

            return testRequest.expect(200).then(() => {
                expect(isNextHandlerCalled).to.equal(true);
            });
        });
    });

    describe("`X-Forwarded-Proto` header is not set", () => {
        it("should forward request to next request handler if `enableHttpsRedirection` parameter is false", () => {
            const testRequest = setupTest(false, null);

            return testRequest.expect(200).then(() => {
                expect(isNextHandlerCalled).to.equal(true);
            });
        });

        it("should forward request to next request handler if `enableHttpsRedirection` parameter is true", () => {
            const testRequest = setupTest(true, "https");

            return testRequest.expect(200).then(() => {
                expect(isNextHandlerCalled).to.equal(true);
            });
        });
    });
});
