import express from "express";
import session from "express-session";
import pg from "pg";
import passport from "passport";
import URI from "urijs";
import signature from "cookie-signature";

/** This is present in the express-session types but not actually exported properly, so it needs to be copy-pasted here */
type SessionCookieOptions = {
    maxAge?: number;
    signed?: boolean;
    expires?: Date;
    httpOnly?: boolean;
    path?: string;
    domain?: string;
    secure?: boolean | "auto";
    encode?: (val: string) => string;
    sameSite?: boolean | "lax" | "strict" | "none";
};

export interface AuthenticatorOptions {
    sessionSecret: string;
    dbPool: pg.Pool;
    cookieOptions?: SessionCookieOptions;
}

export const DEFAULT_SESSION_COOKIE_NAME: string = "connect.sid";
export let DEFAULT_SESSION_COOKIE_OPTIONS: SessionCookieOptions = {
    maxAge: 7 * 60 * 60 * 1000
};

/**
 * Run a list of middlewares in order.
 * It simulates express's middleware handling.
 * i.e.: middlewares (other than the first one) will be executed if the middleware before it called next()
 *
 * @param {express.RequestHandler[]} middlewareList
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function runMiddlewareList(
    middlewareList: express.RequestHandler[],
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    function runNext() {
        if (!middlewareList.length) return next();
        const currentMiddleware = middlewareList.shift();
        currentMiddleware(req, res, runNext);
    }
    runNext();
}

function getSessionId(req: express.Request, secret: string = ""): string {
    const sessionCookie = req.cookies[DEFAULT_SESSION_COOKIE_NAME] as string;
    if (!sessionCookie) {
        return null;
    } else {
        if (sessionCookie.substr(0, 2) === "s:") {
            // --- process signed cookie
            const unsignResult = signature.unsign(
                sessionCookie.slice(2),
                secret
            );
            if (unsignResult === false) {
                return null;
            }
            return unsignResult;
        } else {
            return sessionCookie;
        }
    }
}

export default class Authenticator {
    private cookieParserMiddleware: express.RequestHandler;
    private sessionMiddleware: express.RequestHandler;
    private passportMiddleware: express.RequestHandler;
    private passportSessionMiddleware: express.RequestHandler;
    public sessionCookieOptions: SessionCookieOptions;
    private sessionSecret: string;

    constructor(options: AuthenticatorOptions) {
        this.sessionCookieOptions = options.cookieOptions
            ? {
                  ...DEFAULT_SESSION_COOKIE_OPTIONS,
                  ...options.cookieOptions
              }
            : {
                  ...DEFAULT_SESSION_COOKIE_OPTIONS
              };

        passport.serializeUser(function(user: any, cb) {
            cb(null, user);
        });

        passport.deserializeUser(function(user: any, cb) {
            cb(null, user);
        });

        const store = new (require("connect-pg-simple")(session))({
            pool: options.dbPool
        });

        this.cookieParserMiddleware = require("cookie-parser")();

        this.sessionSecret = options.sessionSecret ? options.sessionSecret : "";

        this.sessionMiddleware = session({
            store,
            // --- we don't have to set session cookie name
            // --- but good to make sure it'd be only one value in our app
            name: DEFAULT_SESSION_COOKIE_NAME,
            secret: options.sessionSecret,
            cookie: { ...this.sessionCookieOptions },
            resave: false,
            saveUninitialized: false,
            rolling: true
        });

        this.passportMiddleware = passport.initialize();
        this.passportSessionMiddleware = passport.session();
    }

    /**
     * destroy the session.
     *  - will delete the session data from session store only.
     * - will not delete session cookie (Call deleteCookie method for deleting cookie)
     *
     * @param {express.Request} req
     * @returns {Promise<never>}
     * @memberof Authenticator
     */
    destroySession(req: express.Request): Promise<never> {
        return new Promise((resolve, reject) => {
            req.session.destroy(err => {
                if (err) {
                    // Failed to access session storage to delete session data
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Delete cookie from web browser
     *
     * @param {express.Response} res
     * @memberof Authenticator
     */
    deleteCookie(res: express.Response) {
        const deleteCookieOptions = {
            ...this.sessionCookieOptions
        };
        // --- `clearCookie` works in a way like it will fail to delete cookie if maxAge presents T_T
        // --- https://github.com/expressjs/express/issues/3856#issuecomment-502397226
        delete deleteCookieOptions.maxAge;
        res.clearCookie(DEFAULT_SESSION_COOKIE_NAME, deleteCookieOptions);
    }

    /**
     * A middleware wraps all other cookie / session / passport related middlewares
     * to achieve fine-gain session / cookie control in Magda.
     * Generally, we want to:
     * - user request won't carry a cookie in the header unless they are logged in
     * - system won't mis/re-issue a new session for the same user whose request carries the session cookie
     * See https://github.com/magda-io/magda/issues/2545 for more details
     *
     * @param {express.Request} req
     * @param {express.Response} res
     * @param {express.NextFunction} next
     * @memberof Authenticator
     */
    authenticatorMiddleware(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        const uri = new URI(req.originalUrl);
        const pathname = uri.pathname().toLowerCase();

        if (pathname.indexOf("/auth/login/") === 0) {
            // --- start session / passport here
            return runMiddlewareList(
                [
                    this.sessionMiddleware,
                    this.passportMiddleware,
                    this.passportSessionMiddleware
                ],
                req,
                res,
                next
            );
        } else if (
            pathname === "/auth/logout" ||
            (pathname === "/sign-in-redirect" &&
                uri.hasQuery("result", "failure"))
        ) {
            // --- end the session here
            if (!req.cookies[DEFAULT_SESSION_COOKIE_NAME]) {
                // --- session not started yet
                return next();
            }
            // --- Only make session / store available
            // --- passport midddleware should not be run
            return runMiddlewareList(
                [this.sessionMiddleware],
                req,
                res,
                async () => {
                    // --- destroy session here
                    // --- any session data will be removed from session store
                    if (pathname === "/auth/logout") {
                        // --- based on PR review feedback, we want to report any errors happened during session destroy
                        // --- and only remove cookie from user agent when session data is destroyed successfully
                        this.destroySession(req)
                            .then(() => {
                                // --- delete the cookie and continue middleware processing chain
                                this.deleteCookie(res);
                                res.status(200).send({
                                    isError: false
                                });
                            })
                            .catch(err => {
                                const errorMessage = `Failed to destory session: ${err}`;
                                console.log(errorMessage);
                                res.status(500).send({
                                    isError: true,
                                    errorCode: 500,
                                    errorMessage
                                });
                            });
                    } else {
                        // --- for non logout path, no need to wait till `destroySession` complete
                        this.destroySession(req).catch(err => {
                            // --- only log here if failed to delete session data from session store
                            console.log(`Failed to destory session: ${err}`);
                        });
                        this.deleteCookie(res);
                        return next();
                    }
                }
            );
        } else {
            // For other routes: only make session & passport data available if session has already started (cookie set)
            if (!req.cookies[DEFAULT_SESSION_COOKIE_NAME]) {
                // --- session not started yet & no incoming session id cookie
                // --- proceed to other non auth middlewares
                return next();
            } else {
                // --- run the session middleware only first
                return runMiddlewareList(
                    [this.sessionMiddleware],
                    req,
                    res,
                    () => {
                        // --- check if the original incoming session id was invalid
                        // --- here, we test session middleware's processing result
                        // --- rather than accessing session store directly by ourself
                        const sessionId = getSessionId(req, this.sessionSecret);
                        if (req.session.id !== sessionId) {
                            // --- a new session has been created
                            // --- the original incoming session id must have been an invalid or expired one
                            // --- we need to destroy this newly created empty session
                            // --- destroy session here & no need to wait till `destroySession` complete
                            this.destroySession(req).catch(err => {
                                // --- only log here if failed to delete session data from session store
                                console.log(
                                    `Failed to destory session: ${err}`
                                );
                            });
                            this.deleteCookie(res);
                            // --- proceed to other middleware & no need to run passport
                            return next();
                        } else {
                            // --- if the session id is valid, run passport middleware
                            return runMiddlewareList(
                                [
                                    this.passportMiddleware,
                                    this.passportSessionMiddleware
                                ],
                                req,
                                res,
                                next
                            );
                        }
                    }
                );
            }
        }
    }

    applyToRoute(router: express.Router) {
        // --- we always need cooker parser middle in place
        router.use(this.cookieParserMiddleware);
        // --- apply our wrapper as the delegate for other middlewares
        router.use(this.authenticatorMiddleware.bind(this));
    }
}
