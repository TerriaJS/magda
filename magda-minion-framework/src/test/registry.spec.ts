import jsc from "magda-typescript-common/src/test/jsverify";
import nock from "nock";
import express from "express";
import { Server } from "http";

import { encodeURIComponentWithApost } from "magda-typescript-common/src/test/util";
import {
    WebHook,
    AspectDefinition
} from "magda-typescript-common/src/generated/registry/api";
import buildJwt from "magda-typescript-common/src/session/buildJwt";
import { lcAlphaNumStringArbNe } from "magda-typescript-common/src/test/arbitraries";

import fakeArgv from "./fakeArgv";
import MinionOptions from "../MinionOptions";
import minion from "../index";
import baseSpec from "./baseSpec";

const aspectArb = jsc.record({
    id: jsc.string,
    name: jsc.string,
    jsonSchema: jsc.json,
    tenantId: jsc.string
});

baseSpec(
    "registry interactions:",
    (
        expressApp: () => express.Express,
        expressServer: () => Server,
        listenPort: () => number,
        beforeEachProperty: () => void
    ) => {
        doStartupTest(
            "should register aspects",
            ({
                aspectDefs,
                registryScope,
                tenantScope,
                jwtSecret,
                userId,
                hook
            }) => {
                aspectDefs.forEach(aspectDef => {
                    registryScope
                        .put(
                            `/aspects/${encodeURIComponentWithApost(
                                aspectDef.id
                            )}`,
                            aspectDef,
                            {
                                reqheaders: reqHeaders(jwtSecret, userId)
                            }
                        )
                        .reply(201, aspectDef);
                });

                registryScope.get(/hooks\/.*/).reply(200, hook);
                registryScope.post(/hooks\/.*/).reply(201, {});
                tenantScope.get("/tenants").reply(200, []);
            }
        );

        doStartupTest(
            "should register hook if none exists",
            ({
                aspectDefs,
                registryScope,
                tenantScope,
                jwtSecret,
                userId,
                hook
            }) => {
                registryScope
                    .put(/aspects\/.*/)
                    .times(aspectDefs.length)
                    .optionally()
                    .reply(201, aspectDefs);

                registryScope
                    .get(
                        `/hooks/${encodeURIComponentWithApost(hook.id)}`,
                        undefined,
                        {
                            reqheaders: reqHeaders(jwtSecret, userId)
                        }
                    )
                    .reply(404, "");

                registryScope
                    .put(
                        `/hooks/${encodeURIComponentWithApost(hook.id)}`,
                        hook,
                        {
                            reqheaders: reqHeaders(jwtSecret, userId)
                        }
                    )
                    .reply(201, hook);

                registryScope
                    .get("/records")
                    .query(true)
                    .reply(200, { totalCount: 0, records: [], hasMore: false });

                tenantScope.get("/tenants").reply(200, []);
            }
        );

        doStartupTest(
            "should resume hook if one already exists",
            ({
                aspectDefs,
                registryScope,
                tenantScope,
                jwtSecret,
                userId,
                hook
            }) => {
                registryScope
                    .put(/aspects\/.*/)
                    .times(aspectDefs.length)
                    .optionally()
                    .reply(201, aspectDefs);

                registryScope
                    .get(
                        `/hooks/${encodeURIComponentWithApost(hook.id)}`,
                        undefined,
                        {
                            reqheaders: reqHeaders(jwtSecret, userId)
                        }
                    )
                    .reply(200, hook);

                registryScope
                    .post(
                        `/hooks/${encodeURIComponentWithApost(hook.id)}/ack`,
                        {
                            succeeded: false,
                            lastEventIdReceived: null
                        },
                        {
                            reqheaders: reqHeaders(jwtSecret, userId)
                        }
                    )
                    .reply(201, {
                        lastEventIdReceived: 1
                    });

                tenantScope.get("/tenants").reply(200, []);
            }
        );

        function doStartupTest(
            caption: string,
            fn: (x: {
                aspectDefs: AspectDefinition[];
                registryScope: nock.Scope;
                tenantScope: nock.Scope;
                jwtSecret: string;
                userId: string;
                hook: WebHook;
            }) => void
        ) {
            jsc.property(
                caption,
                jsc.array(aspectArb),
                jsc.nestring,
                lcAlphaNumStringArbNe,
                lcAlphaNumStringArbNe,
                lcAlphaNumStringArbNe,
                jsc.array(jsc.nestring),
                jsc.array(jsc.nestring),
                lcAlphaNumStringArbNe,
                lcAlphaNumStringArbNe,
                jsc.integer(0, 10),
                jsc.bool,
                (
                    aspectDefs: AspectDefinition[],
                    id: string,
                    registryHost: string,
                    tenantHost: string,
                    listenDomain: string,
                    aspects: string[],
                    optionalAspects: string[],
                    jwtSecret: string,
                    userId: string,
                    concurrency: number,
                    enableMultiTenant: boolean
                ) => {
                    beforeEachProperty();
                    const registryUrl = `http://${registryHost}.com`;
                    const registryScope = nock(registryUrl); //.log(console.log);

                    const tenantUrl = `http://${tenantHost}.com`;
                    const tenantScope = nock(tenantUrl); //.log(console.log);

                    const internalUrl = `http://${listenDomain}.com:${listenPort()}`;
                    const hook = buildWebHook(
                        id,
                        internalUrl,
                        aspects,
                        optionalAspects
                    );

                    fn({
                        aspectDefs,
                        registryScope,
                        tenantScope,
                        jwtSecret,
                        userId,
                        hook
                    });

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
                        id,
                        aspects: hook.config.aspects,
                        optionalAspects: hook.config.optionalAspects,
                        writeAspectDefs: aspectDefs,
                        express: expressApp,
                        onRecordFound: record => Promise.resolve(),
                        maxRetries: 0,
                        concurrency: concurrency
                    };

                    return minion(options).then(() => {
                        registryScope.done();
                        return true;
                    });
                }
            );
        }
    }
);

function reqHeaders(jwtSecret: string, userId: string) {
    return {
        "X-Magda-Session": buildJwt(jwtSecret, userId)
    };
}

function buildWebHook(
    id: string,
    internalUrl: string,
    aspects: string[],
    optionalAspects: string[]
): WebHook {
    return {
        id: id,
        name: id,
        url: `${internalUrl}/hook`,
        active: true,
        userId: 0,
        eventTypes: [
            "CreateRecord",
            "CreateAspectDefinition",
            "CreateRecordAspect",
            "PatchRecord",
            "PatchAspectDefinition",
            "PatchRecordAspect"
        ],
        config: {
            aspects: aspects,
            optionalAspects: optionalAspects,
            includeEvents: false,
            includeAspectDefinitions: false,
            dereference: true,
            includeRecords: true
        },
        lastEvent: null,
        isWaitingForResponse: false,
        enabled: true,
        lastRetryTime: null,
        retryCount: 0,
        isRunning: null,
        isProcessing: null
    };
}
