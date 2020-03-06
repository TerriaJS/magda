import mockTenantDataStore from "magda-typescript-common/src/test/mockTenantDataStore";
import { Tenant } from "magda-typescript-common/src/tenant-api/Tenant";

export default class MockDatabase {
    async getTenants(): Promise<Tenant[]> {
        return new Promise(function(resolve, _) {
            resolve(
                mockTenantDataStore.getTenants().map(
                    (item: {
                        id: number;
                        domainname: string;
                        enabled: boolean;
                    }) =>
                        ({
                            id: item.id,
                            domainname: item.domainname,
                            enabled: item.enabled
                        } as Tenant)
                )
            );
        });
    }

    async createTenant(tenant: Tenant): Promise<Tenant> {
        return new Promise(function(resolve, reject) {
            resolve(mockTenantDataStore.createTenant(tenant));
        });
    }

    check() {}
}
