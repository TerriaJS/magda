import { AspectDefinition, Record } from "./generated/registry/api";
import AspectCreationFailure from "./AspectCreationFailure";
import AsyncPage, { forEachAsync, asyncPageToArray } from "./AsyncPage";
import ConnectorRecordId, { RecordType } from "./ConnectorRecordId";
import ConnectionResult from "./ConnectionResult";
import RecordCreationFailure from "./RecordCreationFailure";
import JsonTransformer from "./JsonTransformer";
import Registry from "./registry/AuthorizedRegistryClient";
import unionToThrowable from "./util/unionToThrowable";
import { parse as parseArgv } from "yargs";

import express from "express";
import fs from "fs";
import path from "path";
import process from "process";
import uuid from "uuid";
import _ from "lodash";

/**
 * A base class for connectors for most any JSON-based catalog source.
 */
export default class JsonConnector {
    public readonly source: ConnectorSource;
    public readonly transformer: JsonTransformer;
    public readonly registry: Registry;
    public readonly maxConcurrency: number;
    public readonly sourceTag?: string;
    public readonly configData?: JsonConnectorConfig;

    constructor({
        source,
        transformer,
        registry,
        maxConcurrency = 1,
        sourceTag = uuid.v4()
    }: JsonConnectorOptions) {
        this.source = source;
        this.transformer = transformer;
        this.registry = registry;
        this.maxConcurrency = maxConcurrency;
        this.sourceTag = sourceTag;
        this.configData = this.readConfigData();
    }

    readConfigData(): JsonConnectorConfig {
        try {
            const argv = parseArgv(process.argv);
            if (!argv) {
                throw new Error("failed to parse commandline parameter!");
            }

            let configData: JsonConnectorConfig;

            if (!argv.config) {
                if (!argv.id) {
                    configData = {
                        id: this.source.id,
                        name: this.source.name
                    };
                    if (this.source.extras) {
                        configData.extras = this.source.extras;
                    }
                    if (this.source.presetRecordAspects) {
                        configData.presetRecordAspects = this.source.presetRecordAspects;
                    }
                } else {
                    configData = {
                        id: argv.id as string,
                        name: argv.name as string
                    };
                    if (argv.extras) {
                        configData.extras = argv.extras as JsonConnectorConfigExtraMetaData;
                    }
                    if (argv.presetRecordAspects) {
                        configData.presetRecordAspects = argv.presetRecordAspects as JsonConnectorConfigPresetAspect[];
                    }
                }
            } else {
                configData = JSON.parse(
                    fs.readFileSync(argv.config as string, {
                        encoding: "utf-8"
                    })
                );
            }

            if (!configData) {
                throw new Error("invalid empty config data.");
            }

            if (!configData.id) {
                throw new Error(
                    "invalid config data, missing compulsory `id`."
                );
            }

            if (!configData.name) {
                throw new Error(
                    "invalid config data, missing compulsory `name`."
                );
            }

            if (
                configData.presetRecordAspects &&
                !configData.presetRecordAspects.length
            ) {
                console.log(
                    "Warning: `presetRecordAspects` exists but is not an array. It will not be used."
                );
            }

            return configData;
        } catch (e) {
            throw new Error(`Can't read connector config data: ${e}`);
        }
    }

    async createAspectDefinitions(): Promise<ConnectionResult> {
        const result = new ConnectionResult();

        const allAspectDefinitions = this.transformer.getRequiredAspectDefinitions();

        const aspectBuilderPage = AsyncPage.single<AspectDefinition[]>(
            allAspectDefinitions
        );
        await forEachAsync(
            aspectBuilderPage,
            this.maxConcurrency,
            async aspectDefinition => {
                const aspectDefinitionOrError = await this.registry.putAspectDefinition(
                    aspectDefinition
                );
                if (aspectDefinitionOrError instanceof Error) {
                    result.aspectDefinitionFailures.push(
                        new AspectCreationFailure(
                            aspectDefinition.id,
                            aspectDefinitionOrError
                        )
                    );
                } else {
                    ++result.aspectDefinitionsConnected;
                }
            }
        );

        return result;
    }

