const inquirer = require("inquirer");
const trim = require("lodash/trim");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const chalk = require("chalk");
const pwgen = require("./pwgen");
const partial = require("lodash/partial");
const stripJsonComments = require("strip-json-comments");

const questions = [
    {
        type: "list",
        dataType: "boolean",
        name: "deploy-to-google-cloud",
        message:
            "Are you creating k8s secrets for google cloud or local testing cluster?",
        choices: [
            {
                name: "Google Cloud Kubernetes Cluster",
                value: true
            },
            {
                name: "Local Testing Kubernetes Cluster",
                value: false
            }
        ]
    },
    {
        type: "list",
        name: "local-cluster-type",
        message:
            "Which local k8s cluster environment you are going to connect to?",
        choices: ["minikube", "docker"],
        when: onlyWhenQuestion("deploy-to-google-cloud", false)
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-cloudsql-instance-credentials",
        message: "Do you use google cloud SQL service as your database?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ],
        when: onlyAvailableForGoogleCloud
    },
    {
        type: "input",
        name: "cloudsql-db-credentials",
        message: "Please provide default google cloud SQL service DB password:",
        when: onlyWhenQuestion("use-cloudsql-instance-credentials", true),
        validate: input =>
            trim(input).length ? true : "Default password cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "reselect-cloudsql-instance-credentials",
        message:
            "Has located saved Google SQL cloud credentials JSON file. Do you want to re-select?",
        choices: [
            {
                name: "NO",
                value: false
            },
            {
                name: "YES",
                value: true
            }
        ],
        //--- config parameter needs to be prefilled later before run questionnaire
        //--- answers will be provided by inquirer lib at runtime
        when: function(config, answers) {
            if (
                answers["deploy-to-google-cloud"] === false ||
                answers["use-cloudsql-instance-credentials"] === false
            ) {
                return false;
            }
            if (
                config["cloudsql-instance-credentials"] &&
                config["cloudsql-instance-credentials"]["value"] &&
                config["cloudsql-instance-credentials"]["data"]
            ) {
                return true;
            }
            return false;
        }
    },
    {
        type: "fuzzypath",
        dataType: "jsonfile",
        name: "cloudsql-instance-credentials",
        pathFilter: pathFilterByExt("json"),
        suggestOnly: false,
        rootPath: path.resolve(),
        message:
            "Please provide the path to the credentials JSON file for your Google SQL cloud service access:",
        //--- config parameter needs to be prefilled later before run questionnaire
        //--- answers will be provided by inquirer lib at runtime
        when: function(config, answers) {
            if (
                answers["deploy-to-google-cloud"] === false ||
                answers["use-cloudsql-instance-credentials"] === false
            ) {
                return false;
            }
            if (
                !config["cloudsql-instance-credentials"] ||
                !config["cloudsql-instance-credentials"]["value"] ||
                !config["cloudsql-instance-credentials"]["data"]
            ) {
                return true;
            }
            if (answers["reselect-cloudsql-instance-credentials"] === false) {
                return false;
            }
            return true;
        },
        validate: validJsonFileExist,
        filter: getJsonFileContent
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-storage-account-credentials",
        message: "Do you use google storage service?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ],
        when: onlyAvailableForGoogleCloud
    },
    {
        type: "list",
        dataType: "boolean",
        name: "reselect-storage-account-credentials",
        message:
            "Has located saved Google storage private key JSON file. Do you want to re-select?",
        choices: [
            {
                name: "NO",
                value: false
            },
            {
                name: "YES",
                value: true
            }
        ],
        //--- config needs to prefill later before run questionnaire
        //--- answers will be provided by inquirer lib at runtime
        when: function(config, answers) {
            if (
                answers["deploy-to-google-cloud"] === false ||
                answers["use-storage-account-credentials"] === false
            ) {
                return false;
            }
            if (
                config["storage-account-credentials"] &&
                config["storage-account-credentials"]["value"] &&
                config["storage-account-credentials"]["data"]
            ) {
                return true;
            }
            return false;
        }
    },
    {
        type: "fuzzypath",
        dataType: "jsonfile",
        name: "storage-account-credentials",
        pathFilter: pathFilterByExt("json"),
        suggestOnly: false,
        rootPath: path.resolve(),
        message:
            "Please provide the path to the private key JSON file for your Google storage service access:",
        //--- config needs to prefill later before run questionnaire
        //--- answers will be provided by inquirer lib at runtime
        when: function(config, answers) {
            if (
                answers["deploy-to-google-cloud"] === false ||
                answers["use-storage-account-credentials"] === false
            ) {
                return false;
            }
            if (
                !config["storage-account-credentials"] ||
                !config["storage-account-credentials"]["value"] ||
                !config["storage-account-credentials"]["data"]
            ) {
                return true;
            }
            if (answers["reselect-storage-account-credentials"] === false) {
                return false;
            }
            return true;
        },
        validate: validJsonFileExist,
        filter: getJsonFileContent
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-smtp-secret",
        message:
            "Do you need to access SMTP service for sending data request email?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "smtp-secret-username",
        message: "Please provide SMTP service username:",
        when: onlyWhenQuestion("use-smtp-secret", true),
        validate: input =>
            trim(input).length ? true : "username cannot be empty!"
    },
    {
        type: "input",
        name: "smtp-secret-password",
        message: "Please provide SMTP service password:",
        when: onlyWhenQuestion("use-smtp-secret", true),
        validate: input =>
            trim(input).length ? true : "password cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-regcred",
        message:
            "Do you use Gitlab as your CI system and need the access to Gitlab docker registry?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ],
        when: onlyAvailableForGoogleCloud
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-regcred-password-from-env",
        message:
            "Do you want to get gitlab docker registry password from environment variable ($CI_JOB_TOKEN) or input manually now?",
        choices: [
            {
                name: "YES (Get from $CI_JOB_TOKEN)",
                value: true
            },
            {
                name: "NO (input manually)",
                value: false
            }
        ],
        when: onlyWhenQuestion("use-regcred", true)
    },
    {
        type: "input",
        name: "regcred-email",
        message:
            "Please provide the email address that you want to use for Gitlab docker registry:",
        when: onlyWhenQuestion("use-regcred", true),
        validate: input =>
            trim(input).length ? true : "email cannot be empty!"
    },
    {
        type: "input",
        name: "regcred-password",
        message: "Please provide password for Gitlab docker registry:",
        when: onlyWhenQuestion("use-regcred-password-from-env", false),
        validate: input =>
            trim(input).length ? true : "password cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-oauth-secrets-google",
        message: "Do you want to create google-client-secret for oAuth SSO?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "oauth-secrets-google",
        message: "Please provide google api access key for oAuth SSO:",
        when: onlyWhenQuestion("use-oauth-secrets-google", true),
        validate: input =>
            trim(input).length ? true : "secret cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-oauth-secrets-facebook",
        message: "Do you want to create facebook-client-secret for oAuth SSO?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "oauth-secrets-facebook",
        message: "Please provide facebook api access key for oAuth SSO:",
        when: onlyWhenQuestion("use-oauth-secrets-facebook", true),
        validate: input =>
            trim(input).length ? true : "secret cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-oauth-secrets-arcgis",
        message: "Do you want to create arcgis-client-secret for oAuth SSO?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "oauth-secrets-arcgis",
        message: "Please provide arcgis api access key for oAuth SSO:",
        when: onlyWhenQuestion("use-oauth-secrets-arcgis", true),
        validate: input =>
            trim(input).length ? true : "secret cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-oauth-secrets-aaf",
        message:
            "Do you want to create aaf-client-secret for AAF Rapid Connect SSO?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "oauth-secrets-aaf",
        message: "Please provide AAF secret for AAF Rapid Connect SSO:",
        when: onlyWhenQuestion("use-oauth-secrets-aaf", true),
        validate: input =>
            trim(input).length ? true : "secret cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "use-web-access-secret",
        message: "Do you want to setup HTTP Basic authentication?",
        choices: [
            {
                name: "YES",
                value: true
            },
            {
                name: "NO",
                value: false
            }
        ]
    },
    {
        type: "input",
        name: "web-access-username",
        message:
            "Please provide the username for HTTP Basic authentication setup:",
        when: answers => answers["use-web-access-secret"] === true,
        validate: input => {
            const r = trim(input);
            if (!r.length) {
                return "username cannot be empty!";
            }
            if (r.indexOf(":") !== -1) {
                return "username cannot contains `:`!";
            }
            return true;
        }
    },
    {
        type: "transformer-list",
        dataType: "boolean",
        name: "manual-web-access-password",
        message:
            "Do you want to manually input the password for HTTP Basic authentication setup?",
        choices: [
            {
                name: "NO (A random password will be generated for you now)",
                value: false
            },
            {
                name: "YES",
                value: true
            }
        ],
        when: answers => answers["use-web-access-secret"] === true,
        filter: function(input) {
            const r = {
                answer: input
            };
            if (input === false) {
                r["password"] = pwgen();
            }
            return r;
        },
        transformer: function(value, answers) {
            if (value.answer === true) {
                return chalk.yellow("Chose to manually input password");
            } else {
                return chalk.yellow(
                    "Generated password: " +
                        chalk.green.underline(value["password"])
                );
            }
        }
    },
    {
        type: "input",
        name: "web-access-password",
        message:
            "Please provide the password for HTTP Basic authentication setup:",
        when: answers =>
            answers["use-web-access-secret"] === true &&
            answers["manual-web-access-password"]["answer"] === true,
        validate: input =>
            trim(input).length ? true : "password cannot be empty!"
    },
    {
        type: "transformer-list",
        dataType: "boolean",
        name: "manual-db-passwords",
        message:
            "Do you want to manually input the password used for databases?",
        choices: [
            {
                name: "NO (A random password will be generated for you now)",
                value: false
            },
            {
                name: "YES",
                value: true
            }
        ],
        filter: function(input) {
            const r = {
                answer: input
            };
            if (input === false) {
                r["password"] = pwgen();
            }
            return r;
        },
        transformer: function(value, answers) {
            if (value.answer === true) {
                return chalk.yellow("Chose to manually input password");
            } else {
                return chalk.yellow(
                    "Generated password: " +
                        chalk.green.underline(value["password"])
                );
            }
        }
    },
    {
        type: "input",
        name: "db-passwords",
        message: "Please provide the password used for databases:",
        when: answers => answers["manual-db-passwords"]["answer"] === true,
        validate: input =>
            trim(input).length ? true : "password cannot be empty!"
    },
    {
        type: "input",
        name: "accesskey",
        message: "Please enter an access key for your MinIO server:",
        validate: input => {
            const trimmedInput = trim(input);
            return trimmedInput.length && trimmedInput.length >= 5
                ? true
                : "MinIO access keys need to be at least 5 characters.";
        }
    },
    {
        type: "input",
        name: "secretkey",
        message: "Please enter a secret key for your MinIO server::",
        validate: input => {
            const trimmedInput = trim(input);
            return trimmedInput.length && trimmedInput.length >= 8
                ? true
                : "MinIO secret keys need to be at least 8 characters.";
        }
    },
    {
        type: "list",
        dataType: "boolean",
        name: "get-namespace-from-env",
        message:
            "Specify a namespace or leave blank and override by env variable later?",
        choices: [
            {
                name: "YES (Specify a namespace)",
                value: false
            },
            {
                name: "NO (leave blank and override by env variable later)",
                value: true
            }
        ]
    },
    {
        type: "input",
        name: "cluster-namespace",
        message:
            "What's the namespace you want to create secrets into (input `default` if you want to use the `default` namespace)?",
        when: onlyWhenQuestion("get-namespace-from-env", false),
        validate: input =>
            trim(input).length ? true : "Cluster namespace cannot be empty!"
    },
    {
        type: "list",
        dataType: "boolean",
        name: "allow-env-override-settings",
        message:
            "Do you want to allow environment variables (see --help for full list) to override current settings at runtime?",
        choices: [
            {
                name: "YES (Any environment variable can overide my settings)",
                value: true
            },
            {
                name: "NO (No settings will be override)",
                value: false
            }
        ]
    }
];

