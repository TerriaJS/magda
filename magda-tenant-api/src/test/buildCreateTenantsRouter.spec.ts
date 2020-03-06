import {} from "mocha";
import request from "supertest";
import express from "express";
import nock from "nock";
import { Response } from "supertest";
import { expect } from "chai";
import mockAuthorization from "magda-typescript-common/src/test/mockAuthorization";
import createTenantsRouter from "../createTenantsRouter";
import mockDatabase from "./mockDatabase";
import Database from "../Database";
import mockTenantDataStore from "magda-typescript-common/src/test/mockTenantDataStore";
import { Tenant } from "magda-typescript-common/src/tenant-api/Tenant";
import {
    MAGDA_TENANT_ID_HEADER,
    MAGDA_ADMIN_PORTAL_ID
} from "magda-typescript-common/src/registry/TenantConsts";

describe("Tenant api router", function(this: Mocha.ISuiteCallbackContext) {
    let app: express.Express;
    const nonAdminPortalId = MAGDA_ADMIN_PORTAL_ID + 1;
    const jwtSecret = "a top secret";
    const authApiUrl = "http://auth.some.where";

    const beforeEachInner = () => {
        mockTenantDataStore.reset();
        app = buildExpressApp();
    };

    beforeEach(beforeEachInner);

    const afterEachInner = () => {
        nock.cleanAll();
        mockTenantDataStore.reset();
    };

    afterEach(afterEachInner);

    function getTenants(
        tenantId: number,
        app: express.Application,
        jwtSecret: string,
        isAdmin: boolean = true
    ): Promise<Response> {
        return mockAuthorization(
            authApiUrl,
            isAdmin,
            jwtSecret,
            request(app)
                .get("/tenants")
                .set(`${MAGDA_TENANT_ID_HEADER}`, tenantId.toString())
        );
    }

    function addTenant(
        tenantId: number,
        newTenant: any,
        app: express.Application,
        jwtSecret: string,
        isAdmin: boolean = true
    ): Promise<Response> {
        return mockAuthorization(
            authApiUrl,
            isAdmin,
            jwtSecret,
            request(app)
                .post("/tenants")
                .set(`${MAGDA_TENANT_ID_HEADER}`, tenantId.toString())
                .send(newTenant)
        );
    }

    function buildExpressApp() {
        const mockDb: any = new mockDatabase();
        const apiRouter = createTenantsRouter({
            jwtSecret: jwtSecret,
            database: mockDb as Database,
            authApiUrl: authApiUrl
        });

        const app = express();
        app.use(require("body-parser").json());
        app.use(apiRouter);
        return app;
    }

    describe("Tenant API", () => {
        it("should return all tenants", async () => {
            const res = await getTenants(MAGDA_ADMIN_PORTAL_ID, app, jwtSecret);
            const actualTenants: Tenant[] = res.body;
            return expect(actualTenants).to.deep.equal(
                mockTenantDataStore.getTenants()
            );
        });

        it("should reject get tenants request if tenant ID is incorrect", async () => {
            const res = await getTenants(nonAdminPortalId, app, jwtSecret);
            return expect(res.status).to.equal(400);
        });

        it("should add a tenant", async () => {
            const newTenant = {
                domainname: "test.com",
                enabled: true
            };

            const res = await addTenant(
                MAGDA_ADMIN_PORTAL_ID,
                newTenant,
                app,
                jwtSecret
            );
            const actualTenant: Tenant = res.body;
            expect(actualTenant.id).to.equal(
                mockTenantDataStore.countTenants() - 1
            );
            expect(actualTenant.domainname).to.equal("test.com");
            return expect(actualTenant.enabled).to.equal(true);
        });

        it("should reject add tenant request if tenant ID is incorrect", async () => {
            const newTenant = {
                domainname: "test.com",
                enabled: true
            };

            const res = await addTenant(
                nonAdminPortalId,
                newTenant,
                app,
                jwtSecret
            );
            return expect(res.status).to.equal(400);
        });
    });
});
