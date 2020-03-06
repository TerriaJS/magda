#!/usr/bin/env node

const path = require("path");
const childProcess = require("child_process");
const glob = require("glob");
const _ = require("lodash");
const os = require("os");

const lernaJson = require("../lerna.json");

const argv = require("yargs").option("filters", {
    alias: "f",
    type: "string",
    describe:
        "Paths and values to filter the package.json.magda, with separated by `=`."
}).argv;

const argFilters = argv.filters
    ? _.isArray(argv.filters)
        ? argv.filters
        : [argv.filters]
    : [];

const filters = argFilters.map(string => {
    const splitFilter = string.split("=");
    return {
        key: splitFilter[0],
        value: splitFilter[1]
    };
});

const jsPackages = _(lernaJson.packages)
    .map(package => package + "/package.json")
    .flatMap(package => glob.sync(package))
    .map(packagePath => {
        const packageJson = require(path.resolve(packagePath));
        return packageJson;
    })
    .filter(function(packageJson) {
        return filters.every(({ key, value }) => {
            return (
                _.get(packageJson.magda, key, "").toString() === value &&
                value.toString()
            );
        });
    })
    .map(packageJson => packageJson.name)
    .value();

const result = childProcess.spawnSync(
    "lerna",
    [
        ...jsPackages.map(package => "--scope " + package),
        "--stream",
        "--concurrency",
        os.cpus().length,
        ...argv._
    ],
    {
        stdio: "inherit",
        shell: true
    }
);

process.exit(result.status);
