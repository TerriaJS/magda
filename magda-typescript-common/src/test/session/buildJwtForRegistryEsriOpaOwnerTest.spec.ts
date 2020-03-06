import "mocha";
import yargs from "yargs";
import addJwtSecretFromEnvVar from "../../session/addJwtSecretFromEnvVar";
import buildJwt from "../../session/buildJwt";

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

    it("should create jwt token with userId and session claims", function() {
        const sessions = [
            { session: { esriUser: "user0" } },
            { session: { esriUser: "user1" } },
            { session: { esriUser: "user2" } },
            { session: { esriUser: "user3" } }
        ];

        const userIds = [
            "00000000-0000-1000-0000-000000000000",
            "00000000-0000-1000-0001-000000000000",
            "00000000-0000-1000-0002-000000000000",
            "00000000-0000-1000-0003-000000000000"
        ];

        for (var i = 0; i < userIds.length; i++) {
            let userId = userIds[i];
            let session = sessions[i];
            let jwtToken = buildJwt(argv.jwtSecret, userId, session);
            console.log(`userId ${userIds[i]}: \njwt: ${jwtToken}\n`);
        }
    });
});
