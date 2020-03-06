import request from "supertest";
import { Server } from "http";
import express from "express";
import nock from "nock";
import sinon from "sinon";
import _ from "lodash";
import { expect } from "chai";

import { Record } from "magda-typescript-common/src/generated/registry/api";
import {
    arbFlatMap,
    lcAlphaNumStringArbNe,
    recordArb
} from "magda-typescript-common/src/test/arbitraries";
import jsc from "magda-typescript-common/src/test/jsverify";

import MinionOptions from "../MinionOptions";
import minion from "../index";
import fakeArgv from "./fakeArgv";
import makePromiseQueryable from "./makePromiseQueryable";
import baseSpec from "./baseSpec";

baseSpec(
    "webhooks",
    (
        expressApp: () => express.Express,
        expressServer: () => Server,
        listenPort: () => number,
        beforeEachProperty: () => void
    ) => {
        doWebhookTest("should work synchronously", false);
        doWebhookTest("should work asynchronously", true);

        function doWebhookTest(caption: string, async: boolean) {
            it(caption, () => {
                const batchResultsArb = jsc.suchthat(
                    jsc.array(jsc.bool),
                    array => array.length <= 5
                );

                const recordWithSuccessArb = (mightFail: boolean) =>
                    jsc.record({
                        record: recordArb,
                        success: mightFail ? jsc.bool : jsc.constant(true)
                    });

                const recordsWithSuccessArrArb = (success: boolean) => {
                    const baseArb = jsc.array(recordWithSuccessArb(!success));

                    return success
                        ? baseArb
                        : jsc.suchthat(baseArb, combined =>
                              combined.some(({ success }) => !success)
                          );
                };

                type Batch = {
                    /** Each record in the batch and whether it should succeed when
                     *  onRecordFound is called */
                    records: { record: Record; success: boolean }[];
                    /** Whether the overall batch should succeed - to succeed, every record
                     *  should succeed, to fail then at least one record should fail. */
                    overallSuccess: boolean;
                };

                const batchArb = arbFlatMap<boolean[], Batch[]>(
                    batchResultsArb,
                    batchResults => {
                        const batchArb = batchResults.map(overallSuccess =>
                            recordsWithSuccessArrArb(overallSuccess).smap(
                                records => ({ records, overallSuccess }),
                                ({ records }) => records
                            )
                        );
                        return batchArb.length > 0
                            ? jsc.tuple(batchArb)
                            : jsc.constant([]);
                    },
                    batches =>
                        batches.map(({ overallSuccess }) => overallSuccess)
                );

                /** Global hook id generator - incremented every time we create another hook */
                let lastHookId = 0;
                return jsc.assert(
                    jsc.forall(
                        batchArb,
                        lcAlphaNumStringArbNe,
                        lcAlphaNumStringArbNe,
                        lcAlphaNumStringArbNe,
                        jsc.integer(1, 10),
                        jsc.bool,
                        (
                            recordsBatches,
                            domain,
                            jwtSecret,
                            userId,
                            concurrency,
                            enableMultiTenant
                        ) => {
                            beforeEachProperty();

                            const registryDomain = "example";
                            const registryUrl = `http://${registryDomain}.com:80`;
                            const registryScope = nock(registryUrl);
                            const tenantDomain = "tenant";
                            const tenantUrl = `http://${tenantDomain}.com:80`;
                            const tenantScope = nock(tenantUrl);

                            /** All records in all the batches */
                            const flattenedRecords = _.flatMap(
                                recordsBatches,
                                batch => batch.records
                            );
                            /** Error thrown when the call is *supposed* to fail  */
                            const fakeError = new Error(
                                "Fake-ass testing error"
                            );
                            (fakeError as any).ignore = true;

                            const internalUrl = `http://${domain}.com`;

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
                                onRecordFound: sinon
                                    .stub()
                                    .callsFake((foundRecord: Record) => {
                                        const match = flattenedRecords.find(
                                            ({ record: thisRecord }) => {
                                                return (
                                                    thisRecord.id ===
                                                    foundRecord.id
                                                );
                                            }
                                        );
                                        return match.success
                                            ? Promise.resolve()
                                            : Promise.reject(fakeError);
                                    })
                            };

                            registryScope.get(/\/hooks\/.*/).reply(200, {
                                url: internalUrl + "/hook",
                                config: {
                                    aspects: [],
                                    optionalAspects: [],
                                    includeEvents: false,
                                    includeRecords: true,
                                    includeAspectDefinitions: false,
                                    dereference: true
                                }
                            });
                            registryScope.post(/\/hooks\/.*/).reply(201, {});

                            tenantScope.get("/tenants").reply(200, []);

                            return minion(options)
                                .then(() =>
                                    Promise.all(
                                        recordsBatches.map(batch => {
                                            lastHookId++;

                                            if (async) {
                                                // If we're running async then we expect that there'll be a call to the registry
                                                // telling it to give more events.
                                                registryScope
                                                    .post(
                                                        `/hooks/${
                                                            options.id
                                                        }/ack`,
                                                        {
                                                            succeeded:
                                                                batch.overallSuccess,
                                                            lastEventIdReceived: lastHookId,
                                                            // Deactivate if not successful.
                                                            ...(batch.overallSuccess
                                                                ? {}
                                                                : {
                                                                      active: false
                                                                  })
                                                        }
                                                    )
                                                    .reply(201);
                                            }

                                            // Send the hook payload to the minion
                                            const test = request(
                                                expressServer()
                                            )
                                                .post("/hook")
                                                .set(
                                                    "Content-Type",
                                                    "application/json"
                                                )
                                                .send({
                                                    records: batch.records.map(
                                                        ({ record }) => record
                                                    ),
                                                    deferredResponseUrl: `${registryUrl}/hooks/${lastHookId}`,
                                                    lastEventId: lastHookId
                                                })
                                                .expect((response: any) => {
                                                    if (
                                                        response.status !==
                                                            201 &&
                                                        response.status !== 500
                                                    ) {
                                                        console.log(response);
                                                    }
                                                })
                                                // The hook should only return 500 if it's failed synchronously.
                                                .expect(
                                                    async ||
                                                        batch.overallSuccess
                                                        ? 201
                                                        : 500
                                                )
                                                .expect((response: any) => {
                                                    expect(
                                                        !!response.body
                                                            .deferResponse
                                                    ).to.equal(async);
                                                });

                                            const queryable = makePromiseQueryable(
                                                test
                                            );

                                            expect(queryable.isFulfilled()).to
                                                .be.false;

                                            return queryable.then(() =>
                                                batch.records.forEach(
                                                    ({ record }) =>
                                                        expect(
                                                            (options.onRecordFound as sinon.SinonStub).calledWith(
                                                                record
                                                            )
                                                        )
                                                )
                                            );
                                        })
                                    )
                                )
                                .then(() => {
                                    registryScope.done();
                                    return true;
                                });
                        }
                    ),
                    {}
                );
            });
        }
    }
);
