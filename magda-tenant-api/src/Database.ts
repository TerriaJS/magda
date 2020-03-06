import createPool from "./createPool";
import { Tenant } from "magda-typescript-common/src/tenant-api/Tenant";
import pg from "pg";
import _ from "lodash";

export interface DatabaseOptions {
    dbHost: string;
    dbPort: number;
}

export default class Database {
    private pool: pg.Pool;

    constructor(options: DatabaseOptions) {
        this.pool = createPool(options);
    }

    async getTenants(): Promise<Tenant[]> {
        const res = await this.pool.query(`SELECT * FROM tenants`);
        return res.rows;
    }

    async createTenant(tenant: Tenant): Promise<Tenant> {
        const result = await this.pool.query(
            "INSERT INTO tenants(domainname, enabled) VALUES($1, $2) RETURNING domainname, id, enabled",
            [tenant.domainname, tenant.enabled]
        );
        const theTenant: Tenant = result.rows[0];
        return theTenant;
    }
}
