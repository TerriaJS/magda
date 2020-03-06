import spawn from "cross-spawn";
import assert from "assert";
import path from "path";
import { MockRegistry } from "./MockRegistry";
import { MockExpressServer } from "./MockExpressServer";
import resolvePkg from "resolve";

/**
 * Hoping to re-use this functionality for all black-box style connector
 * testing.
 */
export function runConnectorTest(
    TEST_CASES: any[],
    Catalog: any,
    options: any = {}
) {
    describe("connector", function() {
        this.timeout(30000);

        const registryPort = 5000 + Math.round(5000 * Math.random());
        const catalogPort = registryPort + 1;

        function run() {
            return new Promise((resolve, reject) => {
                const tsconfigPath = path.resolve("tsconfig.json");
                const tsNodeExec = path.resolve(
                    path.dirname(
                        resolvePkg.sync("ts-node", {
                            basedir: process.cwd()
                        })
                    ),
                    "./bin.js"
                );

                const command = [
                    "-r",
                    resolvePkg.sync("tsconfig-paths/register", {
                        basedir: process.cwd()
                    }),
                    "./src",
                    "--id=connector",
                    "--name=Connector",
                    `--sourceUrl=http://localhost:${catalogPort}`,
                    `--registryUrl=http://localhost:${registryPort}`,
                    "--jwtSecret=nerdgasm",
                    "--userId=user",
                    "--tenantId=1"
                ];
                const proc = spawn(tsNodeExec, command, {
                    stdio: "inherit",
                    cwd: path.dirname(tsconfigPath),
                    env: {
                        ...(process.env ? process.env : {}),
                        TS_NODE_PROJECT: tsconfigPath
                    }
                });
                proc.on("error", (err: any) => {
                    console.log("Failed to start subprocess.", err);
                    reject(err);
                });
                proc.on("close", (code: number) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`error exit code nonzero: ${code}`));
                    }
                });
            });
        }

        let servers: any[] = [];
        let registry: any;

        beforeEach(async function() {
            servers.push(
                (registry = await new MockRegistry().run(registryPort))
            );
        });

        afterEach(function() {
            servers.forEach(server => server.server.close());
        });

        TEST_CASES.forEach(function(testCase: any, index: number) {
            it(`should run ${index}`, async function() {
                const catalog: MockExpressServer = new Catalog(testCase.input);
                await catalog.run(catalogPort).then((catalog: any) => {
                    servers.push(catalog);
                    return run().then(() => {
                        Object.values(registry.records).forEach(
                            (record: any) => {
                                record.sourceTag = "stag";
                                if (
                                    record.aspects &&
                                    record.aspects.source &&
                                    record.aspects.source.url
                                ) {
                                    record.aspects.source.url = record.aspects.source.url.replace(
                                        `http://localhost:${catalogPort}`,
                                        "SOURCE"
                                    );
                                }
                            }
                        );
                        if (options.cleanRegistry) {
                            options.cleanRegistry(registry);
                        }
                        assert.deepStrictEqual(
                            registry.records,
                            testCase.output
                        );
                    });
                });
            });
        });
    });
}
