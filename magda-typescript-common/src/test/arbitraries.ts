const { curried2 } = require("jsverify/lib/utils");
import { Record } from "../generated/registry/api";
const lazyseq = require("lazy-seq");
import uuid = require("uuid/v4");
import _ from "lodash";
import jsc from "./jsverify";

function fromCode(code: number) {
    return String.fromCharCode(code);
}

function toCode(c: string) {
    return c.charCodeAt(0);
}

const charArb = jsc.integer(32, 0xff).smap(fromCode, toCode);

/**
 * Generates a random string with characters greater than code 32 (so no random
 * TTY crap that can't be matched by any regex
 */
export const stringArb = jsc
    .array(charArb)
    .smap(chars => chars.join(""), string => string.split(""));

export const lowerCaseAlphaCharArb = jsc
    .integer(97, 122)
    .smap(fromCode, toCode);
export const numArb = jsc.integer(48, 57).smap(fromCode, toCode);
export const lcAlphaNumCharArb = jsc.oneof([numArb, lowerCaseAlphaCharArb]);
export const lcAlphaNumStringArb = jsc
    .array(lcAlphaNumCharArb)
    .smap((arr: any) => arr.join(""), (string: string) => string.split(""));
export const lcAlphaNumStringArbNe = jsc
    .nearray(lcAlphaNumCharArb)
    .smap((arr: any) => arr.join(""), (string: string) => string.split(""));

export const lcAlphaStringArb = jsc
    .array(lowerCaseAlphaCharArb)
    .smap(chars => chars.join(""), string => string.split(""));

export const lcAlphaStringArbNe = jsc
    .nearray(lowerCaseAlphaCharArb)
    .smap(chars => chars.join(""), string => string.split(""));

export const peopleNameArb = jsc
    .tuple([lcAlphaStringArbNe, lcAlphaStringArbNe])
    .smap(
        strArr => strArr.join(" "),
        string => string.split(" ") as [string, string]
    );

const uuidArb: jsc.Arbitrary<string> = jsc.bless({
    generator: jsc.generator.bless(x => uuid()),
    shrink: jsc.shrink.bless(x => []),
    show: (x: string) => x
});

const intArb = jsc.integer(48, 57);

export const recordArb = jsc.record<Record>({
    id: uuidArb,
    name: stringArb,
    aspects: jsc.suchthat(jsc.array(jsc.json), arr => arr.length <= 10),
    sourceTag: jsc.constant(undefined),
    tenantId: intArb,
    authnReadPolicyId: jsc.constant(undefined)
});

export const specificRecordArb = (aspectArbs: {
    [key: string]: jsc.Arbitrary<any>;
}) =>
    jsc.record<Record>({
        id: uuidArb,
        name: stringArb,
        aspects: jsc.record(aspectArbs),
        sourceTag: jsc.constant(undefined),
        tenantId: intArb,
        authnReadPolicyId: jsc.constant(undefined)
    });

const defaultSchemeArb = jsc.oneof([
    jsc.constant("http"),
    jsc.constant("https"),
    jsc.constant("ftp"),
    lcAlphaNumStringArbNe
]);

type UrlArbOptions = {
    schemeArb?: jsc.Arbitrary<string>;
    hostArb?: jsc.Arbitrary<string>;
};

function shrinkArrayWithMinimumSize<T>(
    size: number
): (x: jsc.Shrink<T>) => jsc.Shrink<T[]> {
    function shrinkArrayImpl(...args: any[]) {
        const shrink: (x: any) => Array<any> = args[0];
        const result: any = jsc.shrink.bless(function(arr: Array<any>) {
            if (arr.length <= size) {
                return lazyseq.nil;
            } else {
                var x = arr[0];
                var xs = arr.slice(1);

                return lazyseq
                    .cons(xs, lazyseq.nil)
                    .append(
                        shrink(x).map(function(xp: any) {
                            return [xp].concat(xs);
                        })
                    )
                    .append(
                        shrinkArrayImpl(shrink, xs).map(function(xsp: any) {
                            return [x].concat(xsp);
                        })
                    );
            }
        });

        return curried2(result, args);
    }

    return shrinkArrayImpl;
}

export type MonadicArb<T> = jsc.Arbitrary<T> & {
    flatMap<U>(
        arbForward: (t: T) => jsc.Arbitrary<U>,
        backwards: (u: U) => T
    ): MonadicArb<U>;
};

