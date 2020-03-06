import Publisher from "./Components/Dataset/Search/Facets/Publisher";
import Format from "./Components/Dataset/Search/Facets/Format";
import Region from "./Components/Dataset/Search/Facets/Region";
import Temporal from "./Components/Dataset/Search/Facets/Temporal";
import { ValidationFieldList } from "./Components/Dataset/Add/ValidationManager";

declare global {
    interface Window {
        magda_client_homepage_config: any;
        magda_server_config: any;
    }
}

// https://www.w3.org/TR/NOTE-datetime
const defaultDateFormats: string[] = [
    // Year
    "YYYY",
    // Year and month (eg 1997-07)
    "YYYY-MM",
    // Complete date (eg 1997-07-16):
    "DD-MM-YYYY",
    "MM-DD-YYYY",
    "YYYY-MM-DD",
    // Complete date plus hours and minutes (eg 1997-07-16T19:20+01:00):
    "YYYY-MM-DDThh:mmTZD",
    // Complete date plus hours, minutes and seconds (eg 1997-07-16T19:20:30+01:00):
    "YYYY-MM-DDThh:mm:ssTZD",
    // Complete date plus hours, minutes, seconds and a decimal fraction of a second (eg 1997-07-16T19:20:30.45+01:00)
    "YYYY-MM-DDThh:mm:ss.sTZD",
    // Natural language date formats (eg 12 March, 1997)
    "DD-MMM-YYYY",
    "MMM-DD-YYYY"
];

// Local minikube/docker k8s cluster
// const fallbackApiHost = "http://localhost:30100/";
// Dev server
const fallbackApiHost = "https://dev.magda.io/";

const DEV_FEATURE_FLAGS = {
    cataloguing: true,
    publishToDga: true,
    previewAddDataset: true
};

const homePageConfig: {
    baseUrl: string;
    backgroundImageUrls: Array<string>;
    stories: string[];
} = window.magda_client_homepage_config || {};

interface DateConfig {
    dateFormats: string[];
    dateRegexes: {
        dateRegex: RegExp;
        startDateRegex: RegExp;
        endDateRegex: RegExp;
    };
}

const serverConfig: {
    authApiBaseUrl?: string;
    baseUrl?: string;
    showNotificationBanner?: boolean;
    contentApiBaseUrl?: string;
    previewMapBaseUrl?: string;
    registryApiBaseUrl?: string;
    registryApiReadOnlyBaseUrl?: string;
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
    defaultOrganizationId?: string;
    defaultContactEmail?: string;
    custodianOrgLevel: number;
    maxChartProcessingRows: number;
    maxTableProcessingRows: number;
    csvLoaderChunkSize: number;
    mandatoryFields: ValidationFieldList;
    dateConfig?: DateConfig;
    noManualKeywords?: boolean;
    noManualThemes?: boolean;
    datasetThemes?: string[];
    keywordsBlackList?: string[];
} = window.magda_server_config || {};

const DATE_REGEX = ".*(date|dt|year|decade).*";
const START_DATE_REGEX = "(start|st).*(date|dt|year|decade)";
const END_DATE_REGEX = "(end).*(date|dt|year|decade)";

/**
 * Given the server's date config object, tries to construct a date config object
 * that also includes defaults for parts of the config that are not specified
 * @param serverDateConfig Server's Date Config object
 */
function constructDateConfig(
    serverDateConfig: DateConfig | undefined
): DateConfig {
    var dateConfig: DateConfig = {
        dateFormats: defaultDateFormats,
        dateRegexes: {
            dateRegex: new RegExp(DATE_REGEX, "i"),
            startDateRegex: new RegExp(START_DATE_REGEX, "i"),
            endDateRegex: new RegExp(END_DATE_REGEX, "i")
        }
    };

    // Overwriting config if there is config coming from the server
    if (serverDateConfig) {
        if (serverDateConfig.dateFormats) {
            dateConfig.dateFormats = serverDateConfig.dateFormats;
        }
        // If the server date config exists, and regexes were also specified
        if (serverDateConfig.dateRegexes) {
            dateConfig["dateRegexes"] = {
                dateRegex: new RegExp(
                    serverDateConfig.dateRegexes.dateRegex || DATE_REGEX,
                    "i"
                ),
                startDateRegex: new RegExp(
                    serverDateConfig.dateRegexes.startDateRegex ||
                        START_DATE_REGEX,
                    "i"
                ),
                endDateRegex: new RegExp(
                    serverDateConfig.dateRegexes.endDateRegex || END_DATE_REGEX,
                    "i"
                )
            };
        }
    }
    return dateConfig;
}

const registryReadOnlyApiUrl =
    serverConfig.registryApiReadOnlyBaseUrl ||
    fallbackApiHost + "api/v0/registry-read-only/";
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
    showNotificationBanner: !!serverConfig.showNotificationBanner,
    baseUrl,
    baseExternalUrl,
    contentApiURL,
    searchApiUrl:
        serverConfig.searchApiBaseUrl || fallbackApiHost + "api/v0/search/",
    registryReadOnlyApiUrl: registryReadOnlyApiUrl,
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
        { id: "format", component: Format },
        { id: "temporal", component: Temporal }
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
    vocabularyApiEndpoints,
    defaultOrganizationId: serverConfig.defaultOrganizationId,
    defaultContactEmail: serverConfig.defaultContactEmail,
    custodianOrgLevel: serverConfig.custodianOrgLevel
        ? serverConfig.custodianOrgLevel
        : 2,
    maxChartProcessingRows: serverConfig.maxChartProcessingRows
        ? serverConfig.maxChartProcessingRows
        : 20000, // --- `-1` means no limit
    maxTableProcessingRows: serverConfig.maxTableProcessingRows
        ? serverConfig.maxTableProcessingRows
        : 200, // --- `-1` means no limit
    // --- CSV loader download / processing chunk size
    // --- default to 2MB
    csvLoaderChunkSize: serverConfig.csvLoaderChunkSize
        ? serverConfig.csvLoaderChunkSize
        : 2097152,
    mandatoryFields: serverConfig.mandatoryFields
        ? serverConfig.mandatoryFields
        : [
              "dataset.title",
              "dataset.description",
              "dataset.defaultLicense",
              "distributions.title",
              "distributions.format",
              "distributions.license",
              "dataset.publisher",
              "licenseLevel",
              "dataset.defaultLicense",
              "informationSecurity.classification",
              "informationSecurity.disseminationLimits",
              "publishToDga"
          ],
    dateConfig: constructDateConfig(serverConfig.dateConfig),
    datasetThemes: serverConfig.datasetThemes ? serverConfig.datasetThemes : [],
    noManualKeywords: serverConfig.noManualKeywords
        ? serverConfig.noManualKeywords
        : false,
    noManualThemes: serverConfig.noManualThemes
        ? serverConfig.noManualThemes
        : false,
    keywordsBlackList: serverConfig.keywordsBlackList
        ? serverConfig.keywordsBlackList
        : [
              "Mr",
              "Ms",
              "Mrs",
              "Miss",
              "Dr",
              "Hon",
              "Jr",
              "Prof",
              "Sr",
              "St",
              "Mr.",
              "Ms.",
              "Mrs.",
              "Miss.",
              "Dr.",
              "Hon.",
              "Jr.",
              "Prof.",
              "Sr.",
              "St."
          ]
};

export const defaultConfiguration = {
    datasetSearchSuggestionScoreThreshold: 65,
    searchResultsPerPage: 10
};
