require("isomorphic-fetch");

import { User } from "./model";
import { Maybe } from "tsmonad";
import lodash from "lodash";
import buildJwt from "../session/buildJwt";

export default class ApiClient {
    private jwt: string = null;
    private requestInitOption: RequestInit = null;

    constructor(
        readonly baseUrl: string,
        jwtSecret: string = null,
        userId: string = null
    ) {
        if (jwtSecret && userId) {
            this.jwt = buildJwt(jwtSecret, userId);
        }
        this.requestInitOption = {
            headers: {
                "X-Magda-Session": this.jwt
            }
        };
    }

    getMergeRequestInitOption(extraOptions: RequestInit = null): RequestInit {
        return lodash.merge({}, this.requestInitOption, extraOptions);
    }

    async getUser(userId: string): Promise<Maybe<User>> {
        return await this.handleGetResult(
            fetch(
                `${this.baseUrl}/private/users/${userId}`,
                this.getMergeRequestInitOption()
            )
        );
    }

    async getUserPublic(userId: string): Promise<Maybe<User>> {
        return await this.handleGetResult(
            fetch(
                `${this.baseUrl}/public/users/${userId}`,
                this.getMergeRequestInitOption()
            )
        );
    }

    async lookupUser(source: string, sourceId: string): Promise<Maybe<User>> {
        return this.handleGetResult(
            fetch(
                `${
                    this.baseUrl
                }/private/users/lookup?source=${source}&sourceId=${sourceId}`,
                this.getMergeRequestInitOption()
            )
        );
    }

    async createUser(user: User): Promise<User> {
        try {
            const res = await fetch(
                `${this.baseUrl}/private/users`,
                this.getMergeRequestInitOption({
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(user)
                })
            );
            if (res.status >= 400) {
                throw new Error(
                    `Encountered error ${res.status} when POSTing new user to ${
                        this.baseUrl
                    }/private/users`
                );
            }
            const resData = await res.json();
            return { ...user, ...resData };
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    async updateOpaExtraInput(extraInput: any): Promise<void> {
        const extraInputEndpoint = `private/opa/extra/input`;
        try {
            const res = await fetch(
                `${this.baseUrl}/${extraInputEndpoint}`,
                this.getMergeRequestInitOption({
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(extraInput)
                })
            );

            if (res.status !== 200) {
                throw new Error(
                    `Encountered error ${
                        res.status
                    } when POSTing opa extra input to ${
                        this.baseUrl
                    }/${extraInputEndpoint}`
                );
            }
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    private async handleGetResult(
        promise: Promise<Response>
    ): Promise<Maybe<User>> {
        return promise
            .then(res => {
                if (res.status === 404) {
                    return Promise.resolve(Maybe.nothing<User>());
                } else {
                    return res
                        .text()
                        .then(resText => {
                            try {
                                return JSON.parse(resText);
                            } catch (e) {
                                throw new Error(resText);
                            }
                        })
                        .then(user => Maybe.just(user));
                }
            })
            .catch(e => {
                console.error(e);
                throw e;
            });
    }
}
