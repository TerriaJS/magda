import _ from "lodash";

export type RegoValue = string | boolean | number | Array<any> | Object;

export interface RegoRuleOptions {
    name: string;
    fullName: string;
    isDefault: boolean;
    value: RegoValue;
    expressions: RegoExp[];
    isCompleteEvaluated?: boolean;
    parser: OpaCompileResponseParser;
}

/**
 * @class RegoRule
 * @export
 *
 * RegoRule represents [Rule](https://www.openpolicyagent.org/docs/latest/how-do-i-write-policies/#rules) concept in Rego language.
 * - A simple rule is made up of Rule head, Rule value & Rule body
 * - The Rule value defines the final result of the rule if the rule is matched (i.e. all expressions in rule body are true)
 * - If you didn't sepcify the rule value, it will be assume as boolean value `true`
 * - The rule body is made up of one of more rego expressions (see @class RegoExp) and each of the expression is made up of terms (see @class RegoTerm)
 * - The rule is considered as matched if all expressions in rule body are `true`
 * You can opt to define a `default` rule. A default rule has no rule body and will only considered as matched if all other rules are not matched.
 */
export class RegoRule {
    /**
     * the local name of the rule. i.e. doesn't include full package path
     * e.g. `allow`
     *
     * @type {string}
     * @memberof RegoRule
     */
    public name: string;

    /**
     * Full name of the rule. Includes fulle package path
     * e.g. `data.object.content.allowRead`
     *
     * @type {string}
     * @memberof RegoRule
     */
    public fullName: string;

    /**
     * Whether a rule is a default Rule
     * Its value only be used if any other residual rules are not matched (or no other residual rules)
     *
     * @type {boolean}
     * @memberof RegoRule
     */
    public isDefault: boolean;

    /**
     * Rule value. Rule value is this value if all expression in rule body are true
     * It can be any type. e.g. can be object or array etc. But a simple policy normally outputs a boolean true or false
     *
     * @type {RegoValue}
     * @memberof RegoRule
     */
    public value: RegoValue;

    /**
     * All Rego expressions in this rule's rule body. @see RegoExp
     *
     * @type {RegoExp[]}
     * @memberof RegoRule
     */
    public expressions: RegoExp[];

    /**
     * If the rule is matched or not
     * Default to undefined
     * Its value is only set when `isCompleteEvaluated` is true
     *
     * @type {boolean}
     * @memberof RegoRule
     */
    public isMatched: boolean;

    /**
     * If the rule is fully evaluate
     * Default to false
     *
     * @type {boolean}
     * @memberof RegoRule
     */
    public isCompleteEvaluated: boolean;

    /**
     * Reference to OpaParser
     *
     * @private
     * @type {OpaCompileResponseParser}
     * @memberof RegoRule
     */
    private parser: OpaCompileResponseParser;

    constructor(options: RegoRuleOptions) {
        this.isCompleteEvaluated = false;
        this.name = _.isString(options.name) ? options.name : "";
        this.fullName = _.isString(options.fullName) ? options.fullName : "";
        this.isDefault = _.isBoolean(options.isDefault)
            ? options.isDefault
            : false;
        this.value = _.isUndefined(options.value) ? true : options.value;
        this.expressions = _.isArray(options.expressions)
            ? options.expressions
            : [];
        this.isCompleteEvaluated = _.isBoolean(options.isCompleteEvaluated)
            ? options.isCompleteEvaluated
            : false;
        this.parser = options.parser;

        if (this.name === "") {
            throw new Error("Rule name can't be empty");
        }

        if (this.fullName === "") {
            throw new Error("Rule fullName can't be empty");
        }

        if (!(this.parser instanceof OpaCompileResponseParser)) {
            throw new Error("Require parser parameter to create a RegoRule");
        }
    }

    clone(): RegoRule {
        const regoRule = new RegoRule({
            name: this.name,
            fullName: this.fullName,
            isDefault: this.isDefault,
            value: this.value,
            isCompleteEvaluated: this.isCompleteEvaluated,
            expressions: this.expressions.map(e => e.clone()),
            parser: this.parser
        });
        regoRule.isMatched = this.isMatched;
        return regoRule;
    }

