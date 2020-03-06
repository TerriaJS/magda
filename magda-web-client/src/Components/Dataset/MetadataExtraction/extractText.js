import XLSX from "xlsx";
import mammoth from "mammoth";
import pdfjsLib from "pdfjs-dist/build/pdf";
import PDFWorker from "pdfjs-dist/build/pdf.worker";
import { MAX_KEYWORDS } from "./extractKeywords";
import uniq from "lodash/uniq";
window.pdfjsWorker = PDFWorker;

/**
 * Extract contents of file as text if they are text based file formats
 *
 */
export async function extractText(input, output) {
    const name = input.file.name;

    if (name.match(/[.]xlsx?$/i)) {
        await extractSpreadsheetFile(input, output);
        output.format = "XLSX";
    } else if (name.match(/[.]csv/i)) {
        await extractSpreadsheetFile(input, output, "csv");
        output.format = "CSV";
    } else if (name.match(/[.]tsv$/i)) {
        await extractSpreadsheetFile(input, output, "csv");
        output.format = "TSV";
    } else if (name.match(/[.]pdf$/i)) {
        await extractPDFFile(input, output);
        output.format = "PDF";
    } else if (name.match(/[.]docx?$/i)) {
        await extractDocumentFile(input, output);
        output.format = "DOCX";
    }

    if (input.text) {
        input.text = input.text.replace(/\n+/g, "\n");
    }
}

/**
 * Extracts data/metadata from various spreadsheet formats. Refer to
 * https://github.com/SheetJS/js-xlsx for more details
 */
async function extractSpreadsheetFile(input, output, bookType = "xlsx") {
    input.workbook = XLSX.read(input.array, {
        type: "array",
        cellDates: true
    });

    // excel files can have embedded properties; extract those
    const props = input.workbook.Props;
    if (props) {
        if (props.Title) {
            output.datasetTitle = props.Title;
        }
        if (props.LastAuthor) {
            output.author = props.LastAuthor;
        }
        if (props.Author) {
            output.author = props.Author;
        }
        if (props.ModifiedDate) {
            output.modified = props.ModifiedDate.toISOString().substr(0, 10);
        }
    }

    // --- pass to keywords extractor for processing
    largeTextBlockIdentified = false;
    input.keywords = productKeywordsFromInput(input);
    input.largeTextBlockIdentified = largeTextBlockIdentified;
    if (largeTextBlockIdentified) {
        largeTextBlockIdentified = false;
        // --- only generate text for NLP if large text block is detected
        input.text = Object.values(input.workbook.Sheets)
            .map(worksheet => {
                return XLSX.utils
                    .sheet_to_json(worksheet)
                    .map(row => Object.values(row).join(","))
                    .join("\n");
            })
            .join("\n\n");
    }
}

const CONTAINS_LETTER = /[a-zA-Z]+/;
let largeTextBlockIdentified = false;

function getKeywordsFromWorksheet(
    sheet,
    limit = 0,
    skipFirstRow = false,
    firstRowOnly = false
) {
    const keywords = [];
    const cancelLoopToken = {};
    try {
        Object.keys(sheet).forEach(key => {
            if (typeof key !== "string") {
                // --- invalid key
                return;
            }

            if (key[0] === "!") {
                // --- skip meta data
                return;
            }

            const rowNum = key.replace(/[^\d]/g, "");

            if (skipFirstRow && rowNum === "1") {
                // --- skip first row i.e. header row
                return;
            }

            if (firstRowOnly && rowNum !== "1") {
                // --- only first row i.e. header row
                return;
            }

            if (!sheet[key]) {
                return;
            }

            if (
                (sheet[key].t && sheet[key].t !== "s") ||
                typeof sheet[key].v !== "string"
            ) {
                // --- skip not text field
                return;
            }

            let value = sheet[key].v.trim();

            if (value === "") {
                return;
            }

            if (!CONTAINS_LETTER.test(value)) {
                return;
            }

            if (value.length > 100 || value.split(/\s/).length > 10) {
                // --- will not capture very long content or more than 10 words
                // --- leave to NLP
                largeTextBlockIdentified = true;
                return;
            }

            value = value.toLowerCase().replace(/[,._;?@!^]/g, " ");

            if (keywords.indexOf(value) !== -1) {
                // --- will not create duplicated keywords
                return;
            }

            if (limit > 0 && keywords.length >= limit) {
                // --- skip generating more keywords
                // --- but we still want the loop keep going for large content block detection if not yet detected
                if (largeTextBlockIdentified) {
                    // --- large block detected. Quit loop
                    throw cancelLoopToken;
                } else {
                    // --- not yet detected. Keep digging more data
                    return;
                }
            }

            keywords.push(value);
        });
    } catch (e) {
        // --- allow escape from loop earlier
        if (e !== cancelLoopToken) {
            throw e;
        }
    }

    return keywords;
}

function productKeywordsFromInput(input) {
    let keywords = [];

    // --- we read the sheet data directly instead of `sheet_to_json` as:
    // --- `sheet_to_json` return [] if there is only one row
    // --- the type data & row num is lost during conversion
    const allSheetsData = Object.values(
        XLSX.read(input.array, {
            type: "array"
        }).Sheets
    );

    for (let i = 0; i < allSheetsData.length; i++) {
        keywords = keywords.concat(
            getKeywordsFromWorksheet(
                allSheetsData[i],
                MAX_KEYWORDS,
                false,
                true
            )
        );
        keywords = uniq(keywords);
        if (keywords.length >= MAX_KEYWORDS && largeTextBlockIdentified) {
            return keywords.slice(0, MAX_KEYWORDS);
        }
    }

    if (keywords.length >= MAX_KEYWORDS) {
        keywords = keywords.slice(0, MAX_KEYWORDS);
    }

    // --- we still need to proceed to generate cell keywords if largeTextBlockIdentified not yet detected
    if (largeTextBlockIdentified) {
        return keywords;
    }

    // --- start to process all cell as not enough keywords produced
    for (let i = 0; i < allSheetsData.length; i++) {
        keywords = keywords.concat(
            getKeywordsFromWorksheet(
                allSheetsData[i],
                MAX_KEYWORDS,
                true,
                false
            )
        );
        keywords = uniq(keywords);
        if (keywords.length >= MAX_KEYWORDS && largeTextBlockIdentified) {
            break;
        }
    }

    return keywords.slice(0, MAX_KEYWORDS);
}

/**
 * Extracts data/metadata from pdf format.
 */
async function extractPDFFile(input, output) {
    let pdf = await pdfjsLib.getDocument({
        data: input.array
    });

    // pdf files can have embedded properties; extract those
    const meta = await pdf.getMetadata();

    if (meta.info) {
        if (meta.info.Author) {
            output.author = meta.info.Author;
        }
        if (meta.info.Title) {
            output.datasetTitle = meta.info.Title;
        }

        if (meta.info.Keywords) {
            output.keywords = meta.info.Keywords.split(/,\s+/g);
        }

        if (meta.info.Subject) {
            output.themes = [meta.info.Subject];
        }
    }

    // extract text
    let text = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        let page = await pdf.getPage(i);
        page = await page.getTextContent({
            normalizeWhitespace: true
        });
        page = page.items.map(txt => txt.str).join("\n");
        text.push(page);
    }

    input.text = text.join("\n\n");
}

/**
 * Extracts data/metadata from word format.
 */
async function extractDocumentFile(input, output) {
    input.text = (await mammoth.extractRawText({
        arrayBuffer: input.arrayBuffer
    })).value;
}
