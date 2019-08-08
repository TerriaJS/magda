import React from "react";

import { AlwaysEditor } from "Components/Editing/AlwaysEditor";
import {
    multilineTextEditor,
    multiTextEditorEx
} from "Components/Editing/Editors/textEditor";
import { codelistRadioEditor } from "Components/Editing/Editors/codelistEditor";
import * as codelists from "constants/DatasetConstants";
import {
    Dataset,
    DatasetPublishing
} from "Components/Dataset/Add/DatasetAddCommon";
import OrganisationAutoComplete from "./OrganisationAutocomplete";
import OrgUnitDropdown from "./OrgUnitDropdown";

function YesNoEditReveal(props) {
    const yes = !!props.value;
    const name = Math.random() + "";
    const yesOpts: any = {
        name,
        value: "yes"
    };
    const noOpts: any = { name, value: "no" };
    if (yes) {
        yesOpts.checked = "checked";
    } else {
        noOpts.checked = true;
    }
    yesOpts.onChange = noOpts.onChange = e => {
        if (e.target.value === "yes") {
            props.onChange(props.defaultValue);
        } else {
            props.onChange(props.nullValue);
        }
    };
    return (
        <div>
            <div>
                <div className="au-control-input">
                    <input
                        className="au-control-input__input"
                        type="radio"
                        id={name + "-no"}
                        {...noOpts}
                    />
                    <label
                        htmlFor={name + "-no"}
                        className="au-control-input__text"
                    >
                        No
                    </label>
                </div>
            </div>
            <div>
                <div className="au-control-input">
                    <input
                        className="au-control-input__input"
                        type="radio"
                        id={name + "-yes"}
                        {...yesOpts}
                    />
                    <label
                        className="au-control-input__text"
                        htmlFor={name + "-yes"}
                    >
                        Yes
                    </label>
                </div>
            </div>
            {yes && props.children}
        </div>
    );
}

type Props = {
    edit: (aspectField: string) => (field: string) => (newValue: any) => void;
    dataset: Dataset;
    publishing: DatasetPublishing;
};

export default function DatasetAddPeoplePage(props: Props) {
    const { dataset } = props;

    const editDataset = props.edit("dataset");
    const editPublishing = props.edit("datasetPublishing");

    return (
        <div className="row people-and-production-page">
            <div className="col-sm-12">
                <h2>People and production</h2>
                <hr />
                <h3>People</h3>
                <h4>
                    Which organisation is responsible for publishing this
                    dataset?
                </h4>
                <div>
                    <OrganisationAutoComplete
                        defaultValue={dataset.publisher}
                        onOrgSelected={editDataset("publisher")}
                    />
                </div>
                <h4>Which team is responsible for maintaining this dataset?</h4>
                <div>
                    <OrgUnitDropdown
                        orgUnitId={dataset.owningOrgUnitId}
                        onChange={editDataset("owningOrgUnitId")}
                    />
                </div>
                <h4>
                    How should the contact point(s) be referenced in the
                    metadata?
                </h4>
                <div>
                    <AlwaysEditor
                        value={props.publishing.contactPointDisplay}
                        onChange={editPublishing("contactPointDisplay")}
                        editor={codelistRadioEditor(
                            "dataset-contact-point-display",
                            codelists.contactPointDisplay
                        )}
                    />
                </div>
                <hr />
                <h3>Production</h3>
                <h4>
                    Was this dataset produced in collaboration with with other
                    organisations?
                </h4>
                <div>
                    <YesNoEditReveal
                        value={dataset.creation_affiliatedOrganisation}
                        defaultValue={[]}
                        nullValue={null}
                        onChange={editDataset(
                            "creation_affiliatedOrganisation"
                        )}
                    >
                        <AlwaysEditor
                            value={dataset.creation_affiliatedOrganisation}
                            onChange={editDataset(
                                "creation_affiliatedOrganisation"
                            )}
                            editor={multiTextEditorEx({
                                placeholder: "Add an organisation"
                            })}
                        />
                    </YesNoEditReveal>
                </div>
                <h4>How was the dataset produced?</h4>
                <div>
                    <AlwaysEditor
                        value={dataset.creation_mechanism}
                        onChange={editDataset("creation_mechanism")}
                        editor={multilineTextEditor}
                    />
                </div>
            </div>
        </div>
    );
}
