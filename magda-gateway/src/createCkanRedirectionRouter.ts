import express from "express";
import URI from "urijs";
import _ from "lodash";
import Registry from "magda-typescript-common/src/registry/RegistryClient";
import unionToThrowable from "magda-typescript-common/src/util/unionToThrowable";
import { escapeRegExp } from "lodash";

export type CkanRedirectionRouterOptions = {
    ckanRedirectionDomain: string;
    ckanRedirectionPath: string;
    registryApiBaseUrlInternal: string;
    tenantId: number;
};

export type genericUrlRedirectConfig =
    | {
          path: string;
          requireExtraSeqment?: boolean;
          statusCode?: number;
          method?: string;
          skip404?: boolean; //--- only for test cases
      }
    | string;

export const genericUrlRedirectConfigs: genericUrlRedirectConfig[] = [
    {
        path: "/api/3",
        requireExtraSeqment: true
    },
    "/dataset/edit",
    "/dataset/new",
    "/datastore",
    "/dashboard",
    {
        path: "/fanstatic",
        requireExtraSeqment: true
    },
    "/geoserver",
    "/group",
    "/showcase",
    {
        path: "/storage",
        requireExtraSeqment: true
    },
    {
        path: "/uploads",
        requireExtraSeqment: true
    },
    {
        path: "/vendor/leaflet",
        requireExtraSeqment: true
    },
    "/user",
    "/stats",
    "/datarequest"
];

export function covertGenericUrlRedirectConfigToFullArgList(
    config: genericUrlRedirectConfig
) {
    let fullConfig;
    if (typeof config === "string") {
        fullConfig = { path: config };
    } else {
        fullConfig = { ...config };
    }
    const { path, requireExtraSeqment, statusCode, method } = fullConfig;
    const args: any[] = [path];
    args.push(requireExtraSeqment ? requireExtraSeqment : false);
    args.push(statusCode ? statusCode : 307);
    args.push(method ? method : "all");
    return args;
}

