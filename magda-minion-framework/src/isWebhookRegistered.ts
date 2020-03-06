import { isEqual } from "lodash";

import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";

import MinionOptions from "./MinionOptions";
import buildWebhookConfig from "./buildWebhookConfig";
import getWebhookUrl from "./getWebhookUrl";

export default async function isWebhookRegistered(
    options: MinionOptions,
    registry: Registry
): Promise<boolean> {
    const maybeHook = await registry.getHook(options.id);

    if (maybeHook instanceof Error) {
        throw maybeHook;
    }

    const newWebhookConfig = buildWebhookConfig(options);

    return maybeHook
        .map(
            hook =>
                isEqual(hook.config, newWebhookConfig) &&
                hook.url === getWebhookUrl(options)
        )
        .valueOr(false);
}
