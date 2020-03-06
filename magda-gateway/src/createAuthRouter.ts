import { Router } from "express";
import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import Authenticator from "./Authenticator";
import passport from "passport";

export interface AuthRouterOptions {
    authenticator: Authenticator;
    jwtSecret: string;
    facebookClientId: string;
    facebookClientSecret: string;
    googleClientId: string;
    googleClientSecret: string;
    aafClientUri: string;
    aafClientSecret: string;
    arcgisClientId: string;
    arcgisClientSecret: string;
    arcgisInstanceBaseUrl: string;
    esriOrgGroup: string;
    ckanUrl: string;
    authorizationApi: string;
    externalUrl: string;
    userId: string;
    vanguardWsFedIdpUrl: string;
    vanguardWsFedRealm: string;
    vanguardWsFedCertificate: string;
}

export default function createAuthRouter(options: AuthRouterOptions): Router {
    const authRouter: Router = Router();
    const authApi = new ApiClient(
        options.authorizationApi,
        options.jwtSecret,
        options.userId
    );

    if (options.authenticator) {
        options.authenticator.applyToRoute(authRouter);
    }

    authRouter.use(require("body-parser").urlencoded({ extended: true }));

    const providers = [
        {
            id: "facebook",
            enabled: options.facebookClientId ? true : false,
            authRouter: options.facebookClientId
                ? require("./oauth2/facebook").default({
                      authorizationApi: authApi,
                      passport: passport,
                      clientId: options.facebookClientId,
                      clientSecret: options.facebookClientSecret,
                      externalAuthHome: `${options.externalUrl}/auth`
                  })
                : null
        },
        {
            id: "google",
            enabled: options.googleClientId ? true : false,
            authRouter: options.googleClientId
                ? require("./oauth2/google").default({
                      authorizationApi: authApi,
                      passport: passport,
                      clientId: options.googleClientId,
                      clientSecret: options.googleClientSecret,
                      externalAuthHome: `${options.externalUrl}/auth`
                  })
                : null
        },
        {
            id: "arcgis",
            enabled: options.arcgisClientId ? true : false,
            authRouter: options.arcgisClientId
                ? require("./oauth2/arcgis").default({
                      authorizationApi: authApi,
                      passport: passport,
                      clientId: options.arcgisClientId,
                      clientSecret: options.arcgisClientSecret,
                      arcgisInstanceBaseUrl: options.arcgisInstanceBaseUrl,
                      externalAuthHome: `${options.externalUrl}/auth`,
                      esriOrgGroup: options.esriOrgGroup
                  })
                : null
        },
        {
            id: "ckan",
            enabled: options.ckanUrl ? true : false,
            authRouter: options.ckanUrl
                ? require("./oauth2/ckan").default({
                      authorizationApi: authApi,
                      passport: passport,
                      externalAuthHome: `${options.externalUrl}/auth`,
                      ckanUrl: options.ckanUrl
                  })
                : null
        },
        {
            id: "aaf",
            enabled: options.aafClientUri ? true : false,
            authRouter: options.aafClientUri
                ? require("./oauth2/aaf").default({
                      authorizationApi: authApi,
                      passport: passport,
                      aafClientUri: options.aafClientUri,
                      aafClientSecret: options.aafClientSecret,
                      externalUrl: options.externalUrl
                  })
                : null
        },
        {
            id: "vanguard",
            enabled: options.vanguardWsFedIdpUrl ? true : false,
            authRouter: options.vanguardWsFedIdpUrl
                ? require("./oauth2/vanguard").default({
                      authorizationApi: authApi,
                      passport: passport,
                      wsFedIdpUrl: options.vanguardWsFedIdpUrl,
                      wsFedRealm: options.vanguardWsFedRealm,
                      wsFedCertificate: options.vanguardWsFedCertificate,
                      externalUrl: options.externalUrl
                  })
                : null
        }
    ];

    // Define routes.
    authRouter.get("/", function(req, res) {
        res.render("home", { user: req.user });
    });

    authRouter.get("/login", function(req, res) {
        res.render("login");
    });

    authRouter.get("/admin", function(req, res) {
        res.render("admin");
    });

    providers
        .filter(provider => provider.enabled)
        .forEach(provider => {
            authRouter.use("/login/" + provider.id, provider.authRouter);
        });

    authRouter.get("/providers", (req, res) => {
        res.json(
            providers
                .filter(provider => provider.enabled)
                .map(provider => provider.id)
        );
    });

    authRouter.get(
        "/profile",
        require("connect-ensure-login").ensureLoggedIn(),
        function(req, res) {
            authApi
                .getUser(req.user.id)
                .then(user =>
                    res.render("profile", { user: user.valueOrThrow() })
                )
                .catch((error: Error) => {
                    console.error(error);
                    res.status(500).send("Error");
                });
        }
    );

    // --- /auth/logout route is now handled by Authenticator.ts

    return authRouter;
}
