require("isomorphic-fetch");
require("isomorphic-form-data");

import { Either } from "tsmonad";

const cheerio = require("cheerio");
const gravatar = require("gravatar");
import passport from "passport";

namespace loginToCkan {
    export type Failure = string;
    export type Success = passport.Profile;
}

function loginToCkan(
    username: string,
    password: string,
    ckanUrl: string
): Promise<Either<loginToCkan.Failure, loginToCkan.Success>> {
    return fetch(ckanUrl + "/data/login_generic?came_from=/user/logged_in", {
        method: "POST",
        redirect: "manual",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `login=${username}&password=${password}`
    }).then(res => {
        const cookies = res.headers.get("set-cookie");

        if (!cookies) {
            return Promise.resolve(
                Either.left<loginToCkan.Failure, loginToCkan.Success>(
                    "unauthorized"
                )
            );
        }

        const relevantCookie = cookies.split(";")[0];

        return afterLoginSuccess(relevantCookie, username, ckanUrl);
    });
}

function afterLoginSuccess(
    cookies: string,
    username: string,
    ckanUrl: string
): Promise<Either<loginToCkan.Failure, loginToCkan.Success>> {
    return fetch(ckanUrl + "/user/edit/" + username, {
        headers: {
            cookie: cookies
        }
    }).then(secondRes => {
        if (secondRes.status === 200) {
            return parseUser(secondRes);
        } else {
            return Promise.resolve(
                Either.left<loginToCkan.Failure, loginToCkan.Success>(
                    "unauthorized"
                )
            );
        }
    });
}

function parseUser(
    res: Response
): Promise<Either<loginToCkan.Failure, loginToCkan.Success>> {
    return res.text().then(text => {
        const $ = cheerio.load(text);

        const userName = $("#field-username").attr("value");
        const email = $("#field-email").attr("value");
        const displayName = $("#field-fullname").attr("value");

        return Promise.resolve(
            Either.right<loginToCkan.Failure, loginToCkan.Success>({
                id: userName,
                provider: "ckan",
                displayName,
                emails: [{ value: email }],
                photos: [{ value: gravatar.url(email) }]
            })
        );
    });
}

export default loginToCkan;
