import defaultFormatIcon from "assets/format-passive-dark.svg";

const formatIcons = {
    default: defaultFormatIcon
};

const dataFormatCategories = [
    "api",
    "archive",
    "document",
    "gis",
    "html",
    "image-raster",
    "image-vector",
    "presentation",
    "spreadsheet",
    "tabular"
];
dataFormatCategories.forEach(item => {
    formatIcons[item] = require(`assets/data-types/${item}.svg`);
});
const CategoryDetermineConfigItems = [
    {
        regex: /wfs|wms|geojson|kml|kmz|shp|gdb|csv-geo-au|mpk|ArcGIS|ESRI REST/i,
        category: "gis"
    },
    {
        regex: /api|webservice| web service/i,
        category: "api"
    },
    {
        regex: /zip|7z|rar|arj/i,
        category: "archive"
    },
    {
        regex: /doc|pdf|docx|txt|plaintext/i,
        category: "document"
    },
    {
        regex: /html|htm|web page|web site/i,
        category: "html"
    },
    {
        regex: /^www:/i,
        category: "html"
    },
    {
        regex: /jpg|gif|jpeg/i,
        category: "image-raster"
    },
    {
        regex: /svg|png/i,
        category: "image-vector"
    },
    {
        regex: /ppt|pptx/i,
        category: "presentation"
    },
    {
        regex: /xlsx|xls/i,
        category: "spreadsheet"
    },
    {
        regex: /csv|tab/i,
        category: "tabular"
    }
];

function determineCategoryFromString(str) {
    let matchedCategory = "default";
    if (!str || typeof str !== "string") return matchedCategory;
    str = str.trim().toLowerCase();
    for (let i = 0; i < CategoryDetermineConfigItems.length; i++) {
        let config = CategoryDetermineConfigItems[i];
        if (str.match(config.regex)) {
            matchedCategory = config.category;
            break;
        }
    }
    return matchedCategory;
}

export function determineFormatIcon(distribution) {
    let matchedCategory = determineCategoryFromString(distribution.format);
    if (distribution.downloadURL && matchedCategory === "default") {
        matchedCategory = determineCategoryFromString(distribution.downloadURL);
    }
    return matchedCategory;
}

export function getFormatIcon(distribution, defaultIcon = "default") {
    let matchedCategory = determineFormatIcon(distribution);
    if (matchedCategory === "default" && defaultIcon) {
        matchedCategory = defaultIcon;
    }
    return formatIcons[matchedCategory];
}
