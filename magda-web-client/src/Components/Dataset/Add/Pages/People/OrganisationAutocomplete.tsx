import React from "react";
import debouncePromise from "debounce-promise";

import { autocompletePublishers } from "api-clients/SearchApis";
import { OrganisationAutocompleteChoice } from "../../DatasetAddCommon";

import ASyncCreatableSelect from "react-select/async-creatable";
import ValidationHoc from "Components/Common/react-select/ValidationHoc";

const ASyncCreatableSelectWithValidation = ValidationHoc<Choice>(
    ASyncCreatableSelect
);

type Props =
    | {
          onOrgSelected: (
              choice: OrganisationAutocompleteChoice | undefined
          ) => void;
          value?: OrganisationAutocompleteChoice;
          multi: false;
          validationFieldPath?: string;
          validationFieldLabel?: string;
      }
    | {
          onOrgSelected: (
              choices: OrganisationAutocompleteChoice[] | undefined
          ) => void;
          value?: OrganisationAutocompleteChoice[];
          multi: true;
          validationFieldPath?: string;
          validationFieldLabel?: string;
      };

type Choice = {
    value: string;
    label: string;
    existingId?: string;
};

function fromReactSelect(choice: Choice) {
    return {
        existingId: choice.existingId,
        name: choice.label
    };
}

function toReactSelectValue(choice: OrganisationAutocompleteChoice): Choice {
    return {
        existingId: choice.existingId,
        value: choice.existingId || choice.name,
        label: choice.name
    };
}

export default function OrganisationAutocomplete(props: Props) {
    const query: (term: string) => Promise<Choice[]> = debouncePromise(
        async (term: string) => {
            const apiResult = await autocompletePublishers({}, term);

            return apiResult.options.map(option => ({
                existingId: option.identifier,
                value: option.identifier,
                label: option.value
            }));
        },
        200
    );

    return (
        <ASyncCreatableSelectWithValidation
            className="react-select"
            isMulti={props.multi}
            isSearchable={true}
            onChange={(rawValue, action) => {
                if (!rawValue) {
                    props.onOrgSelected(undefined);
                } else if (props.multi) {
                    props.onOrgSelected(
                        (rawValue as Choice[]).map(fromReactSelect)
                    );
                } else {
                    props.onOrgSelected(fromReactSelect(rawValue as Choice));
                }
            }}
            value={
                props.value
                    ? props.multi
                        ? props.value!.map(toReactSelectValue)
                        : toReactSelectValue(props.value!)
                    : props.value
            }
            loadOptions={query}
            placeholder="Search for an organisation"
            validationFieldPath={props.validationFieldPath}
            validationFieldLabel={props.validationFieldLabel}
        />
    );
}
