require("isomorphic-fetch");
import { throttle, Cancelable } from "lodash";
import { Tenant } from "magda-typescript-common/src/tenant-api/Tenant";
import AuthorizedTenantClient from "magda-typescript-common/src/tenant-api/AuthorizedTenantClient";

type TenantsLoaderConfig = {
    tenantUrl: string;
    jwtSecret: string;
    userId: string;
    minReqIntervalInMs?: number;
};

export default class TenantsLoader {
    private tenantApiClient: AuthorizedTenantClient;
    tenantsTable = new Map<String, Tenant>();

    private async updateTenants() {
        const tenants = <Tenant[]>await this.tenantApiClient.getTenants();
        this.tenantsTable.clear();
        tenants.forEach(t => {
            if (t.enabled === true) {
                this.tenantsTable.set(t.domainname.toLowerCase(), t);
                console.debug(`${t.domainname.toLowerCase()} : ${t.id}`);
            }
        });
    }

    private throttledReloadTenants: (() => Promise<void>) & Cancelable;

    constructor(config: TenantsLoaderConfig) {
        console.debug(
            `TenantsLoader throttle interval = ${config.minReqIntervalInMs}`
        );
        this.tenantApiClient = new AuthorizedTenantClient({
            urlStr: config.tenantUrl,
            userId: config.userId,
            jwtSecret: config.jwtSecret
        });

        const throttleInterval = config.minReqIntervalInMs || 600000;
        this.throttledReloadTenants = throttle(
            this.updateTenants.bind(this),
            throttleInterval,
            { trailing: false }
        );
    }

    public reloadTenants() {
        return this.throttledReloadTenants();
    }
}
