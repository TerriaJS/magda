import express from "express";

import { MinionArguments } from "./commonYargs";
import {
    Record,
    AspectDefinition
} from "magda-typescript-common/src/generated/registry/api";
import { default as AuthorizedRegistryClient } from "magda-typescript-common/src/registry/AuthorizedRegistryClient";

export type onRecordFoundType = (
    record: Record,
    registry: AuthorizedRegistryClient
) => Promise<void>;
export default class MinionOptions {
    argv: MinionArguments;
    id: string;
    aspects: string[];
    optionalAspects: string[];
    writeAspectDefs: AspectDefinition[];
    async?: boolean;
    onRecordFound: onRecordFoundType;
    express?: () => express.Express;
    maxRetries?: number;
    concurrency?: number;
}