    /**
     * Re-evaluate this rule
     * If fully evaluated, this.isCompleteEvaluated will be set to true
     *
     * @returns
     * @memberof RegoRule
     */
    evaluate() {
        this.expressions = this.expressions.map(exp => exp.evaluate());
        const falseExpression = this.expressions.find(
            exp => exp.isMatch() === false
        );
        if (!_.isUndefined(falseExpression)) {
            // --- rule expressions are always evaluated in the context of AND
            // --- any false expression will make the rule not match
            this.isCompleteEvaluated = true;
            this.isMatched = false;
        } else {
            // --- filter out all expressions are evaluated
            // --- note any non-false value will considered as a match (true) i.e. 0 is equivalent to true
            const idx = this.expressions.findIndex(
                exp => !exp.isCompleteEvaluated
            );
            if (idx === -1) {
                this.isCompleteEvaluated = true;
                this.isMatched = true;
            } else {
                // --- further dry the rule if the rule has unsolved exps
                // --- if a exp is matched (i.e. true) it can be strip out as true AND xxxx = xxxx
                this.expressions = this.expressions.filter(
                    exp => exp.isMatch() !== true
                );
            }
        }
        return this;
    }

    /**
     * Generate Human Readable string of this rule
     * If it's fully evaluated, the output will be true or false (or actual rule value)
     * Otherwise, will generate expressions concate with `AND`
     *
     * @returns {string}
     * @memberof RegoRule
     */
    toHumanReadableString(): string {
        if (this.isCompleteEvaluated) {
            if (this.isMatched) {
                return value2String(this.value);
            } else {
                return "";
            }
        } else {
            const parts = this.expressions.map(e => e.toHumanReadableString());
            return parts.join(" AND \n");
        }
    }

    /**
     * Create RegoRule from Opa response data
     *
     * @static
     * @param {*} r
     * @param {string} packageName
     * @param {OpaCompileResponseParser} parser
     * @returns {RegoRule}
     * @memberof RegoRule
     */
    static parseFromData(
        r: any,
        packageName: string,
        parser: OpaCompileResponseParser
    ): RegoRule {
        const ruleName = r.head && r.head.name ? r.head.name : "";
        const ruleFullName = [packageName, ruleName].join(".");
        const ruleIsDefault = r.default === true;
        const ruleValue =
            r.head && r.head.value && !_.isUndefined(r.head.value.value)
                ? r.head.value.value
                : true;
        const ruleOptions: RegoRuleOptions = {
            name: ruleName,
            fullName: ruleFullName,
            isDefault: ruleIsDefault,
            value: ruleValue,
            expressions: RegoRule.createExpressionsFromRuleBodyData(
                r.body,
                parser
            ),
            parser
        };
        const regoRule = new RegoRule(ruleOptions);
        regoRule.evaluate();
        return regoRule;
    }

    static createExpressionsFromRuleBodyData(
        data: any,
        parser: OpaCompileResponseParser
    ): RegoExp[] {
        if (!_.isArray(data) || !data.length) {
            throw new Error(`Encountered empty rule body.`);
        }
        return data.map(expData => RegoExp.parseFromData(expData, parser));
    }
}

export interface RegoRefPart {
    type: string;
    value: string;
}

export const RegoOperators: {
    [k: string]: string;
} = {
    eq: "=", // --- eq & equal are different in rego but no difference for value evluation.
    equal: "=",
    neq: "!=",
    lt: "<",
    gt: ">",
    lte: "<=",
    gte: ">="
};

export type RegoTermValue = RegoRef | RegoValue;

/**
 * RegoTerm represent the basic elements that creates an expressions.
 * e.g. An expression `a > 4` is made up of 3 terms
 * - Reference Term: `a`
 * - Operator Term `>`
 * - Value Term: `4`
 *
 * @export
 * @class RegoTerm
 */