    async createOrganization(
        organizationJson: object
    ): Promise<Record | Error> {
        return this.putRecord(
            this.transformer.organizationJsonToRecord(organizationJson),
            "Organization"
        );
    }

    async createDataset(datasetJson: object): Promise<Record | Error> {
        return this.putRecord(
            this.transformer.datasetJsonToRecord(datasetJson),
            "Dataset"
        );
    }

    async createDistribution(
        distributionJson: object,
        datasetJson: object
    ): Promise<Record | Error> {
        return this.putRecord(
            this.transformer.distributionJsonToRecord(
                distributionJson,
                datasetJson
            ),
            "Distribution"
        );
    }

    async createOrganizations(): Promise<ConnectionResult> {
        const result = new ConnectionResult();

        if (this.source.hasFirstClassOrganizations) {
            const organizations = this.source.getJsonFirstClassOrganizations();
            await forEachAsync(
                organizations,
                this.maxConcurrency,
                async organization => {
                    if (!organization) {
                        return;
                    }
                    const recordOrError = await this.createOrganization(
                        organization
                    );
                    if (recordOrError instanceof Error) {
                        result.organizationFailures.push(
                            new RecordCreationFailure(
                                this.transformer.getIdFromJsonOrganization(
                                    organization,
                                    this.source.id
                                ),
                                undefined,
                                recordOrError
                            )
                        );
                    } else {
                        ++result.organizationsConnected;
                    }
                }
            );
        }

        return result;
    }

    async createDatasetsAndDistributions(): Promise<ConnectionResult> {
        const result = new ConnectionResult();

        const datasets = this.source.getJsonDatasets();
        await forEachAsync(datasets, this.maxConcurrency, async dataset => {
            const record = this.transformer.datasetJsonToRecord(dataset);

            const distributions = this.source.getJsonDistributions(dataset);
            if (distributions) {
                const distributionIds: ConnectorRecordId[] = [];
                await forEachAsync(distributions, 1, async distribution => {
                    const recordOrError = await this.createDistribution(
                        distribution,
                        dataset
                    );
                    if (recordOrError instanceof Error) {
                        result.distributionFailures.push(
                            new RecordCreationFailure(
                                this.transformer.getIdFromJsonDistribution(
                                    distribution,
                                    dataset,
                                    this.source.id
                                ),
                                this.transformer.getIdFromJsonDataset(
                                    dataset,
                                    this.source.id
                                ),
                                recordOrError
                            )
                        );
                    } else {
                        ++result.distributionsConnected;
                        distributionIds.push(
                            this.transformer.getIdFromJsonDistribution(
                                distribution,
                                dataset,
                                this.source.id
                            )
                        );
                    }
                });

                record.aspects["dataset-distributions"] = {
                    distributions: distributionIds.map(id => id.toString())
                };
            }

            if (this.source.hasFirstClassOrganizations) {
                const publisher = this.source.getJsonDatasetPublisherId(
                    dataset
                );
                if (publisher) {
                    record.aspects["dataset-publisher"] = {
                        publisher: new ConnectorRecordId(
                            publisher,
                            "Organization",
                            this.source.id
                        ).toString()
                    };
                }
            } else {
                const publisher = await this.source.getJsonDatasetPublisher(
                    dataset
                );
                if (publisher) {
                    const publisherId = this.transformer.getIdFromJsonOrganization(
                        publisher,
                        this.source.id
                    );

                    if (publisherId) {
                        const recordOrError = await this.createOrganization(
                            publisher
                        );
                        if (recordOrError instanceof Error) {
                            result.organizationFailures.push(
                                new RecordCreationFailure(
                                    publisherId,
                                    undefined,
                                    recordOrError
                                )
                            );
                        } else {
                            record.aspects["dataset-publisher"] = {
                                publisher: publisherId.toString()
                            };
                            ++result.organizationsConnected;
                        }
                    }
                }
            }

            const recordOrError = await this.putRecord(record, "Dataset");
            if (recordOrError instanceof Error) {
                result.datasetFailures.push(
                    new RecordCreationFailure(
                        this.transformer.getIdFromJsonDataset(
                            dataset,
                            this.source.id
                        ),
                        undefined,
                        recordOrError
                    )
                );
            } else {
                ++result.datasetsConnected;
            }
        });

        return result;
    }

