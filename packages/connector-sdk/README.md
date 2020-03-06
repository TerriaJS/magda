### MAGDA Connector SDK

`Magda Connectors` are [Magda](https://github.com/magda-io/magda) backend processes that go out to external datasources and copy their metadata into the [Magda registry](https://github.com/magda-io/magda#registry), so that they can be searched and have other aspects attached to them. A connector is simply a docker-based microservice that is invoked as a job. It scans the target datasource (usually an open-data portal), then completes and shuts down. We have connectors for a number of existing open data formats, otherwise you can easily write and run your own.

This SDK provides scaffolding that help you to create your own (nodeJs based) connectors easily.

The following two packages may help connector devleopment as well:

-   [@magda/utils](https://www.npmjs.com/package/@magda/utils)
-   [@magda/connector-test-utils](https://www.npmjs.com/package/@magda/connector-test-utils)

### Example

See [magda-ckan-connector](https://github.com/magda-io/magda-ckan-connector)

### Content

#### JsonConnector

A base class for connectors for most any JSON-based catalog source.

```typescript
export declare class JsonConnector {
    readonly source: ConnectorSource;
    readonly transformer: JsonTransformer;
    readonly registry: AuthorizedRegistryClient;
    readonly maxConcurrency: number;
    readonly sourceTag?: string;
    readonly configData?: JsonConnectorConfig;
    constructor({
        source,
        transformer,
        registry,
        maxConcurrency,
        sourceTag
    }: JsonConnectorOptions);
    readConfigData(): JsonConnectorConfig;
    createAspectDefinitions(): Promise<ConnectionResult>;
    createOrganization(organizationJson: object): Promise<Record | Error>;
    createDataset(datasetJson: object): Promise<Record | Error>;
    createDistribution(
        distributionJson: object,
        datasetJson: object
    ): Promise<Record | Error>;
    createOrganizations(): Promise<ConnectionResult>;
    createDatasetsAndDistributions(): Promise<ConnectionResult>;
    trimRecords(): Promise<ConnectionResult>;
    /**
     * Runs the connector, creating aspect definitions, organizations, datasets, and distributions in the
     * registry as necessary.
     *
     * @returns {Promise<ConnectionResult>}
     * @memberof JsonConnector
     */
    run(): Promise<ConnectionResult>;
    runInteractive(options: JsonConnectorRunInteractiveOptions): void;
    private shutdownOnIdle;
    putRecord(record: Record, recordType: RecordType): Promise<Record | Error>;
    /**
     * Copy `extras` from connector config data to
     * records `source` aspect
     */
    private attachConnectorDataToSource;
    private attachConnectorPresetAspects;
}
```

### JsonTransformer

A base class for transformers for most any JSON-based catalog source.
A transformer takes source data and transforms it to registry records and aspects.

```typescript
export abstract class JsonTransformer {
    readonly sourceId: string;
    private datasetAspectBuilders;
    private distributionAspectBuilders;
    private organizationAspectBuilders;
    private organizationAspects;
    private datasetAspects;
    private distributionAspects;
    private tenantId;
    constructor({
        sourceId,
        libraries,
        datasetAspectBuilders,
        distributionAspectBuilders,
        organizationAspectBuilders
    }: JsonTransformerOptions);
    /**
     * Create a {@link Record} from JSON data representing an organization.
     *
     * @param {string} id The ID of the record.
     * @param {string} name The name of the record.
     * @param {object} jsonOrganization The JSON data representing the organization.
     * @returns {Record} The record.
     *
     * @memberof JsonConnector
     */
    organizationJsonToRecord(jsonOrganization: object): Record;
    datasetJsonToRecord(jsonDataset: object): Record;
    distributionJsonToRecord(
        jsonDistribution: object,
        jsonDataset: object
    ): Record;
    getRequiredAspectDefinitions(): AspectDefinition[];
    abstract getIdFromJsonOrganization(
        jsonOrganization: any,
        sourceId: string
    ): ConnectorRecordId;
    abstract getIdFromJsonDataset(
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId;
    abstract getIdFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId;
    abstract getNameFromJsonOrganization(jsonOrganization: any): string;
    abstract getNameFromJsonDataset(jsonDataset: any): string;
    abstract getNameFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any
    ): string;
    reviseOrganizationRecord(record: Record): Record;
    jsonToRecord(
        id: ConnectorRecordId,
        name: string,
        json: any,
        aspects: CompiledAspects
    ): Record;
}
```

### AuthorizedRegistryClient

A Magda registry client.

```typescript
export declare class AuthorizedRegistryClient extends RegistryClient {
    protected options: AuthorizedRegistryOptions;
    protected jwt: string;
    constructor(options: AuthorizedRegistryOptions);
    putAspectDefinition(
        aspectDefinition: AspectDefinition,
        tenantId?: number
    ): Promise<AspectDefinition | Error>;
    postHook(hook: WebHook): Promise<WebHook | Error>;
    putHook(hook: WebHook): Promise<WebHook | Error>;
    getHook(hookId: string): Promise<Maybe<WebHook> | Error>;
    getHooks(): Promise<WebHook[] | Error>;
    resumeHook(
        webhookId: string,
        succeeded?: boolean,
        lastEventIdReceived?: string,
        active?: boolean
    ): Promise<WebHookAcknowledgementResponse | Error>;
    putRecord(record: Record, tenantId?: number): Promise<Record | Error>;
    putRecordAspect(
        recordId: string,
        aspectId: string,
        aspect: any,
        tenantId?: number
    ): Promise<Record | Error>;
    patchRecordAspect(
        recordId: string,
        aspectId: string,
        aspectPatch: Operation[],
        tenantId?: number
    ): Promise<Record | Error>;
    deleteBySource(
        sourceTagToPreserve: string,
        sourceId: string,
        tenantId?: number
    ): Promise<MultipleDeleteResult | "Processing" | Error>;
}
```

#### Other Utils & typescript definitions

```typescript
export declare interface AspectBuilder {
    aspectDefinition: AspectDefinition;
    builderFunctionString: string;
    setupFunctionString?: string;
}

declare class AspectCreationFailure {
    readonly id: string;
    readonly error: Error;
    constructor(id: string, error: Error);
}

/**
 * A type of aspect in the registry, unique for a tenant.
 */
declare class AspectDefinition {
    /**
     * The identifier for the aspect type.
     */
    "id": string;
    /**
     * The name of the aspect.
     */
    "name": string;
    /**
     * The JSON Schema of this aspect.
     */
    "jsonSchema": any;
}

declare class AspectDefinitionsApi {
    protected basePath: string;
    protected defaultHeaders: any;
    protected _useQuerystring: boolean;
    protected authentications: any;
    constructor(basePath?: string);
    set useQuerystring(value: boolean);
    setApiKey(key: AspectDefinitionsApiApiKeys, value: string): void;
    /**
     * Create a new aspect
     *
     * @param xMagdaTenantId 0
     * @param aspect The definition of the new aspect.
     * @param xMagdaSession Magda internal session id
     */
    create(
        xMagdaTenantId: number,
        aspect: AspectDefinition,
        xMagdaSession: string
    ): Promise<{
        response: http.IncomingMessage;
        body: AspectDefinition;
    }>;
    /**
     * Get a list of all aspects
     *
     * @param xMagdaTenantId 0
     */
    getAll(
        xMagdaTenantId: number
    ): Promise<{
        response: http.IncomingMessage;
        body: Array<AspectDefinition>;
    }>;
    /**
     * Get an aspect by ID
     *
     * @param xMagdaTenantId 0
     * @param id ID of the aspect to be fetched.
     */
    getById(
        xMagdaTenantId: number,
        id: string
    ): Promise<{
        response: http.IncomingMessage;
        body: AspectDefinition;
    }>;
    /**
     * Modify an aspect by applying a JSON Patch
     * The patch should follow IETF RFC 6902 (https://tools.ietf.org/html/rfc6902).
     * @param xMagdaTenantId 0
     * @param id ID of the aspect to be saved.
     * @param aspectPatch The RFC 6902 patch to apply to the aspect.
     * @param xMagdaSession Magda internal session id
     */
    patchById(
        xMagdaTenantId: number,
        id: string,
        aspectPatch: Array<Operation>,
        xMagdaSession: string
    ): Promise<{
        response: http.IncomingMessage;
        body: AspectDefinition;
    }>;
    /**
     * Modify an aspect by ID
     * Modifies the aspect with a given ID.  If an aspect with the ID does not yet exist, it is created.
     * @param xMagdaTenantId 0
     * @param id ID of the aspect to be saved.
     * @param aspect The aspect to save.
     * @param xMagdaSession Magda internal session id
     */
    putById(
        xMagdaTenantId: number,
        id: string,
        aspect: AspectDefinition,
        xMagdaSession: string
    ): Promise<{
        response: http.IncomingMessage;
        body: AspectDefinition;
    }>;
}

export abstract class BuilderFunctionParameters {
    /**
     * The result of invoking the {@link AspectBuilder#setupFunctionString}, or undefined if there is no
     * {@link AspectBuilder#setupFunctionString} defined for this builder.
     *
     * @type {*}
     * @memberOf BuilderFunctionParameters
     */
    setup: any;
    /**
     * The transformer that is building aspects.
     *
     * @type {JsonTransformer}
     * @memberof BuilderFunctionParameters
     */
    transformer: JsonTransformer;
    /**
     * Reports a non-fatal problem creating an aspect.
     *
     * @type {ReportProblem}
     * @memberOf BuilderFunctionParameters
     */
    reportProblem: ReportProblem;
    /**
     * Provides access to utility libraries that may be helpful in building aspects.
     *
     * @type {BuilderFunctionLibraries}
     * @memberOf BuilderFunctionParameters
     */
    libraries: object;
    [propName: string]: any;
}

export declare interface BuilderSetupFunctionParameters {
    /**
     * The transformer that is building aspects.
     *
     * @type {JsonTransformer}
     * @memberof BuilderFunctionParameters
     */
    transformer: JsonTransformer;
    /**
     * Provides access to utility libraries that may be helpful in setting up the builder.
     *
     * @type {BuilderFunctionLibraries}
     * @memberOf BuilderFunctionParameters
     */
    libraries: object;
}

export declare function buildersToCompiledAspects(
    builders: AspectBuilder[],
    setupParameters: BuilderSetupFunctionParameters,
    buildParameters: BuilderFunctionParameters
): CompiledAspects;

export declare function cleanOrgTitle(title: string): string;

export declare interface CompiledAspects {
    parameterNames: string[];
    parameters: BuilderFunctionParameters;
    aspects: CompiledAspect[];
}

export declare class ConnectorRecordId {
    readonly id: string;
    readonly type: RecordType;
    readonly sourceId: string;
    constructor(id: string, type: RecordType, sourceId: string);
    toString(): string;
    private get typeId();
}

export declare interface ConnectorSource {
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

export declare interface JsonConnectorOptions {
    source: ConnectorSource;
    transformer: JsonTransformer;
    registry: AuthorizedRegistryClient;
    maxConcurrency?: number;
    sourceTag?: string;
}

export declare interface JsonConnectorRunInteractiveOptions {
    timeoutSeconds: number;
    listenPort: number;
    transformerOptions: any;
}

export declare interface JsonTransformerOptions {
    sourceId: string;
    libraries?: object;
    datasetAspectBuilders?: AspectBuilder[];
    distributionAspectBuilders?: AspectBuilder[];
    organizationAspectBuilders?: AspectBuilder[];
    maxConcurrency?: number;
    tenantId: number;
}

export declare const TenantConsts: any;
```
