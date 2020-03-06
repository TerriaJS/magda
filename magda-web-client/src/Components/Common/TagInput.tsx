import React from "react";

import { query } from "api-clients/VocabularyApis";
import MultiSelectAutoComplete from "Components/Editing/MultiSelectAutocomplete";
import { KeywordsLike } from "Components/Dataset/Add/DatasetAddCommon";
import partial from "lodash/partial";

interface TagInputProps {
    placeHolderText?: string;
    value?: KeywordsLike | undefined;
    onChange: (value?: KeywordsLike) => void;
    useVocabularyAutoCompleteInput?: boolean;
    options?: string[];
    noManualInput?: boolean;
}

async function optionsQuery(options: string[], str: string): Promise<string[]> {
    if (!options || !options.length) {
        return [];
    }
    return options.filter(
        item => item.toLowerCase().indexOf(str.toLowerCase()) !== -1
    );
}

export default (props: TagInputProps) => {
    const noManualInput = props.noManualInput === true ? true : false;

    return (
        <MultiSelectAutoComplete<string>
            placeHolderText={props.placeHolderText}
            value={props.value && props.value.keywords}
            onChange={newKeywords =>
                props.onChange(
                    newKeywords
                        ? {
                              derived: !!props.value && props.value.derived,
                              keywords: newKeywords
                          }
                        : undefined
                )
            }
            noManualInput={noManualInput}
            query={
                props.useVocabularyAutoCompleteInput
                    ? query
                    : props.options
                    ? partial(optionsQuery, props.options)
                    : undefined
            }
            fromData={data => data.value}
            toData={string => ({ label: string, value: string })}
        />
    );
};
