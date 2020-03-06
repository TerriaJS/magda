import nock from "nock";
import { Scope } from "nock";
import { getUserId } from "../session/GetUserId";
import AuthError from "../authorization-api/AuthError";

import mockUserDataStore from "./mockUserDataStore";
import { Request } from "express";
import url from "url";

export default class mockAuthApiHost {
    public scope: Scope;
    private authApiUrl: string;
    private jwtSecret: string;
    private defaultAdminUserId: string;

    constructor(
        authApiUrl: string,
        jwtSecret: string,
        defaultAdminUserId: string
    ) {
        if (!authApiUrl)
            throw new Error("authApiUrl is required to run mockAuthApiHost");
        if (!jwtSecret)
            throw new Error("jwtSecret is required to run mockAuthApiHost");
        if (!defaultAdminUserId)
            throw new Error(
                "defaultAdminUserId is required to run mockAuthApiHost"
            );

        this.authApiUrl = authApiUrl;
        this.jwtSecret = jwtSecret;
        this.defaultAdminUserId = defaultAdminUserId;

        this.createHost();
    }

    public start() {
        nock.disableNetConnect();
        this.createHost();
    }

    public stop() {
        nock.cleanAll();
        nock.enableNetConnect();
    }

    public mockReq(req: any, paramName: string = null): Request {
        const mockReq = {
            header: function(headerName: string) {
                const header = req.headers[headerName.toLowerCase()];
                if (header && header.length) return header[0];
                else return "";
            },
            query: url.parse(req.path, true, true).query,
            params: (function() {
                if (!paramName) return {};
                const r = req.path.match(/\/([^\/]+)$/);
                if (!r || !r.length) return null;
                return { [paramName]: r[1] };
            })()
        } as Request;

        return mockReq;
    }

    public mockAuthCheck(req: Request, requiredAdminAccess: boolean = false) {
        const userId = getUserId(req, this.jwtSecret).valueOrThrow(
            new AuthError("Unauthorised", 401)
        );
        if (!requiredAdminAccess) return;
        if (userId != this.defaultAdminUserId)
            throw new AuthError("Can only be accessed by Admin users", 403);
    }

    private createHost() {
        this.scope = nock(this.authApiUrl).persist();
        const thisObj = this;
        this.scope
            .get("/private/users/lookup")
            .query(true)
            .reply(function(this: any, uri, requestBody) {
                const req = thisObj.mockReq(this.req);
                try {
                    thisObj.mockAuthCheck(req, true);
                } catch (e) {
                    if (e instanceof AuthError) {
                        return [e.statusCode, e.message];
                    } else {
                        return [401, "Unauthorised"];
                    }
                }
                try {
                    const source = req.query.source;
                    const sourceId = req.query.sourceId;
                    if (!source || !sourceId)
                        return [500, "Missing query parameter"];
                    const records = mockUserDataStore.getRecordBySourceAndSourceId(
                        source,
                        sourceId
                    );
                    if (!records.length) return [404, "cannot locate record"];
                    return [200, JSON.stringify(records[0])];
                } catch (e) {
                    return [500, e.message];
                }
            });

        this.scope
            .get(/\/private\/users\/[^\/]+/)
            .reply(function(this: any, uri, requestBody) {
                const req = thisObj.mockReq(this.req, "userId");
                try {
                    thisObj.mockAuthCheck(req, true);
                } catch (e) {
                    if (e instanceof AuthError) {
                        return [e.statusCode, e.message];
                    } else {
                        return [401, "Unauthorised"];
                    }
                }
                try {
                    const userId = req.params.userId;
                    if (!userId) return [500, "Missing userId parameter"];
                    const records = mockUserDataStore.getRecordByUserId(userId);
                    if (!records.length) return [404, "cannot locate record"];
                    return [200, JSON.stringify(records[0])];
                } catch (e) {
                    return [500, e.message];
                }
            });

        this.scope
            .get(/\/public\/users\/[^\/]+/)
            .reply(function(this: any, uri, requestBody) {
                const req = thisObj.mockReq(this.req, "userId");
                try {
                    const userId = req.params.userId;
                    if (!userId) return [500, "Missing userId parameter"];

                    const records = mockUserDataStore
                        .getRecordByUserId(userId)
                        .map(record => ({
                            id: record.id,
                            photoURL: record.photoURL,
                            displayName: record.displayName,
                            isAdmin: record.isAdmin
                        }));
                    if (!records.length) return [404, "cannot locate record"];

                    return [200, JSON.stringify(records[0])];
                } catch (e) {
                    return [500, e.message];
                }
            });

        this.scope
            .post("/private/users")
            .reply(function(this: any, uri, requestBody) {
                const req = thisObj.mockReq(this.req);
                try {
                    thisObj.mockAuthCheck(req, true);
                } catch (e) {
                    if (e instanceof AuthError) {
                        return [e.statusCode, e.message];
                    } else {
                        return [401, "Unauthorised"];
                    }
                }
                try {
                    if (!requestBody) return [500, "Missing request body"];
                    const user: any = requestBody;
                    const newUser = mockUserDataStore.createRecord(user);

                    return [200, JSON.stringify(newUser)];
                } catch (e) {
                    return [500, e.message];
                }
            });
    }
}
