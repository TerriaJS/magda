import buildJwt from "magda-typescript-common/src/session/buildJwt";
import rp from "request-promise-native";
import mime from "mime-types";
import recursiveReadDir from "recursive-readdir";
import fse from "fs-extra";
import path from "path";
import typeis from "type-is";

/**
 * A Class attempt to create an abstract access layer between content API and local directory
 */
class ContentApiDirMapper {
    public url: string;
    public userId: string;
    private jwtSecret: string;

    /**
     *
     * @param url string: Content API url access url
     * @param userId string: Admin user ID (for uploading resources to content API)
     * @param jwtSecret string: JWT secrets (for uploading resources to content API)
     */
    constructor(url: string, userId: string = "", jwtSecret: string = "") {
        this.url = url;
        this.userId = userId;
        this.jwtSecret = jwtSecret;
        if (this.url === "") {
            throw new Error(
                "ContentApiDirMapper: content API URL canot be empty!"
            );
        }
    }

    /**
     * Get resource from content API by localPath.
     * Will return string or Buffer depends `content-type` header
     * @param localPath string: local directory path. e.g.: emailTemplates/assets/top-left-logo.jpg
     */
    public async getFileContent(localPath: string) {
        const res = await rp.get(`${this.url}/${localPath}`, {
            resolveWithFullResponse: true,
            encoding: null
        });
        const contentType = res.headers["content-type"];
        if (typeis.is(contentType, ["text/*"])) {
            return res.body.toString("utf-8");
        }
        return res.body;
    }

    /**
     * Upload a local content to content API.
     * @param localPath string: local path of the resource. e.g. emailTemplates/assets/top-left-logo.jpg
     * @param fileContent string or Buffer. Require string for text content, otherwise Buffer is required.
     */
    public async saveFile(localPath: string, fileContent: Buffer) {
        let mimeType = mime.lookup(localPath);
        if (mimeType === false) {
            mimeType = "application/octet-stream";
        }
        return await rp(`${this.url}/${localPath}`, {
            method: "PUT",
            resolveWithFullResponse: true,
            headers: {
                "X-Magda-Session": buildJwt(this.jwtSecret, this.userId),
                "Content-type": mimeType
            },
            body: fileContent
        });
    }

    /**
     * Test if a resource specified by the `localPath` is avaiable on content API
     * This function is done via express build-in HEAD request handling
     * @param localPath string: local path of the resource. e.g. emailTemplates/assets/top-left-logo.jpg
     */
    public async fileExist(localPath: string) {
        const res = await rp.head(`${this.url}/${localPath}`, {
            resolveWithFullResponse: true,
            simple: false
        });
        if (res.statusCode !== 200) return false;
        else return true;
    }

    /**
     * Sync (i.e. upload all files in a local directory if not exist) a local directory with a target directory on content API.
     * If a resource already exists, it will NOT be overwritten.
     * @param localFolderPath string: Local directory path. e.g. ./emailTemplates
     * @param remoteFolerName string: Optional. If not specify, the function will attempt to sync with a directory with the same name.
     */
    public async syncFolder(
        localFolderPath: string,
        remoteFolerName: string = ""
    ) {
        const absLocalFolderPath = path.resolve(localFolderPath);
        let targetRemoteFolderName = remoteFolerName;
        if (remoteFolerName === "") {
            targetRemoteFolderName = path.basename(absLocalFolderPath);
        }
        const files = await recursiveReadDir(localFolderPath);
        if (!files || !files.length) {
            return [[], []];
        }
        const skippedFiles = [];
        for (let i = 0; i < files.length; i++) {
            const fileRemoteLocalPath = `${targetRemoteFolderName}${files[
                i
            ].replace(absLocalFolderPath, "")}`;
            const checkFile = await this.fileExist(fileRemoteLocalPath);
            if (checkFile) {
                skippedFiles.push(fileRemoteLocalPath);
                continue;
            }
            const fileContent = await fse.readFile(`${files[i]}`);
            await this.saveFile(fileRemoteLocalPath, fileContent);
        }
        return [files, skippedFiles];
    }
}

export default ContentApiDirMapper;
