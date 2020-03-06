import {} from "mocha";
import { ApiRouterOptions } from "../createApiRouter";
import { SMTPMailer, Message, Attachment } from "../SMTPMailer";
import fs from "fs";
import path from "path";

import createApiRouter from "../createApiRouter";

import { expect } from "chai";
import sinon from "sinon";
import supertest from "supertest";
import express from "express";
import nock from "nock";
import RegistryClient from "magda-typescript-common/src/registry/RegistryClient";
import ContentApiDirMapper from "../ContentApiDirMapper";
import EmailTemplateRender from "../EmailTemplateRender";

const REGISTRY_URL: string = "https://registry.example.com";
const CONTENT_API_URL: string = "https://content-api.example.com";
const registry: RegistryClient = new RegistryClient({
    baseUrl: REGISTRY_URL,
    maxRetries: 0,
    secondsBetweenRetries: 0,
    tenantId: 1
});

const contentMapper = new ContentApiDirMapper(
    CONTENT_API_URL,
    "userId",
    "secrets"
);
const templateRender = new EmailTemplateRender(contentMapper);
const assetsFiles = [
    "emailTemplates/request.html",
    "emailTemplates/question.html",
    "emailTemplates/feedback.html",
    "emailTemplates/assets/top-left-logo.jpg",
    "emailTemplates/assets/centered-logo.jpg"
];

sinon.stub(contentMapper, "fileExist").callsFake(function(localPath: string) {
    if (assetsFiles.findIndex(file => file === localPath) !== -1) return true;
    throw new Error(`Tried to access non-exist file: ${localPath}`);
});

sinon
    .stub(contentMapper, "getFileContent")
    .callsFake(function(localPath: string) {
        if (assetsFiles.findIndex(file => file === localPath) === -1) {
            throw new Error(`Tried to access non-exist file: ${localPath}`);
        }
        if (path.extname(localPath) === ".html") {
            return fs.readFileSync(
                path.join(__dirname, "..", "..", localPath),
                "utf-8"
            );
        } else {
            return fs.readFileSync(path.join(__dirname, "..", "..", localPath));
        }
    });

const stubbedSMTPMailer: SMTPMailer = {
    checkConnectivity() {
        return null;
    },
    send(): Promise<{}> {
        return null;
    }
} as SMTPMailer;

const DEFAULT_SENDER_NAME = "Bob Cunningham";
const DEFAULT_SENDER_EMAIL = "bob.cunningham@example.com";
const DEFAULT_MESSAGE_TEXT = `Gib me

a dataset

༼ つ ◕_◕ ༽つ`;
const DEFAULT_MESSAGE_HTML = `<p>Gib me</p>\n<p>a dataset</p>\n<p>༼ つ ◕_◕ ༽つ</p>`;
const DEFAULT_DATASET_ID =
    "ds-launceston-http://opendata.launceston.tas.gov.au/datasets/9dde05eb82174fa3b1fcf89299d959a9_2";
const ENCODED_DEFAULT_DATASET_ID = encodeURIComponent(DEFAULT_DATASET_ID);
const DEFAULT_DATASET_TITLE = "thisisatitle";
const DEFAULT_DATASET_PUBLISHER = "publisher";
const DEFAULT_DATASET_CONTACT_POINT = "contactpoint@example.com";
const EXTERNAL_URL = "datagov.au.example.com";

