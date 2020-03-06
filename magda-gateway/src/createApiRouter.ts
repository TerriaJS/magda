import express from "express";
import { Router } from "express";
import _ from "lodash";
import escapeStringRegexp from "escape-string-regexp";

import buildJwt from "magda-typescript-common/src/session/buildJwt";

import createBaseProxy from "./createBaseProxy";
import Authenticator from "./Authenticator";
import { TenantMode } from "./setupTenantMode";

export interface ProxyTarget {
    to: string;
    methods?: string[];
    auth?: boolean;
    redirectTrailingSlash?: boolean;
}

export interface ApiRouterOptions {
    authenticator: Authenticator;
    jwtSecret: string;
    routes: {
        [localRoute: string]: ProxyTarget;
    };
    tenantMode: TenantMode;
}

export default function createApiRouter(options: ApiRouterOptions): Router {
    var proxy = createBaseProxy(options.tenantMode);

    const authenticator = options.authenticator;
    const jwtSecret = options.jwtSecret;

    const router: Router = express.Router();

    proxy.on("proxyReq", (proxyReq, req: any, _res, _options) => {
        if (jwtSecret && req.user) {
            proxyReq.setHeader(
                "X-Magda-Session",
                buildJwt(jwtSecret, req.user.id, { session: req.user.session })
            );
        }
    });

    function proxyRoute(
        baseRoute: string,
        target: string,
        verbs: string[] = ["all"],
        auth = false,
        redirectTrailingSlash = false
    ) {
        console.log("PROXY", baseRoute, target, verbs);
        const routeRouter: any = express.Router();

        if (authenticator && auth) {
            authenticator.applyToRoute(routeRouter);
        }

        verbs.forEach((verb: string) =>
            routeRouter[verb.toLowerCase()](
                "*",
                (req: express.Request, res: express.Response) => {
                    proxy.web(req, res, { target });
                }
            )
        );

        if (redirectTrailingSlash) {
            // --- has to use RegEx as `req.originalUrl` will match both with & without trailing /
            const re = new RegExp(`^${escapeStringRegexp(baseRoute)}$`);
            router.get(re, function(req, res) {
                res.redirect(`${req.originalUrl}/`);
            });
        }

        router.use(baseRoute, routeRouter);

        return routeRouter;
    }

    _.forEach(options.routes, (value: ProxyTarget, key: string) => {
        // --- skip tenant api router if multiTenantsMode is off
        if (key === "tenant" && !options.tenantMode.multiTenantsMode) {
            return;
        }
        proxyRoute(
            `/${key}`,
            value.to,
            value.methods,
            !!value.auth,
            value.redirectTrailingSlash
        );
    });

    return router;
}
