import express from "express";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Authenticator, Profile } from "passport";

import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import createOrGetUserToken from "../createOrGetUserToken";
import { redirectOnSuccess, redirectOnError } from "./redirect";

export interface GoogleOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    clientId: string;
    clientSecret: string;
    externalAuthHome: string;
}

export default function google(options: GoogleOptions) {
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
        new GoogleStrategy(
            {
                clientID: clientId,
                clientSecret: clientSecret,
                callbackURL: `${loginBaseUrl}/google/return`
            },
            function(
                accessToken: string,
                refreshToken: string,
                profile: Profile,
                cb: (error: any, user?: any, info?: any) => void
            ) {
                createOrGetUserToken(authorizationApi, profile, "google")
                    .then(userId => cb(null, userId))
                    .catch(error => cb(error));
            }
        )
    );

    const router: express.Router = express.Router();

    router.get("/", (req, res, next) => {
        const options: any = {
            scope: ["profile", "email"],
            state: req.query.redirect || externalAuthHome
        };
        passport.authenticate("google", options)(req, res, next);
    });

    router.get(
        "/return",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("google", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(req.query.state, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            redirectOnError(err, req.query.state, req, res);
        }
    );

    return router;
}
