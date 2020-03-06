import { Server } from "http";
import express from "express";
import nock from "nock";
import _ from "lodash";
import { expect } from "chai";
import queryString from "query-string";
import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";

import { Record } from "magda-typescript-common/src/generated/registry/api";
import { lcAlphaNumStringArbNe } from "magda-typescript-common/src/test/arbitraries";
import jsc from "magda-typescript-common/src/test/jsverify";

import MinionOptions from "../MinionOptions";
import fakeArgv from "./fakeArgv";
import baseSpec from "./baseSpec";
import Crawler from "../Crawler";
import { MAGDA_ADMIN_PORTAL_ID } from "magda-typescript-common/src/registry/TenantConsts";

baseSpec(
    "Crawler",
    (
        expressApp: () => express.Express,
        expressServer: () => Server,
        listenPort: () => number,
        beforeEachProperty: () => void
    ) => {
        //--- avoid different property test hit into the same registry domain
        let registryDomainCounter = 0;

        //--- function implements generic crawler testing logic
        async function basecrawlerTest(
            registryTotalRecordsNumber: number,
            domain: string,
            jwtSecret: string,
            userId: string,
            concurrency: number,
            async: boolean,
            enableMultiTenant: boolean,
            // --- init func creates other context variables shared among callbacks
            envInit: () => any,
            onRecordFound: (
                record: Record,
                registry: Registry
            ) => Promise<void>,
            registryReplyFunc: (uri: string, requestBody: string) => any,
            propertyCheckingFunc: () => boolean
        ) {
            beforeEachProperty();

            const internalUrl = `http://${domain}.com`;
            const registryDomain = "registry_" + registryDomainCounter;
            const tenantDomain = "tenant_" + registryDomainCounter;
            registryDomainCounter++;
            const registryUrl = `http://${registryDomain}.com:80`;
            const tenantUrl = `http://${tenantDomain}.com:80`;
            const registryScope = nock(registryUrl);
            const tenantId = MAGDA_ADMIN_PORTAL_ID;

            const registry = new Registry({
                baseUrl: registryUrl,
                jwtSecret: jwtSecret,
                userId: userId,
                tenantId: tenantId
            });

            let context: any = {
                registryTotalRecordsNumber,
                domain,
                jwtSecret,
                userId,
                concurrency,
                async,
                registryScope,
                registry
            };

            const env = envInit.bind(context)();
            if (env && typeof env === "object")
                context = { ...context, ...env };

            const options: MinionOptions = {
                argv: fakeArgv({
                    internalUrl,
                    registryUrl,
                    enableMultiTenant,
                    tenantUrl,
                    jwtSecret,
                    userId,
                    listenPort: listenPort()
                }),
                id: "id",
                aspects: [],
                optionalAspects: [],
                writeAspectDefs: [],
                async,
                express: expressApp,
                concurrency: concurrency,
                onRecordFound: onRecordFound.bind(context)
            };

            registryScope
                .persist()
                .get("/records")
                .query(true)
                .reply(registryReplyFunc.bind(context));

            const crawler = new Crawler(registry, options);
            context.crawler = crawler;

            await crawler.start();
            registryScope.done();
            return propertyCheckingFunc.bind(context)();
        }

        function basePropertyTest(
            // --- init func creates other context variables shared among callbacks
            envInit: () => any,
            onRecordFound: (
                record: Record,
                registry: Registry
            ) => Promise<void>,
            registryReplyFunc: (uri: string, requestBody: string) => any,
            propertyCheckingFunc: () => boolean
        ) {
            return jsc.assert(
                jsc.forall(
                    jsc.nat(100),
                    lcAlphaNumStringArbNe,
                    lcAlphaNumStringArbNe,
                    lcAlphaNumStringArbNe,
                    jsc.integer(1, 10),
                    jsc.bool,
                    jsc.bool,
                    _.partialRight(
                        basecrawlerTest,
                        envInit,
                        onRecordFound,
                        registryReplyFunc,
                        propertyCheckingFunc
                    )
                )
            );
        }

        it("should crawl all records in registry ONCE start() called ", () => {
            return basePropertyTest(
                function(this: any) {
                    //---envInit
                    //--- this table records whether all records are sent to onRecordFound for only once
                    const recordsTestTable: number[] = new Array(
                        this.registryTotalRecordsNumber
                    ).fill(0);
                    const registryRecords: Record[] = recordsTestTable.map(
                        (item, idx) => ({
                            id: String(idx),
                            name: "",
                            aspects: {},
                            sourceTag: "",
                            tenantId: MAGDA_ADMIN_PORTAL_ID,
                            authnReadPolicyId: undefined
                        })
                    );
                    return { recordsTestTable, registryRecords };
                },
                function(
                    //---onRecordFound
                    this: any,
                    foundRecord: Record,
                    registry: Registry
                ) {
                    const idx = parseInt(foundRecord.id, 10);
                    if (typeof this.recordsTestTable[idx] !== "number") {
                        throw new Error(
                            `try to increase invalid counter at ${idx}`
                        );
                    }
                    this.recordsTestTable[idx]++;
                    return Promise.resolve();
                },
                function(this: any, uri: string, requestBody: string) {
                    //---registryReplyFunc
                    const params = queryString.parseUrl(uri).query;
                    const pageIdx = params.pageToken
                        ? parseInt(params.pageToken as string, 10)
                        : 0;
                    const limit = parseInt(params.limit as string, 10);
                    if (limit < 1)
                        throw new Error("Invalid limit param received!");
                    if (pageIdx >= this.registryRecords.length)
                        return [
                            200,
                            {
                                totalCount: this.registryRecords.length,
                                hasMore: false,
                                records: new Array()
                            }
                        ];
                    const recordPage = this.registryRecords.slice(
                        pageIdx,
                        pageIdx + limit - 1
                    );

                    const resData: any = {
                        totalCount: this.registryRecords.length,
                        hasMore: true,
                        records: recordPage
                    };

                    const nextPageToken = pageIdx + recordPage.length;

                    if (nextPageToken < this.registryRecords.length) {
                        resData.nextPageToken = String(nextPageToken);
                    } else {
                        resData.hasMore = false;
                    }

                    return [200, resData];
                },
                function(this: any) {
                    //---propertyCheckingFunc
                    return (
                        this.recordsTestTable.findIndex(
                            (item: any) => item !== 1
                        ) === -1
                    );
                }
            );
        }).timeout(20000);

        it("should correctly return crawling progress at every step via getProgress()", () => {
            return basePropertyTest(
                function(this: any) {
                    //---envInit
                    const totalCrawledRecordsNumber = 0;

                    const registryRecords: Record[] = new Array(
                        this.registryTotalRecordsNumber
                    )
                        .fill(0)
                        .map((item, idx) => ({
                            id: String(idx),
                            name: "",
                            aspects: {},
                            sourceTag: "",
                            tenantId: MAGDA_ADMIN_PORTAL_ID,
                            authnReadPolicyId: undefined
                        }));
                    return {
                        totalCrawledRecordsNumber,
                        registryRecords
                    };
                },
                function(
                    //---onRecordFound
                    this: any,
                    foundRecord: Record,
                    registry: Registry
                ) {
                    return Promise.resolve();
                },
                function(this: any, uri: string, requestBody: string) {
                    //---registryReplyFunc
                    const params = queryString.parseUrl(uri).query;
                    const pageIdx = params.pageToken
                        ? parseInt(params.pageToken as string, 10)
                        : 0;
                    const limit = parseInt(params.limit as string, 10);
                    if (limit < 1)
                        throw new Error("Invalid limit param received!");
                    if (pageIdx >= this.registryRecords.length) {
                        return [
                            200,
                            {
                                totalCount: this.registryRecords.length,
                                hasMore: false,
                                records: []
                            }
                        ];
                    }
                    const recordPage = this.registryRecords.slice(
                        pageIdx,
                        pageIdx + limit - 1
                    );
                    const crawlingPageTokenValue = pageIdx + recordPage.length;
                    const crawlingPageToken = String(crawlingPageTokenValue);
                    this.totalCrawledRecordsNumber += recordPage.length;
                    const progress = this.crawler.getProgress();
                    expect(progress).to.deep.equal({
                        isCrawling: true,
                        crawlingPageToken: String(pageIdx ? pageIdx : ""),
                        crawledRecordNumber: pageIdx
                    });
                    return [
                        200,
                        {
                            totalCount: this.registryRecords.length,
                            hasMore: true,
                            nextPageToken: crawlingPageToken,
                            records: recordPage
                        }
                    ];
                },
                function(this: any) {
                    //---propertyCheckingFunc
                    return true;
                }
            );
        }).timeout(200000);
    }
);