describe("send dataset request mail", () => {
    const DEFAULT_RECIPIENT = "blah@example.com";
    let app: express.Express;
    let sendStub: sinon.SinonStub;
    let registryScope: nock.Scope;

    beforeEach(() => {
        sendStub = sinon.stub(stubbedSMTPMailer, "send");

        app = express();
        app.use(require("body-parser").json());
        app.use(
            "/",
            createApiRouter(
                resolveRouterOptions(stubbedSMTPMailer, templateRender)
            )
        );

        registryScope = nock(REGISTRY_URL);
    });

    afterEach(() => {
        sendStub.restore();
        registryScope.done();
    });

    describe("/status/ready", () => {
        let checkConnectivityStub: sinon.SinonStub;

        beforeEach(() => {
            checkConnectivityStub = sinon.stub(
                stubbedSMTPMailer,
                "checkConnectivity"
            );
        });

        afterEach(() => {
            checkConnectivityStub.restore();
        });

        withStubbedConsoleError(stubbedError => {
            it("should return 500 if connection fails", () => {
                checkConnectivityStub.returns(
                    Promise.reject(new Error("Fake error"))
                );

                return supertest(app)
                    .get("/status/ready")
                    .expect(500)
                    .then(() => {
                        expect(stubbedError().called).to.be.true;
                    });
            });
        });
    });

    describe("/public/send/dataset/request", () => {
        it("should respond with an 200 response if sendMail() was successful", () => {
            sendStub.returns(Promise.resolve());

            return supertest(app)
                .post("/public/send/dataset/request")
                .set({
                    "Content-Type": "application/json"
                })
                .send({
                    senderName: DEFAULT_SENDER_NAME,
                    senderEmail: DEFAULT_SENDER_EMAIL,
                    message: DEFAULT_MESSAGE_TEXT
                })
                .expect(200)
                .then(() => {
                    const args: Message = sendStub.firstCall.args[0];

                    expect(args.to).to.equal(DEFAULT_RECIPIENT);
                    expect(args.from).to.contain(DEFAULT_SENDER_NAME);
                    expect(args.from).to.contain(DEFAULT_RECIPIENT);
                    expect(args.replyTo).to.contain(DEFAULT_SENDER_EMAIL);
                    expect(args.html).to.contain(DEFAULT_MESSAGE_HTML);
                    expect(args.text).to.contain(DEFAULT_MESSAGE_TEXT);
                    expect(args.subject).to.contain(DEFAULT_SENDER_NAME);

                    checkAttachments(args.attachments);
                });
        });

        checkEmailErrorCases("/public/send/dataset/request");
    });

    describe("/public/send/dataset/:datasetId/question", () => {
        it("should respond with an 200 response if everything was successful", () => {
            return sendQuestion().then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_DATASET_CONTACT_POINT);
                expect(args.from).to.contain(DEFAULT_SENDER_NAME);
                expect(args.from).to.contain(DEFAULT_RECIPIENT);
                expect(args.replyTo).to.contain(DEFAULT_SENDER_EMAIL);

                expect(args.text).to.contain(DEFAULT_MESSAGE_TEXT);
                expect(args.text).to.contain(DEFAULT_DATASET_PUBLISHER);
                expect(args.text).to.contain(
                    EXTERNAL_URL + "/dataset/" + ENCODED_DEFAULT_DATASET_ID
                );
                expect(args.text).to.contain("question");

                expect(args.html).to.contain(DEFAULT_MESSAGE_HTML);
                expect(args.html).to.contain(DEFAULT_DATASET_PUBLISHER);
                expect(args.html).to.contain(
                    EXTERNAL_URL + "/dataset/" + ENCODED_DEFAULT_DATASET_ID
                );
                expect(args.html).to.contain("question");

                expect(args.subject).to.contain(DEFAULT_DATASET_TITLE);

                checkAttachments(args.attachments);
            });
        });

        it("should fall back to default recipient if forced via options", () => {
            // Create a new app with different options
            app = express();
            app.use(require("body-parser").json());
            const options = resolveRouterOptions(
                stubbedSMTPMailer,
                templateRender
            );
            options.alwaysSendToDefaultRecipient = true;

            app.use("/", createApiRouter(options));

            return sendQuestion().then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_RECIPIENT);
                expect(args.html).to.not.contain(" not valid email addresses");
                expect(args.subject).to.contain(
                    "for " + DEFAULT_DATASET_CONTACT_POINT
                );
            });
        });

        it("should find valid email address within contact point string", () => {
            return sendQuestion({
                contactPoint:
                    "Commonwealth of Australia (Dept. of Code), sales@dept.gov.au"
            }).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal("sales@dept.gov.au");
                expect(args.html).to.not.contain(" not valid email addresses");
            });
        });

        it("should fall back to publisher email address if there's no email with the contact point", () => {
            return sendQuestion(
                {
                    contactPoint: "Commonwealth of Australia (Dept. of Code)"
                },
                {
                    publisher: {
                        aspects: {
                            "organization-details": {
                                email:
                                    "blah blah publisher@example.com blah blah"
                            }
                        }
                    }
                }
            ).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal("publisher@example.com");
                expect(args.html).to.not.contain(" not valid email addresses");
            });
        });

        it("should fall back to default recipient if there's no contact point and no publisher email", () => {
            return sendQuestion({
                contactPoint: undefined,
                email: undefined
            }).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_RECIPIENT);
                expect(args.html).to.contain(" not valid email addresses");
            });
        });

        it("should fall back to default recipient if dataset contact point is a phone number", () => {
            return sendQuestion({
                contactPoint: "02 9411 1111"
            }).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_RECIPIENT);
                expect(args.html).to.contain(" not valid email addresses");
            });
        });

        it("should fall back to default recipient if dataset contact point is a malformed email address", () => {
            return sendQuestion({
                contactPoint: "hello@blah"
            }).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_RECIPIENT);
                expect(args.html).to.contain(" not valid email addresses");
            });
        });

        it("should fall back to default recipient if dataset contact point is a bunch of nonsense", () => {
            return sendQuestion({
                contactPoint:
                    "You can contact me on my mobile phone between the hours of 9am and 5pm"
            }).then(() => {
                const args: Message = sendStub.firstCall.args[0];

                expect(args.to).to.equal(DEFAULT_RECIPIENT);
                expect(args.html).to.contain(" not valid email addresses");
            });
        });

        checkEmailErrorCases(
            `/public/send/dataset/${ENCODED_DEFAULT_DATASET_ID}/question`,
            true
        );

        checkRegistryErrorCases(
            `/public/send/dataset/${ENCODED_DEFAULT_DATASET_ID}/question`
        );

        function sendQuestion(
            overrideDataset: {} = {},
            overridePublisher: {} = {}
        ) {
            sendStub.returns(Promise.resolve());

            stubGetRecordCall(overrideDataset, overridePublisher);

            return supertest(app)
                .post(
                    `/public/send/dataset/${ENCODED_DEFAULT_DATASET_ID}/question`
                )
                .set({
                    "Content-Type": "application/json"
                })
                .send({
                    senderName: DEFAULT_SENDER_NAME,
                    senderEmail: DEFAULT_SENDER_EMAIL,
                    message: DEFAULT_MESSAGE_TEXT
                })
                .expect(200);
        }
    });

    function stubGetRecordCall(overrideDataset = {}, overridePublisher = {}) {
        registryScope
            .get(
                `/records/${ENCODED_DEFAULT_DATASET_ID}?aspect=dcat-dataset-strings&optionalAspect=dataset-publisher&dereference=true`
            )
            .reply(200, {
                id: DEFAULT_DATASET_ID,
                aspects: {
                    "dcat-dataset-strings": {
                        title: DEFAULT_DATASET_TITLE,
                        publisher: DEFAULT_DATASET_PUBLISHER,
                        contactPoint: DEFAULT_DATASET_CONTACT_POINT,
                        ...overrideDataset
                    },
                    "dataset-publisher": {
                        ...overridePublisher
                    }
                }
            });
    }

    function withStubbedConsoleError(
        tests: (errorStubGetter: () => sinon.SinonStub) => void
    ) {
        describe("with stubbed console.error", () => {
            let errorStub: sinon.SinonStub;

            beforeEach(() => {
                errorStub = sinon.stub(console, "error");
            });

            afterEach(() => {
                errorStub.restore();
            });

            tests(() => errorStub);
        });
    }

    function checkRegistryErrorCases(path: string) {
        describe("Registry errors", () => {
            withStubbedConsoleError(errorStub => {
                it("should return 404 if getting dataset from registry returns 404", () => {
                    registryScope
                        .get(
                            `/records/${ENCODED_DEFAULT_DATASET_ID}?aspect=dcat-dataset-strings&optionalAspect=dataset-publisher&dereference=true`
                        )
                        .reply(404);

                    return supertest(app)
                        .post(path)
                        .set({
                            "Content-Type": "application/json"
                        })
                        .send({
                            senderName: DEFAULT_SENDER_NAME,
                            senderEmail: DEFAULT_SENDER_EMAIL,
                            message: DEFAULT_MESSAGE_TEXT
                        })
                        .expect(404)
                        .then(() => {
                            expect(errorStub().called).to.be.true;
                            expect(errorStub().firstCall.args[0]).to.contain(
                                DEFAULT_DATASET_ID
                            );
                        });
                });

                it("should return 500 if getting dataset from registry returns 500", () => {
                    registryScope
                        .get(
                            `/records/${ENCODED_DEFAULT_DATASET_ID}?aspect=dcat-dataset-strings&optionalAspect=dataset-publisher&dereference=true`
                        )
                        .reply(500);

                    return supertest(app)
                        .post(path)
                        .set({
                            "Content-Type": "application/json"
                        })
                        .send({
                            senderName: DEFAULT_SENDER_NAME,
                            senderEmail: DEFAULT_SENDER_EMAIL,
                            message: DEFAULT_MESSAGE_TEXT
                        })
                        .expect(500)
                        .then(() => {
                            expect(errorStub().called).to.be.true;
                        });
                });
            });
        });
    }

    function checkEmailErrorCases(
        path: string,
        stubGetRecordApi: boolean = false
    ) {
        describe("Email errors", () => {
            withStubbedConsoleError(errorStub => {
                it("should respond with an 500 response if sendMail() was unsuccessful", () => {
                    if (stubGetRecordApi) {
                        stubGetRecordCall();
                    }

                    sendStub.returns(Promise.reject(new Error("Fake error")));

                    return supertest(app)
                        .post(path)
                        .set({
                            "Content-Type": "application/json"
                        })
                        .send({
                            senderName: DEFAULT_SENDER_NAME,
                            senderEmail: DEFAULT_SENDER_EMAIL,
                            message: DEFAULT_MESSAGE_TEXT
                        })
                        .expect(500)
                        .then(() => {
                            expect(sendStub.called).to.be.true;
                            expect(errorStub().called).to.be.true;
                        });
                });

                it("should raise an error if the sender provides an invalid email", () => {
                    return supertest(app)
                        .post(path)
                        .set({
                            "Content-Type": "application/json"
                        })
                        .send({
                            senderName: DEFAULT_SENDER_NAME,
                            senderEmail: "<INVALID EMAIL>",
                            message: DEFAULT_MESSAGE_TEXT
                        })
                        .expect(400)
                        .then(() => {
                            expect(sendStub.called).to.be.false;
                        });
                });
            });
        });
    }

    function checkAttachments(attachments: Array<Attachment>) {
        attachments.forEach(attachment => {
            expect(
                attachment.content instanceof Buffer ||
                    typeof attachment.content === "string",
                "attachment.content to exist"
            ).to.be.true;
        });
    }

    function resolveRouterOptions(
        smtpMailer: SMTPMailer,
        templateRender: EmailTemplateRender
    ): ApiRouterOptions {
        return {
            templateRender,
            defaultRecipient: DEFAULT_RECIPIENT,
            smtpMailer: smtpMailer,
            registry,
            externalUrl: EXTERNAL_URL,
            alwaysSendToDefaultRecipient: false
        };
    }
});
