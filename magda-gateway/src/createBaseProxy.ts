import * as httpProxy from "http-proxy";
import * as URI from "urijs";
import {
    tenantsTable,
    magdaAdminPortalName,
    multiTenantsMode,
    MAGDA_TENANT_ID_HEADER,
    MAGDA_ADMIN_PORTAL_ID
} from "./index";

export default function createBaseProxy(): httpProxy {
    const proxy = httpProxy.createProxyServer({
        prependUrl: false
    } as httpProxy.ServerOptions);

    proxy.on("error", function(err: any, req: any, res: any) {
        res.writeHead(500, {
            "Content-Type": "text/plain"
        });

        console.error(err);

        res.end("Something went wrong.");
    });

    proxy.on("proxyRes", function(proxyRes, req, res) {
        // Add a default cache time of 60 seconds on GETs so the CDN can cache in times of high load.
        if (
            req.method === "GET" &&
            !proxyRes.headers["Cache-Control"] &&
            !proxyRes.headers["cache-control"] &&
            !req.headers["Cache-Control"] &&
            !req.headers["cache-control"]
        ) {
            proxyRes.headers["Cache-Control"] = "public, max-age=60";
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

    proxy.on("proxyReq", function(proxyReq, req, res) {
        proxyReq.setHeader(MAGDA_TENANT_ID_HEADER, "undefined");

        if (multiTenantsMode === true) {
            const host = req.headers.host;
            const domainName = new URI("http://" + host)
                .hostname()
                .toLowerCase();

            if (domainName === magdaAdminPortalName) {
                proxyReq.setHeader(
                    MAGDA_TENANT_ID_HEADER,
                    MAGDA_ADMIN_PORTAL_ID
                );
            } else {
                const tenant = tenantsTable.get(domainName);
                if (tenant !== undefined) {
                    proxyReq.setHeader(MAGDA_TENANT_ID_HEADER, tenant.id);
                } else {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end(
                        `Something went wrong when processing the tenant with the domain name of ${domainName}.`
                    );
                }
            }
        } else {
            proxyReq.setHeader(MAGDA_TENANT_ID_HEADER, MAGDA_ADMIN_PORTAL_ID);
        }
    });

    return proxy;
}
