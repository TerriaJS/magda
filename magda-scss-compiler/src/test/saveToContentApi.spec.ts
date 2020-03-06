import {} from "mocha";
import { expect } from "chai";
import nock from "nock";
import URI from "urijs";
import saveToContentApi from "../saveToContentApi";
import { getUserId } from "magda-typescript-common/src/session/GetUserId";

describe("saveToContentApi", () => {
    const contentApiUrl = "http://contentAPI.example.com";
    let contentApiScope: nock.Scope;

    beforeEach(() => {
        contentApiScope = nock(contentApiUrl);
    });

    it("should request to save css content to content API properly", async () => {
        const jwtSecret = "" + Math.random();
        const userId = "" + Math.random();
        const fileName = "stylesheet";
        const content = "" + Math.random();

        contentApiScope
            .put(`/${fileName}`)
            .reply(function(this: any, uri, requestBody) {
                const uriObj = new URI(uri);
                const segs = uriObj.segmentCoded();
                expect(segs).to.to.be.an("array");
                expect(segs.length).to.greaterThan(0);
                const requestFileName = segs.pop();
                expect(requestFileName).to.equal(fileName);

                expect(this.req.headers).to.to.be.an("object");
                expect(this.req.headers["x-magda-session"]).to.to.be.an(
                    "string"
                );

                this.req.header = (key: string) =>
                    this.req.headers[key.toLowerCase()];

                const requestUserId = getUserId(
                    this.req,
                    jwtSecret
                ).valueOrThrow(new Error("Cannot get userId from jwtToken"));

                expect(requestUserId).to.equal(userId);
                expect(requestBody).to.equal(content);

                return [
                    201,
                    JSON.stringify({
                        result: "SUCCESS"
                    })
                ];
            });

        const r = await saveToContentApi(
            fileName,
            content,
            contentApiUrl,
            jwtSecret,
            userId
        );

        expect(r).to.equal(true);
    });
});
