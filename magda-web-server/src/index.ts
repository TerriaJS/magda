import express from "express";
import path from "path";
import URI from "urijs";
import yargs from "yargs";
import morgan from "morgan";
import request from "magda-typescript-common/src/request";

import Registry from "magda-typescript-common/src/registry/RegistryClient";
import coerceJson from "magda-typescript-common/src/coerceJson";
import { MAGDA_ADMIN_PORTAL_ID } from "magda-typescript-common/src/registry/TenantConsts";

import buildSitemapRouter from "./buildSitemapRouter";
import getIndexFileContent from "./getIndexFileContent";

const argv = yargs
    .config()
    .help()
    .option("listenPort", {
        describe: "The TCP/IP port on which the web server should listen.",
        type: "number",
        default: 6107
    })
    .option("disableAuthenticationFeatures", {
        describe: "True to disable all features that require authentication.",
        type: "boolean",
        default: false
    })
    .option("showNotificationBanner", {
        describe:
            "Whether or not the global notification banner should be shown",
        type: "boolean",
        default: false
    })
    .option("useLocalStyleSheet", {
        describe:
            "True to use prebuilt static stylesheet from web-client module.",
        type: "boolean",
        default: false
    })
    .option("baseExternalUrl", {
        describe:
            "The absolute base URL of the Magda site, when accessed externally. Used for building sitemap URLs which must be absolute.",
        type: "string",
        required: true
    })
    .option("registryApiBaseUrlInternal", {
        describe: "The url of the registry api for use within the cluster",
        type: "string",
        default: "http://localhost:6101/v0",
        required: true
    })
    .option("baseUrl", {
        describe:
            "The base URL of the MAGDA Gateway, for building the base URLs of the APIs when not manually specified. Can be relative.",
        type: "string",
        default: "/"
    })
    .option("devProxy", {
        describe:
            "The URL of the MAGDA API Gateway to proxy to. Useful in development when you want to serve everything from one port for CORS reasons",
        type: "string"
    })
    .option("apiBaseUrl", {
        describe:
            "The base URL of the MAGDA API Gateway.  If not specified, the URL is built from the baseUrl.",
        type: "string"
    })
    .option("searchApiBaseUrl", {
        describe:
            "The base URL of the MAGDA Search API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("contentApiBaseUrl", {
        describe:
            "The base _EXTERNAL_ URL of the MAGDA Content API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("contentApiBaseUrlInternal", {
        describe:
            "The base _INTERNAL_ URL of the MAGDA Content API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("registryApiBaseUrl", {
        describe:
            "The base URL of the MAGDA Registry API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("registryApiReadOnlyBaseUrl", {
        describe:
            "The base URL of the MAGDA Registry API for use for read-only operations.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("authApiBaseUrl", {
        describe:
            "The base URL of the MAGDA Auth API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("adminApiBaseUrl", {
        describe:
            "The base URL of the MAGDA admin API.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("previewMapBaseUrl", {
        describe:
            "The base URL of the Magda preview map.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("correspondenceApiBaseUrl", {
        describe:
            "The base URL of the correspondence api.  If not specified, the URL is built from the apiBaseUrl.",
        type: "string"
    })
    .option("fallbackUrl", {
        describe:
            "An older system to fall back to - this url will be shown in a banner that says 'you can still go back to old site'.",
        type: "string"
    })
    .option("gapiIds", {
        describe: "Google Analytics ID(s)",
        type: "array",
        default: []
    })
    .option("featureFlags", {
        describe:
            "A map of feature flags ids to booleans, turning feature flags on/off",
        type: "string",
        coerce: coerceJson("requestOpts"),
        default: "{}"
    })
    .option("vocabularyApiEndpoints", {
        describe: "A list of Vocabulary API Endpoints",
        type: "string",
        coerce: coerceJson("vocabularyApiEndpoints"),
        default: "[]"
    })
    .option("defaultOrganizationId", {
        describe: "The id of a default organization to use for new datasets",
        type: "string",
        required: false
    })
    .option("defaultContactEmail", {
        describe:
            "Default contact email for users to report magda system errors",
        type: "string"
    })
    .option("custodianOrgLevel", {
        describe: "Data custodian org unit tree level",
        type: "number"
    })
    .option("maxChartProcessingRows", {
        describe:
            "Max number of CSV data file rows that chart preview will module process",
        type: "number"
    })
    .option("maxTableProcessingRows", {
        describe:
            "Max number of CSV data file rows that table preview will module process",
        type: "number"
    })
    .option("csvLoaderChunkSize", {
        describe: "The size of the csv loader processing chunk (in bytes)",
        type: "number"
    })
    .option("mandatoryFields", {
        describe: "Add dataset page mandatory fields list (in JSON path)",
        type: "string",
        coerce: coerceJson("mandatoryFields"),
        default: "[]"
    })
    .option("dateFormats", {
        describe: "A list of date formats supported by this Magda instance",
        type: "string",
        coerce: coerceJson("dateFormats"),
        default: "[]"
    })
    .option("datasetThemes", {
        describe:
            "A list of pre-defined phrases for theme input on the `add dataset page`",
        type: "string",
        coerce: coerceJson("datasetThemes"),
        default: "[]"
    })
    .option("noManualKeywords", {
        describe:
            "Whether manual keywords input should be allowed on add dataset page",
        type: "boolean",
        default: false
    })
    .option("noManualThemes", {
        describe:
            "Whether manual themes input should be allowed on add dataset page",
        type: "boolean",
        default: false
    })
    .option("keywordsBlackList", {
        describe:
            "A list of pre-defined BlackList for auto keywords generation",
        type: "string",
        coerce: coerceJson("keywordsBlackList"),
        default: "[]"
    }).argv;

