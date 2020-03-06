export interface CreateAsyncPage<T> {
    (): Promise<AsyncPage<T>>;
}

export default class AsyncPage<T> {
    public readonly requestNextPage: CreateAsyncPage<T>;
    public readonly data: T;
    public readonly hasData: boolean;

    static create<T>(next: (data: T) => Promise<T>): AsyncPage<T> {
        const nextPage: (lastPage: T) => Promise<AsyncPage<T>> = (
            lastPage: T
        ) => {
            const nextPromise = next(lastPage);
            if (!nextPromise) {
                // There is no next page.
                return Promise.resolve(
                    new AsyncPage(undefined, false, undefined)
                );
            }
            return nextPromise.then(thisPage => {
                return new AsyncPage(thisPage, true, () => nextPage(thisPage));
            });
        };

        return new AsyncPage(undefined, false, () => nextPage(undefined));
    }

    static single<T>(value: T): AsyncPage<T> {
        return new AsyncPage<T>(value, true, undefined);
    }

    static singlePromise<T>(valuePromise: Promise<T>): AsyncPage<T> {
        return AsyncPage.create<T>(current =>
            current ? undefined : valuePromise
        );
    }

    static none<T>(): AsyncPage<T> {
        return new AsyncPage(undefined, false, undefined);
    }

    constructor(
        data: T,
        hasData: boolean,
        requestNextPage: CreateAsyncPage<T>
    ) {
        this.data = data;
        this.hasData = hasData;
        this.requestNextPage = requestNextPage;
    }

    map<TResult>(selector: (data: T) => TResult): AsyncPage<TResult> {
        async function loadNextPage(
            pager: AsyncPage<T>
        ): Promise<AsyncPage<TResult>> {
            const nextPage = await pager.requestNextPage();

            const data = nextPage.hasData ? selector(nextPage.data) : undefined;
            const loadNextPageFunction = nextPage.requestNextPage
                ? () => loadNextPage(nextPage)
                : undefined;

            return new AsyncPage<TResult>(
                data,
                nextPage.hasData,
                loadNextPageFunction
            );
        }

        return new AsyncPage<TResult>(
            this.hasData ? selector(this.data) : undefined,
            this.hasData,
            this.requestNextPage ? () => loadNextPage(this) : undefined
        );
    }

    async forEach(callback: (data: T) => void): Promise<void> {
        let current: AsyncPage<T> = this;
        while (current) {
            if (current.hasData) {
                callback(current.data);
            }

            if (current.requestNextPage) {
                current = await current.requestNextPage();
            } else {
                current = undefined;
            }
        }
    }

    take(n: number): AsyncPage<T> {
        if (n === 0) {
            return AsyncPage.none<T>();
        }
        const nextN = this.hasData ? n - 1 : n;
        return new AsyncPage<T>(
            this.data,
            this.hasData,
            this.requestNextPage
                ? () => this.requestNextPage().then(page => page.take(nextN))
                : undefined
        );
    }
}

export function forEachAsync<T>(
    page: AsyncPage<T[]>,
    maxConcurrency: number,
    callbackFn: (data: T) => Promise<void>
): Promise<void> {
    let currentPromise: Promise<AsyncPage<T[]>> = undefined;
    let currentPage = page;
    let currentIndex = 0;
    let resultIndex = 0;

    async function getNext(): Promise<{ value: T; index: number }> {
        while (
            currentPage.requestNextPage &&
            (!currentPage.hasData || currentIndex >= currentPage.data.length)
        ) {
            if (!currentPromise) {
                currentPromise = currentPage
                    .requestNextPage()
                    .then(nextPage => {
                        currentIndex = 0;
                        currentPromise = undefined;
                        currentPage = nextPage;
                        return nextPage;
                    });
            }

            currentPage = await currentPromise;
        }

        if (!currentPage.hasData || currentIndex >= currentPage.data.length) {
            return undefined;
        }

        return {
            value: currentPage.data[currentIndex++],
            index: resultIndex++
        };
    }

    async function callNext(): Promise<void> {
        const next = await getNext();
        if (!next) {
            return;
        }

        await callbackFn(next.value);

        // Start the next value.
        return callNext();
    }

    const promises = [];

    for (var i = 0; i < maxConcurrency; ++i) {
        promises.push(callNext());
    }

    return Promise.all(promises).then(results => {
        return;
    });
}

export function asyncPageToArray<T>(page: AsyncPage<T[]>): Promise<T[]> {
    const result = new Array<T>();
    return page
        .forEach(value => {
            result.push(...value);
        })
        .then(() => result);
}
