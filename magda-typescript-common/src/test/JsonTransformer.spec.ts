import JsonTransformer, { JsonTransformerOptions } from "../JsonTransformer";
import ConnectorRecordId from "../ConnectorRecordId";
import { expect } from "chai";
import "mocha";
import AspectBuilder from "../AspectBuilder";
import fs from "fs";
import { Record } from "../generated/registry/api";

describe("JsonTransformer", () => {
    const tenantId1 = 1;
    describe("organizationJsonToRecord", () => {
        let transformerOptions: JsonTransformerOptions;

        beforeEach(() => {
            const organizationAspectBuilders: AspectBuilder[] = [
                {
                    aspectDefinition: {
                        id: "organization-details",
                        name: "Organization",
                        jsonSchema: require("@magda/registry-aspects/organization-details.schema.json")
                    },
                    builderFunctionString: fs.readFileSync(
                        "src/test/aspect-templates/organization-details.js",
                        "utf8"
                    )
                }
            ];

            transformerOptions = {
                sourceId: "test",
                organizationAspectBuilders,
                tenantId: tenantId1
            };
        });

        it("should revise the organisation record", () => {
            const transformer = new JsonTransformerWithCheck(
                transformerOptions
            );
            const organization = JSON.parse(
                `{
                    "description": "This description should be revised as an empty string.",
                    "id": "123", 
                    "name": "abc"
                }`
            );
            const theRecord = transformer.organizationJsonToRecord(
                organization
            );
            expect(theRecord.id).to.equal("org-test-123");
            expect(theRecord.name).to.equal("abc");

            const organizationDetailsAspect =
                theRecord.aspects["organization-details"];
            expect(organizationDetailsAspect.description).to.equal("");
            expect(organizationDetailsAspect.name).to.equal("abc");
        });

        it("organisation record should be the same if not revised", () => {
            const transformer = new JsonTransformerWithCheck(
                transformerOptions
            );
            const organization = JSON.parse(
                `{
                    "description": "This description should be kept.",
                    "id": "456", 
                    "name": "def"
                }`
            );
            const theRecord = transformer.organizationJsonToRecord(
                organization
            );
            expect(
                theRecord.aspects["organization-details"].description
            ).to.equal("This description should be kept.");
        });

        it("should not revise the organisation record by default", () => {
            const transformer = new JsonTransformerDefaultNoCheck(
                transformerOptions
            );
            const organization = JSON.parse(
                `{
                    "description": "This description should be kept.",
                    "id": "123456", 
                    "name": "abc def"
                }`
            );
            const theRecord = transformer.organizationJsonToRecord(
                organization
            );
            expect(
                theRecord.aspects["organization-details"].description
            ).to.equal("This description should be kept.");
        });
    });
});

class JsonTransformerDefaultNoCheck extends JsonTransformer {
    getIdFromJsonOrganization(
        jsonOrganization: any,
        sourceId: string
    ): ConnectorRecordId {
        return new ConnectorRecordId(
            jsonOrganization.id,
            "Organization",
            sourceId
        );
    }

    getNameFromJsonOrganization(jsonOrganization: any): string {
        return jsonOrganization.name;
    }

    getIdFromJsonDataset(
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId {
        throw new Error("Method not implemented.");
    }
    getIdFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any,
        sourceId: string
    ): ConnectorRecordId {
        throw new Error("Method not implemented.");
    }
    getNameFromJsonDataset(jsonDataset: any): string {
        throw new Error("Method not implemented.");
    }
    getNameFromJsonDistribution(
        jsonDistribution: any,
        jsonDataset: any
    ): string {
        throw new Error("Method not implemented.");
    }
}

class JsonTransformerWithCheck extends JsonTransformerDefaultNoCheck {
    reviseOrganizationRecord(record: Record) {
        if (
            record.aspects["organization-details"] &&
            record.aspects["organization-details"].description ===
                "This description should be revised as an empty string."
        ) {
            record.aspects["organization-details"].description = "";
        }

        return record;
    }
}