function onlyAvailableForGoogleCloud(answers) {
    return answers["deploy-to-google-cloud"];
}

function onlyWhenQuestion(name, value) {
    return answers => {
        return answers[name] === value;
    };
}

function validJsonFileExist(choice) {
    try {
        const filePath = trim(choice.value);
        if (!fs.existsSync(filePath)) {
            return "The file doe not exist or cannot read. Please re-select.";
        }
        const content = fs.readFileSync(filePath, {
            encoding: "utf-8"
        });
        try {
            const data = JSON.parse(stripJsonComments(content));
            return true;
        } catch (e) {
            return `The file content is not in valid JSON format: ${e}`;
        }
    } catch (e) {
        return String(e);
    }
}

function pathFilterByExt(ext) {
    return (isDirectory, nodePath) => {
        if (isDirectory) return false;
        const idx = nodePath.lastIndexOf(".");
        let fileExt;
        if (idx === -1 || idx === nodePath.length - 1) {
            fileExt = "";
        } else {
            fileExt = nodePath.substring(idx + 1).toLowerCase();
        }
        return fileExt === ext.toLowerCase();
    };
}

function getJsonFileContent(filePath) {
    try {
        filePath = trim(filePath);
        const content = fs.readFileSync(filePath, {
            encoding: "utf-8"
        });
        return {
            value: filePath,
            data: JSON.parse(stripJsonComments(content))
        };
    } catch (e) {
        console.log(chalk.red(`Failed to process data: ${e}`));
        process.exit(1);
    }
}

