import { Strategy as FBStrategy } from "passport-facebook";
import express from "express";
import { Router } from "express";
import { Authenticator, Profile } from "passport";

import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import createOrGetUserToken from "../createOrGetUserToken";
import { redirectOnSuccess, redirectOnError } from "./redirect";

export interface FacebookOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    clientId: string;
    clientSecret: string;
    externalAuthHome: string;
}

export default function facebook(options: FacebookOptions) {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const clientId = options.clientId;
    const clientSecret = options.clientSecret;
    const externalAuthHome = options.externalAuthHome;
    const loginBaseUrl = `${externalAuthHome}/login`;

    if (!clientId) {
        return undefined;
    }

    passport.use(
        new FBStrategy(
            {
                clientID: clientId,
                clientSecret: clientSecret,
                profileFields: ["displayName", "picture", "email"],
                callbackURL: undefined
            },
            function(
                accessToken: string,
                refreshToken: string,
                profile: Profile,
                cb: Function
            ) {
                createOrGetUserToken(authorizationApi, profile, "facebook")
                    .then(userId => cb(null, userId))
                    .catch(error => cb(error));
            }
        )
    );

    const router: Router = express.Router();

    router.get("/", (req, res, next) => {
        // callbackURL property from https://github.com/jaredhanson/passport-facebook/issues/2
        // But it's not in the typescript defintions (as of @types/passport@0.3.4), so we need
        // sneak it in via an `any`.
        const options: any = {
            scope: ["public_profile", "email"],
            callbackURL: `${loginBaseUrl}/facebook/return?redirect=${encodeURIComponent(
                req.query.redirect || externalAuthHome
            )}`
        };
        passport.authenticate("facebook", options)(req, res, next);
    });

    router.get(
        "/return",
        function(
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) {
            const options: any = {
                callbackURL: `${loginBaseUrl}/facebook/return?redirect=${encodeURIComponent(
                    req.query.redirect || externalAuthHome
                )}`,
                failWithError: true
            };
            passport.authenticate("facebook", options)(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(req.query.redirect || externalAuthHome, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            console.error(err);
            redirectOnError(
                err,
                req.query.redirect || externalAuthHome,
                req,
                res
            );
        }
    );

    return router;
}
