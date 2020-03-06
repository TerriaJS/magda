import express from "express";
const CustomStrategy = require("passport-custom").Strategy;
import { Authenticator, Profile } from "passport";
const jwt = require("jwt-simple");
import ApiClient from "magda-typescript-common/src/authorization-api/ApiClient";
import createOrGetUserToken from "../createOrGetUserToken";
import { redirectOnSuccess, redirectOnError } from "./redirect";

export interface aafOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    aafClientUri: string;
    aafClientSecret: string;
    externalUrl: string;
}

export default function aaf(options: aafOptions) {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const aafClientUri = options.aafClientUri;

    /**
     * Many base64 ultiliy will add a trailing \n to encoded content
     * Just in case the secret has a trailing \n
     * Using trim to remove it.
     * Make sure aafClientSecret is a string to avoid `no toString method`
     * error from jwt.decode
     */
    const aafClientSecret = (options.aafClientSecret
        ? "" + options.aafClientSecret
        : ""
    ).trim();

    const aafSuccessRedirect = `${
        options.externalUrl
    }/sign-in-redirect?redirectTo=/`;
    const aafFailRedirect = `${
        options.externalUrl
    }/sign-in-redirect?redirectTo=/signin`;

    if (!aafClientUri) {
        return undefined;
    }

    if (!aafClientSecret) {
        console.log("aafClientSecret is empty!");
    }

    passport.use(
        new CustomStrategy(function(req: any, done: any) {
            const verified_jwt = jwt.decode(
                req.body["assertion"],
                aafClientSecret
            );
            const attribute = verified_jwt["https://aaf.edu.au/attributes"];
            // Use mail as id because AAF return identites will change for every request though the user is the same
            // DB will use this unique mail address to hash and to get an unique id in db
            const profile: Profile = {
                id: attribute["mail"],
                displayName: attribute["displayname"],
                name: {
                    familyName: attribute["surname"],
                    givenName: attribute["givenname"]
                },
                emails: [{ value: attribute["mail"] }],
                photos: [{ value: "none-photoURL" }],
                provider: "aaf"
            };
            createOrGetUserToken(authorizationApi, profile, "aaf")
                .then(userId => {
                    console.log("create or get token:", userId);
                    return done(null, userId);
                })
                .catch(error => done(error));
        })
    );

    const router: express.Router = express.Router();

    router.get(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            console.log(req.query);
            res.redirect(aafClientUri);
        }
    );

    router.get(
        "/success",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            console.log("redirect success");
        }
    );

    router.post(
        "/jwt",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("custom", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(aafSuccessRedirect, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            console.log("error redirect: " + err);
            redirectOnError(err, aafFailRedirect, req, res);
        }
    );

    return router;
}