export class RegoTerm {
    public type: string;
    public value: RegoTermValue;
    private parser: OpaCompileResponseParser;

    constructor(
        type: string,
        value: RegoTermValue,
        parser: OpaCompileResponseParser
    ) {
        this.type = type;
        this.value = value;
        this.parser = parser;
    }

    clone() {
        return new RegoTerm(this.type, this.value, this.parser);
    }

    /**
     * If it's a reference term, return its full string representation
     *
     * @returns
     * @memberof RegoTerm
     */
    asString() {
        if (this.value instanceof RegoRef) return this.value.fullRefString();
        else return this.value;
    }

    /**
     * If it's a reference term. A operator is an Reference term as well
     *
     * @returns {boolean}
     * @memberof RegoTerm
     */
    isRef(): boolean {
        if (this.value instanceof RegoRef) return true;
        return false;
    }

    /**
     * Return RegoRef instance if this term is a RegoRef.
     *
     * @returns {RegoRef}
     * @memberof RegoTerm
     */
    getRef(): RegoRef {
        if (this.isRef()) {
            return this.value as RegoRef;
        }
        throw new Error(`Term ${this.asString()} is not a ref`);
    }

    /**
     * If the term is a reference and it contains any collection lookup
     * e.g.
     * - objectA.propB.collectionC[_]
     * - objectA.propB.collectionC[_].ABC[_].name
     * - objectA.propB.collectionC[_].id
     *
     * @returns {boolean}
     * @memberof RegoTerm
     */
    hasCollectionLookup(): boolean {
        if (!this.isRef()) return false;
        const ref = this.getRef();
        return ref.hasCollectionLookup();
    }

    /**
     * The term is not only a Reference but a reference contains simple collection lookup
     * i.e. only contains one collection lookup and the whole ref ends with the only collection lookup
     * e.g. objectA.propB.collectionC[_]
     * Note: objectA.propB.collectionC[_].name is not a simple collection lookup as it resolve to single value (`name` property)
     * rather than a collection
     *
     * @returns {boolean}
     * @memberof RegoTerm
     */
    isSimpleCollectionLookup(): boolean {
        if (!this.isRef()) return false;
        const ref = this.getRef();
        return ref.isSimpleCollectionLookup();
    }

    /**
     *
     *
     * @returns {boolean}
     * @memberof RegoTerm
     */
    isResolveAsCollectionValue(): boolean {
        if (!this.isRef()) return false;
        const ref = this.getRef();
        return ref.isResolveAsCollectionValue();
    }

    /**
     * If it's a reference term, return its full string representation
     * Otherwise, throw exception
     *
     * @param {string[]} [removalPrefixs=[]]
     * @returns {string}
     * @memberof RegoTerm
     */
    fullRefString(removalPrefixs: string[] = []): string {
        if (this.value instanceof RegoRef) {
            return this.value.fullRefString(removalPrefixs);
        } else {
            throw new Error("Tried to call `fullRefString` on non Ref term.");
        }
    }

    /**
     * If it's a reference term, return its string representation (not include ending [_])
     * Otherwise, throw exception
     *
     * @param {string[]} [removalPrefixs=[]]
     * @returns {string}
     * @memberof RegoTerm
     */
    refString(removalPrefixs: string[] = []): string {
        if (this.value instanceof RegoRef) {
            return this.value.refString(removalPrefixs);
        } else {
            throw new Error("Tried to call `refString` on non Ref term.");
        }
    }

    /**
     * Return term as operator string e.g. `=`, `>=` etc.
     *
     * @returns {string}
     * @memberof RegoTerm
     */
    asOperator(): string {
        if (this.value instanceof RegoRef) {
            return this.value.asOperator();
        } else {
            throw new Error("Tried to call `asOperator` on non Ref term.");
        }
    }

    /**
     * If it's a operator term
     *
     * @returns {boolean}
     * @memberof RegoTerm
     */
    isOperator(): boolean {
        if (this.value instanceof RegoRef) {
            return this.value.isOperator();
        } else {
            return false;
        }
    }

