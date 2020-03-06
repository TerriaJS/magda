import { Record, RecordSummary } from "../generated/registry/api";
export class RecordLayer {
    /*
     * The record data for this record layer
     */
    record: Record;
    /*
     * The layer corresponding to this Object
     */
    layer: string;
}

export class RecordLayerSummary {
    /*
     * The record summary data for this record layer
     */
    recordSummary: RecordSummary;
    /*
     * The layer corresponding to this summary
     */
    layer: string;
}
