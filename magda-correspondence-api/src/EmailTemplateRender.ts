import { Attachment } from "./SMTPMailer";
import ContentApiDirMapper from "./ContentApiDirMapper";
import path from "path";
import mimeTypes from "mime-types";
import Mustache from "mustache";

/**
 * customised mustache render function.
 * usgae: {{#inlineImg}}<img class="xxx" src="emailTemplates/assets/1.png" />{{/inlineImg}}
 *
 * @param text
 * @param render
 */
function inlineImg(
    this: EmailTemplateRender,
    text: string,
    render: (text: string) => string
) {
    // --- render inner block first
    const content = render(text);
    const matches = content.match(/<img\s+[^>]*src=["']([^"']*)['"]/i);
    if (!matches) {
        return content;
    }
    const filePath = matches[1];
    const fileName = path.basename(filePath);
    const idx = this.attachments.findIndex(item => item.path === filePath);
    let cid = "";
    if (idx !== -1) {
        cid = this.attachments[idx].cid;
    } else {
        const mimeType = mimeTypes.lookup(filePath);
        cid = `inlineImg_${Math.random()}`.replace(".", "_");
        this.attachments.push({
            filename: fileName,
            contentType:
                mimeType === false ? "application/octet-stream" : mimeType,
            contentDisposition: "inline",
            path: filePath,
            cid
        });
    }
    return content.replace(
        /(<img\s+[^>]*src=["'])([^"']*)(['"])/i,
        `$1${"cid:" + cid}$3`
    );
}

export default class EmailTemplateRender {
    public attachments: Attachment[] = [];
    private contentMapper: ContentApiDirMapper = null;

    constructor(contentMapper: ContentApiDirMapper) {
        this.contentMapper = contentMapper;
        if (!this.attachments) {
            throw new Error("Content Mapper cannot be empty!");
        }
    }

    async render(templatePath: string, data: any) {
        this.attachments = [];
        const template = await this.contentMapper.getFileContent(templatePath);
        if (!data || typeof data !== "object") {
            data = {};
        }
        // --- set render function
        data.inlineImg = () => {
            return inlineImg.bind(this);
        };
        const renderedContent = Mustache.render(template, data);
        if (this.attachments.length) {
            for (let i = 0; i < this.attachments.length; i++) {
                const imgContent = await this.contentMapper.getFileContent(
                    this.attachments[i].path.toString()
                );
                this.attachments[i].content = imgContent;
                delete this.attachments[i].path;
            }
        }
        return renderedContent;
    }
}
