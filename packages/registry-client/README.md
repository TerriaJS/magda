### MAGDA Registry Client

[Magda](https://github.com/magda-io/magda) revolves around the Registry - an unopinionated datastore built on top of Postgres. The Registry stores records as a set of JSON documents called aspects. For instance, a dataset is represented as a record with a number of aspects - a basic one that records the name, description and so on as well as more esoteric ones that might not be present for every dataset, like temporal coverage or determined data quality. Likewise, distributions (the actual data files, or URLs linking to them) are also modelled as records, with their own sets of aspects covering both basic metadata once again, as well as more specific aspects like whether the URL to the file worked when last tested.

This package provides NodeJs client library to connect to a Magda Registry.

### RegistryClient

```typescript
export declare class RegistryClient {
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
        maxRetries,
        secondsBetweenRetries,
        tenantId
    }: RegistryOptions);
    getRecordUrl(id: string): string;
    getAspectDefinitions(): Promise<AspectDefinition[] | Error>;
    getRecord(
        id: string,
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        dereference?: boolean
    ): Promise<Record | Error>;
    getRecords<I extends Record>(
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        pageToken?: string,
        dereference?: boolean,
        limit?: number,
        aspectQueries?: string[]
    ): Promise<RecordsPage<I> | Error>;
    getRecordsPageTokens(
        aspect?: Array<string>,
        limit?: number
    ): Promise<string[] | Error>;
}
```

### AuthorizedRegistryClient

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
