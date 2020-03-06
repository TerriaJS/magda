import { Authenticator } from "passport";
import express from "express";
import { Router } from "express";
import { Strategy as LocalStrategy } from "passport-local";

import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import loginToCkan from "./loginToCkan";
import createOrGetUserToken from "../createOrGetUserToken";
import { redirectOnSuccess, redirectOnError } from "./redirect";

export interface CkanOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    externalAuthHome: string;
    ckanUrl: string;
}

export default function ckan(options: CkanOptions) {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const externalAuthHome = options.externalAuthHome;
    const ckanUrl = options.ckanUrl;

    passport.use(
        new LocalStrategy(function(
            username: string,
            password: string,
            cb: (error: any, user?: any, info?: any) => void
        ) {
            loginToCkan(username, password, ckanUrl).then(result => {
                result.caseOf({
                    left: error => cb(error),
                    right: profile => {
                        createOrGetUserToken(authorizationApi, profile, "ckan")
                            .then(userId => cb(null, userId))
                            .catch(error => cb(error));
                    }
                });
            });
        })
    );

    const router: Router = express.Router();

    router.get("/", function(req, res) {
        res.render("form");
    });

    router.post(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("local", {
                failWithError: true
            })(req, res, next);
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
