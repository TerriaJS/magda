import { Request, Response } from "express";
import { Maybe } from "tsmonad";
const jwt = require("jsonwebtoken");

export function getUserId(req: Request, jwtSecret: string): Maybe<string> {
    const jwtToken = req.header("X-Magda-Session");

    if (jwtToken) {
        try {
            const jwtPayload = jwt.verify(jwtToken, jwtSecret);
            return Maybe.just(jwtPayload.userId);
        } catch (e) {
            console.error(e);
            return Maybe.nothing<string>();
        }
    } else {
        return Maybe.nothing<string>();
    }
}

export function getUserIdHandling(
    req: Request,
    res: Response,
    jwtSecret: string,
    cb: (userId: string) => void
) {
    const userId = getUserId(req, jwtSecret);

    userId.caseOf({
        just: userId => {
            cb(userId);
        },
        nothing: () => {
            console.warn(
                "Rejecting with not authorized because no user id present"
            );
            res.status(401).send("Not authorized.");
        }
    });
}
