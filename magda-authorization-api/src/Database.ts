import createPool from "./createPool";
import {
    User,
    Role,
    Permission
} from "magda-typescript-common/src/authorization-api/model";
import { Maybe } from "tsmonad";
import arrayToMaybe from "magda-typescript-common/src/util/arrayToMaybe";
import pg from "pg";
import _ from "lodash";
import GenericError from "magda-typescript-common/src/authorization-api/GenericError";
import { getUserId } from "magda-typescript-common/src/session/GetUserId";
import NestedSetModelQueryer from "./NestedSetModelQueryer";
import isUuid from "magda-typescript-common/src/util/isUuid";

export interface DatabaseOptions {
    dbHost: string;
    dbPort: number;
}

const ANONYMOUS_USERS_ROLE = "00000000-0000-0001-0000-000000000000";
const AUTHENTICATED_USERS_ROLE = "00000000-0000-0002-0000-000000000000";
const ADMIN_USERS_ROLE = "00000000-0000-0003-0000-000000000000";

const defaultAnonymousUserInfo: User = {
    id: "",
    displayName: "Anonymous User",
    email: "",
    photoURL: "",
    source: "",
    sourceId: "",
    isAdmin: false,
    roles: [
        {
            id: ANONYMOUS_USERS_ROLE,
            name: "Anonymous Users",
            description: "Default role for unauthenticated users",
            permissionIds: [] as string[]
        }
    ],
    permissions: [],
    orgUnit: null,
    managingOrgUnitIds: []
};

export default class Database {
    private pool: pg.Pool;
    private orgQueryer: NestedSetModelQueryer;

    constructor(options: DatabaseOptions) {
        this.pool = createPool(options);
        this.orgQueryer = new NestedSetModelQueryer(this.pool, "org_units", [
            "id",
            "name",
            "description",
            "create_by",
            "create_time",
            "edit_by",
            "edit_time"
        ]);
    }

    getPool(): pg.Pool {
        return this.pool;
    }

    getOrgQueryer(): NestedSetModelQueryer {
        return this.orgQueryer;
    }

    getUser(id: string): Promise<Maybe<User>> {
        return this.pool
            .query(
                'SELECT id, "displayName", email, "photoURL", source, "isAdmin", "orgUnitId" FROM users WHERE "id" = $1',
                [id]
            )
            .then(res => arrayToMaybe(res.rows));
    }

    async getUserRoles(id: string): Promise<Role[]> {
        const result = await this.pool.query(
            `SELECT r.id, r.name, rp.permission_id
                FROM user_roles AS ur
                LEFT JOIN roles r ON r.id = ur.role_id
                LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
                WHERE ur.user_id = $1`,
            [id]
        );
        const list: any = {};
        result.rows.forEach(item => {
            const { permissionId, ...roleData } = _.zipObject(
                // --- underscore to camelCase case
                Object.keys(item).map(_.camelCase),
                Object.values(item)
            );
            if (!list[item.id]) {
                list[item.id] = {
                    ...roleData,
                    permissionIds: []
                };
            }
            if (permissionId) {
                list[item.id].permissionIds.push(permissionId);
            }
        });
        return Object.values(list);
    }

    async getUserPermissions(id: string): Promise<Permission[]> {
        const result = await this.pool.query(
            `SELECT DISTINCT ON (p.id, op.id)
                p.id, p.name, p.resource_id, res.uri AS resource_uri,
                p.user_ownership_constraint,
                p.org_unit_ownership_constraint,
                p.pre_authorised_constraint,
                op.id AS operation_id,
                op.uri AS operation_uri,
                op.name AS operation_name
                FROM role_permissions rp
                LEFT JOIN user_roles ur ON ur.role_id = rp.role_id
                LEFT JOIN permission_operations po ON po.permission_id = rp.permission_id
                LEFT JOIN operations op ON op.id = po.operation_id
                LEFT JOIN permissions p ON p.id = rp.permission_id
                LEFT JOIN resources res ON res.id = p.resource_id
                WHERE ur.user_id = $1`,
            [id]
        );
        return this.convertPermissionOperationRowsToPermissions(result);
    }

    private convertPermissionOperationRowsToPermissions(
        result: pg.QueryResult
    ): Permission[] {
        const list: any = {};
        result.rows.forEach(item => {
            const {
                operationId,
                operationUri,
                operationName,
                ...permissionData
            } = _.zipObject(
                // --- underscore to camelCase case
                Object.keys(item).map(_.camelCase),
                Object.values(item)
            );
            if (!list[item.id]) {
                list[item.id] = {
                    ...permissionData,
                    operations: []
                };
            }
            if (operationId) {
                list[item.id].operations.push({
                    id: operationId,
                    uri: operationUri,
                    name: operationName
                });
            }
        });
        return Object.values(list);
    }

    async getRolePermissions(id: string): Promise<Permission[]> {
        const result = await this.pool.query(
            `SELECT  DISTINCT ON (p.id, op.id)
            p.id, p.name, p.resource_id, res.uri AS resource_uri,
            p.user_ownership_constraint,
            p.org_unit_ownership_constraint,
            p.pre_authorised_constraint,
            op.id AS operation_id,
            op.uri AS operation_uri,
            op.name AS operation_name
            FROM role_permissions rp 
            LEFT JOIN permission_operations po ON po.permission_id = rp.permission_id
            LEFT JOIN operations op ON op.id = po.operation_id
            LEFT JOIN permissions p ON p.id = rp.permission_id
            LEFT JOIN resources res ON res.id = p.resource_id
            WHERE rp.role_id = $1`,
            [id]
        );
        return this.convertPermissionOperationRowsToPermissions(result);
    }

