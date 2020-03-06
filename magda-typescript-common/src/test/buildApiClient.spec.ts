import {} from "mocha";
import sinon from "sinon";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import yargs from "yargs";
import addJwtSecretFromEnvVar from "../session/addJwtSecretFromEnvVar";
import mockAuthApiHost from "./mockAuthApiHost";
import ApiClient from "../authorization-api/ApiClient";
import mockUserDataStore from "./mockUserDataStore";

chai.use(chaiAsPromised);
const expect = chai.expect;

const mockUserData = mockUserDataStore.getData();

describe("Test ApiClient.ts", function() {
    const argv = addJwtSecretFromEnvVar(
        yargs
            .config()
            .help()
            .option("authorizationApi", {
                describe: "The base URL of the authorization API.",
                type: "string",
                default: "http://localhost:6104/v0"
            })
            .option("jwtSecret", {
                describe:
                    "The secret to use to sign JSON Web Token (JWT) for authenticated requests.  This can also be specified with the JWT_SECRET environment variable.",
                type: "string"
            })
            .option("userId", {
                describe:
                    "The user id to use when making authenticated requests to the registry",
                type: "string",
                demand: true,
                default:
                    process.env.USER_ID || process.env.npm_package_config_userId
            }).argv
    );

    const mockHost = new mockAuthApiHost(
        argv.authorizationApi,
        argv.jwtSecret,
        argv.userId
    );

    before(function() {
        sinon.stub(console, "error").callsFake(() => {});
        sinon.stub(console, "warn").callsFake(() => {});
        mockHost.start();
    });

    after(function() {
        (console.error as any).restore();
        (console.warn as any).restore();
        mockHost.stop();
    });

    it("`lookupUser` should return 'Unauthorised' error if called without sepecifying user ID", async function() {
        const api = new ApiClient(argv.authorizationApi);
        return expect(
            api.lookupUser("ckan", "testuser")
        ).to.eventually.rejectedWith("Unauthorised");
    });

    it("`lookupUser` should return 'Can only be accessed by Admin users' error if called as a standard user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            mockUserData[1].id
        );
        return expect(
            api.lookupUser("ckan", "testuser")
        ).to.eventually.rejectedWith("Can only be accessed by Admin users");
    });

    it("`lookupUser` should return the correct test user record if called as admin user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            argv.userId
        );
        const data = (await api.lookupUser("ckan", "testuser")).valueOr(null);
        expect(data).to.deep.equal(mockUserData[1]);
    });

    it("`getUser` should return 'Unauthorised' error if called without sepecifying user ID", async function() {
        const api = new ApiClient(argv.authorizationApi);
        return expect(
            api.getUser(mockUserData[1].id)
        ).to.eventually.rejectedWith("Unauthorised");
    });

    it("`getUser` should return 'Can only be accessed by Admin users' error if called as a standard user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            mockUserData[1].id
        );
        return expect(api.getUser(mockUserData[1].id)).eventually.rejectedWith(
            "Can only be accessed by Admin users"
        );
    });

    it("`getUser` should return the correct test user record if called as admin user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            argv.userId
        );
        const data = (await api.getUser(mockUserData[1].id)).valueOr(null);
        expect(data).to.deep.equal(mockUserData[1]);
    });

    it("`getUserPublic` should return the correct test user record if called without sepecifying user ID", async function() {
        const api = new ApiClient(argv.authorizationApi);
        const data = (await api.getUserPublic(mockUserData[1].id)).valueOr(
            null
        );
        const expectedUserData = {
            id: mockUserData[1].id,
            photoURL: mockUserData[1].photoURL,
            displayName: mockUserData[1].displayName,
            isAdmin: mockUserData[1].isAdmin
        };
        expect(data).to.deep.equal(expectedUserData);
    });

    it("`getUserPublic` should return the correct test user record if called as a standard user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            mockUserData[1].id
        );
        const data = (await api.getUserPublic(mockUserData[1].id)).valueOr(
            null
        );
        const expectedUserData = {
            id: mockUserData[1].id,
            photoURL: mockUserData[1].photoURL,
            displayName: mockUserData[1].displayName,
            isAdmin: mockUserData[1].isAdmin
        };
        expect(data).to.deep.equal(expectedUserData);
    });

    it("`getUserPublic` should return the correct test user record if called as admin user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            argv.userId
        );
        const data = (await api.getUserPublic(mockUserData[1].id)).valueOr(
            null
        );
        const expectedUserData = {
            id: mockUserData[1].id,
            photoURL: mockUserData[1].photoURL,
            displayName: mockUserData[1].displayName,
            isAdmin: mockUserData[1].isAdmin
        };
        expect(data).to.deep.equal(expectedUserData);
    });

    const newUserDataToBeInserted = {
        displayName: "Test User2",
        email: "test@test.com",
        photoURL: "http://example.com",
        source: "manual",
        sourceId: "2",
        isAdmin: false
    };

    it(`\`createUser\` should return 'Encountered error 401 when POSTing new user to ${
        argv.authorizationApi
    }' error if called without sepecifying user ID`, async function() {
        const api = new ApiClient(argv.authorizationApi);
        return expect(
            api.createUser(newUserDataToBeInserted)
        ).to.eventually.rejectedWith(
            `Encountered error 401 when POSTing new user to ${
                argv.authorizationApi
            }`
        );
    });

    it(`\`createUser\` should return 'Encountered error 403 when POSTing new user to ${
        argv.authorizationApi
    }' error if called as a standard user`, async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            mockUserData[1].id
        );
        return expect(
            api.createUser(newUserDataToBeInserted)
        ).to.eventually.rejectedWith(
            `Encountered error 403 when POSTing new user to ${
                argv.authorizationApi
            }`
        );
    });

    let newlyCreatedUserId: string = null;

    it("`createUser` should return the new user data if called as admin user", async function() {
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            argv.userId
        );
        const newUser = await api.createUser(newUserDataToBeInserted);
        expect(newUser).to.have.property("id");
        expect(newUser.id).to.be.a("string");
        expect(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(
                newUser.id
            )
        ).to.be.true;
        newlyCreatedUserId = newUser.id;
        expect(newUser).to.deep.equal({
            ...newUserDataToBeInserted,
            id: newUser.id
        });
    });

    it("After `createUser` call, the same user record should be able to retrieved via `getUser`", async function() {
        if (!newlyCreatedUserId) {
            this.skip();
            return;
        }
        const api = new ApiClient(
            argv.authorizationApi,
            argv.jwtSecret,
            argv.userId
        );
        const user: any = (await api.getUser(newlyCreatedUserId)).valueOrThrow(
            null
        );
        expect(user).to.deep.equal({
            ...newUserDataToBeInserted,
            id: newlyCreatedUserId
        });
    });
});
