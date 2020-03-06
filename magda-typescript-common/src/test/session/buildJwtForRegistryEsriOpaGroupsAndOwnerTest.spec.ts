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
            {
                session: {
                    esriGroups: [
                        "Dep. A",
                        "Branch A, Dep. A",
                        "Branch B, Dep. A",
                        "Section C, Branch B, Dep. A"
                    ],
                    esriUser: "user0"
                }
            },
            {
                session: {
                    esriGroups: ["Branch A, Dep. A"],
                    esriUser: "user1"
                }
            },
            {
                session: {
                    esriGroups: [
                        "Branch B, Dep. A",
                        "Section C, Branch B, Dep. A"
                    ],
                    esriUser: "user2"
                }
            },
            {
                session: {
                    esriGroups: ["Section C, Branch B, Dep. A"],
                    esriUser: "user3"
                }
            }
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
