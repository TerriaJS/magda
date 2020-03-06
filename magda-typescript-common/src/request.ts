const requestOriginal = require("request");
import { RequestAPI, Request, CoreOptions, RequiredUriUrl } from "request";
import readPkgUp from "read-pkg-up";
const pkg = readPkgUp.sync().pkg;

if (!pkg || !pkg.name) {
    throw new Error(
        "magda-typescript-common/request: Can't locate package.json in current working directory or `name` field is empty."
    );
}

// include user agent derived from package.json in all http requests
const request = requestOriginal.defaults({
    headers: {
        "User-Agent": "".concat(
            pkg.name.replace("/", "-").replace("@", ""),
            "/",
            pkg.version
        )
    }
}) as RequestAPI<Request, CoreOptions, RequiredUriUrl>;

export default request;
