import pg from "pg";

export interface PoolCreationOptions {
    dbHost: string;
    dbPort: number;
}

export default function createPool(options: PoolCreationOptions) {
    //   conString: "postgres://postgres@192.168.99.100:30544/postgres"
    const config = {
        database: "auth", //env var: PGDATABASE
        host: options.dbHost, // Server hosting the postgres database
        port: options.dbPort, //env var: PGPORT
        max: 10, // max number of clients in the pool
        idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
    };

    const pool = new pg.Pool(config);

    pool.on("error", function(err, client) {
        // if an error is encountered by a client while it sits idle in the pool
        // the pool itself will emit an error event with both the error and
        // the client which emitted the original error
        // this is a rare occurrence but can happen if there is a network partition
        // between your application and the database, the database restarts, etc.
        // and so you might want to handle it and at least log it out
        console.error("idle client error", err.message, err.stack);
    });

    return pool;
}