function prefillQuestions(questions, config) {
    const questionNamesRequireBindWhen = [
        "reselect-cloudsql-instance-credentials",
        "cloudsql-instance-credentials",
        "reselect-storage-account-credentials",
        "storage-account-credentials"
    ];
    return questions
        .map(question => {
            let configValue = config.get(question.name);
            const type = typeof configValue;
            if (type === "undefined") return question;
            if (type === "object") {
                if (typeof configValue.value === "undefined") return question;
                else configValue = configValue.value;
            }

            return Object.assign({}, question, {
                default: configValue
            });
        })
        .map(question => {
            if (questionNamesRequireBindWhen.indexOf(question["name"]) === -1) {
                return question;
            }
            return Object.assign({}, question, {
                when: partial(question.when, config.all)
            });
        });
}

const inquirerFuzzyPath = require("./prompts/inquirer-fuzzy-path");
const inquirerListWithTransformer = require("./prompts/list-with-transformer");
inquirer.registerPrompt("fuzzypath", inquirerFuzzyPath);
inquirer.registerPrompt("transformer-list", inquirerListWithTransformer);
function askSettingQuestions(config) {
    return inquirer
        .prompt(prefillQuestions(questions, config))
        .then(function(answers) {
            const configData = config.all;
            //--- if user didn't re-select credentials files,
            //--- we needs to save to answers before clear the config
            if (
                answers["use-cloudsql-instance-credentials"] === true &&
                configData["cloudsql-instance-credentials"] &&
                configData["cloudsql-instance-credentials"]["value"] &&
                configData["cloudsql-instance-credentials"]["data"] &&
                answers["reselect-cloudsql-instance-credentials"] === false
            ) {
                answers["cloudsql-instance-credentials"] = {};
                answers["cloudsql-instance-credentials"]["value"] =
                    configData["cloudsql-instance-credentials"]["value"];
                answers["cloudsql-instance-credentials"]["data"] =
                    configData["cloudsql-instance-credentials"]["data"];
            }
            if (
                answers["use-storage-account-credentials"] === true &&
                configData["storage-account-credentials"] &&
                configData["storage-account-credentials"]["value"] &&
                configData["storage-account-credentials"]["data"] &&
                answers["reselect-storage-account-credentials"] === false
            ) {
                answers["storage-account-credentials"] = {};
                answers["storage-account-credentials"]["value"] =
                    configData["storage-account-credentials"]["value"];
                answers["storage-account-credentials"]["data"] =
                    configData["storage-account-credentials"]["data"];
            }
            config.clear();
            config.set(answers);
            config.set("creation-time", new Date().toISOString());
        });
}
function askClosingQuestions(config) {
    return inquirer
        .prompt([
            {
                type: "list",
                name: "deploy-now",
                message:
                    "Do you want to connect to kubernetes cluster to create secrets now?",
                choices: [
                    {
                        name: "YES (Create Secrets in Cluster now)",
                        value: true
                    },
                    {
                        name: "NO (Exit but all settings have been saved)",
                        value: false
                    }
                ]
            }
        ])
        .then(answers => answers["deploy-now"]);
}
function askStartSecretsCreationWithoutQuestions(config) {
    const creationTime = new Date(config.get("creation-time"));
    console.log(
        chalk.yellow(
            `Found previous saved config (${moment(creationTime).format(
                "MMMM Do YYYY, h:mm:ss a"
            )}).`
        )
    );
    return inquirer
        .prompt([
            {
                type: "list",
                name: "deploy-now",
                message:
                    "Do you want to connect to kubernetes cluster to create secrets without going through any questions?",
                choices: [
                    {
                        name: "NO (Going through all questions)",
                        value: false
                    },
                    {
                        name:
                            "YES (Create Secrets in Cluster using existing config now)",
                        value: true
                    }
                ]
            }
        ])
        .then(answers => answers["deploy-now"]);
}

