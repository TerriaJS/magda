import { Maybe } from "tsmonad";
import request from "request-promise-native";
import pg from "pg";
import _ from "lodash";

import arrayToMaybe from "magda-typescript-common/src/util/arrayToMaybe";
import AccessControlError from "magda-typescript-common/src/authorization-api/AccessControlError";
import queryOpa from "magda-typescript-common/src/opa/queryOpa";

import { Content } from "./model";
import createPool from "./createPool";
import {
    AuthDecision,
    AuthAnd,
    AuthQuery
} from "magda-typescript-common/src/opa/getAuthDecision";

const ALLOWABLE_QUERY_FIELDS = ["id", "type"];
const allowableQueryFieldLookup = _.keyBy(ALLOWABLE_QUERY_FIELDS, _.identity);

export interface DatabaseOptions {
    dbHost: string;
    dbPort: number;
    dbName: string;
    opaUrl: string;
}
export interface Database {
    getContentById(id: string): Promise<Maybe<Content>>;
    getContentSummary(
        queries: Query[],
        inlineContentIfType: string[]
    ): Promise<any>;
    setContentById(
        id: string,
        type: string,
        content: string
    ): Promise<Maybe<Content>>;
    deleteContentById(id: string): Promise<any[]>;
}

export type Query = {
    field: "id" | "type";
    patterns: string[];
};

interface QueryPattern {
    field: string;
    pattern: string;
}

export default class PostgresDatabase implements Database {
    private pool: pg.Pool;
    private opaUrl: string;

    constructor(options: DatabaseOptions) {
        this.pool = createPool(options);
        this.opaUrl = options.opaUrl;
    }

    async getContentPartialDecisionByContentId(
        id: string,
        jwtToken: string = null
    ): Promise<AuthDecision> {
        // --- incoming id could be `header/navigation/datasets.json` or `header/logo-mobile`
        // --- or a pattern header/*
        // --- operationUri should be `object/content/header/**/read` etc.
        const resourceId = id.replace(/\.[^\.\/$]/, "");
        const operationUri = `object/content/${resourceId}/read`;

        return queryOpa(
            "data.object.content.allowRead == true",
            {
                operationUri
            },
            ["input.object.content"],
            jwtToken,
            this.opaUrl
        );
    }

    opaResultToSqlClause: (
        result: AuthDecision,
        genParamIndex: () => number
    ) => { sql: string; params: (string | number | boolean)[] } = (
        result,
        genParamIndex
    ) => {
        if (result === false) {
            return { sql: "false", params: [] };
        } else if (result instanceof AuthQuery) {
            // We don't want to simply put the column name into the SQL because we wouldn't be able to parameterise it, which would leave us vulnerable to SQL injection.
            if (result.path.join(".") !== "content.id") {
                throw new Error(
                    "Only policies based on the id column of the content table are currently supported for the content api"
                );
            }

            return {
                sql: `content.id ${result.sign} $${genParamIndex()}`,
                params: [result.value]
            };
        } else if (result.parts.length === 0) {
            return { sql: "true", params: [] };
        } else {
            const flattenedParts = result.parts.map(part =>
                this.opaResultToSqlClause(part, genParamIndex)
            );

            const sql = flattenedParts
                .map(part => `(${part.sql})`)
                .join(result instanceof AuthAnd ? " AND " : " OR ");
            const params = _.flatMap(flattenedParts, part => part.params);

            return {
                sql,
                params
            };
        }
    };

    async getContentDecisionById(
        id: string,
        jwtToken: string = null
    ): Promise<boolean> {
        // --- incoming id could be `header/navigation/datasets.json` or `header/logo-mobile`
        // --- operationUri should be `object/content/header/header/navigation/datasets/read` etc.
        const resourceId = id.replace(/\.[^\.\/$]/, "");
        const operationUri = `object/content/${resourceId}/read`;
        const requestOptions: any = {
            json: {
                input: {
                    operationUri,
                    object: {
                        content: {
                            id: resourceId
                        }
                    }
                }
            }
        };
        if (jwtToken) {
            requestOptions.headers = {
                "X-Magda-Session": jwtToken
            };
        }
        // --- we don't need partial evaluation as we only need the decision for a particular resource
        const response = await request.post(
            `${this.opaUrl}data/object/content/allowRead`,
            requestOptions
        );

        if (response && response.result === true) return true;
        else return false;
    }

