import { expect } from "chai";
import "mocha";
import yargs from "yargs";
import addJwtSecretFromEnvVar from "../../session/addJwtSecretFromEnvVar";
import { getUserId } from "../../session/GetUserId";
import { getUserSession } from "../../session/GetUserSession";
import buildJwt from "../../session/buildJwt";
const { mockRequest } = require("mock-req-res");

describe("Get authz claim from jwt token", () => {
    const argv = addJwtSecretFromEnvVar(
        yargs
            .config()
            .help()
            .option("jwtSecret", {
                describe:
                    "The secret to use to sign JSON Web Token (JWT) for authenticated requests.",
                type: "string"
            }).argv
    );

    it("should get userId", function() {
        const aUserId = "aTestUserId";
        const jwtToken = buildJwt(argv.jwtSecret, aUserId);

        const req = mockRequest({
            header(name: string) {
                if (name === "X-Magda-Session") return jwtToken;
                else return null;
            }
        });

        const actual = getUserId(req, argv.jwtSecret).valueOr("wrong answer");
        expect(actual).to.be.equal(aUserId);
    });

    it("should get user session", function() {
        const aUserId = "aTestUserId";
        const groups = ["G1", "G2"];
        const session = { session: { esriGroups: groups } };
        const jwtToken = buildJwt(argv.jwtSecret, aUserId, session);

        const req = mockRequest({
            header(name: string) {
                if (name === "X-Magda-Session") return jwtToken;
                else return null;
            }
        });

        const actual = getUserSession(req, argv.jwtSecret).valueOr({});
        expect(actual.session.esriGroups).to.be.deep.equal(groups);
    });
});
