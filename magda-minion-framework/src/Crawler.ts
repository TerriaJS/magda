import { Record } from "magda-typescript-common/src/generated/registry/api";
import { RecordsPage } from "magda-typescript-common/src/registry/RegistryClient";
import unionToThrowable from "magda-typescript-common/src/util/unionToThrowable";
import AsyncPage, { forEachAsync } from "magda-typescript-common/src/AsyncPage";
import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";
import MinionOptions from "./MinionOptions";

class Crawler {
    private isCrawling: boolean = false;
    private crawlingPageToken: string = null;
    private crawledRecordNumber: number = 0;
    private crawlerPromise: Promise<void> = null;

    private registry: Registry = null;
    private options: MinionOptions = null;

    constructor(registry: Registry, options: MinionOptions) {
        this.registry = registry;
        this.options = options;
    }

    private resetCrawler() {
        this.isCrawling = false;
        this.crawlingPageToken = "";
        this.crawledRecordNumber = 0;
    }

    public getProgress() {
        return {
            isCrawling: this.isCrawling,
            crawlingPageToken: this.crawlingPageToken,
            crawledRecordNumber: this.crawledRecordNumber
        };
    }

    public start(): Promise<void> {
        if (this.isCrawling) return this.crawlerPromise;
        this.crawlerPromise = this.crawlExistingRecords();
        return this.crawlerPromise;
    }

    /**
     * allow in-process crawling to be waited by other program
     */
    public async waitForCrawling() {
        if (!this.isCrawling || !this.crawlerPromise) return;
        await this.crawlerPromise;
    }

    public isInProgress() {
        return this.isCrawling;
    }

    private async crawlExistingRecords() {
        try {
            this.resetCrawler();
            this.isCrawling = true;
            console.info("Crawling existing records in registry");

            const registryPage = AsyncPage.create<RecordsPage<Record>>(
                previous => {
                    if (previous && previous.hasMore === false) {
                        console.info("No more records left");
                        // Last page was an empty page, no more records left
                        return undefined;
                    } else {
                        console.info(
                            "Crawling after token " +
                                (previous && previous.nextPageToken
                                    ? previous.nextPageToken
                                    : "<first page>")
                        );
                        this.crawlingPageToken =
                            previous && previous.nextPageToken
                                ? previous.nextPageToken
                                : "";
                        // TODO: Retry with reduced limit if entity size too large error.
                        return this.registry
                            .getRecords<Record>(
                                this.options.aspects,
                                this.options.optionalAspects,
                                previous && previous.nextPageToken,
                                true,
                                10
                            )
                            .then(unionToThrowable)
                            .then(page => {
                                this.crawledRecordNumber += page.records.length;
                                console.info(
                                    `Crawled ${page.records.length} records`
                                );
                                return page;
                            });
                    }
                }
            ).map((page: RecordsPage<Record>) => page.records);

            await forEachAsync(
                registryPage,
                this.options.concurrency || 1,
                (record: Record) =>
                    this.options.onRecordFound(record, this.registry)
            );
        } finally {
            this.resetCrawler();
            this.crawlerPromise = null;
        }
    }
}

export default Crawler;
