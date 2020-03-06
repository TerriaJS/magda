import crypto from "crypto";

export const RecordTypeMapping = {
    Organization: "org",
    Dataset: "ds",
    Distribution: "dist",
    Group: "gp"
};

export type RecordType = "Organization" | "Dataset" | "Distribution" | "Group";

export default class ConnectorRecordId {
    constructor(
        readonly id: string,
        readonly type: RecordType,
        readonly sourceId: string
    ) {}

    toString(): string {
        const id = [this.typeId, this.sourceId, this.id].join("-");
        if (id.length > 100) {
            // ID is too long, so hash the source record ID.
            const hashedId = crypto
                .createHash("sha256")
                .update(this.id, "utf8")
                .digest("hex");
            const hashedFullId = [this.typeId, this.sourceId, hashedId].join(
                "-"
            );
            if (hashedFullId.length > 100) {
                // It's _still_ too long, probably because the sourceId is excessively long.
                // So hash the full ID, including the sourceId and typeId.
                return crypto
                    .createHash("sha256")
                    .update(id, "utf8")
                    .digest("hex");
            }
            return hashedFullId;
        }
        return id;
    }

    private get typeId(): string {
        return RecordTypeMapping[this.type];
    }
}
