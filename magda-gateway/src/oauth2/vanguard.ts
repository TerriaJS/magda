import { Strategy } from "passport-wsfed-saml2";

import express from "express";
import { Router } from "express";
import { Authenticator } from "passport";

import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import createOrGetUserToken from "../createOrGetUserToken";
import { redirectOnSuccess } from "./redirect";

export interface VanguardOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    wsFedIdpUrl: string;
    wsFedRealm: string;
    wsFedCertificate: string;
    externalUrl: string;
}

const STRATEGY = "vanguard";

export default function vanguard(options: VanguardOptions) {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const wsFedIdpUrl = options.wsFedIdpUrl;
    const wsFedRealm = options.wsFedRealm;
    const wsFedCertificate = options.wsFedCertificate;
    const externalUrl = options.externalUrl;

    if (!wsFedIdpUrl || !wsFedRealm || !wsFedCertificate) {
        // --- we will know we didn't setup vanguard well
        throw new Error(
            "Vanguard SSO module is missing one of the following parameters: wsFedIdpUrl, wsFedRealm or wsFedCertificate"
        );
    }

    passport.use(
        STRATEGY,
        new Strategy(
            {
                identityProviderUrl: wsFedIdpUrl,
                realm: wsFedRealm,
                protocol: "wsfed",
                cert: wsFedCertificate
            },
            function(profile: any, cb: Function) {
                const email =
                    profile[
                        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
                    ];
                const displayName =
                    profile[
                        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
                    ] || email;
                const id =
                    profile[
                        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
                    ];
                profile = Object.assign(profile, {
                    emails: [{ value: email }],
                    displayName,
                    id
                });
                createOrGetUserToken(authorizationApi, profile, "vanguard")
                    .then(userId => cb(null, userId))
                    .catch(error => cb(error));
            }
        )
    );

    const router: Router = express.Router();

    router.all("/", (req, res, next) => {
        passport.authenticate(STRATEGY, {})(req, res, next);
    });

    const successRedirectUrl = `${externalUrl}/sign-in-redirect?redirectTo=/account`;

    router.all(
        "/return",
        passport.authenticate(STRATEGY, {
            failureRedirect: "/",
            failureFlash: true
        }),
        function(req, res) {
            redirectOnSuccess(successRedirectUrl, req, res);
        }
    );

    return router;
}
