const jwt = require("jsonwebtoken");
import nock from "nock";
import { Test, Response } from "supertest";

export { Response };

export default function mockAuthorization(
    adminApiUrl: string,
    isAdmin: boolean,
    jwtSecret: string,
    req: Test
): Promise<Response> {
    const userId = "1";
    const scope = nock(adminApiUrl);

    if (!isAdmin)
        scope
            .get(`/private/users/${userId}`)
            .reply(401, "Only admin users are authorised to access this API");
    else scope.get(`/private/users/${userId}`).reply(200, { isAdmin });

    const id = jwt.sign({ userId: userId }, jwtSecret);

    return req.set("X-Magda-Session", id).then(res => {
        scope.done();
        return res;
    });
}
