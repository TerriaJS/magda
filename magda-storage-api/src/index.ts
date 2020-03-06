import express from "express";
import yargs from "yargs";
import createApiRouter from "./createApiRouter";
import MagdaMinioClient from "./MagdaMinioClient";
import addJwtSecretFromEnvVar from "@magda/typescript-common/dist/session/addJwtSecretFromEnvVar";

const argv = addJwtSecretFromEnvVar(
    yargs
        .config()
        .help()
        .option("listenPort", {
            describe: "The TCP/IP port on which the storage-api should listen.",
            type: "number",
            default: 6121
        })
        .option("minioAccessKey", {
            describe: "The access key to your minio server.",
            type: "string",
            demand: true,
            default: process.env.MINIO_ACCESS_KEY
        })
        .option("minioSecretKey", {
            describe: "The secret key to your minio server.",
            type: "string",
            demand: true,
            default: process.env.MINIO_SECRET_KEY
        })
        .option("minioEnableSSL", {
            describe: "Whether or not to use https over http. Defaults to true",
            type: "boolean",
            default: false
        })
        .option("minioHost", {
            describe: "Host where MinIO server is running.",
            type: "string",
            default: "localhost"
        })
        .option("minioPort", {
            describe: "Port where MinIO server is running.",
            type: "number",
            default: 9000
        })
        .option("minioRegion", {
            describe: "Region where the server is being created.",
            type: "string",
            default: "unspecified-region"
        })
        .option("authApiUrl", {
            describe: "Url of the authorization API.",
            type: "string",
            default: "http://localhost:6104/v0"
        })
        .option("uploadLimit", {
            describe: "How large a file can be uploaded to be stored by Magda",
            type: "string",
            default: "100mb"
        }).argv
);

var app = express();

app.use(
    "/v0",
    createApiRouter({
        objectStoreClient: new MagdaMinioClient({
            endPoint: argv.minioHost,
            port: argv.minioPort,
            useSSL: argv.minioEnableSSL,
            accessKey: argv.minioAccessKey,
            secretKey: argv.minioSecretKey,
            region: argv.minioRegion
        }),
        authApiUrl: argv.authApiUrl,
        jwtSecret: argv.jwtSecret as string,
        uploadLimit: argv.uploadLimit
    })
);

app.listen(argv.listenPort);

console.log("Storage API started on port " + argv.listenPort);

process.on(
    "unhandledRejection",
    (reason: {} | null | undefined, _promise: any) => {
        console.error("Unhandled rejection:");
        console.error(reason);
    }
);
