import { OpaCompileResponse, OpaTerm } from "./OpaTypes";
import _ from "lodash";

export type AuthDecision = false | AuthOr | AuthAnd | AuthQuery;

export class AuthQuery {
    constructor(
        readonly path: string[],
        readonly sign: "=" | "!=" | "<" | ">" | "<=" | ">=",
        readonly value: string | boolean | number
    ) {}
}

export class AuthAnd {
    constructor(readonly parts: AuthDecision[]) {}
    joiner = "and";
}

export class AuthOr {
    constructor(readonly parts: AuthDecision[]) {}
    joiner = "or";
}

export default function getAuthDecision(
    response: OpaCompileResponse
): AuthDecision {
    if (response.result.support) {
        throw new Error(
            "Cannot understand support in query " + JSON.stringify(response)
        );
    }

    if (response.result.queries) {
        return new AuthOr(
            response.result.queries.map(
                query =>
                    new AuthAnd(
                        query.map(queryPart => {
                            if (queryPart.terms.length !== 3) {
                                throw new Error(
                                    "Could not understand terms " +
                                        JSON.stringify(queryPart.terms)
                                );
                            }

                            const sign = getSign(queryPart.terms[0]);
                            const path = getPath(queryPart.terms[1]);
                            const value = getValue(queryPart.terms[2]);

                            return new AuthQuery(path, sign, value);
                        })
                    )
            )
        );
    } else {
        return false;
    }
}

function getPath(term: OpaTerm) {
    if (
        term.type !== "ref" ||
        term.value.length === 0 ||
        term.value[0].type !== "var" ||
        term.value[0].value !== "input"
    ) {
        throw new Error("Could not understand " + JSON.stringify(term));
    }

    return term.value.slice(2).map(valueObj => valueObj.value.toString());
}

function getSign(term: OpaTerm) {
    if (
        term.type !== "ref" ||
        term.value.length !== 1 ||
        term.value[0].type !== "var"
    ) {
        throw new Error(JSON.stringify(term) + " is not a sign");
    }

    switch (term.value[0].value) {
        case "eq":
        case "equal":
            return "=";
        case "gt":
            return ">";
        case "gte":
            return ">=";
        case "lt":
            return "<";
        case "lte":
            return "<=";
        case "neq":
            return "!=";
        default:
            throw new Error(term.value[0].value + " is not a sign");
    }
}

function getValue(term: OpaTerm) {
    if (
        term.type === "string" ||
        term.type === "boolean" ||
        term.type === "number"
    ) {
        return term.value;
    } else {
        throw new Error("Could not get value from " + JSON.stringify(term));
    }
}