    async trimRecords(): Promise<ConnectionResult> {
        return this.registry
            .deleteBySource(this.sourceTag, this.source.id)
            .then(unionToThrowable)
            .then(deletionResult => {
                const result = new ConnectionResult();

                if (
                    deletionResult !== undefined &&
                    deletionResult !== "Processing"
                ) {
                    result.recordsTrimmed = deletionResult.count;
                } else {
                    result.trimStillProcessing = true;
                }

                return result;
            });
    }

    /**
     * Runs the connector, creating aspect definitions, organizations, datasets, and distributions in the
     * registry as necessary.
     *
     * @returns {Promise<ConnectionResult>}
     * @memberof JsonConnector
     */
    async run(): Promise<ConnectionResult> {
        const aspectResult = await this.createAspectDefinitions();
        const organizationResult = await this.createOrganizations();
        const datasetAndDistributionResult = await this.createDatasetsAndDistributions();
        const recordsTrimmedResult = await this.trimRecords();

        return ConnectionResult.combine(
            aspectResult,
            organizationResult,
            datasetAndDistributionResult,
            recordsTrimmedResult
        );
    }

    runInteractive(options: JsonConnectorRunInteractiveOptions) {
        const transformerForBrowserPath = path.resolve(
            process.cwd(),
            "dist",
            "createTransformerForBrowser.js"
        );
        if (!fs.existsSync(transformerForBrowserPath)) {
            throw new Error(
                "Cannot run this connector in interactive mode because dist/createTransformerForBrowser.js does not exist."
            );
        }

        var app = express();
        app.use(require("body-parser").json());

        if (options.timeoutSeconds > 0) {
            this.shutdownOnIdle(app, options.timeoutSeconds);
        }

        app.get("/v0/status", (req, res) => {
            res.send("OK");
        });

        app.get("/v0/config", (req, res) => {
            res.send(options.transformerOptions);
        });

        app.get("/v0/datasets/:id", (req, res) => {
            this.source.getJsonDataset(req.params.id).then(function(dataset) {
                res.send(dataset);
            });
        });

        app.get("/v0/datasets/:id/distributions", (req, res) => {
            this.source.getJsonDataset(req.params.id).then(dataset => {
                return asyncPageToArray(
                    this.source.getJsonDistributions(dataset)
                ).then(distributions => {
                    res.send(distributions);
                });
            });
        });

        app.get("/v0/datasets/:id/publisher", (req, res) => {
            this.source.getJsonDataset(req.params.id).then(dataset => {
                return this.source
                    .getJsonDatasetPublisher(dataset)
                    .then(publisher => {
                        res.send(publisher);
                    });
            });
        });

        app.get("/v0/search/datasets", (req, res) => {
            asyncPageToArray(
                this.source.searchDatasetsByTitle(req.query.title, 10)
            ).then(datasets => {
                res.send(datasets);
            });
        });

        if (this.source.hasFirstClassOrganizations) {
            app.get("/v0/organizations/:id", (req, res) => {
                this.source
                    .getJsonFirstClassOrganization(req.params.id)
                    .then(function(organization) {
                        res.send(organization);
                    });
            });

            app.get("/v0/search/organizations", (req, res) => {
                asyncPageToArray(
                    this.source.searchFirstClassOrganizationsByTitle(
                        req.query.title,
                        5
                    )
                ).then(organizations => {
                    res.send(organizations);
                });
            });
        }

        app.get("/v0/test-harness.js", function(req, res) {
            res.sendFile(transformerForBrowserPath);
        });

        app.listen(options.listenPort);
        console.log(`Listening on port ${options.listenPort}.`);
    }

    private shutdownOnIdle(express: express.Express, timeoutSeconds: number) {
        // Arrange to shut down the Express server after the idle timeout expires.
        let timeoutId: NodeJS.Timer;

        function resetTimeout() {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(function() {
                console.log("Shutting down due to idle timeout.");

                // TODO: Should just shut down the HTTP server instead of the whole process.
                process.exit(0);
            }, timeoutSeconds * 1000);
        }

        express.use(function(req, res, next) {
            resetTimeout();
            next();
        });

        resetTimeout();
    }

