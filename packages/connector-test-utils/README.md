### Magda Connector Utils for Test Cases

The package includes the following utilities for writing [Magda connector](https://github.com/magda-io/magda#connectors) test cases:

```typescript
export abstract class MockExpressServer {
    server: any;
    run(port: number): Promise<unknown>;
    abstract runImplementation(app: any): void;
}

export declare class MockRegistry extends MockExpressServer {
    aspects: any;
    records: any;
    env: any;
    runImplementation(registry: any): void;
}

/**
 * Hoping to re-use this functionality for all black-box style connector
 * testing.
 */
export declare function runConnectorTest(
    TEST_CASES: any[],
    Catalog: any,
    options?: any
): void;
```