    getUsers(): Promise<User[]> {
        return this.pool
            .query(
                `SELECT id, "displayName", email, "photoURL", source, "isAdmin" FROM users WHERE id <> '00000000-0000-4000-8000-000000000000'`
            )
            .then(res => res.rows);
    }

    async updateUser(userId: string, update: any): Promise<void> {
        await this.pool.query(`UPDATE users SET "isAdmin" = $1 WHERE id = $2`, [
            update.isAdmin || false,
            userId
        ]);
    }

    getUserByExternalDetails(
        source: string,
        sourceId: string
    ): Promise<Maybe<User>> {
        return this.pool
            .query(
                'SELECT id, "displayName", email, "photoURL", source, "sourceId", "isAdmin" FROM users WHERE "sourceId" = $1 AND source = $2',
                [sourceId, source]
            )
            .then(res => arrayToMaybe(res.rows));
    }

    async createUser(user: User): Promise<User> {
        const result = await this.pool.query(
            'INSERT INTO users(id, "displayName", email, "photoURL", source, "sourceId", "isAdmin") VALUES(uuid_generate_v4(), $1, $2, $3, $4, $5, $6) RETURNING id',
            [
                user.displayName,
                user.email,
                user.photoURL,
                user.source,
                user.sourceId,
                user.isAdmin
            ]
        );
        const userInfo = result.rows[0];
        const userId = userInfo.id;

        //--- add default authenticated role to the newly create user
        await this.pool.query(
            "INSERT INTO user_roles (role_id, user_id) VALUES($1, $2)",
            [AUTHENTICATED_USERS_ROLE, userId]
        );

        //--- add default Admin role to the newly create user (if isAdmin is true)
        if (user.isAdmin) {
            await this.pool.query(
                "INSERT INTO user_roles (role_id, user_id) VALUES($1, $2)",
                [ADMIN_USERS_ROLE, userId]
            );
        }

        return userInfo;
    }

    async check(): Promise<any> {
        await this.pool.query("SELECT id FROM users LIMIT 1");
        return {
            ready: true
        };
    }

    /**
     * Return AnonymousUser info as fallback when system can't authenticate user
     * Should capture call errors and return AnonymousUser info as fallback
     */
    async getDefaultAnonymousUserInfo(): Promise<User> {
        const user = { ...defaultAnonymousUserInfo };
        try {
            user.permissions = await this.getRolePermissions(user.roles[0].id);
            user.roles[0].permissionIds = user.permissions.map(item => item.id);
            return user;
        } catch (e) {
            return user;
        }
    }

    async getCurrentUserInfo(req: any, jwtSecret: string): Promise<User> {
        const userId = getUserId(req, jwtSecret).valueOr(null);

        if (!userId || userId === "") {
            return await this.getDefaultAnonymousUserInfo();
        }

        const user = (await this.getUser(userId)).valueOr(null);
        if (!user) {
            throw new GenericError("Not Found User", 404);
        }
        user.roles = await this.getUserRoles(userId);
        user.permissions = await this.getUserPermissions(userId);
        if (!isUuid(user.orgUnitId)) {
            user.managingOrgUnitIds = [];
            user.orgUnit = null;
        } else {
            user.orgUnit = (await this.orgQueryer.getNodeById(
                user.orgUnitId
            )).valueOr(null);
            user.managingOrgUnitIds = (await this.orgQueryer.getAllChildren(
                user.orgUnitId,
                true,
                ["id"]
            )).map(item => item.id);
        }
        return user;
    }

    async updateExtraInput(
        req: any,
        jwtSecret: string,
        id: string,
        data: any
    ): Promise<boolean> {
        const userId = getUserId(req, jwtSecret).valueOr(null);
        if (!userId || userId === "") {
            return false;
        }

        const user = (await this.getUser(userId)).valueOr(null);
        if (!user) {
            return false;
        }

        const userRoles = await this.getUserRoles(userId);
        const hasAdminRole = userRoles.some(
            role => role.id === ADMIN_USERS_ROLE
        );

        /**
         * Checking hasAdminRole is redundant as the calling of this function is restricted
         * to admin users by the api router. The checking here is a second line defence.
         */
        if (!hasAdminRole) {
            return false;
        }

        /**
         * Ideally the requester should be restricted to updating its own data only. In the
         * current implementation, the requester is the system admin user.
         */
        await this.pool.query(
            `INSERT INTO extra_input (id, data) VALUES ($1, $2) 
            ON CONFLICT (id) DO UPDATE SET "data" = $2;`,
            [id, data]
        );

        return true;
    }

    async getExtraInput(): Promise<any> {
        let result: any = {};
        await this.pool.query(`SELECT id, data FROM extra_input`).then(res => {
            res.rows.forEach(row => (result[row.id] = row.data));
        });

        return result;
    }
}