    /**
     * Tried to determine the value of the term
     *
     * @returns {RegoValue}
     * @memberof RegoTerm
     */
    getValue(): RegoValue {
        if (!this.isRef()) {
            return this.value;
        } else {
            if (this.isOperator()) {
                return undefined;
            } else {
                const fullName = this.fullRefString();
                const result = this.parser.completeRuleResults[fullName];
                if (_.isUndefined(result)) return undefined;
                return result.value;
            }
        }
    }

    static parseFromData(
        data: any,
        parser: OpaCompileResponseParser
    ): RegoTerm {
        if (data.type === "ref") {
            return new RegoTerm(data.type, RegoRef.parseFromData(data), parser);
        } else {
            return new RegoTerm(data.type, data.value, parser);
        }
    }
}

/**
 * Represents Rego expression
 *
 * @export
 * @class RegoExp
 */
export class RegoExp {
    /**
     * All RegoTerms belongs to this expression
     *
     * @type {RegoTerm[]}
     * @memberof RegoExp
     */
    public terms: RegoTerm[];

    /**
     * Whether this expression is a negative expression
     * i.e. it's final evaluation result should be `false` if result is `true`
     *
     * @type {boolean}
     * @memberof RegoExp
     */
    public isNegated: boolean;

    /**
     * If it's complete evaluated
     *
     * @type {boolean}
     * @memberof RegoExp
     */
    public isCompleteEvaluated: boolean = false;

    /**
     * The value of the expression
     *
     * @type {RegoValue}
     * @memberof RegoExp
     */
    public value: RegoValue = null;

    /**
     * Ref to Opa Parser
     *
     * @private
     * @type {OpaCompileResponseParser}
     * @memberof RegoExp
     */
    private parser: OpaCompileResponseParser;

    constructor(
        terms: RegoTerm[],
        isNegated: boolean = false,
        isCompleteEvaluated: boolean = false,
        value: RegoValue = null,
        parser: OpaCompileResponseParser
    ) {
        this.terms = terms;
        this.isNegated = isNegated;
        this.isCompleteEvaluated = isCompleteEvaluated;
        this.value = value;
        this.parser = parser;
    }

    clone(): RegoExp {
        const regoExp = new RegoExp(
            this.terms.map(t => t.clone()),
            this.isNegated,
            this.isCompleteEvaluated,
            this.value,
            this.parser
        );
        return regoExp;
    }

    /**
     * For debug usage, print terms as easy to ready short string
     *
     * @returns
     * @memberof RegoExp
     */
    termsAsString() {
        return this.terms.map(t => t.asString());
    }

    /**
     * Output human readable string
     *
     * @returns {string}
     * @memberof RegoExp
     */
    toHumanReadableString(): string {
        if (this.terms.length === 1) {
            const value = this.terms[0].getValue();
            const parts = [];
            if (this.isNegated) parts.push("NOT");

            if (!_.isUndefined(value)) {
                parts.push(value2String(value));
            } else {
                parts.push(this.terms[0].fullRefString());
            }
            return parts.join(" ");
        } else if (this.terms.length === 3) {
            const [operator, operands] = this.toOperatorOperandsArray();
            const parts = [];
            if (operands[0].isRef()) {
                parts.push(operands[0].fullRefString());
            } else {
                parts.push(value2String(operands[0].getValue()));
            }
            parts.push(operator);
            if (operands[1].isRef()) {
                parts.push(operands[1].fullRefString());
            } else {
                parts.push(value2String(operands[1].getValue()));
            }
            const expStr = parts.join(" ");
            if (this.isNegated) return `NOT (${expStr})`;
            return expStr;
        }
        throw new Error(`Invalid rego expression: ${this.termsAsString()}`);
    }

    /**
     * Try to determins its value
     *
     * @returns
     * @memberof RegoExp
     */
    getValue() {
        this.evaluate();
        if (!this.isCompleteEvaluated) return undefined;
        if (this.isNegated) {
            return this.value === false ? true : false;
        } else {
            // --- undefined is a common value in Rego similar to false
            // --- we set to false here to tell the difference between
            // --- real undefined (not full resolved) and undefined value
            if (_.isUndefined(this.value)) return false;
            else return this.value;
        }
    }