    public async putRecord(
        record: Record,
        recordType: RecordType
    ): Promise<Record | Error> {
        if (!record.id) {
            const noIdMessage = `Tried to put record with no id: ${JSON.stringify(
                record
            )}`;

            console.error(noIdMessage);

            return Promise.resolve(new Error(noIdMessage));
        }

        return this.registry.putRecord({
            ...this.attachConnectorDataToSource(
                this.attachConnectorPresetAspects(record, recordType)
            ),
            sourceTag: this.sourceTag
        });
    }

    /**
     * Copy `extras` from connector config data to
     * records `source` aspect
     */
    private attachConnectorDataToSource(record: Record) {
        if (
            !record ||
            !record.aspects ||
            !record.aspects.source ||
            !this.configData.extras
        ) {
            return record;
        }
        const deepDataCopy = _.merge({}, this.configData.extras);
        record.aspects.source["extras"] = deepDataCopy;
        return record;
    }

    private attachConnectorPresetAspects(
        record: Record,
        recordType: RecordType
    ) {
        if (
            !this.configData.presetRecordAspects ||
            !this.configData.presetRecordAspects.length
        ) {
            // --- no `presetRecordAspects` config, do nothing
            return record;
        }
        const presetRecordAspects = this.configData.presetRecordAspects.filter(
            presetAspect => {
                if (!presetAspect.recordType) {
                    // --- if not specified, apply to all records
                    return true;
                }
                return (
                    presetAspect.recordType.toUpperCase() ===
                    recordType.toUpperCase()
                );
            }
        );

        if (!presetRecordAspects.length) {
            return record;
        }

        if (!record.aspects) {
            record.aspects = {};
        }
        presetRecordAspects.forEach(presetRecordAspect => {
            if (typeof presetRecordAspect !== "object") {
                return;
            }

            const { id, data } = presetRecordAspect;
            if (!id || !data) {
                return;
            }

            const opType = String(presetRecordAspect.opType).toUpperCase();
            //--- avoid deep merge from altering data later
            const deepDataCopy = _.merge({}, data);

            if (!record.aspects[id]) {
                record.aspects[id] = deepDataCopy;
                return;
            }

            if (opType === "FILL") {
                return;
            } else if (opType === "REPLACE") {
                record.aspects[id] = deepDataCopy;
                return;
            } else if (opType === "MERGE_RIGHT") {
                record.aspects[id] = _.merge(record.aspects[id], deepDataCopy);
                return;
            } else {
                // --- MERGE_LEFT should be default operation
                record.aspects[id] = _.mergeWith(
                    deepDataCopy,
                    record.aspects[id],
                    // --- if target property is null, it should be overwritten as well
                    (a, b) => (b === null ? a : undefined)
                );
                return;
            }
        });
        return record;
    }
}

export interface ConnectorSource {
    /**
     * The ID of the source. This is used to prefix IDs of datasets, distributions, and organizations
     * found in this source.
     */
    readonly id: string;

    /**
     * The user-friendly name of the source.
     */
    readonly name: string;

    /**
     * This field is not compulsory and JsonConnector will try to locate its value from commandline parameters
     * before use ConnectorSource.extras as backup --- more for test cases
     */
    readonly extras?: JsonConnectorConfigExtraMetaData;

    /**
     * This field is not compulsory and JsonConnector will try to locate its value from commandline parameters
     * before use ConnectorSource.presetRecordAspects as backup --- more for test cases
     */
    readonly presetRecordAspects?: JsonConnectorConfigPresetAspect[];

    /**
     * Get all of the datasets as pages of objects.
     *
     * @returns {AsyncPage<any[]>} A page of datasets.
     */
    getJsonDatasets(): AsyncPage<any[]>;

    /**
     * Get a particular dataset given its ID.
     *
     * @param {string} id The ID of the dataset.
     * @returns {Promise<any>} The dataset object with the given ID.
     */
    getJsonDataset(id: string): Promise<any>;

    /**
     * Search datasets for those that have a particular case-insensitive string
     * in their title.
     *
     * @param {string} title The string to search for the in the title.
     * @param {number} maxResults The maximum number of results to return.
     * @returns {AsyncPage<any[]>} A page of matching datasets.
     */
    searchDatasetsByTitle(title: string, maxResults: number): AsyncPage<any[]>;

