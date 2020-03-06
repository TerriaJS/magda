import {
    AspectDefinition,
    AspectDefinitionsApi,
    Record,
    RecordsApi,
    RecordAspectsApi,
    WebHooksApi
} from "../generated/registry/api";
import URI from "urijs";
import retry from "../retry";
import formatServiceError from "../formatServiceError";
import createServiceError from "../createServiceError";

export interface RegistryOptions {
    baseUrl: string;
    maxRetries?: number;
    secondsBetweenRetries?: number;
    tenantId: number;
}

export interface PutResult {
    successfulPuts: number;
    errors: Error[];
}

export interface RecordsPage<I extends Record> {
    totalCount: number;
    hasMore: boolean;
    nextPageToken?: string;
    records: I[];
}

export default class RegistryClient {
    protected baseUri: uri.URI;
    protected aspectDefinitionsApi: AspectDefinitionsApi;
    protected recordsApi: RecordsApi;
    protected webHooksApi: WebHooksApi;
    protected recordAspectsApi: RecordAspectsApi;
    protected maxRetries: number;
    protected secondsBetweenRetries: number;
    protected tenantId: number;
    protected jwt: string | undefined;

    constructor({
        baseUrl,
        maxRetries = 10,
        secondsBetweenRetries = 10,
        tenantId
    }: RegistryOptions) {
        if (tenantId === undefined) {
            throw Error("A tenant id must be defined.");
        }

        this.tenantId = tenantId;
        const registryApiUrl = baseUrl;
        this.baseUri = new URI(baseUrl);
        this.maxRetries = maxRetries;
        this.secondsBetweenRetries = secondsBetweenRetries;

        this.aspectDefinitionsApi = new AspectDefinitionsApi(registryApiUrl);
        this.recordsApi = new RecordsApi(registryApiUrl);
        this.recordsApi.useQuerystring = true; // Use querystring instead of qs to construct URL
        this.recordAspectsApi = new RecordAspectsApi(registryApiUrl);
        this.webHooksApi = new WebHooksApi(registryApiUrl);
    }

    getRecordUrl(id: string): string {
        return this.baseUri
            .clone()
            .segment("records")
            .segment(id)
            .toString();
    }

    getAspectDefinitions(): Promise<AspectDefinition[] | Error> {
        const operation = () => () =>
            this.aspectDefinitionsApi.getAll(this.tenantId);
        return <any>retry(
            operation(),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        "Failed to GET aspect definitions.",
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecord(
        id: string,
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        dereference?: boolean
    ): Promise<Record | Error> {
        const operation = (id: string) => () =>
            this.recordsApi.getById(
                id,
                this.tenantId,
                aspect,
                optionalAspect,
                dereference,
                this.jwt
            );
        return <any>retry(
            operation(id),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET records.", e, retriesLeft)
                ),
            e => e.response.statusCode !== 404
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecords<I extends Record>(
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        pageToken?: string,
        dereference?: boolean,
        limit?: number,
        aspectQueries?: string[]
    ): Promise<RecordsPage<I> | Error> {
        const operation = (pageToken: string) => () =>
            this.recordsApi.getAll(
                this.tenantId,
                aspect,
                optionalAspect,
                pageToken,
                undefined,
                limit,
                dereference,
                aspectQueries,
                this.jwt
            );
        return <any>retry(
            operation(pageToken),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET records.", e, retriesLeft)
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecordsPageTokens(
        aspect?: Array<string>,
        limit?: number
    ): Promise<string[] | Error> {
        const operation = () =>
            this.recordsApi.getPageTokens(
                this.tenantId,
                aspect,
                limit,
                this.jwt
            );
        return <any>retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        "Failed to GET records page tokens.",
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }
}
