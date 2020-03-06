import express from "express";
import emailValidator from "email-validator";
import _ from "lodash";

import RegistryClient from "magda-typescript-common/src/registry/RegistryClient";
import { Record } from "magda-typescript-common/src/generated/registry/api";
import unionToThrowable from "magda-typescript-common/src/util/unionToThrowable";

import { installStatusRouter } from "magda-typescript-common/src/express/status";

import { Router } from "express";
import { sendMail } from "./mail";
import { SMTPMailer } from "./SMTPMailer";
import { DatasetMessage } from "./model";
import renderTemplate, { Templates } from "./renderTemplate";
import EmailTemplateRender from "./EmailTemplateRender";

const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;

export interface ApiRouterOptions {
    registry: RegistryClient;
    templateRender: EmailTemplateRender;
    defaultRecipient: string;
    smtpMailer: SMTPMailer;
    externalUrl: string;
    alwaysSendToDefaultRecipient: boolean;
}

function validateMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const body: DatasetMessage = req.body;

    if (!body.message || !body.senderEmail || !body.senderName) {
        res.status(400).json({
            status: "Failure",
            error: "Missing input"
        });
    } else if (!emailValidator.validate(body.senderEmail)) {
        res.status(400).json({
            status: "Failure",
            error: "Invalid email: " + body.senderEmail
        });
    } else {
        next();
    }
}

export default function createApiRouter(
    options: ApiRouterOptions
): express.Router {
    const router: Router = express.Router();

    const status = {
        probes: {
            k8s: async () => {
                await options.smtpMailer.checkConnectivity();
                return {
                    ready: true
                };
            }
        }
    };
    installStatusRouter(router, status);
    installStatusRouter(router, status, "/public");

    /**
     * @apiGroup Correspondence API
     *
     * @api {post} /v0/send/dataset/request Send Dataset Request
     *
     * @apiDescription Sends a request for a dataset to the site administrators
     *
     * @apiParam (Request body) {string} senderName The name of the sender
     * @apiParam (Request body) {string} senderEmail The email address of the sender
     * @apiParam (Request body) {string} message The message to send
     *
     * @apiSuccess {string} status OK
     *
     * @apiSuccessExample {json} 200
     *    {
     *         "status": "OK"
     *    }
     *
     * @apiError {string} status FAILED
     *
     * @apiErrorExample {json} 400
     *    {
     *         "status": "Failed"
     *    }
     */
    router.post("/public/send/dataset/request", validateMiddleware, function(
        req,
        res
    ) {
        const body: DatasetMessage = req.body;
        const subject = `Data Request from ${body.senderName}`;
        const html = renderTemplate(
            options.templateRender,
            Templates.Request,
            body,
            subject,
            options.externalUrl
        );

        handlePromise(
            html.then(({ renderedContent, attachments }) => {
                return sendMail(
                    options.smtpMailer,
                    options.defaultRecipient,
                    body,
                    renderedContent,
                    attachments,
                    subject,
                    options.defaultRecipient
                );
            }),
            res
        );
    });

    /**
     * @apiGroup Correspondence API
     *
     * @api {post} /v0/send/dataset/:datasetId/question Send a question about a dataest
     *
     * @apiDescription Sends a question about a dataset to the data custodian if available,
     *  and to the administrators if not
     *
     * @apiParam (Request body) {string} senderName The name of the sender
     * @apiParam (Request body) {string} senderEmail The email address of the sender
     * @apiParam (Request body) {string} message The message to send
     *
     * @apiSuccess {string} status OK
     *
     * @apiSuccessExample {json} 200
     *    {
     *         "status": "OK"
     *    }
     *
     * @apiError {string} status FAILED
     *
     * @apiErrorExample {json} 400
     *    {
     *         "status": "Failed"
     *    }
     */
    router.post(
        "/public/send/dataset/:datasetId/question",
        validateMiddleware,
        async function(req, res) {
            const body: DatasetMessage = req.body;

            const promise = getDataset(req.params.datasetId).then(dataset => {
                const dcatDatasetStrings = dataset.aspects[
                    "dcat-dataset-strings"
                ] as {
                    contactPoint?: string;
                    title: string;
                };
                const contactPointEmailMatches =
                    dcatDatasetStrings.contactPoint &&
                    dcatDatasetStrings.contactPoint.match(EMAIL_REGEX);
                const contactPointEmail =
                    contactPointEmailMatches &&
                    contactPointEmailMatches.length > 1 &&
                    contactPointEmailMatches[1];

                const datasetPublisher = dataset.aspects["dataset-publisher"];
                const datasetPublisherEmailMatches = _.get(
                    datasetPublisher,
                    "publisher.aspects.organization-details.email",
                    ""
                ).match(EMAIL_REGEX);
                const datasetPublisherEmail: string | undefined =
                    datasetPublisherEmailMatches &&
                    datasetPublisherEmailMatches.length > 1 &&
                    datasetPublisherEmailMatches[1];

                const emails = [contactPointEmail, datasetPublisherEmail]
                    .filter(email => !!email)
                    .filter(email => email !== "")
                    .filter(email => emailValidator.validate(email));

                const validEmail = emails.length > 0;
                if (!validEmail) {
                    body.note = `You are getting this email because the contact point '${
                        dcatDatasetStrings.contactPoint
                    }' on the dataset and ‘${datasetPublisherEmail}’ on the organisation are not valid email addresses`;
                }

                const recipient = validEmail
                    ? emails[0]
                    : options.defaultRecipient;
                const subject = `Question About ${dcatDatasetStrings.title}`;

                const html = renderTemplate(
                    options.templateRender,
                    Templates.Question,
                    body,
                    subject,
                    options.externalUrl,
                    dataset
                );

                return html.then(({ renderedContent, attachments }) => {
                    return sendMail(
                        options.smtpMailer,
                        options.defaultRecipient,
                        body,
                        renderedContent,
                        attachments,
                        subject,
                        recipient,
                        options.alwaysSendToDefaultRecipient
                    );
                });
            });

            handlePromise(promise, res, req.params.datasetId);
        }
    );

    /**
     * Gets a dataset from the registry as a promise, unwrapping it from its
     * aspect.
     */
    function getDataset(datasetId: string): Promise<Record> {
        return options.registry
            .getRecord(
                encodeURIComponent(datasetId),
                ["dcat-dataset-strings"],
                ["dataset-publisher"],
                true
            )
            .then(result => unionToThrowable(result));
    }

    return router;
}

/**
 * Translates a promise into a response, returning 200 if the promise resolves,
 * 404 if it rejects with `response.statusCode: 404` in the error (as per the
 * registry api) or 500 if it rejects for another reason.
 */
function handlePromise(
    promise: Promise<any>,
    response: express.Response,
    datasetId?: string
): void {
    promise
        .then(() => response.status(200).json({ status: "OK" }))
        .catch(e => {
            if (_.get(e, "e.response.statusCode") === 404) {
                console.error(
                    "Attempted to send correspondence for non-existent dataset " +
                        datasetId
                );
                response.status(404).json({
                    status: "Failure",
                    error: "Dataset " + datasetId + " not found"
                });
            } else {
                throw e;
            }
        })
        .catch(e => {
            console.error(e);
            response.status(500).json({ status: "Failure" });
        });
}
