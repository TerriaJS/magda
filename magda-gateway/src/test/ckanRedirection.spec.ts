import {} from "mocha";
import sinon from "sinon";
import express from "express";
import { expect } from "chai";
import nock from "nock";
import _ from "lodash";
import supertest from "supertest";
import URI from "urijs";
import createCkanRedirectionRouter, {
    genericUrlRedirectConfig,
    covertGenericUrlRedirectConfigToFullArgList,
    genericUrlRedirectConfigs
} from "../createCkanRedirectionRouter";

import resCkanDatasetAspect from "./sampleRegistryResponses/ckanDatasetAspect.json";
import resCkanDatasetQuery from "./sampleRegistryResponses/ckanDatasetQuery.json";
import resCkanOrganizationQuery from "./sampleRegistryResponses/ckanOrganizationQuery.json";
import resCkanResource from "./sampleRegistryResponses/ckanResource.json";

describe("ckanRedirectionRouter router", () => {
    const ckanRedirectionDomain = "ckan.data.gov.au";
    const ckanRedirectionPath = "";

    let app: express.Application;
    const registryUrl = "http://registry.example.com";
    let registryScope: nock.Scope;

    before(() => {
        registryScope = nock(registryUrl);
        setupRegistryApiForCkanDatasetQuery();
    });

    after(() => {
        nock.cleanAll();
    });

    beforeEach(() => {
        const router = createCkanRedirectionRouter({
            ckanRedirectionDomain,
            ckanRedirectionPath,
            registryApiBaseUrlInternal: registryUrl,
            tenantId: 1
        });
        app = express();
        app.use(router);
    });

    afterEach(() => {
        if ((<sinon.SinonStub>console.error).restore) {
            (<sinon.SinonStub>console.error).restore();
        }
    });

    /**
     * /dataset/edit or /dataset/new 404 test conflict with router /dataset/*
     * i.e. any extra content after the uri (e.g. /dataset/editxxx) will cause request
     * captured by router /dataset/*
     */
    const routerSkip404Test = ["/dataset/edit", "/dataset/new"];

    genericUrlRedirectConfigs
        .map(config => {
            const path = typeof config === "string" ? config : config.path;
            if (routerSkip404Test.indexOf(path) !== -1) {
                if (typeof config === "string") {
                    return {
                        path,
                        skip404: true
                    };
                } else {
                    return { ...config, skip404: true };
                }
            }
            return config;
        })
        .forEach(config => testGenericCkanRedirection(config));

    describe("Redirect ckan /about", () => {
        it("should redirect /about to /page/about", () => {
            return supertest(app)
                .get("/about")
                .expect(303)
                .expect(checkRedirectionDetails("/page/about"));
        });
    });

    describe("Redirect ckan /organization & /organization?q=xxx", () => {
        it("should redirect /organization to /organisations", () => {
            return supertest(app)
                .get("/organization")
                .expect(303)
                .expect(checkRedirectionDetails("/organisations"));
        });

        it("should redirect /organization?q=xxx&sort=xx&page=xx to /organisations?q=xxx", () => {
            return supertest(app)
                .get("/organization?q=xxx&sort=xx&page=xx")
                .expect(303)
                .expect((res: supertest.Response) => {
                    const uri = URI(res.header["location"]);
                    expect(uri.segment(0)).to.equal("organisations");
                    const query = uri.search(true);
                    expect(query.q).to.equal("xxx");
                    expect(query.sort).be.an("undefined");
                    expect(query.page).be.an("undefined");
                });
        });
    });

    describe("Redirect /dataset/*", () => {
        it("should redirect /dataset/pg_skafsd0_f___00120141210_11a to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/pg_skafsd0_f___00120141210_11a")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/pg_skafsd0_f___00120141210_11a/view/xxxx to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/pg_skafsd0_f___00120141210_11a/view/xxxx")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/groups/pg_skafsd0_f___00120141210_11a to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/groups/pg_skafsd0_f___00120141210_11a")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/activity/pg_skafsd0_f___00120141210_11a to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/activity/pg_skafsd0_f___00120141210_11a")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/showcases/pg_skafsd0_f___00120141210_11a to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/showcases/pg_skafsd0_f___00120141210_11a")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/8beb4387-ec03-46f9-8048-3ad76c0416c8 to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get("/dataset/8beb4387-ec03-46f9-8048-3ad76c0416c8")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/unknown-name to /error?errorCode=404&recordType=ckan-dataset&recordId=unknown-name", () => {
            return supertest(app)
                .get("/dataset/unknown-name")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-dataset&recordId=unknown-name"
                    )
                );
        });
    });

    describe("Redirect /dataset/*/resource/*", () => {
        it("should redirect /dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get(
                    "/dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/view/link to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get(
                    "/dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/view/link"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/download/filename.zip to https://ckan.data.gov.au/dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/download/filename.zip ", () => {
            return supertest(app)
                .get(
                    "/dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/download/filename.zip"
                )
                .expect(301)
                .expect(
                    checkRedirectionDetails(
                        "https://ckan.data.gov.au/dataset/pg_skafsd0_f___00120141210_11a/resource/af618603-e529-4998-b977-e8751f291e6e/download/filename.zip"
                    )
                );
        });

        it("should redirect /dataset/missing-ckan-id/resource/af618603-e529-4998-b977-e8751f291e6e to /dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details", () => {
            return supertest(app)
                .get(
                    "/dataset/missing-ckan-id/resource/af618603-e529-4998-b977-e8751f291e6e"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/dataset/ds-dga-8beb4387-ec03-46f9-8048-3ad76c0416c8/details"
                    )
                );
        });

        it("should redirect /dataset/wrong-ckan-id/resource/wrong-ckan-resource-id to /error?errorCode=404&recordType=ckan-resource&recordId=wrong-ckan-resource-id", () => {
            return supertest(app)
                .get("/dataset/wrong-ckan-id/resource/wrong-ckan-resource-id")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-resource&recordId=wrong-ckan-resource-id"
                    )
                );
        });
    });

    describe("Redirect /organization/:ckanIdOrName", () => {
        it("should redirect /organization/australianbureauofstatistics-geography to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get("/organization/australianbureauofstatistics-geography")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/760c24b1-3c3d-4ccb-8196-41530fcdebd5 to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get("/organization/760c24b1-3c3d-4ccb-8196-41530fcdebd5")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/unknown-name-or-id to /error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id", () => {
            return supertest(app)
                .get("/organization/unknown-name-or-id")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id"
                    )
                );
        });
    });

    describe("Redirect /organization/datarequest/:ckanIdOrName", () => {
        it("should redirect /organization/datarequest/australianbureauofstatistics-geography to /search?organisation=Australian%20Bureau%20of%20Agriculture%20and%20Resource%20Economics%20and%20Sciences", () => {
            return supertest(app)
                .get(
                    "/organization/datarequest/australianbureauofstatistics-geography"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/search?organisation=Australian%20Bureau%20of%20Agriculture%20and%20Resource%20Economics%20and%20Sciences"
                    )
                );
        });

        it("should redirect /organization/datarequest/760c24b1-3c3d-4ccb-8196-41530fcdebd5 to /search?organisation=Australian%20Bureau%20of%20Agriculture%20and%20Resource%20Economics%20and%20Sciences", () => {
            return supertest(app)
                .get(
                    "/organization/datarequest/760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/search?organisation=Australian%20Bureau%20of%20Agriculture%20and%20Resource%20Economics%20and%20Sciences"
                    )
                );
        });

        it("should redirect /organization/datarequest/unknown-name-or-id to /error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id", () => {
            return supertest(app)
                .get("/organization/datarequest/unknown-name-or-id")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id"
                    )
                );
        });
    });

    describe("Redirect /organization/about/:ckanIdOrName", () => {
        it("should redirect /organization/about/australianbureauofstatistics-geography to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get(
                    "/organization/about/australianbureauofstatistics-geography"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/about/760c24b1-3c3d-4ccb-8196-41530fcdebd5 to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get("/organization/about/760c24b1-3c3d-4ccb-8196-41530fcdebd5")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/about/unknown-name-or-id to /error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id", () => {
            return supertest(app)
                .get("/organization/about/unknown-name-or-id")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id"
                    )
                );
        });
    });

    describe("Redirect /organization/activity/:ckanIdOrName", () => {
        it("should redirect /organization/activity/australianbureauofstatistics-geography to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get(
                    "/organization/activity/australianbureauofstatistics-geography"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/activity/760c24b1-3c3d-4ccb-8196-41530fcdebd5 to /organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5", () => {
            return supertest(app)
                .get(
                    "/organization/activity/760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                )
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/organisations/org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                    )
                );
        });

        it("should redirect /organization/activity/unknown-name-or-id to /error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id", () => {
            return supertest(app)
                .get("/organization/activity/unknown-name-or-id")
                .expect(303)
                .expect(
                    checkRedirectionDetails(
                        "/error?errorCode=404&recordType=ckan-organization-details&recordId=unknown-name-or-id"
                    )
                );
        });
    });

    function setupRegistryApiForCkanDatasetQuery() {
        const errorResponse = `{
            "hasMore": false,
            "records": [ ]
        }`;

        const okCkanDatasetResponse = resCkanDatasetQuery;

        const okCkanResource = resCkanResource;

        const okCkanOrganizationQueryResponse = resCkanOrganizationQuery;

        const okCkanDatasetOrgQueryResponse = resCkanDatasetAspect;

        registryScope
            .persist()
            .get("/records")
            .query(true)
            .reply(200, function(uri: string) {
                const uriObj = URI(uri);
                const query = uriObj.search(true);
                if (!query || !query.aspectQuery) return errorResponse;
                const [path, value] = query.aspectQuery.split(":");
                const aspect = query.aspect;
                if (
                    path === "ckan-dataset.name" &&
                    value === "pg_skafsd0_f___00120141210_11a"
                ) {
                    return okCkanDatasetResponse;
                } else if (
                    path === "ckan-dataset.id" &&
                    value === "8beb4387-ec03-46f9-8048-3ad76c0416c8"
                ) {
                    return okCkanDatasetResponse;
                } else if (
                    path === "ckan-dataset.organization.id" &&
                    value === "760c24b1-3c3d-4ccb-8196-41530fcdebd5" &&
                    aspect === "ckan-dataset"
                ) {
                    return okCkanDatasetOrgQueryResponse;
                } else if (
                    path === "ckan-dataset.organization.name" &&
                    value === "australianbureauofstatistics-geography" &&
                    aspect === "ckan-dataset"
                ) {
                    return okCkanDatasetOrgQueryResponse;
                } else if (
                    path === "ckan-dataset.organization.id" &&
                    value === "760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                ) {
                    return okCkanOrganizationQueryResponse;
                } else if (
                    path === "ckan-dataset.organization.name" &&
                    value === "australianbureauofstatistics-geography"
                ) {
                    return okCkanOrganizationQueryResponse;
                } else if (
                    path === "ckan-resource.id" &&
                    value === "af618603-e529-4998-b977-e8751f291e6e"
                ) {
                    return okCkanResource;
                } else if (
                    path === "ckan-resource.name" &&
                    value ===
                        "wwLink to Australian Fish and Fisheries web site managed by Fisheries Research and Development Corporation"
                ) {
                    return okCkanResource;
                } else {
                    return errorResponse;
                }
            });
    }

    function checkRedirectionDetails(location: string | RegExp) {
        return (res: supertest.Response) => {
            if (_.isRegExp(location)) {
                expect(location.test(res.header["location"])).to.equal(true);
            } else {
                expect(res.header["location"]).to.equal(location);
            }
        };
    }

    function checkStatusCode(statusCode: number = 308) {
        return (res: supertest.Response) => {
            expect(res.status).to.equal(statusCode);
        };
    }

    function testCkanDomainChangeOnly(
        targetUrlOrUrls: string | string[],
        statusCode: number = 308,
        allowAllMethod: boolean = false
    ) {
        let targetUrls: string[] = [];
        if (_.isArray(targetUrlOrUrls)) {
            targetUrls = targetUrls.concat(targetUrlOrUrls);
        } else {
            targetUrls.push(targetUrlOrUrls);
        }
        targetUrls.forEach(targetUrl => {
            const uri = URI(targetUrl);
            let testMethods = ["get"];
            if (allowAllMethod) {
                testMethods = testMethods.concat(["post", "put", "patch"]);
            }
            const uriRes = uri.resource();
            const testUri = URI(uriRes);
            if (uri.origin()) {
                testUri.origin(uri.origin());
                if (uri.protocol()) {
                    testUri.protocol(uri.protocol());
                }
            }

            testMethods.forEach(method => {
                let caseTitle = `should redirect ${method.toUpperCase()} ${uriRes} correctly`;
                if (statusCode === 404) {
                    caseTitle = `should return 404 for ${method.toUpperCase()} ${uriRes}`;
                }
                it(caseTitle, () => {
                    let test: any = supertest(app);
                    test = test[method].call(test, uriRes);
                    test = test.expect(checkStatusCode(statusCode));
                    if (statusCode === 404) return test;
                    else {
                        return test.expect(
                            checkRedirectionDetails(testUri.toString())
                        );
                    }
                });
            });
        });
    }

    function test404(
        targetUrlOrUrls: string | string[],
        allowAllMethod: boolean = false
    ) {
        testCkanDomainChangeOnly(targetUrlOrUrls, 404, allowAllMethod);
    }

    function testGenericCkanRedirection(config: genericUrlRedirectConfig) {
        const [
            path,
            requireExtraSeqment,
            statusCode,
            method
        ] = covertGenericUrlRedirectConfigToFullArgList(config);
        const allowAllMethod = method === "all";
        const testUrlList = [
            `https://${ckanRedirectionDomain}${path}/xxx`,
            `https://${ckanRedirectionDomain}${path}/xxx?q=xxx`
        ];
        if (!requireExtraSeqment) {
            testUrlList.push(`https://${ckanRedirectionDomain}${path}`);
            testUrlList.push(`https://${ckanRedirectionDomain}${path}?q=xxx`);
        }
        describe(`Redirect CKan URL ${path}`, () => {
            testCkanDomainChangeOnly(testUrlList, statusCode, allowAllMethod);
            if (typeof config === "object" && !config.skip404) {
                test404(
                    `https://${ckanRedirectionDomain}${path}xxx`,
                    allowAllMethod
                );
            }
        });
    }
});
