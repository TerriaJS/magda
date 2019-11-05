import { Probe } from "@magda/typescript-common/dist/express/status";
import ObjectFromStore from "./ObjectFromStore";

export default interface ObjectStoreClient {
    getFile(name: string): ObjectFromStore;
    statusProbe: Probe;
}