export default function buildCkanRedirectionRouter({
    ckanRedirectionDomain,
    ckanRedirectionPath,
    registryApiBaseUrlInternal,
    tenantId
}: CkanRedirectionRouterOptions): express.Router {
    const router = express.Router();
    const registry = new Registry({
        baseUrl: registryApiBaseUrlInternal,
        tenantId
    });

    /**
     * Redirect a path to ckan system
     *
     * @param path
     * @param requireExtraSeqment
     * Assume path = "/a/b/c":
     * If requireExtraSeqment == false, redirect anything like /a/b/c* to ckan (with domain only change).
     * Here, * stands for zero or more chars string that starts with a single `/` or `?`
     * If requireExtraSeqment == true, redirect anything like /a/b/c/* to ckan (with domain only change).
     * Here, * stands for one or more any chars string
     * @param statusCode
     * @param method `all` stands for all method. `get` stands for http GET only
     */
    function redirectToCkanGeneric(
        path: string,
        requireExtraSeqment: boolean = false,
        statusCode: number = 307,
        method: string = "all"
    ) {
        let genericRegExOrStringPattern: string | RegExp;
        if (!requireExtraSeqment) {
            genericRegExOrStringPattern = new RegExp(
                `^${escapeRegExp(path)}(|\\?.*|\\/.*)$`
            );
        } else {
            genericRegExOrStringPattern = `${path}/*`;
        }
        const rounterRef: any = router;
        const routerMethod = rounterRef[method] as Function;
        routerMethod.call(router, genericRegExOrStringPattern, function(
            req: any,
            res: any
        ) {
            res.redirect(
                statusCode,
                URI(req.originalUrl)
                    .domain(ckanRedirectionDomain)
                    .protocol("https")
                    .directory(
                        URI.joinPaths(
                            ckanRedirectionPath,
                            URI(req.originalUrl).directory()
                        ).toString()
                    )
                    .toString()
            );
        });
    }

    router.get("/about", function(req, res) {
        res.redirect(303, "/page/about");
    });

    genericUrlRedirectConfigs.forEach(config => {
        const args = covertGenericUrlRedirectConfigToFullArgList(config);
        redirectToCkanGeneric.apply(null, args as [
            string,
            boolean?,
            number?,
            string?
        ]);
    });

    /**
     * match /organization & /organization?q=xxx&sort
     * this needs to stay on top of the router for:
     * /organization/*
     * /organization/datarequest/*
     * /organization/about/*
     */
    router.get(/^\/organization(|\?.*)$/, function(req, res) {
        res.redirect(
            303,
            URI(req.originalUrl)
                .segment(0, "organisations")
                .removeSearch(["page", "sort"])
                .toString()
        );
    });

    async function queryRegistryRecordApi(
        aspectQuery: string[],
        aspect: string[],
        limit: number = 1
    ) {
        const queryParameters: any = {
            limit
        };
        if (aspectQuery && aspectQuery.length) {
            queryParameters["aspectQuery"] = aspectQuery;
        }
        if (aspect && aspect.length) {
            queryParameters["aspect"] = aspect;
        }

        const records = unionToThrowable(
            await registry.getRecords(
                aspect,
                null,
                null,
                null,
                limit,
                aspectQuery
            )
        );

        return records;
    }

    async function queryCkanAspect(
        ckanIdOrName: string,
        aspectName: string,
        retrieveAspectContent: boolean = true,
        retrieveAspects: string[] = [],
        limit: number = 1
    ): Promise<any[]> {
        const query = `${aspectName}.${
            uuidRegEx.test(ckanIdOrName) ? "id" : "name"
        }:${ckanIdOrName}`;

        let aspectList: string[] = [];

        if (retrieveAspects && retrieveAspects.length) {
            aspectList = retrieveAspects;
        } else {
            //--- this param only take effect when `retrieveAspects` is missing
            if (retrieveAspectContent) {
                aspectList.push(aspectName);
            }
        }

        aspectList = _.uniq(aspectList);

        const resData: any = await queryRegistryRecordApi(
            [query],
            retrieveAspects,
            limit
        );

        if (!resData || !resData.records || !resData.records.length)
            return null;
        return resData.records;
    }

    const uuidRegEx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    async function getCkanRecordMagdaId(
        ckanIdOrName: string,
        aspectName: string
    ) {
        const records = await queryCkanAspect(ckanIdOrName, aspectName, false);
        if (!records || !records.length || !records[0]["id"]) {
            return null;
        } else {
            return records[0]["id"];
        }
    }

    async function getCkanDatasetMagdaId(ckanIdOrName: string) {
        return await getCkanRecordMagdaId(ckanIdOrName, "ckan-dataset");
    }

    /**
     * Currently, there is no API can retrieve dataset id by distribution ID directly.
     * We can, however, get ckan `package_id` (this is the ckan dataset Id) from `ckan-resource` aspect for a distribution.
     * And then use `package_id` to query registry API for magda dataset id again.
     */
    async function getCkanDatasetMagdaIdByCkanDistributionId(
        ckanIdOrName: string
    ) {
        const records = await queryCkanAspect(ckanIdOrName, "ckan-resource");
        if (
            !records ||
            !records.length ||
            !records[0]["aspects"] ||
            !records[0]["aspects"]["ckan-resource"] ||
            !records[0]["aspects"]["ckan-resource"]["package_id"]
        ) {
            return null;
        } else {
            const ckanDatsetID =
                records[0]["aspects"]["ckan-resource"]["package_id"];
            return await getCkanDatasetMagdaId(ckanDatsetID);
        }
    }

    /**
     * Unfortunately, aspect `organization-details` has no `id` field.
     * That means we can't query it as the ckan url may contain ckan-organization id.
     * Luckily, aspect `ckan-dataset`.`organization` has that id.
     * We will query against `ckan-dataset.organization` and then pull `dataset-publisher` aspect of that dataset.
     * Thanks to registry API's flexible `records` aspectQuery interface. We actually can shorten the whole story into one query:
     * /records?aspectQuery=ckan-dataset.organization.id:5a9f3a8e-2673-4c6e-be5b-e8f7287993c5&aspect=dataset-publisher&limt=1
     */
    async function getCkanOrganisationMagdaId(ckanIdOrName: string) {
        const records = await queryCkanAspect(
            ckanIdOrName,
            "ckan-dataset.organization",
            true,
            ["dataset-publisher"]
        );
        if (
            !records ||
            !records.length ||
            !records[0]["aspects"] ||
            !records[0]["aspects"]["dataset-publisher"] ||
            !records[0]["aspects"]["dataset-publisher"]["publisher"]
        ) {
            return null;
        } else {
            return records[0]["aspects"]["dataset-publisher"]["publisher"];
        }
    }

    /**
     * In order to show org dataset page.
     * We need org full name to set the filter.
     */
    async function getCkanOrganisationFullNameMagdaId(ckanIdOrName: string) {
        const records = await queryCkanAspect(
            ckanIdOrName,
            "ckan-dataset.organization",
            true,
            ["ckan-dataset"]
        );
        if (
            !records ||
            !records.length ||
            !records[0]["aspects"] ||
            !records[0]["aspects"]["ckan-dataset"] ||
            !records[0]["aspects"]["ckan-dataset"]["organization"] ||
            !records[0]["aspects"]["ckan-dataset"]["organization"]["title"]
        ) {
            return null;
        } else {
            return records[0]["aspects"]["ckan-dataset"]["organization"][
                "title"
            ];
        }
    }

    /**
     * This route must be placed before the router for /dataset/* below
     * as we now want to capture anything like /dataset/xxxx/resource/xxxx/download/xxx.xxx
     */
    router.get(
        /^\/dataset\/(?!ds-)[^\/]+\/resource\/[^\/]{1}.*\/download\/.*$/,
        async function(req, res) {
            try {
                res.redirect(
                    301,
                    URI(req.originalUrl)
                        .domain(ckanRedirectionDomain)
                        .protocol("https")
                        .directory(
                            URI.joinPaths(
                                ckanRedirectionPath,
                                URI(req.originalUrl).directory()
                            ).toString()
                        )
                        .toString()
                );
            } catch (e) {
                console.log(e);
                showError(res, 500);
            }
        }
    );
    /**
     * This route must be placed before the router for /dataset/* below
     * as we now want to capture anything like /dataset/xxxx/view/xxxx
     */
    router.get(
        /^\/dataset\/(?!ds-)[^\/]+\/resource\/[^\/]{1}.*$/,
        async function(req, res) {
            try {
                const originUri = new URI(req.originalUrl);
                const dsIdOrName = originUri.segmentCoded(1).trim();

                let datasetMagdaId = await getCkanDatasetMagdaId(dsIdOrName);
                if (!datasetMagdaId) {
                    const disIdOrName = originUri.segmentCoded(3).trim();
                    datasetMagdaId = await getCkanDatasetMagdaIdByCkanDistributionId(
                        disIdOrName
                    );
                    if (!datasetMagdaId) {
                        showError(res, {
                            errorCode: 404,
                            recordType: "ckan-resource",
                            recordId: disIdOrName
                        });
                        return;
                    }
                }

                res.redirect(303, `/dataset/${datasetMagdaId}/details`);
            } catch (e) {
                console.log(e);
                showError(res, 500);
            }
        }
    );

    /**
     * The second segment of the url could be actions related to a dataset.e.g.:
     *  /dataset/groups/xxx-xx-xxx-xx
     * We need to handle this differently: use segment 2 as ckan ID instead of 1
     */
    const remappedDatasetSubActions = ["groups", "activity", "showcases"];

    router.get(/^\/dataset\/(?!ds-)[^\/]{1}.*$/, async function(req, res) {
        try {
            const originUri = new URI(req.originalUrl);
            const segment1 = originUri.segmentCoded(1).trim();
            let dsIdOrName;
            if (remappedDatasetSubActions.indexOf(segment1) !== -1) {
                dsIdOrName = originUri.segmentCoded(2).trim();
            } else {
                dsIdOrName = segment1;
            }

            const magdaId = await getCkanDatasetMagdaId(dsIdOrName);

            if (!magdaId) {
                showError(res, {
                    errorCode: 404,
                    recordType: "ckan-dataset",
                    recordId: dsIdOrName
                });
            } else {
                res.redirect(303, `/dataset/${magdaId}/details`);
            }
        } catch (e) {
            console.log(e);
            showError(res, 500);
        }
    });

    const orgSubActions = ["about", "datarequest", "activity"];
    router.get(/^\/organization\/[^/]{1}.*$/, async function(req, res) {
        try {
            const originUri = new URI(req.originalUrl);
            const segment1 = originUri.segmentCoded(1).trim();

            let ckanIdOrName;
            if (orgSubActions.indexOf(segment1) !== -1) {
                ckanIdOrName = originUri.segmentCoded(2).trim();
            } else {
                ckanIdOrName = segment1;
            }

            if (segment1 === "datarequest") {
                await redirectToOrgDatasetPage(ckanIdOrName, res);
            } else {
                await redirectToOrgPage(ckanIdOrName, res);
            }
        } catch (e) {
            console.log(e);
            showError(res, 500);
        }
    });

    async function redirectToOrgDatasetPage(
        ckanIdOrName: string,
        res: express.Response
    ) {
        if (!ckanIdOrName)
            throw new Error(`Invalid ckanIdOrName ${ckanIdOrName}`);

        const orgFullName = await getCkanOrganisationFullNameMagdaId(
            ckanIdOrName
        );

        if (!orgFullName || !orgFullName.trim()) {
            showError(res, {
                errorCode: 404,
                recordType: "ckan-organization-details",
                recordId: ckanIdOrName
            });
        } else {
            let uri: any = new URI("/search");
            //--- make sure %20 is used instead of +
            uri = uri.escapeQuerySpace(false).search({
                organisation: orgFullName
            });
            res.redirect(303, uri.toString());
        }
    }

    async function redirectToOrgPage(
        ckanIdOrName: string,
        res: express.Response
    ) {
        if (!ckanIdOrName)
            throw new Error(`Invalid ckanIdOrName ${ckanIdOrName}`);

        const magdaId = await getCkanOrganisationMagdaId(ckanIdOrName);

        if (!magdaId) {
            showError(res, {
                errorCode: 404,
                recordType: "ckan-organization-details",
                recordId: ckanIdOrName
            });
        } else {
            res.redirect(303, `/organisations/${magdaId}`);
        }
    }

    function showError(
        res: express.Response,
        errorDataOrErrorCode: object | number
    ) {
        let redirectUri: any = new URI("/error");
        let errorData;
        if (typeof errorDataOrErrorCode === "number") {
            errorData = { errorCode: errorDataOrErrorCode };
        } else if (typeof errorDataOrErrorCode === "object") {
            errorData = errorDataOrErrorCode;
        }
        if (errorData && Object.keys(errorData).length) {
            redirectUri = redirectUri.escapeQuerySpace(false).search(errorData);
        }
        res.redirect(303, redirectUri.toString());
    }

    return router;
}
