const childProcess = require("child_process");
const process = require("process");
const chalk = require("chalk");
const trim = require("lodash/trim");
const {
    getEnvVarInfo,
    askIfCreateNamespace,
    settingNameToEnvVarName
} = require("./askQuestions");
const Base64 = require("js-base64").Base64;
const pwgen = require("./pwgen");

const dbPasswordNames = [
    "authorization-db",
    "authorization-db-client",
    "combined-db",
    "combined-db-client",
    "content-db",
    "content-db-client",
    "registry-db",
    "registry-db-client",
    "session-db",
    "session-db-client",
    "tenant-db",
    "tenant-db-client"
];

function k8sExecution(config, shouldNotAsk = false) {
    try {
        return doK8sExecution(config, shouldNotAsk);
    } catch (e) {
        return Promise.reject(e);
    }
}

function doK8sExecution(config, shouldNotAsk = false) {
    const env = getEnvByClusterType(config);
    let configData = Object.assign({}, config.all);
    const allowEnvVarOverride = configData["allow-env-override-settings"];

    configData = overrideSettingWithEnvVarsBasedOnQuestionAnswers(
        env,
        configData
    );

    if (allowEnvVarOverride) {
        configData = overrideSettingWithEnvVars(env, configData);
    }

    let promise = Promise.resolve().then(function() {
        /**
         * All errors / exceptions should be process through promise chain rather than stop program here.
         * There are different logic outside doK8sExecution requires some clean-up job to be done before exit program.
         */
        checkIfKubectlValid(env);
        configData["cluster-namespace"] = trim(configData["cluster-namespace"]);
        if (!configData["cluster-namespace"]) {
            throw new Error(
                "Cluster namespace cannot be empty! \n " +
                    "If you've set cluster namespace, make sure it's not overrided by env variable."
            );
        }
    });

    if (!checkNamespace(env, configData["cluster-namespace"])) {
        if (shouldNotAsk) {
            promise = promise.then(function() {
                // --- leave error to be handled at end of then chain. see above
                throw new Error(
                    `Namespace ${
                        configData["cluster-namespace"]
                    } doesn't exist. Please create and try again.`
                );
            });
        }
        promise = promise
            .then(
                askIfCreateNamespace.bind(null, configData["cluster-namespace"])
            )
            .then(function(shouldCreateNamespace) {
                if (!shouldCreateNamespace) {
                    throw new Error(
                        `You need to create namespace \`${
                            configData["cluster-namespace"]
                        }\` before try again.`
                    );
                } else {
                    createNamespace(env, configData["cluster-namespace"]);
                }
            });
    }
    return promise.then(function() {
        const namespace = configData["cluster-namespace"];

        if (configData["use-cloudsql-instance-credentials"] === true) {
            createFileContentSecret(
                env,
                namespace,
                "cloudsql-instance-credentials",
                "credentials.json",
                configData["cloudsql-instance-credentials"]["data"]
            );
            createSecret(env, namespace, "cloudsql-db-credentials", {
                password: configData["cloudsql-db-credentials"]
            });
        }

        if (configData["use-storage-account-credentials"] === true) {
            createFileContentSecret(
                env,
                namespace,
                "storage-account-credentials",
                "db-service-account-private-key.json",
                configData["storage-account-credentials"]["data"]
            );
        }

        if (configData["use-smtp-secret"] === true) {
            createSecret(env, namespace, "smtp-secret", {
                username: configData["smtp-secret-username"],
                password: configData["smtp-secret-password"]
            });
        }

        createDbPasswords(env, namespace, configData);
        createMinioCredentials(env, namespace, configData);

        createWebAccessPassword(env, namespace, configData);

        if (configData["use-regcred"] === true) {
            /**
             * always use `regcred-password`
             * `use-regcred-password-from-env` has been taken care seperately
             */
            createDockerRegistrySecret(
                env,
                namespace,
                "regcred",
                configData["regcred-password"],
                "registry.gitlab.com",
                "gitlab-ci-token",
                configData["regcred-email"]
            );
        }

        if (
            configData["use-oauth-secrets-google"] === true ||
            configData["use-oauth-secrets-facebook"] === true ||
            configData["use-oauth-secrets-arcgis"] === true ||
            configData["use-oauth-secrets-aaf"] === true
        ) {
            const data = {};

            if (configData["use-oauth-secrets-google"]) {
                data["google-client-secret"] =
                    configData["oauth-secrets-google"];
            }

            if (configData["use-oauth-secrets-facebook"]) {
                data["facebook-client-secret"] =
                    configData["oauth-secrets-facebook"];
            }

            if (configData["use-oauth-secrets-arcgis"]) {
                data["arcgis-client-secret"] =
                    configData["oauth-secrets-arcgis"];
            }

            if (configData["use-oauth-secrets-aaf"]) {
                data["aaf-client-secret"] = configData["oauth-secrets-aaf"];
            }

            createSecret(env, namespace, "oauth-secrets", data);
        }

        createSecret(env, namespace, "auth-secrets", {
            "jwt-secret": pwgen(64),
            "session-secret": pwgen()
        });
    });
}

function getEnvByClusterType(config) {
    const localClusterType = config.get("local-cluster-type");

    if (
        typeof localClusterType === "undefined" ||
        localClusterType !== "minikube"
    ) {
        return Object.assign({}, process.env);
    }

    const dockerEnvProcess = childProcess.execSync(
        "minikube docker-env --shell bash",
        { encoding: "utf8" }
    );
    const dockerEnv = dockerEnvProcess
        .split("\n")
        .filter(line => line.indexOf("export ") === 0)
        .reduce(function(env, line) {
            const match = /^export (\w+)="(.*)"$/.exec(line);
            if (match) {
                env[match[1]] = match[2];
            }
            return env;
        }, {});

    const env = Object.assign({}, process.env, dockerEnv);
    return env;
}