    async getContentById(
        id: string,
        jwtToken: string = null
    ): Promise<Maybe<Content>> {
        const isAllow = await this.getContentDecisionById(id, jwtToken);
        if (!isAllow) throw new AccessControlError(`Access denied for ${id}`);

        const sqlParameters: any[] = [id];
        return await this.pool
            .query(`SELECT * FROM content WHERE "id" = $1`, sqlParameters)
            .then(res => arrayToMaybe(res.rows));
    }

    async check(): Promise<any> {
        await this.pool.query("SELECT id FROM content LIMIT 1");
        return {
            ready: true
        };
    }

    async getContentSummary(
        queries: Query[],
        inlineContentIfType: string[],
        jwtToken: string = null
    ): Promise<any> {
        for (const query of queries) {
            if (!allowableQueryFieldLookup[query.field]) {
                throw new Error(
                    "Attempted to filter by unknown query field " + query.field
                );
            }
        }

        let params: (string | boolean | number)[] = [];
        let paramCounter = 0;
        const getParamIndex = () => {
            return ++paramCounter;
        };

        let inline = "";
        if (inlineContentIfType.length > 0) {
            const inlineStatements = inlineContentIfType.map((type, i) => {
                params.push(type.replace(/\'/g, ""));
                return `type = $${getParamIndex()}`;
            });

            inline = `,
            CASE
              WHEN ${inlineStatements.join(" OR ")} THEN content
              ELSE NULL
            END
            AS content`;
        }

        const queryPatterns = _.flatMap(queries, q =>
            q.patterns.map(p => ({ field: q.field, pattern: p }))
        );

        const queryPatternResults: (QueryPattern & {
            opaResult?: AuthDecision;
        })[] = await Promise.all(
            queryPatterns.map(qp => {
                if (qp.field !== "id") {
                    return Promise.resolve(qp);
                } else {
                    const x = (async () => {
                        const opaResult = await this.getContentPartialDecisionByContentId(
                            // --- we used glob pattern in opa policy
                            // --- header/* should be header/** to match header/navigation/datasets
                            qp.pattern.replace(/\/\*$/, "/**"),
                            jwtToken
                        );
                        return {
                            ...qp,
                            opaResult
                        };
                    })();

                    return x;
                }
            })
        );

        const whereClauses: string[] = [];
        queryPatternResults.forEach(r => {
            params.push(PostgresDatabase.createWildcardMatch(r.pattern));
            const patternLookupSql = `${r.field} LIKE $${getParamIndex()}`;

            if (r.field !== "id") {
                whereClauses.push(patternLookupSql);
            } else {
                const patternConditions = [];
                patternConditions.push(patternLookupSql);
                const accessControlSql = this.opaResultToSqlClause(
                    r.opaResult,
                    getParamIndex
                );
                patternConditions.push(accessControlSql.sql);
                params = params.concat(accessControlSql.params);
                whereClauses.push(
                    patternConditions.map(c => `(${c})`).join(" AND ")
                );
            }
        });

        const sql = `SELECT id, type, length(content) as length ${inline} FROM content ${
            whereClauses.length
                ? `WHERE ${whereClauses.map(c => `(${c})`).join(" OR ")} `
                : ""
        }`;

        return this.pool
            .query(sql, params)
            .then(res => (res && res.rows) || []);
    }

    setContentById(
        id: string,
        type: string,
        content: string
    ): Promise<Maybe<Content>> {
        return this.pool
            .query(
                `INSERT INTO content (id, "type", "content")
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id) DO
                 UPDATE SET "type" = $2, "content"=$3`,
                [id, type, content]
            )
            .then(res => arrayToMaybe(res.rows));
    }

    deleteContentById(id: string) {
        return this.pool
            .query("DELETE FROM content WHERE id=$1", [id])
            .then(res => (res && res.rows) || []);
    }

    private static createWildcardMatch(pattern: string): string {
        return pattern.replace(/[^\w\/\-* ]/gi, "").replace(/\*/g, "%");
    }
}
