import _ from "lodash";
import { CompleteRuleResult } from "./OpaCompileResponseParser";

/**
 * This is a generic, simple OPA result to SQL translator
 * It doesn't support table join.
 * For complex case (e.g. table join), it would be much easier to write a customised one within the problem domain
 * rather than write a generic one for all solution here.
 */
class SimpleOpaSQLTranslator {
    private refPrefixs: string[] = [];

    constructor(unknowns: string[] = []) {
        this.refPrefixs = unknowns.map(s => s + ".");
    }

    parse(result: CompleteRuleResult, sqlParametersArray: any[] = []) {
        if (result === null) return "false"; // --- no matched rules
        if (result.isCompleteEvaluated) {
            if (result.value === false) return "false";
            else return "true";
        }
        if (!result.residualRules || !result.residualRules.length) {
            throw new Error("residualRules cannot be empty array!");
        }
        let ruleConditions = result.residualRules.map(r =>
            r.expressions
                .map(e => {
                    if (e.terms.length === 1) {
                        const term = e.terms[0];
                        if (term.isRef()) {
                            if (!e.isNegated) {
                                return (
                                    term.fullRefString(this.refPrefixs) +
                                    " = true"
                                );
                            } else {
                                return (
                                    term.fullRefString(this.refPrefixs) +
                                    " != true"
                                );
                            }
                        } else {
                            const value = term.getValue();
                            // --- we convert any value to boolean before generate sql
                            return !!value ? "true" : "false";
                        }
                    } else if (e.terms.length === 3) {
                        const [
                            operator,
                            operands
                        ] = e.toOperatorOperandsArray();
                        const identifiers = operands.map(op => {
                            if (op.isRef())
                                return `"${op.fullRefString(this.refPrefixs)}"`;
                            else
                                return getSqlParameterName(
                                    sqlParametersArray,
                                    op.getValue()
                                );
                        });
                        const expStr = `${identifiers[0]} ${operator} ${
                            identifiers[1]
                        }`;
                        if (e.isNegated) return `!(${expStr})`;
                        else return expStr;
                    } else {
                        throw new Error(
                            `Invalid 3 terms expression: ${e.termsAsString()}`
                        );
                    }
                })
                .join(" AND ")
        );
        if (ruleConditions.length > 1) {
            ruleConditions = ruleConditions.map(r => `( ${r} )`);
        }

        return ruleConditions.join(" OR ");
    }
}

export function getSqlParameterName(
    sqlParametersArray: any[],
    value: any
): string {
    sqlParametersArray.push(value);
    const idx = sqlParametersArray.length;
    return `$${idx}`;
}

export default SimpleOpaSQLTranslator;
