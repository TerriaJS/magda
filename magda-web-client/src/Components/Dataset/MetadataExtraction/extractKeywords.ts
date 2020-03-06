import retext from "retext";
import keywords from "retext-keywords";
import toString from "nlcst-to-string";
import { isValidKeyword } from "api-clients/VocabularyApis";
import uniq from "lodash/uniq";
import { config } from "config";

/** The maximum number of characters to feed into retext (input after this char length will be trimmed off) */
const MAX_CHARACTERS_FOR_EXTRACTION = 150000;
/** The maximum number of keywords to return */
export const MAX_KEYWORDS = 10;

const keywordsBlackList =
    config.keywordsBlackList &&
    config.keywordsBlackList.map(kw => kw.toLowerCase());

/** Turns all instances of one or more whitespace characters (space, newline etc) into a single space */
function standardizeWhitespace(keyword: string) {
    return keyword.replace(/\s+/g, " ").trim();
}

function cleanUpKeywords(keywords: string[]) {
    let cleaned = uniq(
        keywords.map(kw => standardizeWhitespace(kw).toLowerCase())
    );
    if (keywordsBlackList) {
        cleaned = cleaned.filter(
            keyword =>
                !keywordsBlackList.some(
                    blackListed => keyword.indexOf(blackListed) > -1
                )
        );
    }
    return cleaned;
}

/**
 * Extract keywords from text based file formats
 */
export async function extractKeywords(
    input: {
        text: string;
        keywords: string[];
        largeTextBlockIdentified: boolean;
    },
    output: { keywords: string[] }
) {
    let keywords = [] as string[];

    // please note: `largeTextBlockIdentified` can be undefined
    // only spreadsheet like source will set this field
    if (input.text && input.largeTextBlockIdentified !== false) {
        // Only take up to a certain length - anything longer results in massive delays and the browser
        // prompting with a "Should I stop this script?" warning.
        const trimmedText = input.text.slice(0, MAX_CHARACTERS_FOR_EXTRACTION);

        const candidateKeywords = keywords.concat(
            await getKeywordsFromText(trimmedText)
        );

        const validatedKeywords: string[] = [];
        for (let i = 0; i < candidateKeywords.length; i++) {
            const result = await isValidKeyword(candidateKeywords[i]);
            if (result) {
                validatedKeywords.push(candidateKeywords[i]);
            }
        }

        // Put the validated keywords first then unvalidated, so that if it goes over MAX_KEYWORDS
        // the unvalidated ones will be the ones trimmed.
        keywords = [...validatedKeywords, ...candidateKeywords];
    }

    // add keywords from header / cells if applicable
    if (input.keywords) {
        keywords = [...keywords, ...input.keywords];
    }

    output.keywords = cleanUpKeywords(keywords).slice(0, 10);
}

function getKeywordsFromText(
    text: string,
    maximum: number = MAX_KEYWORDS * 2
): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
        retext()
            .use(keywords, {
                maximum
            })
            .process(text, done);

        function done(err, file) {
            if (err) throw err;
            let keyphrases: string[] = [];
            file.data.keyphrases.forEach(function(phrase) {
                keyphrases.push(phrase.matches[0].nodes.map(toString).join(""));
            });
            resolve(keyphrases);
        }
    });
}
