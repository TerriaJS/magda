import yargs from "yargs";
import _ from "lodash";

import buildApp from "./buildApp";

import addJwtSecretFromEnvVar from "magda-typescript-common/src/session/addJwtSecretFromEnvVar";

const coerceJson = (path?: string) => path && require(path);

const argv = addJwtSecretFromEnvVar(
    yargs
        .config()
        .help()
        .option("listenPort", {
            describe: "The TCP/IP port on which the gateway should listen.",
            type: "number",
            default: 6100
        })
        .option("externalUrl", {
            describe: "The base external URL of the gateway.",
            type: "string",
            default: "http://localhost:6100"
        })
        .option("dbHost", {
            describe: "The host running the session database.",
            type: "string",
            default: "localhost"
        })
        .option("dbPort", {
            describe: "The port running the session database.",
            type: "number",
            default: 5432
        })
        .option("proxyRoutesJson", {
            describe:
                "Path of the json that defines routes to proxy. These will be merged with the defaults specified in defaultConfig.ts.",
            type: "string",
            coerce: coerceJson
        })
        .option("webProxyRoutesJson", {
            describe:
                "Path of the json that defines web (non-API) routes to proxy.",
            type: "string",
            coerce: coerceJson
        })
        .option("helmetJson", {
            describe:
                "Path of the json that defines node-helmet options, as per " +
                "https://helmetjs.github.io/docs/. Node that this _doesn't_ " +
                "include csp options as these are a separate module. These will " +
                "be merged with the defaults specified in defaultConfig.ts.",

            type: "string",
            coerce: coerceJson
        })
        .option("cspJson", {
            describe:
                "Path of the json that defines node-helmet options, as per " +
                "https://helmetjs.github.io/docs/. These will " +
                "be merged with the defaults specified in defaultConfig.ts.",
            type: "string",
            coerce: coerceJson
        })
        .option("corsJson", {
            describe:
                "Path of the json that defines CORS options, as per " +
                "https://www.npmjs.com/package/cors. These will " +
                "be merged with the defaults specified in defaultConfig.ts.",
            type: "string",
            coerce: coerceJson
        })
        .option("authorizationApi", {
            describe: "The base URL of the authorization API.",
            type: "string",
            default: "http://localhost:6104/v0"
        })
        .option("previewMap", {
            describe: "The base URL of the preview map.",
            type: "string",
            default: "http://localhost:6110"
        })
        .option("web", {
            describe: "The base URL of the web site.",
            type: "string",
            default: "http://localhost:6108"
        })
        .option("jwtSecret", {
            describe:
                "The secret to use to sign JSON Web Token (JWT) for authenticated requests.  This can also be specified with the JWT_SECRET environment variable.",
            type: "string"
        })
        .option("sessionSecret", {
            describe:
                "The secret to use to sign session cookies.  This can also be specified with the SESSION_SECRET environment variable.",
            type: "string",
            default:
                process.env.SESSION_SECRET ||
                process.env.npm_package_config_SESSION_SECRET,
            demand: true
        })
        .option("facebookClientId", {
            describe: "The client ID to use for Facebook OAuth.",
            type: "string",
            default:
                process.env.FACEBOOK_CLIENT_ID ||
                process.env.npm_package_config_facebookClientId
        })
        .option("facebookClientSecret", {
            describe:
                "The secret to use for Facebook OAuth.  This can also be specified with the FACEBOOK_CLIENT_SECRET environment variable.",
            type: "string",
            default:
                process.env.FACEBOOK_CLIENT_SECRET ||
                process.env.npm_package_config_facebookClientSecret
        })
        .option("googleClientId", {
            describe: "The client ID to use for Google OAuth.",
            type: "string",
            default:
                process.env.GOOGLE_CLIENT_ID ||
                process.env.npm_package_config_googleClientId
        })
        .option("googleClientSecret", {
            describe:
                "The secret to use for Google OAuth.  This can also be specified with the GOOGLE_CLIENT_SECRET environment variable.",
            type: "string",
            default:
                process.env.GOOGLE_CLIENT_SECRET ||
                process.env.npm_package_config_googleClientSecret
        })
        .option("arcgisClientId", {
            describe: "The client ID to use for ArcGIS OAuth.",
            type: "string",
            default:
                process.env.ARCGIS_CLIENT_ID ||
                process.env.npm_package_config_arcgisClientId
        })
        .option("arcgisClientSecret", {
            describe:
                "The secret to use for ArcGIS OAuth.  This can also be specified with the ARCGIS_CLIENT_SECRET environment variable.",
            type: "string",
            default:
                process.env.ARCGIS_CLIENT_SECRET ||
                process.env.npm_package_config_arcgisClientSecret
        })
        .option("arcgisInstanceBaseUrl", {
            describe: "The instance of ArcGIS infrastructure to use for OAuth.",
            type: "string",
            default:
                process.env.ARCGIS_INSTANCE_BASE_URL ||
                process.env.npm_package_config_arcgisInstanceBaseUrl
        })
        .option("esriOrgGroup", {
            describe:
                "A unique group name representing authenticated users of the esri portal",
            type: "string",
            default:
                process.env.ESRI_ORG_GROUP ||
                process.env.npm_package_config_esriOrgGroup
        })
        .option("vanguardWsFedCertificate", {
            describe:
                "The certificate to use for Vanguard WS-FED Login. This can also be specified with the VANGUARD_CERTIFICATE environment variable.",
            type: "string",
            default:
                process.env.VANGUARD_CERTIFICATE ||
                process.env.npm_package_config_vanguardCertificate
        })
        .option("vanguardWsFedIdpUrl", {
            describe:
                "Vanguard integration entry point. Can also be specified in VANGUARD_URL environment variable.",
            type: "string",
            default:
                process.env.VANGUARD_URL ||
                process.env.npm_package_config_vanguardUrl
        })
        .option("vanguardWsFedRealm", {
            describe:
                "Vanguard realm id for entry point. Can also be specified in VANGUARD_REALM environment variable.",
            type: "string",
            default:
                process.env.VANGUARD_REALM ||
                process.env.npm_package_config_vanguardRealm
        })
        .option("aafClientUri", {
            describe: "The aaf client Uri to use for AAF Auth.",
            type: "string",
            default:
                process.env.AAF_CLIENT_URI ||
                process.env.npm_package_config_aafClientUri
        })
        .option("aafClientSecret", {
            describe:
                "The secret to use for AAF Auth.  This can also be specified with the AAF_CLIENT_SECRET environment variable.",
            type: "string",
            default:
                process.env.AAF_CLIENT_SECRET ||
                process.env.npm_package_config_aafClientSecret
        })
        .options("ckanUrl", {
            describe: "The URL of a CKAN server to use for authentication.",
            type: "string"
        })
        .options("enableAuthEndpoint", {
            describe: "Whether enable the AuthEndpoint",
            type: "boolean",
            default: false
        })
        .option("enableCkanRedirection", {
            describe: "Whether or not to turn on the CKan Redirection feature",
            type: "boolean",
            default: false
        })
        .option("ckanRedirectionDomain", {
            describe:
                "The target domain for redirecting ckan Urls. If not specified, default value `ckan.data.gov.au` will be used.",
            type: "string",
            default: "ckan.data.gov.au"
        })
        .option("ckanRedirectionPath", {
            describe:
                "The target path for redirecting ckan Urls. If not specified, default value `` will be used.",
            type: "string",
            default: ""
        })
        .option("enableWebAccessControl", {
            describe:
                "Whether users are required to enter a username & password to access the magda web interface",
            type: "boolean",
            default: false
        })
        .option("webAccessUsername", {
            describe:
                "The web access username required for all users to access Magda web interface if `enableWebAccessControl` is true.",
            type: "string",
            default: process.env.WEB_ACCESS_USERNAME
        })
        .option("webAccessPassword", {
            describe:
                "The web access password required for all users to access Magda web interface if `enableWebAccessControl` is true.",
            type: "string",
            default: process.env.WEB_ACCESS_PASSWORD
        })
        .option("enableHttpsRedirection", {
            describe: "Whether redirect any http requests to https URLs",
            type: "boolean",
            default: false
        })
        .option("userId", {
            describe:
                "The user id to use when making authenticated requests to the registry",
            type: "string",
            demand: true,
            default:
                process.env.USER_ID || process.env.npm_package_config_userId
        })
        .option("enableMultiTenants", {
            describe:
                "Whether to run in multi-tenant mode. If true, magdaAdminPortalName must refer to a real portal.",
            type: "boolean",
            default: false
        })
        .option("tenantUrl", {
            describe: "The base URL of the tenant API.",
            type: "string",
            default: "http://localhost:6130/v0"
        })
        .option("magdaAdminPortalName", {
            describe:
                "Magda admin portal host name. Must not be the same as gateway external URL or any other tenant website URL",
            type: "string",
            default: "unknown_portal_host_name"
        })
        .option("minReqIntervalInMs", {
            describe: "Minimal interval in ms to fetch tenants from DB.",
            type: "number",
            default: 60000
        }).argv
);

const app = buildApp(argv as any);
app.listen(argv.listenPort);
console.log("Listening on port " + argv.listenPort);

process.on(
    "unhandledRejection",
    (reason: {} | null | undefined, promise: Promise<any>) => {
        console.error("Unhandled rejection");
        console.error(reason);
    }
);