const app = express();

app.use(morgan("combined"));

const clientRoot = path.resolve(
    require.resolve("@magda/web-client/package.json"),
    ".."
);
const clientBuild = path.join(clientRoot, "build");
console.log("Client: " + clientBuild);

const apiBaseUrl = addTrailingSlash(
    argv.apiBaseUrl || new URI(argv.baseUrl).segment("api").toString()
);

const webServerConfig = {
    disableAuthenticationFeatures: argv.disableAuthenticationFeatures,
    baseUrl: addTrailingSlash(argv.baseUrl),
    apiBaseUrl: apiBaseUrl,
    contentApiBaseUrl: addTrailingSlash(
        argv.contentApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("content")
                .toString()
    ),
    searchApiBaseUrl: addTrailingSlash(
        argv.searchApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("search")
                .toString()
    ),
    registryApiBaseUrl: addTrailingSlash(
        argv.registryApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("registry")
                .toString()
    ),
    registryApiReadOnlyBaseUrl: addTrailingSlash(
        argv.registryApiReadOnlyBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("registry-read-only")
                .toString()
    ),
    authApiBaseUrl: addTrailingSlash(
        argv.authApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("auth")
                .toString()
    ),
    adminApiBaseUrl: addTrailingSlash(
        argv.adminApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("admin")
                .toString()
    ),
    previewMapBaseUrl: addTrailingSlash(
        argv.previewMapBaseUrl ||
            new URI(apiBaseUrl)
                .segment("..")
                .segment("preview-map")
                .toString()
    ),
    correspondenceApiBaseUrl: addTrailingSlash(
        argv.correspondenceApiBaseUrl ||
            new URI(apiBaseUrl)
                .segment("v0")
                .segment("correspondence")
                .toString()
    ),
    fallbackUrl: argv.fallbackUrl,
    gapiIds: argv.gapiIds,
    showNotificationBanner: argv.showNotificationBanner,
    featureFlags: argv.featureFlags || {},
    vocabularyApiEndpoints: (argv.vocabularyApiEndpoints || []) as string[],
    defaultOrganizationId: argv.defaultOrganizationId,
    defaultContactEmail: argv.defaultContactEmail,
    custodianOrgLevel: argv.custodianOrgLevel,
    maxChartProcessingRows: argv.maxChartProcessingRows,
    maxTableProcessingRows: argv.maxTableProcessingRows,
    csvLoaderChunkSize: argv.csvLoaderChunkSize,
    mandatoryFields: argv.mandatoryFields,
    dateFormats: argv.dateFormats,
    datasetThemes: argv.datasetThemes,
    noManualKeywords: argv.noManualKeywords,
    noManualThemes: argv.noManualThemes,
    keywordsBlackList: argv.keywordsBlackList
};

