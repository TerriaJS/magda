function getTestDBConfig() {
    const {
        POSTGRES_HOST: host,
        POSTGRES_DB: database,
        POSTGRES_USER: user,
        POSTGRES_PASSWORD: password
    } = process.env;

    return {
        host: host ? host : "localhost",
        database: database ? database : "postgres",
        user: user ? user : "postgres",
        password: password ? password : ""
    };
}

export default getTestDBConfig;