/** Sometimes jsc returns a lazy-seq when it should return an array, this makes sure it's an array. */
function unSeq<T>(maybeArray: any): T[] {
    return maybeArray.toArray ? maybeArray.toArray() : maybeArray;
}

export function arbFlatMap<T, U>(
    arb: jsc.Arbitrary<T>,
    arbForward: (t: T) => jsc.Arbitrary<U>,
    backwards: (u: U) => T,
    show: (u: U) => string | undefined = u => JSON.stringify(u)
): MonadicArb<U> {
    const x = jsc.bless<U>({
        generator: arb.generator.flatmap((t: T) => {
            return arbForward(t).generator;
        }),
        show,
        shrink: jsc.shrink.bless((u: U) => {
            const t = backwards(u);

            if (_.isUndefined(t)) {
                return [];
            }

            const ts = unSeq<T>(arb.shrink(t));
            const us = _(ts)
                .flatMap(thisT => {
                    const newArb = arbForward(thisT);
                    const newU = (jsc.sampler(newArb, ts.length)(1) as any)[0];
                    return _.take(unSeq<U>(newArb.shrink(newU)), 3);
                })
                .value();

            return us;
        })
    });

    return {
        ...x,
        flatMap<V>(
            arbForward: (u: U) => jsc.Arbitrary<V>,
            backwards: (v: V) => U
        ): MonadicArb<V> {
            return arbFlatMap<U, V>(x, arbForward, backwards);
        }
    };
}

function generateArrayOfSize<T>(
    arrSize: number,
    gen: jsc.Generator<T>
): jsc.Generator<T[]> {
    var result = jsc.generator.bless(function(size: number) {
        var arr = new Array(arrSize);
        for (var i = 0; i < arrSize; i++) {
            arr[i] = gen(size);
        }
        return arr;
    });

    return result;
}

/** Generates an array that is guaranteed to be of the supplied size */
export function arrayOfSizeArb<T>(
    size: number,
    arb: jsc.Arbitrary<T>
): jsc.Arbitrary<T[]> {
    return jsc.bless<T[]>({
        generator: generateArrayOfSize(size, arb.generator),
        shrink: shrinkArrayWithMinimumSize<T>(size)(arb.shrink),
        show: x => x.toString()
    });
}

/**
 * Randomly generates a scheme, host, port and path for a URL.
 */
const urlPartsArb = (options: UrlArbOptions) =>
    jsc.record({
        scheme: options.schemeArb,
        host: jsc.suchthat(
            options.hostArb,
            (string: string) => !string.startsWith("ftp")
        ),
        port: jsc.oneof([
            jsc.integer(1, 65000),
            jsc.constant(80),
            jsc.constant(21)
        ]),
        path: jsc.array(lcAlphaNumStringArbNe)
    });

/** Generates a URL for a distribution - this could be ftp, http or https */
export const distUrlArb = ({
    schemeArb = defaultSchemeArb,
    hostArb = lcAlphaNumStringArbNe
}: UrlArbOptions = {}) =>
    urlPartsArb({ schemeArb, hostArb }).smap(
        urlParts => {
            const port =
                (urlParts.scheme === "http" && urlParts.port === 80) ||
                (urlParts.scheme === "ftp" && urlParts.port === 21)
                    ? ""
                    : ":" + urlParts.port;

            return `${urlParts.scheme}://${urlParts.host}.com${port}/${(
                urlParts.path || []
            ).join("/")}` as string;
        },
        (url: string) => {
            const splitAfterScheme = url.split("://");
            const scheme = splitAfterScheme[0];
            const splitOnDotCom = splitAfterScheme[1].split(/\.com:?/);
            const host = splitOnDotCom[0];
            const pathSegments = splitOnDotCom[1].split("/");
            const port: number = parseInt(pathSegments[0]);
            const path = pathSegments.slice(1);
            return { scheme, host, port, path };
        }
    );

/**
 * Can be passed into distStringsArb to override the default arbitraries.
 */
export type DistStringsOverrideArbs = {
    url?: jsc.Arbitrary<string>;
    license?: jsc.Arbitrary<string>;
    format?: jsc.Arbitrary<string>;
};

/**
 * Can be passed into sourceLinkArb to override the default arbitraries.
 */
export type SourceLinkOverrideArbs = {
    status?: jsc.Arbitrary<string | undefined>;
};

