import express from "express";
import createBaseProxy from "./createBaseProxy";
import { GenericProxyRouterOptions } from "./createGenericProxyRouter";

export default function createGenericProxy(
    target: string,
    options: GenericProxyRouterOptions
): express.Router {
    const webRouter = express.Router();
    const proxy = createBaseProxy(options);

    webRouter.all("*", (req: express.Request, res: express.Response) => {
        proxy.web(req, res, { target });
    });

    return webRouter;
}