/**
 * the difference between this function and `overrideSettingWithEnvVars` is:
 * `overrideSettingWithEnvVars` allows users to override any questions answers
 * and it will only be run when the answer to question
 * `Do you want to allow environment variables (see --help for full list) to override current settings at runtime?`
 * is `YES`.
 * This function will always be run so if user said YES to a specific question
 * (e.g. Do you want namespace to be overiden), that particular question answer will be overriden.
 */
function overrideSettingWithEnvVarsBasedOnQuestionAnswers(env, configData) {
    if (
        configData["get-namespace-from-env"] === true &&
        env[settingNameToEnvVarName("cluster-namespace")]
    ) {
        configData["cluster-namespace"] =
            env[settingNameToEnvVarName("cluster-namespace")];
    }

    if (
        configData["use-regcred-password-from-env"] === true &&
        env["CI_JOB_TOKEN"]
    ) {
        configData["regcred-password"] = env["CI_JOB_TOKEN"];
    }

    if (
        typeof configData["manual-db-passwords"] === "object" &&
        configData["manual-db-passwords"]["answer"] === false &&
        configData["manual-db-passwords"]["password"]
    ) {
        configData["db-passwords"] =
            configData["manual-db-passwords"]["password"];
    }

    if (
        typeof configData["manual-web-access-password"] === "object" &&
        configData["manual-web-access-password"]["answer"] === false &&
        configData["manual-web-access-password"]["password"]
    ) {
        configData["web-access-password"] =
            configData["manual-web-access-password"]["password"];
    }

    return configData;
}

function overrideSettingWithEnvVars(env, configData) {
    getEnvVarInfo().forEach(item => {
        const envVal = env[item.name];
        if (typeof envVal === "undefined") return;
        if (item.dataType === "boolean") {
            const value = envVal.toLowerCase().trim();
            if (value === "false" || value === "0") {
                configData[item.settingName] = false;
            } else {
                configData[item.settingName] = true;
            }
        } else if (item.dataType === "jsonfile") {
            configData[item.settingName] = {
                data: JSON.parse(envVal)
            };
        } else {
            configData[item.settingName] = envVal;
        }
    });

    return configData;
}

function checkIfKubectlValid(env) {
    try {
        childProcess.execSync("kubectl", {
            stdio: "ignore",
            env: env
        });
    } catch (e) {
        throw new Error(
            `Failed to execute \`kubectl\` utility: ${e}\n` +
                "Make sure you have install & config `kubectl` properly before try again."
        );
    }
}

function checkNamespace(env, namespace) {
    try {
        childProcess.execSync(`kubectl get namespace ${namespace}`, {
            stdio: "ignore",
            env: env
        });
        return true;
    } catch (e) {
        console.log(
            chalk.red(
                `Failed to get k8s namespace ${namespace} or namespace has not been created yet: ${e}`
            )
        );
        return false;
    }
}

function createNamespace(env, namespace) {
    childProcess.execSync(`kubectl create namespace ${namespace}`, {
        stdio: "inherit",
        env: env
    });
}

function buildTemplateObject(name, namespace) {
    return {
        apiVersion: "v1",
        kind: "Secret",
        type: "Opaque",
        metadata: {
            name,
            namespace,
            annotations: {},
            creationTimestamp: null
        }
    };
}

function createDbPasswords(env, namespace, configData) {
    /**
     * dbPasswordNames is defined as const at top of the file
     */
    const data = {};
    dbPasswordNames.forEach(key => {
        data[key] = configData["db-passwords"];
    });
    createSecret(env, namespace, "db-passwords", data);
}

function createMinioCredentials(env, namespace, configData) {
    const data = {
        accesskey: configData["accesskey"],
        secretkey: configData["secretkey"]
    };
    createSecret(env, namespace, "storage-secrets", data);
}

function createWebAccessPassword(env, namespace, configData) {
    if (configData["use-web-access-secret"] === false) {
        return;
    }
    const data = {
        username: configData["web-access-username"],
        password: configData["web-access-password"]
    };
    createSecret(env, namespace, "web-access-secret", data);
}

function createFileContentSecret(
    env,
    namespace,
    secretName,
    fileName,
    content
) {
    if (typeof content !== "string") {
        content = JSON.stringify(content);
    }

    createSecret(env, namespace, secretName, {
        [fileName]: content
    });
}

function createDockerRegistrySecret(
    env,
    namespace,
    secretName,
    password,
    dockerServer,
    username,
    email
) {
    const dockerConfig = {
        auths: {
            [dockerServer]: {
                username: username,
                password: password,
                email: email,
                auth: Base64.encode(`${username}:${password}`)
            }
        }
    };

    const data = {};
    data[".dockerconfigjson"] = JSON.stringify(dockerConfig);
    createSecret(
        env,
        namespace,
        secretName,
        data,
        true,
        "kubernetes.io/dockerconfigjson"
    );
}

function createSecret(
    env,
    namespace,
    secretName,
    data,
    encodeAllDataFields,
    type
) {
    const configObj = buildTemplateObject(secretName, namespace);
    configObj.data = data;

    if (type) configObj.type = type;

    if (encodeAllDataFields !== false) {
        Object.keys(configObj.data).forEach(key => {
            configObj.data[key] = Base64.encode(configObj.data[key]);
        });
    }

    const configContent = JSON.stringify(configObj);

    childProcess.execSync(`kubectl apply --namespace ${namespace} -f -`, {
        input: configContent,
        env: env
    });

    console.log(
        chalk.green(
            `Successfully created secret \`${secretName}\` in namespace \`${namespace}\`.`
        )
    );
}

module.exports = k8sExecution;
