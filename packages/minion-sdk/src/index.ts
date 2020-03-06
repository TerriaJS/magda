import minion from "@magda/minion-framework/dist/index";
export default minion;

export {
    default as commonYargs,
    MinionArguments
} from "@magda/minion-framework/dist/commonYargs";
export {
    default as AuthorizedRegistryClient,
    AuthorizedRegistryOptions
} from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
export {
    Record,
    AspectDefinition
} from "@magda/typescript-common/dist/generated/registry/api";
export {
    default as MinionOptions,
    onRecordFoundType
} from "@magda/minion-framework/dist/MinionOptions";
