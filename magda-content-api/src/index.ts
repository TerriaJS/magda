import express from "express";
import yargs from "yargs";

import createApiRouter from "./createApiRouter";
import Database from "./Database";
import addJwtSecretFromEnvVar from "magda-typescript-common/src/session/addJwtSecretFromEnvVar";

const argv = addJwtSecretFromEnvVar(
    yargs
        .config()
        .help()
        .option("listenPort", {
            describe:
                "The TCP/IP port on which the authorization-api should listen.",
            type: "number",
            default: 6119
        })
        .option("dbHost", {
            describe: "The host running the auth database.",
            type: "string",
            default: "localhost"
        })
        .option("dbPort", {
            describe: "The port running the auth database.",
            type: "number",
            default: 5432
        })
        .option("dbName", {
            describe: "The database name.",
            type: "string",
            default: "content"
        })
        .option("authApiUrl", {
            describe: "The base URL of the auth API",
            type: "string",
            default: "http://localhost:6104/v0"
        })
        .option("opaUrl", {
            describe: "The base URL of the opa API",
            type: "string",
            default: "http://localhost:6104/v0/opa/"
        })
        .option("jwtSecret", {
            describe: "The shared secret for intra-network communication",
            type: "string"
        }).argv
);

// Create a new Express application.
var app = express();
// app.use(require("body-parser").json());

app.use(
    "/v0",
    createApiRouter({
        authApiUrl: argv.authApiUrl,
        jwtSecret: argv.jwtSecret,
        database: new Database({
            dbHost: argv.dbHost,
            dbPort: argv.dbPort,
            dbName: argv.dbName,
            opaUrl: argv.opaUrl
        })
    })
);

app.listen(argv.listenPort);
console.log("Contents API started on port " + argv.listenPort);

process.on(
    "unhandledRejection",
    (reason: {} | null | undefined, promise: Promise<any>) => {
        console.error("Unhandled rejection:");
        console.error(reason);
    }
);