    /**
     * Gets the distributions of a given dataset.
     *
     * @param {object} dataset The dataset.
     * @returns {AsyncPage<any[]>} A page of distributions of the dataset.
     */
    getJsonDistributions(dataset: any): AsyncPage<any[]>;

    /**
     * True if the source provides organizations as first-class objects that can be enumerated and retrieved
     * by ID.  False if organizations are just fields on datasets or distributions, or if they're not
     * available at all.
     */
    readonly hasFirstClassOrganizations: boolean;

    /**
     * Enumerates first-class organizations.  If {@link hasFirstClassOrganizations} is false, this
     * method returns undefined.
     *
     * @returns {AsyncPage<any[]>} A page of organizations, or undefined if first-class organizations are not available.
     */
    getJsonFirstClassOrganizations(): AsyncPage<any[]>;

    /**
     * Gets a first-class organization by ID. If {@link hasFirstClassOrganizations} is false, this
     * method returns undefined.
     *
     * @param {string} id The ID of the organization to retrieve.
     * @returns {Promise<any>} A promise for the organization, or undefined if first-class organizations are not available.
     */
    getJsonFirstClassOrganization(id: string): Promise<any>;

    /**
     * Search first-class organizations for those that have a particular case-insensitive string
     * in their title.
     *
     * @param {string} title The string to search for the in the title.
     * @param {number} maxResults The maximum number of results to return.
     * @returns {AsyncPage<any[]>} A page of matching organizations, or undefined if first-class organizations are not available.
     */
    searchFirstClassOrganizationsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]>;

    /**
     * Gets the ID of the publisher of this dataset.  This method will return undefined if {@link hasFirstClassOrganizations}
     * is false because non-first-class organizations do not have IDs.
     *
     * @param {any} dataset The dataset from which to get the publisher ID.
     * @returns {string} The ID of the dataset's publisher.
     */
    getJsonDatasetPublisherId(dataset: any): string;

    /**
     * Gets the publisher organization of this dataset.
     *
     * @param {any} dataset The dataset from which to get the publisher.
     * @returns {Promise<object>} A promise for the organization that published this dataset.
     */
    getJsonDatasetPublisher(dataset: any): Promise<any>;
}

export interface JsonConnectorOptions {
    source: ConnectorSource;
    transformer: JsonTransformer;
    registry: Registry;
    maxConcurrency?: number;
    sourceTag?: string;
}

export interface JsonConnectorRunInteractiveOptions {
    timeoutSeconds: number;
    listenPort: number;
    transformerOptions: any;
}

/**
 * Connector extra metadata
 * Will be copied to records' source aspect automatically
 */
export type JsonConnectorConfigExtraMetaData = {
    [k: string]: any;
};

/**
 * Any aspects that will be `preset` on any records created by the connector
 *
 * opType: operation type; Describe how to add the aspect to the record
 * - MERGE_LEFT: merge `presetAspect` with records aspects.
 *   i.e. `presetAspect` will be overwritten by records aspects data if any
 * - MEREG_RIGHT: merge records aspects with `presetAspect`.
 *   i.e. records aspects data (if any) will be overwritten by `presetAspect`
 * - REPLACE: `presetAspect` will replace any existing records aspect
 * - FILL: `presetAspect` will be added if no existing aspect
 * Default value (If not specified) will be `MERGE_LEFT`
 *
 * recordType:
 * Describes which type of records this aspect will be added to;
 * If this field is omitted, the aspect will be added to every records.
 *
 * data: Object; aspect data
 */
export type JsonConnectorConfigPresetAspect = {
    id: string;
    recordType?: RecordType;
    opType?: "MERGE_LEFT" | "REPLACE" | "FILL" | "MERGE_RIGHT";
    data: {
        [k: string]: any;
    };
};

export interface JsonConnectorConfig {
    id: string;
    name: string;
    sourceUrl?: string;
    pageSize?: number;
    schedule?: string;
    ignoreHarvestSources?: string[];
    allowedOrganisationNames?: string[];
    ignoreOrganisationNames?: string[];

    extras?: JsonConnectorConfigExtraMetaData;
    presetRecordAspects?: JsonConnectorConfigPresetAspect[];
}
