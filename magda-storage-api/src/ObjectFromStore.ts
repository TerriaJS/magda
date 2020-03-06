import { OutgoingHttpHeaders } from "http";

export default interface ObjectFromStore {
    createStream(): Promise<NodeJS.ReadableStream>;
    headers(): Promise<OutgoingHttpHeaders>;
}
