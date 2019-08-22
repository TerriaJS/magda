import Publisher from "./Components/Dataset/Search/Facets/Publisher";
import Format from "./Components/Dataset/Search/Facets/Format";
import Region from "./Components/Dataset/Search/Facets/Region";
import Temporal from "./Components/Dataset/Search/Facets/Temporal";

declare global {
    interface Window {
        magda_client_homepage_config: any;
        magda_server_config: any;
    }
}

// Local minikube/docker k8s cluster
// const fallbackApiHost = "http://localhost:30100/";
// Dev server
const fallbackApiHost = "https://dev.magda.io/";

const DEV_FEATURE_FLAGS = {
    cataloguing: true
};

const homePageConfig: {
    baseUrl: string;
    backgroundImageUrls: Array<string>;
    stories: string[];
} = window.magda_client_homepage_config || {};

const serverConfig: {
    authApiBaseUrl?: string;
    baseUrl?: string;
    contentApiBaseUrl?: string;
    adminApiBaseURL?: string;
    previewMapBaseUrl?: string;
    registryApiBaseUrl?: string;
    searchApiBaseUrl?: string;
    correspondenceApiBaseUrl?: string;
    gapiIds?: Array<string>;
    adminApiBaseUrl?: string;
    disableAuthenticationFeatures?: boolean;
    fallbackUrl?: string;
    featureFlags?: {
        [id: string]: boolean;
    };
    vocabularyApiEndpoints: string[];
} = window.magda_server_config || {};

const registryRoApiUrl =
    serverConfig.registryApiBaseUrl || fallbackApiHost + "api/v0/registry-ro";
const registryFullApiUrl =
    serverConfig.registryApiBaseUrl || fallbackApiHost + "api/v0/registry/";

const previewMapUrl =
    serverConfig.previewMapBaseUrl || fallbackApiHost + "preview-map/";
const proxyUrl = previewMapUrl + "proxy/";
const baseUrl = serverConfig.baseUrl || fallbackApiHost;
const baseExternalUrl =
    baseUrl === "/"
        ? window.location.protocol + "//" + window.location.host + "/"
        : baseUrl;

const fetchOptions: RequestInit =
    `${window.location.protocol}//${window.location.host}/` !== baseUrl
        ? {
              credentials: "include"
          }
        : {
              credentials: "same-origin"
          };

const contentApiURL =
    serverConfig.contentApiBaseUrl || fallbackApiHost + "api/v0/content/";

const adminApiURL =
    serverConfig.adminApiBaseURL || fallbackApiHost + "api/v0/admin";

const vocabularyApiEndpoints =
    Array.isArray(serverConfig.vocabularyApiEndpoints) &&
    serverConfig.vocabularyApiEndpoints.length
        ? serverConfig.vocabularyApiEndpoints
        : // --- default endpoints
          [
              "https://vocabs.ands.org.au/repository/api/lda/abares/australian-land-use-and-management-classification/version-8/concept.json",
              "https://vocabs.ands.org.au/repository/api/lda/ands-nc/controlled-vocabulary-for-resource-type-genres/version-1-1/concept.json"
          ];

export const config = {
    fetchOptions,
    homePageConfig: homePageConfig,
    baseUrl,
    baseExternalUrl,
    contentApiURL,
    adminApiURL,
    searchApiUrl:
        serverConfig.searchApiBaseUrl || fallbackApiHost + "api/v0/search/",
    registryRoApiUrl: registryRoApiUrl,
    registryFullApiUrl: registryFullApiUrl,
    adminApiUrl:
        serverConfig.adminApiBaseUrl || fallbackApiHost + "api/v0/admin/",
    authApiUrl: serverConfig.authApiBaseUrl || fallbackApiHost + "api/v0/auth/",
    correspondenceApiUrl:
        serverConfig.correspondenceApiBaseUrl ||
        fallbackApiHost + "api/v0/correspondence/",
    previewMapUrl: previewMapUrl,
    proxyUrl: proxyUrl,
    rssUrl: proxyUrl + "_0d/https://blog.data.gov.au/blogs/rss.xml",
    disableAuthenticationFeatures:
        serverConfig.disableAuthenticationFeatures || false,
    breakpoints: {
        small: 768,
        medium: 992,
        large: 1200
    },
    facets: [
        {
            id: "publisher",
            component: Publisher,
            showExplanation: true,
            name: "Organisation"
        },
        { id: "region", component: Region },
        { id: "temporal", component: Temporal },
        { id: "format", component: Format }
    ],
    headerLogoUrl: `${contentApiURL}header/logo`,
    headerMobileLogoUrl: `${contentApiURL}header/logo-mobile`,
    contentUrl: `${contentApiURL}all?id=home/*&id=footer/*&id=config/*&id=header/*&inline=true`,
    fallbackUrl: serverConfig.fallbackUrl,
    months: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ],
    boundingBox: {
        west: 105,
        south: -45,
        east: 155,
        north: -5
    },
    gapiIds: serverConfig.gapiIds || [],
    featureFlags:
        serverConfig.featureFlags ||
        (process.env.NODE_ENV === "development" ? DEV_FEATURE_FLAGS : {}),
    vocabularyApiEndpoints
};

export const defaultConfiguration = {
    datasetSearchSuggestionScoreThreshold: 65,
    searchResultsPerPage: 10
};
