export default {
    proxyRoutes: {
        search: {
            to: "http://localhost:6102/v0"
        },
        registry: {
            to: "http://localhost:6101/v0",
            auth: true
        },
        auth: {
            to: "http://localhost:6104/v0/public",
            auth: true
        },
        admin: {
            to: "http://localhost:6112/v0",
            auth: true
        },
        apidocs: {
            to: "http://localhost:6118"
        },
        content: {
            to: "http://localhost:6119/v0",
            auth: true
        },
        storage: {
            to: "http://localhost:6121/v0",
            auth: true
        }
    },
    csp: {
        directives: {
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"]
        },
        browserSniff: false
    },
    helmet: {},
    cors: {}
};