    isMatch() {
        const value = this.getValue();
        if (_.isUndefined(value)) {
            return undefined;
        } else {
            if (value === false || _.isUndefined(value)) return false;
            // --- 0 is a match
            return true;
        }
    }

    /**
     * Convert operator term to string and put rest operands into an array.
     * And then return a [Operator, Operands] structure
     *
     * @returns {[string, RegoTerm[]]}
     * @memberof RegoExp
     */
    toOperatorOperandsArray(): [string, RegoTerm[]] {
        if (this.terms.length !== 3) {
            throw new Error(
                `Can't get Operator & Operands from non 3 terms expression: ${this.termsAsString()}`
            );
        }
        const operands: RegoTerm[] = [];
        let operator = null;
        this.terms.forEach(t => {
            if (t.isOperator()) {
                operator = t.asOperator();
            } else {
                const value = t.getValue();
                if (!_.isUndefined(value)) {
                    operands.push(
                        new RegoTerm(typeof value, value, this.parser)
                    );
                } else operands.push(t);
            }
        });
        if (!operator) {
            throw new Error(
                `Invalid 3 terms rego expression, can't locate operator: ${this.termsAsString()}`
            );
        }
        if (operands.length !== 2) {
            throw new Error(
                `Invalid 3 terms rego expression, the number of operands should be 2: ${this.termsAsString()}`
            );
        }
        return [operator, operands];
    }

    /**
     * Try to evaluate the expression
     *
     * @returns
     * @memberof RegoExp
     */
    evaluate() {
        if (this.terms.length === 0) {
            // --- exp should be considered as matched (true)
            // --- unless isNegated is true
            // --- will try to normalise isNegated here
            this.isCompleteEvaluated = true;
            this.value = this.isNegated ? false : true;
            this.isNegated = false;
        }
        if (this.terms.length === 1) {
            const term = this.terms[0];
            const value = term.getValue();
            if (_.isUndefined(value)) return this;

            this.value = value;
            this.isCompleteEvaluated = true;
            return this;
        } else if (this.terms.length === 3) {
            // --- 3 terms expression e.g. true == true or x >= 3
            // --- we only evalute some redundant expression e.g. true == true or false != true
            const [operator, operands] = this.toOperatorOperandsArray();
            if (operands.findIndex(op => op.isRef()) !== -1) {
                // --- this expression involve unknown no need to evalute
                return this;
            } else {
                const operandsValues = operands.map(op => op.getValue());
                let value = null;
                switch (operator) {
                    case "=":
                        value = operandsValues[0] === operandsValues[1];
                        break;
                    case ">":
                        value = operandsValues[0] > operandsValues[1];
                        break;
                    case "<":
                        value = operandsValues[0] < operandsValues[1];
                        break;
                    case ">=":
                        value = operandsValues[0] >= operandsValues[1];
                        break;
                    case "<=":
                        value = operandsValues[0] <= operandsValues[1];
                        break;
                    case "!=":
                        value = operandsValues[0] != operandsValues[1];
                        break;
                    default:
                        throw new Error(
                            `Invalid 3 terms rego expression, Unknown operator "${operator}": ${this.termsAsString()}`
                        );
                }
                this.isCompleteEvaluated = true;
                this.value = value;
                return this;
            }
        } else {
            throw new Error(
                `Invalid ${
                    this.terms.length
                } terms rego expression: ${this.termsAsString()}`
            );
        }
        // --- so far there is no 2 terms expression e.g. ! x
        // --- builtin function should never be included in residual rule
        // --- as we won't apply them on unknowns
        return this;
    }