/**
 * Can be passed into datasetFormatArb to override the default arbitaries.
 */
export type DatasetFormatOverrideArbs = {
    format?: jsc.Arbitrary<string>;
};

/**
 * Generates the content of a distribution's dcat-distribution-strings aspect.
 */
export const distStringsArb = ({
    url = jsc.oneof([distUrlArb(), jsc.constant(undefined)]),
    license = stringArb,
    format = stringArb
}: DistStringsOverrideArbs) =>
    jsc.record({
        downloadURL: url,
        accessURL: url,
        license,
        format
    });

/**
 * Generates the content of source link status aspect
 */
export const sourceLinkArb = ({
    status = jsc.constant("active")
}: SourceLinkOverrideArbs) =>
    jsc.record({
        status: status
    });

/**
 *
 */
export const datasetFormatArb = ({
    format = stringArb
}: DatasetFormatOverrideArbs) =>
    jsc.record({
        format
    });

/**
 * Generates records, allowing specific arbs to be defined for the distribution.
 */
export const recordArbWithDistArbs = (
    distStringsOverrides: DistStringsOverrideArbs = {},
    sourceLinkOverrides: SourceLinkOverrideArbs = {},
    datasetFormatOverrides: DatasetFormatOverrideArbs = {}
) =>
    specificRecordArb({
        "dataset-distributions": jsc.record({
            distributions: jsc.array(
                specificRecordArb({
                    "dcat-distribution-strings": distStringsArb(
                        distStringsOverrides
                    ),
                    "dataset-format": datasetFormatArb(datasetFormatOverrides),
                    "source-link-status": sourceLinkArb(sourceLinkOverrides)
                })
            )
        })
    });

/**
 * Randomly generates a record with the passed objects under its
 * distributions' dcat-distribution-strings aspect.
 */
export const recordArbWithDists = (dists: object[]) =>
    specificRecordArb({
        "dataset-distributions": jsc.record({
            distributions: jsc.tuple(
                dists.map(dist =>
                    specificRecordArb({
                        "dcat-distribution-strings": jsc.constant(dist)
                    })
                )
            )
        })
    });

/**
 * Randomly returns a subset of the array, in-order.
 */
export function someOf<T>(array: T[]): jsc.Arbitrary<T[]> {
    return jsc
        .record({
            length: jsc.integer(0, array.length),
            start: jsc.integer(0, array.length - 1)
        })
        .smap(
            ({ length, start }) =>
                _(array)
                    .drop(start)
                    .take(length)
                    .value(),
            (newArray: T[]) => {
                const start = _.indexOf(array, newArray[0]);
                const length = newArray.length - start;

                return { start, length };
            }
        );
}

/**
 * Fuzzes a string, changing the case and putting random strings around it
 * and in spaces.
 */
export function fuzzStringArb(
    string: string,
    fuzzArb: jsc.Arbitrary<string> = stringArb
): jsc.Arbitrary<string> {
    const words = string.split(/[^a-zA-Z\d]+/);
    const aroundArbs = arrayOfSizeArb(words.length + 1, fuzzArb);

    return arbFlatMap(
        aroundArbs,
        around => {
            const string = _(around)
                .zip(words)
                .flatten()
                .join("");
            const caseArb = arrayOfSizeArb(string.length, jsc.bool);
            return jsc.record({ string: jsc.constant(string), cases: caseArb });
        },
        ({ string, cases }) => {
            const wordsRegex = new RegExp(words.join("|"));
            return string.split(wordsRegex);
        }
    ).smap(
        ({ string, cases }) =>
            _.map(string, (char, index) => {
                if (cases[index]) {
                    return char.toUpperCase();
                } else {
                    return char.toLowerCase();
                }
            }).join(""),
        string => ({
            cases: _.map(string, (char, index) => char === char.toUpperCase()),
            string
        })
    );
}

/**
 * Gets the result of the passed string arbitrary and fuzzes it, changing
 * the case and putting random strings around it and in spaces.
 */
export function fuzzStringArbResult(
    stringArb: jsc.Arbitrary<string>,
    fuzzArb?: jsc.Arbitrary<string>
) {
    return arbFlatMap(
        stringArb,
        string => fuzzStringArb(string, fuzzArb),
        fuzzedString => undefined
    );
}

export const dateStringArb = jsc.datetime.smap(
    date => date.toString(),
    string => new Date(Date.parse(string))
);
