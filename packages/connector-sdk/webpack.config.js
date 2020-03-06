const webpack = require("webpack");
const path = require("path");
const configFile = path.resolve(__dirname, "./tsconfig.json");

module.exports = (env, argv) => {
    const target = env && env.target && env.target === "web" ? "web" : "node";
    return {
        entry: target === "web" ? "./src/index-web.ts" : "./src/index.ts",
        mode: "production",
        target: target === "web" ? "web" : "node",
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    loader: "ts-loader",
                    options: {
                        configFile
                    }
                }
            ]
        },
        stats: "errors-only",
        optimization: {
            minimize: false
        },
        resolve: {
            extensions: [".tsx", ".ts", ".js", ".json"]
        },
        output: {
            libraryTarget: "umd",
            filename: target === "web" ? "index-web.js" : "index.js",
            path: path.resolve(__dirname, "./dist")
        },
        plugins: [
            target === "web" &&
                new webpack.IgnorePlugin({
                    checkResource(resource, context) {
                        if (
                            resource ===
                            "@magda/typescript-common/dist/generated/registry/api"
                        ) {
                            return true;
                        }
                        return false;
                    }
                })
        ].filter(item => item)
    };
};