    static parseFromData(
        expData: any,
        parser: OpaCompileResponseParser
    ): RegoExp {
        const isNegated = expData.negated === true;
        if (_.isEmpty(expData.terms)) {
            if (isNegated) throw new Error("Invalid negated empty term!");
            return new RegoExp([], isNegated, false, null, parser);
        }

        let termsData: any[] = [];
        if (_.isArray(expData.terms)) {
            termsData = expData.terms;
        } else {
            termsData.push(expData.terms);
        }

        const terms: RegoTerm[] = termsData.map((termData: any) =>
            RegoTerm.parseFromData(termData, parser)
        );

        const exp = new RegoExp(terms, isNegated, false, null, parser);
        exp.evaluate();
        return exp;
    }
}

/**
 * Represents a special Rego Term type: reference term
 * You shouldn't use this class directly
 *
 * @export
 * @class RegoRef
 */
export class RegoRef {
    public parts: RegoRefPart[];

    constructor(parts: RegoRefPart[]) {
        this.parts = parts;
    }

    clone(): RegoRef {
        return new RegoRef(this.parts.map(p => ({ ...p })));
    }

    static parseFromData(data: any): RegoRef {
        if (data.type === "ref") {
            return new RegoRef(data.value as RegoRefPart[]);
        } else {
            return null;
        }
    }

    static convertToFullRefString(parts: RegoRefPart[]): string {
        return new RegoRef(parts).fullRefString();
    }

    removeAllPrefixs(str: string, removalPrefixs: string[] = []) {
        if (!removalPrefixs.length) return str;
        let result = str;
        removalPrefixs
            // --- starts from longest prefix
            .sort((a: string, b: string) => b.length - a.length)
            .forEach(prefix => {
                if (!prefix) return;
                const idx = result.indexOf(prefix);
                if (idx !== 0) return;
                result = result.substring(prefix.length);
            });
        return result;
    }

    fullRefString(removalPrefixs: string[] = []): string {
        let isFirstPart = true;
        const str = this.parts
            .map(part => {
                let partStr = "";
                if (isFirstPart) {
                    partStr = part.value;
                } else {
                    if (part.type == "var") {
                        // --- it's a collection lookup
                        // --- var name doesn't matter for most cases
                        partStr = "[_]";
                    } else {
                        partStr = part.value;
                    }
                }
                if (isFirstPart) isFirstPart = false;
                return partStr;
                //--- a.[_].[_] should be a[_][_]
            })
            .join(".")
            .replace(/\.\[/g, "[");
        return this.removeAllPrefixs(str, removalPrefixs);
    }

    refString(removalPrefixs: string[] = []): string {
        return this.fullRefString(removalPrefixs).replace("\\[_\\]$", "");
    }

    asCollectionRefs(removalPrefixs: string[] = []): string[] {
        return this.fullRefString(removalPrefixs)
            .split("[_]")
            .map(refStr => refStr.replace(/^\./, ""));
    }

    isOperator(): boolean {
        return Object.keys(RegoOperators).indexOf(this.fullRefString()) !== -1;
    }

    // --- the first var type won't count as collection lookup
    hasCollectionLookup(): boolean {
        if (this.parts.length <= 1) return false;
        else {
            return (
                this.parts.slice(1).findIndex(part => part.type === "var") !==
                -1
            );
        }
    }

    // -- simple collection only contains 1 level lookup
    // -- we don't need Nested Query to handle it
    isSimpleCollectionLookup(): boolean {
        if (this.parts.length <= 1) return false;
        else {
            return (
                this.parts.slice(1).findIndex(part => part.type === "var") ===
                this.parts.length - 2
            );
        }
    }

    // --- see comment for same name method of RegoTerm
    isResolveAsCollectionValue(): boolean {
        const refString = this.fullRefString();
        return refString.lastIndexOf("[_]") === refString.length - 3;
    }

    asOperator(): string {
        if (this.isOperator()) return RegoOperators[this.fullRefString()];
        else return null;
    }
}

export interface CompleteRuleResult {
    fullName: string;
    name: string;
    value: RegoValue;
    isCompleteEvaluated: boolean;
    residualRules?: RegoRule[];
}

export function value2String(value: RegoValue) {
    if (_.isBoolean(value) || _.isNumber(value)) return value.toString();
    else return JSON.stringify(value);
}

/**
 * OPA result Parser
 *
 * @export
 * @class OpaCompileResponseParser
 */
export default class OpaCompileResponseParser {
    /**
     * If a warning is produced during the parsing
     *
     * @type {boolean}
     * @memberof OpaCompileResponseParser
     */
    public hasWarns: boolean = false;