app.get("/server-config.js", function(req, res) {
    res.type("application/javascript");
    res.send(
        "window.magda_server_config = " + JSON.stringify(webServerConfig) + ";"
    );
});

/**
 * Get the index file content according to the passed in settings. Because getIndexFileContent
 * is throttled, it'll only actually be invoked once every 60 seconds
 */
function getIndexFileContentZeroArgs() {
    return getIndexFileContent(
        clientRoot,
        argv.useLocalStyleSheet,
        argv.contentApiBaseUrlInternal
    );
}

app.get(["/", "/index.html*"], async function(req, res) {
    const indexFileContent = await getIndexFileContentZeroArgs();

    res.send(indexFileContent);
});

// app.use("/admin", express.static(adminBuild));
app.use(express.static(clientBuild));

// URLs in this list will load index.html and be handled by React routing.
const topLevelRoutes = [
    "admin",
    "search",
    "drafts",
    "all-datasets",
    "feedback",
    "contact",
    "account",
    "sign-in-redirect",
    "dataset",
    "projects",
    "publishers", // Renamed to "/organisations" but we still want to redirect it in the web client
    "organisations",
    "suggest",
    "error"
];

topLevelRoutes.forEach(topLevelRoute => {
    app.get("/" + topLevelRoute, async function(req, res) {
        res.send(await getIndexFileContentZeroArgs());
    });
    app.get("/" + topLevelRoute + "/*", async function(req, res) {
        res.send(await getIndexFileContentZeroArgs());
    });
});

app.get("/page/*", async function(req, res) {
    res.send(await getIndexFileContentZeroArgs());
});

// app.get("/admin", function(req, res) {
//     res.sendFile(path.join(adminBuild, "index.html"));
// });
// app.get("/admin/*", function(req, res) {
//     res.sendFile(path.join(adminBuild, "index.html"));
// });

if (argv.devProxy) {
    app.get("/api/*", function(req, res) {
        console.log(argv.devProxy + req.params[0]);
        req.pipe(
            request({
                url: argv.devProxy + req.params[0],
                qs: req.query,
                method: req.method
            })
        )
            .on("error", err => {
                const msg = "Error on connecting to the webservice.";
                console.error(msg, err);
                res.status(500).send(msg);
            })
            .pipe(res);
    });
}

const robotsTxt = `User-agent: *
Crawl-delay: 100
Disallow: /auth
Disallow: /search

Sitemap: ${argv.baseExternalUrl}/sitemap.xml
`;

app.use("/robots.txt", (_, res) => {
    res.status(200).send(robotsTxt);
});

// TODO: Use proper tenant id in multi-tenant mode.
app.use(
    buildSitemapRouter({
        baseExternalUrl: argv.baseExternalUrl,
        registry: new Registry({
            baseUrl: argv.registryApiBaseUrlInternal,
            maxRetries: 0,
            tenantId: MAGDA_ADMIN_PORTAL_ID
        })
    })
);

// Proxy any other URL to 404 error page
const maxErrorDataUrlLength = 1500;
app.use("/", function(req, res) {
    let redirectUri: any = new URI("/error");
    const url =
        req.originalUrl.length > maxErrorDataUrlLength
            ? req.originalUrl.substring(0, maxErrorDataUrlLength)
            : req.originalUrl;
    const errorData = {
        errorCode: 404,
        url: url
    };
    redirectUri = redirectUri.escapeQuerySpace(false).search(errorData);
    res.redirect(303, redirectUri.toString());
});

app.listen(argv.listenPort);
console.log("Listening on port " + argv.listenPort);

process.on(
    "unhandledRejection",
    (reason: {} | null | undefined, promise: Promise<any>) => {
        console.error(reason);
    }
);

function addTrailingSlash(url: string) {
    if (!url) {
        return url;
    }

    if (url.lastIndexOf("/") !== url.length - 1) {
        return url + "/";
    } else {
        return url;
    }
}
