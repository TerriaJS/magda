### MAGDA Common Utils

This package includes the following common utilities that may help magda miniors / connectors development:

```typescript
export declare function addJwtSecretFromEnvVar<T>(
    argv: { [key in keyof Arguments<T>]: Arguments<T>[key] },
    required?: boolean
): { [key in keyof Arguments<T>]: Arguments<T>[key] };

export declare function arrayToMaybe<T>(rows: T[]): Maybe<T>;

export declare class AsyncPage<T> {
    readonly requestNextPage: CreateAsyncPage<T>;
    readonly data: T;
    readonly hasData: boolean;
    static create<T>(next: (data: T) => Promise<T>): AsyncPage<T>;
    static single<T>(value: T): AsyncPage<T>;
    static singlePromise<T>(valuePromise: Promise<T>): AsyncPage<T>;
    static none<T>(): AsyncPage<T>;
    constructor(data: T, hasData: boolean, requestNextPage: CreateAsyncPage<T>);
    map<TResult>(selector: (data: T) => TResult): AsyncPage<TResult>;
    forEach(callback: (data: T) => void): Promise<void>;
    take(n: number): AsyncPage<T>;
}

export declare function asyncPageToArray<T>(page: AsyncPage<T[]>): Promise<T[]>;

export declare class BadRequestError extends ServiceError {
    constructor(statusCode: number, errorResponse: ApiError, e: any);
}

export declare function buildJwt(
    jwtSecret: string,
    userId: string,
    session?: any
): any;

export declare const coerceJson: (param: string) => (json?: string) => any;

export declare function createServiceError(e: any): Error;

export declare function encodeURIComponentWithApost(string: string): string;

export declare function forEachAsync<T>(
    page: AsyncPage<T[]>,
    maxConcurrency: number,
    callbackFn: (data: T) => Promise<void>
): Promise<void>;

export declare function formatServiceError(
    baseMessage: string,
    e: any,
    retriesLeft: number
): string;

export declare function getMinikubeIP(): string;

export declare const isUuid: (id: any) => boolean;

export declare const request: any;

export declare function retry<T>(
    op: () => Promise<T>,
    delaySeconds: number,
    retries: number,
    onRetry: (e: any, retries: number) => any,
    shouldRetry?: (e: any) => boolean
): Promise<T>;

export declare function retryBackoff<T>(
    op: () => Promise<T>,
    delaySeconds: number,
    retries: number,
    onRetry: (e: any, retries: number) => any,
    easing?: (delaySeconds: number) => number
): Promise<T>;

export declare function runLater<TResult>(
    milliseconds: number,
    functionToRunLater: () => Promise<TResult> | TResult
): Promise<TResult>;

export declare class ServiceError extends Error {
    e: any;
    constructor(message: string, e: any);
}

export declare function unionToThrowable<T>(input: T | Error): T;
```