    /**
     * Any warnings produced during the parsing
     *
     * @type {string[]}
     * @memberof OpaCompileResponseParser
     */
    public warns: string[] = [];

    private data: any = null;

    /**
     * Inital Rules parsed from result
     * Only for debug purpose
     *
     * @type {RegoRule[]}
     * @memberof OpaCompileResponseParser
     */
    public completeRules: RegoRule[] = [];

    /**
     * Parsed, compressed & evaluated rules
     *
     * @type {RegoRule[]}
     * @memberof OpaCompileResponseParser
     */
    public rules: RegoRule[] = [];

    public queries: RegoExp[] = [];

    /**
     * A cache of all resolved rule result
     *
     * @type {{
     *         [fullName: string]: CompleteRuleResult;
     *     }}
     * @memberof OpaCompileResponseParser
     */
    public completeRuleResults: {
        [fullName: string]: CompleteRuleResult;
    } = {};

    constructor() {}

    /**
     * Parse OPA result Response
     *
     * @param {*} json
     * @returns {RegoRule[]}
     * @memberof OpaCompileResponseParser
     */
    parse(json: any): RegoRule[] {
        if (_.isString(json)) {
            this.data = JSON.parse(json);
        } else {
            this.data = json;
        }
        if (!this.data.result) {
            // --- mean no rule matched
            return [];
        }
        this.data = this.data.result;
        if (
            (!this.data.queries ||
                !_.isArray(this.data.queries) ||
                !this.data.queries.length) &&
            (!_.isArray(this.data.support) || !this.data.support.length)
        ) {
            // --- mean no rule matched
            return [];
        }

        const queries = this.data.queries;

        if (queries) {
            queries.forEach((q: any, i: number) => {
                const rule = new RegoRule({
                    name: "queryRule" + 1,
                    fullName: "queryRule" + 1,
                    expressions: q.map((innerQ: any) =>
                        RegoExp.parseFromData(innerQ, this)
                    ),
                    isDefault: false,
                    isCompleteEvaluated: false,
                    value: undefined,
                    parser: this
                });

                this.completeRules.push(rule);
                this.rules.push(rule);
            });
        }

        const packages: any[] = this.data.support;

        if (packages) {
            packages.forEach(p => {
                if (!_.isArray(p.rules) || !p.rules.length) return;
                const packageName =
                    p.package && _.isArray(p.package.path)
                        ? RegoRef.convertToFullRefString(p.package.path)
                        : "";

                const rules: any[] = p.rules;
                rules.forEach(r => {
                    const regoRule = RegoRule.parseFromData(
                        r,
                        packageName,
                        this
                    );
                    this.completeRules.push(regoRule);
                    // --- only save matched rules
                    if (!regoRule.isCompleteEvaluated) {
                        this.rules.push(regoRule);
                    } else {
                        if (regoRule.isMatched) {
                            this.rules.push(regoRule);
                        }
                    }
                });
            });
        }

        this.calculateCompleteResult();
        this.reduceDependencies();
        return this.rules;
    }

