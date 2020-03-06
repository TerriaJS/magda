import React from "react";
import "./StorageOptionsSection.scss";
import { Distribution } from "./DatasetAddCommon";

import ToolTip from "./ToolTip";
import { AlwaysEditor } from "Components/Editing/AlwaysEditor";
import { codelistRadioEditor } from "Components/Editing/Editors/codelistEditor";
import AccessLocationAutoComplete from "./Pages/DatasetAddAccessAndUsePage/AccessLocationAutoComplete";

type Props = {
    shouldUploadToStorageApi: boolean;
    setShouldUploadToStorageApi: (uploadToStorageApi: boolean) => void;
    dataAccessLocation: string;
    setDataAccessLocation: (location: string) => void;
    files: Distribution[];
};

const StorageOptionsSection = (props: Props) => {
    const shouldDisableInput = props.files.length > 0 ? true : false;

    return (
        <div className="row storage-options-section">
            <div className="col-sm-12">
                <div className="storage-option-heading">
                    Would you like a copy of the files in this dataset to be
                    stored by Magda?
                </div>
                <ToolTip>
                    Select yes if you would like to store a copy of this file on
                    Magda’s servers. This will allow your users to download the
                    file directly from Magda without having to locate the file
                    on your internal storage system or shared drive .{" "}
                </ToolTip>

                <div className="storage-option-input-area">
                    {shouldDisableInput ? (
                        <div className="tooltip-container">
                            <div className="triangle">&nbsp;</div>
                            <div>
                                All files must be deleted in order to change
                                whether they should be uploaded or not.
                            </div>
                        </div>
                    ) : null}
                    <AlwaysEditor
                        value={
                            props.shouldUploadToStorageApi ? "true" : "false"
                        }
                        onChange={value =>
                            props.setShouldUploadToStorageApi(
                                value === "true" ? true : false
                            )
                        }
                        editor={codelistRadioEditor(
                            "file-storage-option-selection",
                            {
                                true: "Yes, store a copy of this file on Magda",
                                false:
                                    "No, I want to use my existing shared drive or storage systems"
                            },
                            false,
                            shouldDisableInput
                        )}
                    />
                </div>

                {props.shouldUploadToStorageApi ? null : (
                    <div className="access-location-area">
                        <div className="access-location-heading">
                            What internal storage location can internal users
                            access the dataset files from?
                        </div>
                        <ToolTip>
                            Select the best location for this file based on its
                            contents and your organisation file structure. You
                            can choose from a number of pre-defined file storage
                            locations. If these are inaccurate, please contact
                            your system administrator
                        </ToolTip>

                        <AccessLocationAutoComplete
                            placeholder="Start typing a file location name..."
                            defaultValue={props.dataAccessLocation}
                            onChange={props.setDataAccessLocation}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageOptionsSection;
