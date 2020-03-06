import { expect } from "chai";
import OpaCompileResponseParser from "../OpaCompileResponseParser";
import testData from "./sampleOpaResponse.json";
import testDataSimple from "./sampleOpaResponseSimple.json";
import "mocha";

/**
 * Although equivalent, depends on how you write your policy,
 * the result could contains more or less redundant expression / rules (e.g. TRUE && TRUE )
 * Things could trigger more redundant expression are:
 * - reference another rule without evaluate the result directly
 *   - e.g. `isValidURL` will likely produce more redundant expression than `isValidURL == true`
 * - use NOT
 * OpaCompileResultParser will dry the result to its most concise form so we don't need to worry about the difference
 */
describe("Test OpaCompileResultParser with complex response", function() {
    it("Parse sample response with no errors", function() {
        const parser = new OpaCompileResponseParser();
        const data = parser.parse(JSON.stringify(testData));
        expect(parser.hasWarns).to.be.equal(false);
        expect(data).to.be.an("array");
    });

    it("Should evalute rule `allowRead` from parse result correctly", function() {
        const parser = new OpaCompileResponseParser();
        parser.parse(JSON.stringify(testData));
        const result = parser.evaluateRule(
            "data.partial.object.content.allowRead"
        );
        expect(parser.hasWarns).to.be.equal(false);
        expect(result.isCompleteEvaluated).to.be.equal(false);
        expect(result.residualRules).to.be.an("array");
        expect(result.residualRules.length).to.be.equal(1);
        expect(result.residualRules[0].isCompleteEvaluated).to.be.equal(false);
        expect(result.residualRules[0].expressions.length).to.be.equal(1);
        expect(result.residualRules[0].expressions[0].terms.length).to.be.equal(
            3
        );
        expect(
            result.residualRules[0].expressions[0].toHumanReadableString()
        ).to.be.equal('input.object.content.id = "header/navigation/datasets"');
    });

    it("Should generate correct human readable string", function() {
        const parser = new OpaCompileResponseParser();
        parser.parse(JSON.stringify(testData));
        const result = parser.evaluateRuleAsHumanReadableString(
            "data.partial.object.content.allowRead"
        );
        expect(parser.hasWarns).to.be.equal(false);
        expect(result).to.be.equal(
            'input.object.content.id = "header/navigation/datasets"'
        );
    });
});

describe("Test OpaCompileResultParser with simple response", function() {
    it("Parse sample response with no errors", function() {
        const parser = new OpaCompileResponseParser();
        const data = parser.parse(JSON.stringify(testDataSimple));
        expect(parser.hasWarns).to.be.equal(false);
        expect(data).to.be.an("array");
    });

    it("Should evalute rule `allowRead` from parse result correctly", function() {
        const parser = new OpaCompileResponseParser();
        parser.parse(JSON.stringify(testDataSimple));
        const result = parser.evaluateRule(
            "data.partial.object.content.allowRead"
        );
        expect(parser.hasWarns).to.be.equal(false);
        expect(result.isCompleteEvaluated).to.be.equal(false);
        expect(result.residualRules).to.be.an("array");
        expect(result.residualRules.length).to.be.equal(1);
        expect(result.residualRules[0].isCompleteEvaluated).to.be.equal(false);
        expect(result.residualRules[0].expressions.length).to.be.equal(1);
        expect(result.residualRules[0].expressions[0].terms.length).to.be.equal(
            3
        );
        expect(
            result.residualRules[0].expressions[0].toHumanReadableString()
        ).to.be.equal('input.object.content.id = "header/navigation/datasets"');
    });

    it("Should generate correct human readable string", function() {
        const parser = new OpaCompileResponseParser();
        parser.parse(JSON.stringify(testDataSimple));
        const result = parser.evaluateRuleAsHumanReadableString(
            "data.partial.object.content.allowRead"
        );
        expect(parser.hasWarns).to.be.equal(false);
        expect(result).to.be.equal(
            'input.object.content.id = "header/navigation/datasets"'
        );
    });
});
