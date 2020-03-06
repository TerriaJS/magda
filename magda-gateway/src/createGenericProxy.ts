import express from "express";
import createBaseProxy from "./createBaseProxy";
import { TenantMode } from "./setupTenantMode";

export default function createGenericProxy(
    target: string,
    tenantMode: TenantMode
): express.Router {
    const webRouter = express.Router();
    const proxy = createBaseProxy(tenantMode);

    webRouter.all("*", (req: express.Request, res: express.Response) => {
        proxy.web(req, res, { target });
    });

    return webRouter;
}