function askIfCreateNamespace(namespace) {
    return inquirer
        .prompt([
            {
                type: "list",
                name: "if-create-namespace",
                message: `Do you want to create namespace \`${namespace}\` now?`,
                choices: [
                    {
                        name: "YES",
                        value: true
                    },
                    {
                        name: "NO",
                        value: false
                    }
                ]
            }
        ])
        .then(answers => answers["if-create-namespace"]);
}

function askQuestions(config) {
    return new Promise(function(resolve, reject) {
        const creationTime = config.get("creation-time");
        let p;
        if (typeof creationTime !== "undefined") {
            p = askStartSecretsCreationWithoutQuestions(config);
        } else {
            p = Promise.resolve(false);
        }
        p.then(ifGoCreatioin => {
            if (ifGoCreatioin) {
                return true;
            } else {
                return askSettingQuestions(config).then(
                    askClosingQuestions.bind(null, config)
                );
            }
        }).then(answer => resolve(answer));
    });
}

function getEnvVarInfo() {
    return questions.map(item => ({
        name: settingNameToEnvVarName(item.name),
        dataType: item.dataType ? item.dataType : "string",
        settingName: item.name,
        description: item.message
    }));
}

function settingNameToEnvVarName(settingName) {
    return settingName.replace(/\-/g, "_").toUpperCase();
}

module.exports = {
    askQuestions,
    getEnvVarInfo,
    settingNameToEnvVarName,
    askIfCreateNamespace,
    settingNameToEnvVarName
};