    /**
     * Tried to merge rules outcome so that the ref value can be established easier
     * After this step, any rules doesn't involve unknown should be merged to one value
     * This will help to generate more concise query later
     *
     * Only for internal usage
     *
     * @private
     * @memberof OpaCompileResponseParser
     */
    private calculateCompleteResult() {
        const fullNames = this.rules.map(r => r.fullName);
        fullNames.forEach(fullName => {
            const rules = this.rules.filter(r => r.fullName === fullName);
            const nonCompletedRules = rules.filter(r => !r.isCompleteEvaluated);
            const completedRules = rules.filter(r => r.isCompleteEvaluated);
            const defaultRules = completedRules.filter(r => r.isDefault);
            const nonDefaultRules = completedRules.filter(r => !r.isDefault);
            if (nonDefaultRules.length) {
                // --- if a non default complete eveluated rules exist
                // --- it will be the final outcome
                this.completeRuleResults[
                    fullName
                ] = this.createCompleteRuleResult(nonDefaultRules[0]);
                return;
            }
            if (!nonCompletedRules.length) {
                // --- if no unevaluated rule left, default rule value should be used
                if (defaultRules.length) {
                    this.completeRuleResults[
                        fullName
                    ] = this.createCompleteRuleResult(defaultRules[0]);
                    return;
                } else {
                    // --- no matched rule left; Not possible
                    throw new Error(
                        `Unexpected empty rule result for ${fullName}`
                    );
                }
            } else {
                // --- do nothing
                // --- Some defaultRules might be able to strip out once
                // --- nonCompletedRules are determined later
                return;
            }
        });
    }

    /**
     * Only for internal usage
     *
     * @returns
     * @private
     * @memberof OpaCompileResponseParser
     */
    private reduceDependencies() {
        const rules = this.rules.filter(r => !r.isCompleteEvaluated);
        if (!rules.length) return;
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            rule.expressions = rule.expressions.map(e => e.evaluate());
            rule.evaluate();
        }
        // --- unmatched non-default rule can be stripped out
        this.rules = this.rules.filter(
            r => !(r.isCompleteEvaluated && !r.isMatched && !r.isDefault)
        );
    }

    /**
     * Call to evaluate a rule
     *
     * @param {string} fullName
     * @returns {CompleteRuleResult}
     * @memberof OpaCompileResponseParser
     */
    evaluateRule(fullName: string): CompleteRuleResult {
        let rules = this.rules.filter(r => r.fullName === fullName);
        if (!rules.length) {
            // --- no any rule matched; often (depends on your policy) it means a overall non-matched (false)
            return null;
        }

        const defaultRule = rules.find(r => r.isDefault);
        const defaultValue = _.isUndefined(defaultRule)
            ? undefined
            : defaultRule.value;

        // --- filter out default rules & unmatched
        rules = rules.filter(
            r => !r.isDefault && !(r.isCompleteEvaluated && !r.isMatched)
        );

        if (!rules.length) {
            return {
                fullName,
                name: defaultRule ? defaultRule.name : "",
                value: defaultValue,
                isCompleteEvaluated: true,
                residualRules: []
            };
        }

        return {
            fullName,
            name: rules[0].name,
            value: undefined,
            isCompleteEvaluated: false,
            residualRules: rules
        };
    }

    /**
     * evaluate a rule and returned as human readable string
     *
     * @param {string} fullName
     * @returns {string}
     * @memberof OpaCompileResponseParser
     */
    evaluateRuleAsHumanReadableString(fullName: string): string {
        const result = this.evaluateRule(fullName);
        if (result === null) return "null";
        if (result.isCompleteEvaluated) {
            return value2String(result.value);
        }
        let parts = result.residualRules.map(r => r.toHumanReadableString());
        if (parts.length > 1) {
            parts = parts.map(p => `( ${p} )`);
        }
        return parts.join("\nOR\n");
    }

    /**
     * Only for internal usage
     *
     * @param {RegoRule} rule
     * @returns {CompleteRuleResult}
     * @private
     * @memberof OpaCompileResponseParser
     */
    private createCompleteRuleResult(rule: RegoRule): CompleteRuleResult {
        return {
            fullName: rule.fullName,
            name: rule.name,
            value: rule.value,
            isCompleteEvaluated: true,
            residualRules: []
        };
    }

    reportWarns(msg: string) {
        this.warns.push(msg);
        this.hasWarns = true;
    }
}

export function unknown2Ref(unknown: string) {
    const prefix = unknown.replace(/^input\./, "");
    return `data.partial.${prefix}`;
}
