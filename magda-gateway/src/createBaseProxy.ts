import httpProxy from "http-proxy";
import express from "express";

import { TenantMode } from "./setupTenantMode";

import groupBy = require("lodash/groupBy");

import {
    MAGDA_TENANT_ID_HEADER,
    MAGDA_ADMIN_PORTAL_ID
} from "magda-typescript-common/src/registry/TenantConsts";

const DO_NOT_PROXY_HEADERS = [
    "Proxy-Authorization",
    "Proxy-Authenticate",
    "Authorization",
    "Cookie",
    "Cookie2",
    "Set-Cookie",
    "Set-Cookie2"
];

const doNotProxyHeaderLookup = groupBy(
    DO_NOT_PROXY_HEADERS.map(x => x.toLowerCase()),
    (x: string) => x
);

export default function createBaseProxy(tenantMode: TenantMode): httpProxy {
    const proxy = httpProxy.createProxyServer({
        prependUrl: false,
        changeOrigin: true
    } as httpProxy.ServerOptions);

    (proxy as any).before(
        "web",
        "stream",
        (req: any, _res: any, _options: any) => {
            if (req.headers.expect) {
                req.__expectHeader = req.headers.expect;
                delete req.headers.expect;
            }
        }
    );

    proxy.on("error", function(err: any, req: any, res: any) {
        res.writeHead(500, {
            "Content-Type": "text/plain"
        });

        console.error(err);

        res.end("Something went wrong.");
    });

    proxy.on("proxyReq", function(proxyReq, req, res) {
        // Presume that we've already got whatever auth details we need out of the request and so remove it now.
        // If we keep it it causes scariness upstream - like anything that goes through the TerriaJS proxy will
        // be leaking auth details to wherever it proxies to.
        if ((req as any).__expectHeader) {
            proxyReq.setHeader("Expect", (req as any).__expectHeader);
        }

        const headerNames = proxyReq.getHeaderNames();
        for (let i = 0; i < headerNames.length; i++) {
            const headerName = headerNames[i];
            if (!!doNotProxyHeaderLookup[headerName]) {
                proxyReq.removeHeader(headerName);
            }
        }
    });

    proxy.on("proxyRes", function(proxyRes, req, res) {
        if (
            req.method === "GET" &&
            !proxyRes.headers["Cache-Control"] &&
            !proxyRes.headers["cache-control"] &&
            !req.headers["Cache-Control"] &&
            !req.headers["cache-control"]
        ) {
            // TODO: we can't cache results that change per user, but this is an
            // overly blunt way to do it.
            proxyRes.headers["Cache-Control"] = "private, max-age=0";
        }

        /**
         * Remove security sensitive headers
         * `server` header is from scala APIs
         * Proxied content has to be filtered from here
         * while other content (produced locally by gateway) has been
         * taken care of by `app.disable("x-powered-by");` in index.js
         */
        Object.keys(proxyRes.headers).forEach(headerKey => {
            const headerKeyLowerCase = headerKey.toLowerCase();
            if (
                headerKeyLowerCase === "x-powered-by" ||
                headerKeyLowerCase === "server"
            ) {
                proxyRes.headers[headerKey] = undefined;
            }
        });
    });

    proxy.on("proxyReq", async function(proxyReq, req, res) {
        if (tenantMode.multiTenantsMode === true) {
            const theRequest = <express.Request>req;
            const domainName = theRequest.hostname.toLowerCase();

            if (domainName === tenantMode.magdaAdminPortalName) {
                proxyReq.setHeader(
                    MAGDA_TENANT_ID_HEADER,
                    MAGDA_ADMIN_PORTAL_ID
                );
            } else {
                const tenant = tenantMode.tenantsLoader.tenantsTable.get(
                    domainName
                );

                if (tenant !== undefined) {
                    proxyReq.setHeader(MAGDA_TENANT_ID_HEADER, tenant.id);
                } else {
                    // If await reloadTenants() then set header, an error message will occur:
                    //   "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client"
                    // So we just let user try again.
                    // See https://github.com/nodejitsu/node-http-proxy/issues/1328
                    tenantMode.tenantsLoader.reloadTenants();
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end(
                        `Unable to process ${domainName} right now. Please try again shortly.`
                    );
                }
            }
        } else {
            proxyReq.setHeader(MAGDA_TENANT_ID_HEADER, MAGDA_ADMIN_PORTAL_ID);
        }
    });

    return proxy;
}
