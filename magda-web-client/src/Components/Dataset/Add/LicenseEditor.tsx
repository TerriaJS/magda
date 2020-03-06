import React from "react";
import { AlwaysEditor } from "Components/Editing/AlwaysEditor";
import { textEditorEx } from "Components/Editing/Editors/textEditor";
import * as codelists from "constants/DatasetConstants";
import ReactSelectOriginal from "react-select";
import ValidationHoc from "Components/Common/react-select/ValidationHoc";
import "./LicenseEditor.scss";

//--- Added Validation Support to ReactSelect
const ReactSelect = ValidationHoc(ReactSelectOriginal);

type Props = {
    value: string;
    onChange: (newLicense: string) => void;
    validationFieldPath?: string;
    validationFieldLabel?: string;
};

function isCustom(license: string) {
    return (
        license === "custom" ||
        Object.keys(codelists.licenseLevel).indexOf(license) === -1
    );
}

/**
 * Figure out custom license text box status from props.value
 * avoid using derived state to avoid inconsistent state
 */
export default function LicenseEditor({
    value: license,
    onChange,
    validationFieldPath,
    validationFieldLabel
}: Props) {
    const usingCustomLicense = isCustom(license);

    return (
        <div className="license-editor">
            <ReactSelect
                className="license-apply-type-select"
                isSearchable={false}
                menuPortalTarget={document.body}
                options={
                    Object.keys(codelists.licenseLevel).map(key => ({
                        label: codelists.licenseLevel[key],
                        value: key
                    })) as any
                }
                value={
                    license && codelists.licenseLevel[license]
                        ? {
                              label: codelists.licenseLevel[license],
                              value: license
                          }
                        : {
                              label: codelists.licenseLevel["custom"],
                              value: "custom"
                          }
                }
                onChange={(item: any) => {
                    onChange(item.value === "custom" ? "" : item.value);
                }}
            />
            {usingCustomLicense && (
                <div>
                    <AlwaysEditor
                        validationFieldPath={validationFieldPath}
                        validationFieldLabel={validationFieldLabel}
                        value={license}
                        onChange={newLicense => onChange(newLicense!)}
                        editor={textEditorEx({
                            placeholder: "Please specify a licence"
                        })}
                    />
                </div>
            )}
        </div>
    );
}
