import _ from "lodash";

export interface OpaCompileResponse {
    result: {
        queries?: OpaQuery[];
        support?: OpaSupport[];
    };
}

export type OpaQuery = {
    index: number;
    terms: OpaTerm[];
}[];

export interface OpaSupport {}

export type OpaTerm = OpaRef | OpaValue | OpaVar;

export interface OpaRef {
    type: "ref";
    value: (OpaValue | OpaVar)[];
}

export interface OpaVar {
    type: "var";
    value: OpaOp | "data" | "input";
}

export type OpaValue = OpaBoolean | OpaString | OpaValueNumber;

export interface OpaBoolean {
    type: "boolean";
    value: boolean;
}

export interface OpaString {
    type: "string";
    value: string;
}

export interface OpaValueNumber {
    type: "number";
    value: number;
}

export type OpaOp = OpaEq | OpaNeq | OpaLt | OpaGt | OpaLte | OpaGte;

export type OpaEq = "eq" | "equal";
export type OpaNeq = "neq";
export type OpaLt = "lt";
export type OpaGt = "gt";
export type OpaLte = "lte";
export type OpaGte = "gte";
