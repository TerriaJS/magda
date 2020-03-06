#!/usr/bin/env node

const yargs = require("yargs");
const childProcess = require("child_process");
const {
    getVersions,
    getTags,
    getName,
    getRepository
} = require("./docker-util");

// Docker and ConEmu (an otherwise excellent console for Windows) don't get along.
// See: https://github.com/Maximus5/ConEmu/issues/958 and https://github.com/moby/moby/issues/28814
// So if we're running under ConEmu, we need to add an extra -cur_console:i parameter to disable
// ConEmu's hooks and also set ConEmuANSI to OFF so Docker doesn't do anything drastic.
const env = Object.assign({}, process.env);
const extraParameters = [];
if (env.ConEmuANSI === "ON") {
    env.ConEmuANSI = "OFF";
    extraParameters.push("-cur_console:i");
}

const argv = yargs
    .config()
    .help()
    .option("fromPrefix", {
        describe: "The prefix of the image that will be given a new tag",
        type: "string",
        example: "registry.gitlab.com/magda-data/",
        default: ""
    })
    .option("fromName", {
        describe:
            "The package name that used to generate the fromTag. Used to optionally override the docker nanme config in package.json during the auto tagging.",
        type: "string",
        example: "data61/magda-ckan-connector",
        default: ""
    })
    .option("fromVersion", {
        describe:
            "The version of the existing image that will be given a new tag",
        type: "string",
        example: "0.0.38-RC1",
        default: getVersions()[0]
    })
    .option("toPrefix", {
        describe: "The prefix for the tag to push to",
        type: "string",
        example: "registry.gitlab.com/magda-data/",
        default: ""
    })
    .option("toName", {
        describe:
            "The package name that used to generate the toTag. Used to optionally override the docker nanme config in package.json during the auto tagging.",
        type: "string",
        example: "data61/magda-ckan-connector",
        default: ""
    })
    .option("toVersion", {
        describe: "The version for the tag to push to",
        type: "string",
        example: "0.0.39",
        default: getVersions()[0]
    }).argv;

const fromTag =
    argv.fromPrefix + getName(argv.fromName) + ":" + argv.fromVersion;

const pullProcess = childProcess.spawnSync("docker", ["pull", fromTag], {
    stdio: ["pipe", "inherit", "inherit"],
    env: env
});

if (pullProcess.status !== 0) {
    process.exit(pullProcess.status);
}

const toTag = argv.toPrefix + getName(argv.toName) + ":" + argv.toVersion;

const tagProcess = childProcess.spawnSync("docker", ["tag", fromTag, toTag], {
    stdio: ["pipe", "inherit", "inherit"],
    env: env
});

if (tagProcess.status !== 0) {
    process.exit(tagProcess.status);
}

const pushProcess = childProcess.spawnSync("docker", ["push", toTag], {
    stdio: ["pipe", "inherit", "inherit"],
    env: env
});

process.exit(pushProcess.status);
