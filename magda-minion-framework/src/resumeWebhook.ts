import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";

import MinionOptions from "./MinionOptions";

export type NeedsCrawl = Promise<boolean>;

export default async function resumeWebhook(
    options: MinionOptions,
    registry: Registry
) {
    console.info(`Attempting to resume webhook ${options.id}`);

    const resumeResult = await registry.resumeHook(options.id);

    if (resumeResult instanceof Error) {
        throw resumeResult;
    }

    console.info(
        `Successfully resumed webhook - last event id was ${
            resumeResult.lastEventIdReceived
        }`
    );
}
