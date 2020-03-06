import {} from "mocha";
import sinon from "sinon";
import express from "express";
import _ from "lodash";
import { Test, Response } from "supertest";
import request from "supertest";
import nock from "nock";
const jwt = require("jsonwebtoken");

import createApiRouter from "../createApiRouter";
import MagdaMinioClient from "../MagdaMinioClient";

const Minio = require("minio");

import fs from "fs";

export default function mockAuthorization(
    authApiUrl: string,
    isAdmin: boolean,
    jwtSecret: string,
    req: Test
): Promise<Response> {
    const userId = "1";
    const scope = nock(authApiUrl);

    scope.get(`/private/users/${userId}`).reply(200, { isAdmin });

    const id = jwt.sign({ userId: userId }, jwtSecret);

    return req.set("X-Magda-Session", id).then(res => {
        scope.done();
        return res;
    });
}

describe("Storage API tests", () => {
    let app: express.Application;
    const bucketName = "magda-test-bucket";
    const minioClientOpts = {
        endPoint: process.env["MINIO_HOST"],
        port: Number(process.env["MINIO_PORT"]),
        useSSL: false,
        accessKey: process.env["MINIO_ACCESS_KEY"],
        secretKey: process.env["MINIO_SECRET_KEY"],
        region: "unspecified-region"
    };
    const minioClient = new Minio.Client(minioClientOpts);
    const authApiUrl = "http://example.com";
    const jwtSecret = "squirrel";
    const uploadLimit = "100mb";

    before(() => {
        minioClient.makeBucket(bucketName, (err: Error) => {
            if (err && (err as any).code !== "BucketAlreadyOwnedByYou") {
                return console.log("Error creating bucket.", err);
            }
            console.log(
                "Bucket created successfully in " + minioClientOpts.region
            );
        });
    });

    beforeEach(() => {
        app = express();
        app.use(
            "/v0",
            createApiRouter({
                objectStoreClient: new MagdaMinioClient(minioClientOpts),
                authApiUrl,
                jwtSecret,
                uploadLimit
            })
        );
    });

    afterEach(() => {
        if ((<sinon.SinonStub>console.error).restore) {
            (<sinon.SinonStub>console.error).restore();
        }
    });

    describe("Create bucket", () => {
        describe("Creating proper buckets", () => {
            after(() => {
                return minioClient.removeBucket(dummyBucket, function(
                    err: Error
                ) {
                    if (err) {
                        return console.log("Unable to remove bucket: ", err);
                    }
                    return console.log(
                        "Bucket " + dummyBucket + " removed successfully."
                    );
                });
            });

            // Random string
            const dummyBucket =
                Math.random()
                    .toString(36)
                    .substring(2, 15) +
                Math.random()
                    .toString(36)
                    .substring(2, 15);
            it("Not an admin", () => {
                return mockAuthorization(
                    authApiUrl,
                    false,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + dummyBucket)
                        .expect(401, "Not authorized.")
                );
            });

            it("As an admin", () => {
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + dummyBucket)
                        .expect(201, {
                            message:
                                "Bucket " +
                                dummyBucket +
                                " created successfully in unspecified-region 🎉"
                        })
                );
            });

            it("Creating a bucket that already exists", () => {
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + dummyBucket)
                        .expect(201, {
                            message:
                                "Bucket " + dummyBucket + " already exists 👍"
                        })
                );
            });
        });
    });

    describe("Upload", () => {
        describe("Upload a simple file", () => {
            it("As an admin", () => {
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + bucketName + "/upload-test-file-admin")
                        .set("Accept", "application/json")
                        .set("Content-Type", "text/plain")
                        .send("LALALALALALALALALA")
                        .expect(200)
                );
            });

            it("Not an admin", () => {
                return mockAuthorization(
                    authApiUrl,
                    false,
                    jwtSecret,
                    request(app)
                        .put(
                            "/v0/" + bucketName + "/upload-test-file-non-admin"
                        )
                        .set("Accept", "application/json")
                        .set("Content-Type", "text/plain")
                        .send("LALALALALALALALALA")
                        .expect(401, "Not authorized.")
                );
            });
        });

        describe("Upload from the browser", () => {
            describe("Upload some files", () => {
                it("Not as an admin", () => {
                    return mockAuthorization(
                        authApiUrl,
                        false,
                        jwtSecret,
                        request(app)
                            .post("/v0/upload/" + bucketName)
                            .field(
                                "originalname",
                                "test-browser-upload-no-admin"
                            )
                            .attach("image", "src/test/test_image.jpg")
                            .expect(401, "Not authorized.")
                    );
                });

                it("As an admin", () => {
                    const bananadance: Buffer = fs.readFileSync(
                        "src/test/bananadance.gif"
                    );
                    return mockAuthorization(
                        authApiUrl,
                        true,
                        jwtSecret,
                        request(app)
                            .post("/v0/upload/" + bucketName)
                            .attach("text", "src/test/test_csv_1.csv")
                            .accept("csv")
                            .attach("image", bananadance, "bananadance.gif")
                            .accept("gif")
                            .expect(200)
                    ).then(_res => {
                        return request(app)
                            .get("/v0/" + bucketName + "/bananadance.gif")
                            .accept("gif")
                            .expect(200)
                            .expect(bananadance);
                    });
                });
            });

            it("Upload no files", () => {
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .post("/v0/upload/" + bucketName)
                        .field("originalname", "test-browser-upload-1")
                        .expect(400)
                );
            });
        });
    });

    describe("Download", () => {
        it("Uploading and then downloading the simple file", () => {
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/download-test-file-1")
                    .set("Accept", "application/json")
                    .set("Content-Type", "text/plain")
                    .send("Testing download")
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .get("/v0/" + bucketName + "/download-test-file-1")
                    .set("Accept", "application/json")
                    .set("Accept", "text/plain")
                    .expect(200)
                    .expect("Testing download")
                    .expect("Content-Type", "text/plain");
            });
        });

        it("Empty content", () => {
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/download-test-file-2")
                    .set("Accept", "application/json")
                    .set("Content-Type", "text/plain")
                    .send("")
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .get("/v0/" + bucketName + "/download-test-file-2")
                    .set("Accept", "application/json")
                    .set("Accept", "text/plain")
                    .expect(200)
                    .expect("")
                    .expect("Content-Type", "text/plain");
            });
        });

        describe("Binary content", () => {
            it("JPG Image", () => {
                const img: Buffer = fs.readFileSync("src/test/test_image.jpg");
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + bucketName + "/binary-content-jpg")
                        .set("Accept", "image/jpg")
                        .set("Content-Type", "image/jpg")
                        .send(img)
                        .expect(200)
                ).then(_res => {
                    return request(app)
                        .get("/v0/" + bucketName + "/binary-content-jpg")
                        .set("Accept", "image/jpg")
                        .expect(200)
                        .expect(img)
                        .expect("Content-Type", "image/jpg");
                });
            });

            it("Bananadance GIF", () => {
                const bananadance: Buffer = fs.readFileSync(
                    "src/test/bananadance.gif"
                );
                return mockAuthorization(
                    authApiUrl,
                    true,
                    jwtSecret,
                    request(app)
                        .put("/v0/" + bucketName + "/binary-content-gif")
                        .set("Accept", "image/gif")
                        .set("Content-Type", "image/gif")
                        .send(bananadance)
                        .expect(200)
                ).then(_res => {
                    return request(app)
                        .get("/v0/" + bucketName + "/binary-content-gif")
                        .set("Accept", "image/gif")
                        .expect(200)
                        .expect(bananadance)
                        .expect("Content-Type", "image/gif");
                });
            });
        });

        it("CSV File", () => {
            const csvContent = fs.readFileSync(
                "src/test/test_csv_1.csv",
                "utf-8"
            );
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/test-csv-1")
                    .set("Content-Type", "text/csv")
                    .send(csvContent)
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .get("/v0/" + bucketName + "/test-csv-1")
                    .set("Accept", "text/csv")
                    .expect(200)
                    .expect(csvContent)
                    .expect("Content-Type", "text/csv");
            });
        });
        it("JSON File", () => {
            const jsonContent = fs.readFileSync(
                "src/test/test_json_1.json",
                "utf-8"
            );
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/test-json-1")
                    .set("Content-Type", "application/json")
                    .send(jsonContent)
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .get("/v0/" + bucketName + "/test-json-1")
                    .set("Accept", "application/json")
                    .expect(200)
                    .expect(jsonContent)
                    .expect("Content-Type", "application/json");
            });
        });
    });

    describe("Delete", () => {
        it("Uploading and then deleting a simple file", () => {
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/delete-test-file-1")
                    .set("Accept", "application/json")
                    .set("Content-Type", "text/plain")
                    .send("Testing delete")
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .delete("/v0/" + bucketName + "/delete-test-file-1")
                    .expect(200)
                    .expect({ message: "File deleted successfully" })
                    .then(_res => {
                        return request(app)
                            .get("/v0/" + bucketName + "/delete-test-file-1")
                            .set("Accept", "application/json")
                            .set("Accept", "text/plain")
                            .expect(404);
                    });
            });
        });

        it("Uploading and then deleting : Empty content", () => {
            return mockAuthorization(
                authApiUrl,
                true,
                jwtSecret,
                request(app)
                    .put("/v0/" + bucketName + "/delete-test-file-2")
                    .set("Accept", "application/json")
                    .set("Content-Type", "text/plain")
                    .send("")
                    .expect(200)
            ).then(_res => {
                return request(app)
                    .delete("/v0/" + bucketName + "/delete-test-file-2")
                    .expect(200)
                    .expect({ message: "File deleted successfully" })
                    .then(_res => {
                        return request(app)
                            .get("/v0/" + bucketName + "/delete-test-file-2")
                            .set("Accept", "application/json")
                            .set("Accept", "text/plain")
                            .expect(404);
                    });
            });
        });

        it("Deleting non-existent file", () => {
            return request(app)
                .delete("/v0/" + bucketName + "/nonexistent-file-dfijgy45")
                .expect(200);
        });
    });
});
