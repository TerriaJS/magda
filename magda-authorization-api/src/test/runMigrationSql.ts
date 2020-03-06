import pg from "pg";
import fse from "fs-extra";
import recursive from "recursive-readdir";
import getTestDBConfig from "./getTestDBConfig";
import path from "path";

function getVersionNumber(fileName: string) {
    const matches = fileName.match(/^V(\d+(_\d+)*)/i);
    if (!matches || matches.length < 2) return 0;
    const verNum = parseFloat(matches[1].replace(/_/, "."));
    if (isNaN(verNum)) {
        return 0;
    }
    return verNum;
}

function replaceEnvVar(sql: string) {
    const config = getTestDBConfig();
    return sql
        .replace(/\$\{clientUserName\}/g, config.user)
        .replace(/\$\{clientPassword\}/g, config.password);
}

export async function deleteAllTables(pool: pg.Pool) {
    const result = await pool.query(
        "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
    );
    if (!result || !result.rows || !result.rows.length) return;
    await pool.query(
        result.rows
            .map(r => `DROP TABLE "${r["tablename"]}" CASCADE`)
            .join(";\n")
    );
}

/**
 * rebuilt a clean (i.e. in initial state) auth db in test database
 *
 * @param pool
 * @param deleteAllTable
 */
export default async function runMigrationSql(
    pool: pg.Pool,
    deleteAllTable: boolean = false
) {
    const migrationSqlDir = path.resolve(
        __dirname,
        "../../../magda-migrator-authorization-db/sql"
    );
    const files = await recursive(migrationSqlDir, ["*,sql"]);
    const fileObjects = files
        .map(f => ({
            path: f,
            version: getVersionNumber(path.basename(f))
        }))
        .filter(f => f.version !== 1.2)
        .sort((a, b) => a.version - b.version);

    if (!fileObjects.length)
        throw new Error("Can't find any DB migration SQL files.");
    if (deleteAllTable) {
        await deleteAllTables(pool);
    }
    for (let i = 0; i < fileObjects.length; i++) {
        const file = fileObjects[i];
        const fileContent = replaceEnvVar(
            await fse.readFile(file.path, { encoding: "utf-8" })
        );
        await pool.query(fileContent);
    }
}
