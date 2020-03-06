import express from "express";
import yargs from "yargs";

import Database from "./Database";
import createTenantsRouter from "./createTenantsRouter";
import addJwtSecretFromEnvVar from "magda-typescript-common/src/session/addJwtSecretFromEnvVar";

const argv = addJwtSecretFromEnvVar(
    yargs
        .config()
        .help()
        .option("listenPort", {
            describe: "The TCP/IP port on which the tenant api should listen.",
            type: "number",
            default: 6130
        })
        .option("dbHost", {
            describe: "The host running the tenant database.",
            type: "string",
            default: "localhost"
        })
        .option("dbPort", {
            describe: "The port running the auth database.",
            type: "number",
            default: 5432
        })
        .option("jwtSecret", {
            describe: "The shared secret for intra-network communication",
            type: "string"
        })
        .option("authApiUrl", {
            describe: "The authorization api URL",
            type: "string",
            default: "http://localhost:6104/v0"
        }).argv
);

// Create a new Express application.
var app = express();
app.use(require("body-parser").json());

const database = new Database({
    dbHost: argv.dbHost,
    dbPort: argv.dbPort
});

app.use(
    "/v0",
    createTenantsRouter({
        jwtSecret: argv.jwtSecret,
        database,
        authApiUrl: argv.authApiUrl
    })
);

app.listen(argv.listenPort);
console.log("Tenant API started on port " + argv.listenPort);

process.on(
    "unhandledRejection",
    (reason: {} | null | undefined, promise: Promise<any>) => {
        console.error("Unhandled rejection:");
        console.error(reason);
    }
);
