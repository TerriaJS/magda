import {} from "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import AuthorizedTenantClient from "../tenant-api/AuthorizedTenantClient";
import mockTenantDataStore from "./mockTenantDataStore";
import { MAGDA_ADMIN_PORTAL_ID } from "../registry/TenantConsts";
import nock from "nock";

const jwt = require("jsonwebtoken");

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Test AuthorizedTenantClient.ts", function() {
    const mockTenants = mockTenantDataStore.getTenants();
    const jwtSecret = "a top secret";
    const adminUserId = "an-admin-user";
    const tenantsBaseUrl = "http://tenant.some.where";

    const requestScope = nock(tenantsBaseUrl, {
        reqheaders: {
            // A jwt will contain timestamp by default. The value of header
            // "X-Magda-Session" can not be pre-determined. The exact match
            // of this header can not be guaranteed. Therefore we have to
            // check the decoded user id.
            "X-Magda-Session": jwtToken => {
                return jwt.verify(jwtToken, jwtSecret).userId === adminUserId;
            },
            "Content-Type": "application/json",
            "X-Magda-Tenant-Id": `${MAGDA_ADMIN_PORTAL_ID}`
        }
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it("`getTenants()` should return all tenants", async function() {
        requestScope.get("/tenants").reply(200, mockTenants);

        const api = new AuthorizedTenantClient({
            urlStr: tenantsBaseUrl,
            maxRetries: 1,
            secondsBetweenRetries: 1,
            jwtSecret: jwtSecret,
            userId: adminUserId
        });

        const actual = await api.getTenants();
        return expect(actual).to.deep.equal(mockTenants);
    });
});
