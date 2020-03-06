import { WebHookConfig } from "magda-typescript-common/src/generated/registry/api";
import MinionOptions from "./MinionOptions";

export default function buildWebhookConfig(
    options: MinionOptions
): WebHookConfig {
    return {
        aspects: options.aspects,
        optionalAspects: options.optionalAspects,
        includeEvents: false,
        includeRecords: true,
        includeAspectDefinitions: false,
        dereference: true
    };
}
