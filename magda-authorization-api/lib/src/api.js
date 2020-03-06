"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const db_1 = require("./db");
const GetUserId_1 = require("@magda/typescript-common/lib/session/GetUserId");
const router = express.Router();
function handlePromise(res, promise) {
    return promise
        .then(user =>
            user.caseOf({
                just: user => Promise.resolve(res.json(user)),
                nothing: () => Promise.resolve(res.status(404))
            })
        )
        .catch(e => {
            console.error(e);
            res.status(500);
        })
        .then(() => res.send());
}
router.get("/private/users/lookup", function(req, res) {
    const source = req.query.source;
    const sourceId = req.query.sourceId;
    handlePromise(res, db_1.getUserByExternalDetails(source, sourceId));
});
router.get("/private/users/:userId", function(req, res) {
    const userId = req.params.userId;
    handlePromise(res, db_1.getUser(userId));
});
router.post("/private/users", function(req, res) {
    db_1.createUser(req.body)
        .then(user => {
            res.json(user);
            res.status(201);
        })
        .catch(e => {
            console.error(e);
            res.status(500);
        })
        .then(() => res.send());
});
router.get("/public/users/whoami", function(req, res) {
    GetUserId_1.getUserIdHandling(req, res, userId =>
        handlePromise(res, db_1.getUser(userId))
    );
});
router.get("/public/users/:userId", (req, res) => {
    const userId = req.params.userId;
    const getPublicUser = db_1.getUser(userId).then(userMaybe =>
        userMaybe.map(user => {
            const publicUser = {
                id: user.id,
                photoURL: user.photoURL,
                displayName: user.displayName
            };
            return publicUser;
        })
    );
    handlePromise(res, getPublicUser);
});
// This is for getting a JWT in development so you can do fake authenticated requests to a local server.
if (process.env.NODE_ENV !== "production") {
    router.get("public/jwt", function(req, res) {
        res.status(200);
        res.write("X-Magda-Session: " + req.header("X-Magda-Session"));
        res.send();
    });
}
exports.default = router;
//# sourceMappingURL=api.js.map
