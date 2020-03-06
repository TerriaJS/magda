import yargs from "yargs";
import path from "path";
import getScssFileList from "./getScssFileList";
import { renderScssFilesExtra } from "./renderScss";
import saveToContentApi from "./saveToContentApi";

const argv = yargs
    .config()
    .help()
    .option("scssVars", {
        describe: "SCSS vars to override. Expect JSON format string.",
        type: "string",
        default:
            process.env.SCSS_VARS ||
            process.env.npm_package_config_scssVars ||
            ""
    })
    .option("contentApiUrl", {
        describe: "The base URL of the content API.",
        type: "string",
        default:
            process.env.CONTENT_API_URL ||
            process.env.npm_package_config_contentApiUrl ||
            "http://localhost:6119/v0"
    })
    .option("jwtSecret", {
        describe: "The shared secret for intra-network communication",
        type: "string",
        default:
            process.env.JWT_SECRET || process.env.npm_package_config_jwtSecret
    })
    .option("userId", {
        describe:
            "The user id to use when making authenticated requests to the registry",
        type: "string",
        default: process.env.USER_ID || process.env.npm_package_config_userId
    }).argv;

const clientRoot = path.resolve(
    require.resolve("@magda/web-client/package.json"),
    ".."
);

let scssVars: object;
// --- parse argv.scssVars
try {
    if (argv.scssVars) {
        scssVars = JSON.parse(argv.scssVars);
    } else {
        scssVars = {};
    }
} catch (e) {
    console.error("Failed to parse `argv.scssVars`. ", e);
    process.exit(1);
}

async function run() {
    console.log("Scanning SCSS files from web-client...");
    const files = await getScssFileList(clientRoot);
    console.log("Compiling SCSS files from web-client...");
    const result = await renderScssFilesExtra(
        clientRoot,
        clientRoot + "/src/index.scss",
        clientRoot + "/src/_variables.scss",
        files,
        scssVars
    );
    console.log("Saving result to Content API...");
    await saveToContentApi(
        "stylesheet",
        result,
        argv.contentApiUrl,
        argv.jwtSecret,
        argv.userId
    );
    console.log("Web-client SCSS compilation completed!");
}

run().catch(e => {
    console.error("Failed to compile web-client scss. ", e);
    process.exit(1);
});
