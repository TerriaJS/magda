import _ from "lodash";
import express from "express";

import { Record } from "magda-typescript-common/src/generated/registry/api";
import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";
import unionToThrowable from "magda-typescript-common/src/util/unionToThrowable";

import MinionOptions from "./MinionOptions";

import AsyncPage, { forEachAsync } from "magda-typescript-common/src/AsyncPage";

export default function setupWebhookEndpoint(
    server: express.Application,
    options: MinionOptions,
    registry: Registry
) {
    server.post(
        "/hook",
        (request: express.Request, response: express.Response) => {
            const payload = request.body;

            const recordsPage = AsyncPage.single(payload.records);
            const megaPromise = forEachAsync(
                recordsPage,
                options.concurrency || 1,
                (record: Record) => options.onRecordFound(record, registry)
            );

            const lastEventIdExists = !_.isUndefined(payload.lastEventId);
            const deferredResponseUrlExists = !_.isUndefined(
                payload.deferredResponseUrl
            );
            if (options.async) {
                if (!lastEventIdExists) {
                    console.warn(
                        "No event id was passed so the minion can't operate asynchronously - reverting to synchronous mode"
                    );
                }

                if (!deferredResponseUrlExists) {
                    console.warn(
                        "No deferred response url was passed so the minion can't operate asynchronously - reverting to synchronous mode"
                    );
                }
            }

            if (
                options.async &&
                lastEventIdExists &&
                deferredResponseUrlExists
            ) {
                response.status(201).send({
                    status: "Working",
                    deferResponse: true
                });

                const sendResult = (success: boolean) =>
                    registry
                        .resumeHook(options.id, success, payload.lastEventId)
                        .then(unionToThrowable)
                        .then(result => {
                            console.info(
                                "Successfully posted back to registry for event " +
                                    payload.lastEventId
                            );
                            return result;
                        })
                        .catch((error: Error) => {
                            console.error(error);
                            throw error;
                        });

                megaPromise
                    .then(() =>
                        // On success, send the result as true, if we fail to send the result (even though the hook worked) then just log
                        // the error - this is presumably because the registry has gone down, when it comes back up it'll resume the hook.
                        sendResult(true).catch((err: Error) => {
                            console.error(err);
                        })
                    )
                    .catch((err: Error) => {
                        // Something has actually gone wrong with the minion behaviour itself that hasn't been handled by the minion.
                        // We class this as pretty catastrophic, so we log it and shut down the hook (set to inactive)
                        // TODO: Figure out some way to notify of failures.
                        console.error(err);

                        console.info("Setting hook to inactive");
                        return registry.resumeHook(
                            options.id,
                            false,
                            payload.lastEventId,
                            false
                        );
                    });
            } else {
                megaPromise
                    .then(() => {
                        response.status(201).send({
                            status: "Received",
                            deferResponse: false
                        });
                    })
                    .catch(e => {
                        console.error(e);
                        response.status(500).send({
                            status: "Error",
                            deferResponse: false
                        });
                    });
            }
        }
    );
}
