import setupTenantMode from "../setupTenantMode";
import TenantsLoader from "../reloadTenants";
import { Tenant } from "magda-typescript-common/src/tenant-api/Tenant";
import { MAGDA_ADMIN_PORTAL_ID } from "magda-typescript-common/src/registry/TenantConsts";

import { expect } from "chai";
import nock from "nock";
import { delay } from "q";

describe("Test reload tenants", () => {
    const config = {
        tenantUrl: "http://some.where",
        enableMultiTenants: true,
        magdaAdminPortalName: "some.where",
        fetchTenantsMinIntervalInMs: 1000,
        jwtSecret: "a top secret",
        userId: "an-admin-user"
    };

    const requestScope = nock(config.tenantUrl, {
        reqheaders: {
            "Content-Type": "application/json",
            "X-Magda-Tenant-Id": `${MAGDA_ADMIN_PORTAL_ID}`
        }
    });

    before(() => {
        // This will automatically create a default tenant loader not being
        // used in the test, which is OK.
        // A fresh tenant loader must be created for each test. Otherwise the
        // throttle mechanism will fail any tests that reuse the loader.
        setupTenantMode(config);
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it("should make request with correct tenant ID", async () => {
        requestScope
            .get("/tenants")
            .reply(200, [{ domainname: "built.in", enabled: true, id: 0 }]);

        const tenantLoader = new TenantsLoader({
            tenantUrl: config.tenantUrl,
            jwtSecret: config.jwtSecret,
            userId: config.userId
        });

        await tenantLoader.reloadTenants();

        expect(tenantLoader.tenantsTable.get("built.in").id).to.equal(0);
        expect(tenantLoader.tenantsTable.get("built.in").enabled).to.equal(
            true
        );
        expect(tenantLoader.tenantsTable.size).to.equal(1);
    });

    it("should reload tenants table with enabled tenants only", async () => {
        requestScope
            .get("/tenants")
            .reply(200, [
                { domainname: "built.in", enabled: true, id: 0 },
                { domainname: "web1.com", enabled: false, id: 1 },
                { domainname: "web2.com", enabled: true, id: 2 }
            ]);

        const tenantLoader = new TenantsLoader({
            tenantUrl: config.tenantUrl,
            jwtSecret: config.jwtSecret,
            userId: config.userId
        });

        await tenantLoader.reloadTenants();

        expect(tenantLoader.tenantsTable.size).to.equal(2);
        expect(tenantLoader.tenantsTable.get("built.in").id).to.equal(0);
        expect(tenantLoader.tenantsTable.get("web1.com")).to.equal(undefined);
        expect(tenantLoader.tenantsTable.get("web2.com").id).to.equal(2);
    });

    it("should remove disabled tenants", async () => {
        requestScope
            .get("/tenants")
            .reply(200, [
                { domainname: "built.in", enabled: true, id: 0 },
                { domainname: "web1.com", enabled: true, id: 1 },
                { domainname: "web2.com", enabled: false, id: 2 }
            ]);

        const tenant0: Tenant = {
            domainname: "built.in",
            enabled: true,
            id: 0
        };
        const tenant1 = { domainname: "web1.com", enabled: true, id: 1 };
        const tenant2 = { domainname: "web1.com", enabled: true, id: 2 };

        const tenantLoader = new TenantsLoader({
            tenantUrl: config.tenantUrl,
            jwtSecret: config.jwtSecret,
            userId: config.userId
        });

        tenantLoader.tenantsTable.set(tenant0.domainname, tenant0);
        tenantLoader.tenantsTable.set(tenant1.domainname, tenant1);
        tenantLoader.tenantsTable.set(tenant2.domainname, tenant2);

        await tenantLoader.reloadTenants();

        expect(tenantLoader.tenantsTable.size).to.equal(2);
        expect(tenantLoader.tenantsTable.get("built.in").id).to.equal(0);
        expect(tenantLoader.tenantsTable.get("web1.com").id).to.equal(1);
        expect(tenantLoader.tenantsTable.get("web2.com")).to.equal(undefined);
    });

    it("should fetch tenants only once if the interval of two requests is less than the min wait time", async () => {
        const testDomainName = "some.com";
        const minReqIntervalInMs = 200;
        const theReqIntervalInMs = 20;
        const expectedTenantId = 1;
        const otherTenantId = 2;

        const tenantLoader = new TenantsLoader({
            tenantUrl: config.tenantUrl,
            jwtSecret: config.jwtSecret,
            userId: config.userId,
            minReqIntervalInMs: minReqIntervalInMs
        });

        const request1 = requestScope.get("/tenants").reply(200, [
            {
                domainname: `${testDomainName}`,
                enabled: true,
                id: expectedTenantId
            }
        ]);

        await tenantLoader.reloadTenants();
        expect(request1.isDone()).to.equal(true);

        const request2 = requestScope.get("/tenants").reply(200, [
            {
                domainname: `${testDomainName}`,
                enabled: true,
                id: otherTenantId
            }
        ]);

        await delay(() => {}, theReqIntervalInMs);
        await tenantLoader.reloadTenants();

        expect(request2.isDone()).to.equal(false);
        expect(tenantLoader.tenantsTable.get(testDomainName).id).to.equal(
            expectedTenantId
        );
    });

    it("should fetch tenants twice if the interval of two requests is greater than the min wait time", async () => {
        const testDomainName = "some.com";
        const minReqIntervalInMs = 100;
        const theReqIntervalInMs = 200;
        const expectedTenantId = 2;
        const otherTenantId = 1;

        const tenantLoader = new TenantsLoader({
            tenantUrl: config.tenantUrl,
            jwtSecret: config.jwtSecret,
            userId: config.userId,
            minReqIntervalInMs: minReqIntervalInMs
        });

        const request1 = requestScope.get("/tenants").reply(200, [
            {
                domainname: `${testDomainName}`,
                enabled: true,
                id: otherTenantId
            }
        ]);

        await tenantLoader.reloadTenants();
        expect(request1.isDone()).to.equal(true);

        const request2 = requestScope.get("/tenants").reply(200, [
            {
                domainname: `${testDomainName}`,
                enabled: true,
                id: expectedTenantId
            }
        ]);

        await delay(() => {}, theReqIntervalInMs);
        await tenantLoader.reloadTenants();

        expect(request2.isDone()).to.equal(true);
        expect(tenantLoader.tenantsTable.get(testDomainName).id).to.equal(
            expectedTenantId
        );
    });
});
