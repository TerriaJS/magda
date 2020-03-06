import React from "react";

import ToolTip from "Components/Dataset/Add/ToolTip";
import { AlwaysEditor } from "Components/Editing/AlwaysEditor";
import { codelistRadioEditor } from "Components/Editing/Editors/codelistEditor";
import LicenseEditor from "Components/Dataset/Add/LicenseEditor";

import { State } from "Components/Dataset/Add/DatasetAddCommon";
import * as codelists from "constants/DatasetConstants";

import { getFormatIcon } from "../../../View/DistributionIcon";
import helpIcon from "assets/help.svg";

import ReactSelectOriginal from "react-select";
import ValidationHoc from "Components/Common/react-select/ValidationHoc";
import PurpleToolTip from "Components/Common/TooltipWrapper";
import { config } from "config";

import ValidationRequiredLabel from "../../ValidationRequiredLabel";
import * as ValidationManager from "../../ValidationManager";
import { CustomValidatorType } from "../../ValidationManager";

import "./index.scss";

//--- Added Validation Support to ReactSelect
const ReactSelect = ValidationHoc(ReactSelectOriginal);

type Props = {
    edit: <K extends keyof State>(
        aspectField: K
    ) => (field: string) => (newValue: any) => void;
    editState: <K extends keyof State>(field: K) => (newValue: any) => void;
    editStateWithUpdater: (updater: (state: State) => void) => void;
    stateData: State;
};

const publishToDgaValidator: CustomValidatorType = (
    value,
    state,
    validationItem
) => {
    if (value !== true) {
        return {
            valid: true
        };
    }
    if (
        !ValidationManager.shouldValidate(
            "$.informationSecurity.classification"
        )
    ) {
        return {
            valid: true
        };
    }
    if (
        state.informationSecurity.classification &&
        state.informationSecurity.classification !== "UNOFFICIAL"
    ) {
        return {
            valid: false,
            validationMessage:
                "Validation Error: Only unofficial data can be published to data.gov.au. " +
                'Please update the "Publish to data.gov.au" or "Security classification" section accordingly.'
        };
    }
    return {
        valid: true
    };
};

const classificationValidator: CustomValidatorType = (
    value,
    state,
    validationItem
) => {
    if (
        !ValidationManager.shouldValidate(
            "$.datasetPublishing.publishAsOpenData.dga"
        )
    ) {
        // --- ask ValidationManager fall back to default validator (`isEmpty`)
        return {
            useDefaultValidator: true
        };
    }
    const result = publishToDgaValidator(
        state.datasetPublishing &&
            state.datasetPublishing.publishAsOpenData &&
            state.datasetPublishing.publishAsOpenData.dga,
        state,
        validationItem
    );
    if (result.valid === true) {
        // --- ask ValidationManager fall back to default validator (`isEmpty`)
        return {
            useDefaultValidator: true
        };
    } else {
        return result;
    }
};

export default function DatasetAddAccessAndUsePage(props: Props) {
    let {
        distributions,
        dataset,
        licenseLevel,
        datasetPublishing,
        informationSecurity
    } = props.stateData;

    const editDatasetPublishing = props.edit("datasetPublishing");
    const editInformationSecurity = props.edit("informationSecurity");
    const editPublishToDga = (shouldPublishToDga: string | undefined) => {
        props.editStateWithUpdater(state => ({
            ...state,
            datasetPublishing: {
                ...state.datasetPublishing,
                publishAsOpenData: {
                    ...(state.datasetPublishing.publishAsOpenData
                        ? state.datasetPublishing.publishAsOpenData
                        : {}),
                    dga: shouldPublishToDga === "true" ? true : false
                }
            }
        }));
    };

    const shouldPublishToDga: boolean = datasetPublishing.publishAsOpenData
        ? !!datasetPublishing.publishAsOpenData.dga
        : false;

    return (
        <div className="row dataset-access-and-use-page">
            <div className="col-sm-12">
                <h2>Access and Use</h2>
                <h3 className="with-underline">Sharing</h3>

                {config.featureFlags.publishToDga ? (
                    <div className="question-publish-to-dga">
                        <h4 className="with-icon">
                            <span>
                                Do you want to publish this dataset to{" "}
                                <a href="https://data.gov.au" target="__blank">
                                    data.gov.au
                                </a>{" "}
                                as open data? (*)
                            </span>
                            <span className="tooltip-container">
                                <PurpleToolTip
                                    className="tooltip no-print"
                                    launcher={() => (
                                        <div className="tooltip-launcher-icon help-icon">
                                            <img
                                                src={helpIcon}
                                                alt="Publish to data.gov.au, click for more information"
                                            />
                                        </div>
                                    )}
                                    innerElementClassName="inner"
                                >
                                    {() => (
                                        <>
                                            Publishing to data.gov.au will mean
                                            the dataset will be available
                                            publicly via the data.gov.au website
                                            as open data. Please ensure your
                                            dataset has the appropriate security
                                            classification and license if
                                            selecting Yes
                                        </>
                                    )}
                                </PurpleToolTip>
                            </span>
                        </h4>
                        <div className="input-area">
                            <AlwaysEditor
                                value={shouldPublishToDga ? "true" : "false"}
                                onChange={value => {
                                    editPublishToDga(value);
                                    if (
                                        ValidationManager.shouldValidate(
                                            "$.informationSecurity.classification"
                                        )
                                    ) {
                                        // --- trigger classifcation validtion as well
                                        setTimeout(() => {
                                            ValidationManager.onInputFocusOut(
                                                "$.informationSecurity.classification"
                                            );
                                        }, 1);
                                    }
                                }}
                                validationFieldPath="$.datasetPublishing.publishAsOpenData.dga"
                                validationFieldLabel="Publish as Open Data (data.gov.au)"
                                customValidator={publishToDgaValidator}
                                editor={codelistRadioEditor(
                                    "dataset-publishing-as-open-data",
                                    {
                                        true:
                                            "Yes, publish this as open data to data.gov.au",
                                        false:
                                            "No, share it internally within my organisation only"
                                    }
                                )}
                            />
                        </div>
                    </div>
                ) : null}

                <div className="question-who-can-see-dataset">
                    <h4 className="with-icon">
                        <span>
                            Who can see the dataset once it is published?
                        </span>
                    </h4>
                    <div className="input-area">
                        <ToolTip>
                            We recommend you publish your data to everyone in
                            your organisation to help prevent data silos.
                        </ToolTip>
                        <div>
                            <AlwaysEditor
                                value={datasetPublishing.level}
                                onChange={editDatasetPublishing("level")}
                                editor={codelistRadioEditor(
                                    "dataset-publishing-level",
                                    codelists.publishingLevel
                                )}
                            />
                        </div>
                    </div>
                </div>

                <h3 className="with-underline">Dataset use</h3>

                {distributions.length !== 0 && (
                    <div className="question-license-apply-type">
                        <h4>
                            What type of licence should be applied to these
                            distributions?
                        </h4>

                        <ToolTip>
                            By default, Magda adds Licenses at the Dataset Level
                            (i.e. to all distributions), but this can be
                            overriden to apply at a Distribution (each file or
                            URL) level if desired.
                        </ToolTip>

                        <div className="row">
                            <div className="col-sm-4">
                                <ReactSelect
                                    validationFieldPath="$.licenseLevel"
                                    validationFieldLabel="Licence Type"
                                    className="license-apply-type-select"
                                    isSearchable={false}
                                    options={
                                        Object.keys(
                                            codelists.datasetLicenseLevel
                                        ).map(key => ({
                                            label:
                                                codelists.datasetLicenseLevel[
                                                    key
                                                ],
                                            value: key
                                        })) as any
                                    }
                                    value={
                                        licenseLevel
                                            ? {
                                                  label:
                                                      codelists
                                                          .datasetLicenseLevel[
                                                          licenseLevel
                                                      ],
                                                  value: licenseLevel
                                              }
                                            : null
                                    }
                                    onChange={(item: any) =>
                                        props.editState("licenseLevel")(
                                            item.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="question-license-restriction-type">
                    <h4>
                        What licence restrictions should be applied?
                        <ValidationRequiredLabel validationFieldPath="$.dataset.defaultLicense" />
                    </h4>
                    <ToolTip>
                        We recommend a Whole of Government Licence be applied to
                        encourage inter-department data sharing in the future.
                    </ToolTip>
                    {licenseLevel === "dataset" ? (
                        <div className="license-dataset-option-container row">
                            <div className="col-sm-6">
                                <LicenseEditor
                                    validationFieldPath="$.dataset.defaultLicense"
                                    validationFieldLabel="Dataset Level Licence"
                                    value={dataset.defaultLicense || ""}
                                    onChange={license => {
                                        props.editState("dataset")({
                                            ...dataset,
                                            defaultLicense: license
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="license-distribution-option-container">
                            {distributions.map((file, fileIndex) => {
                                const edit = field => value => {
                                    file[field] = value;
                                    props.editState("distributions")(
                                        distributions
                                    );
                                };
                                return (
                                    <div className="fileBlock">
                                        <div className="fileBlock-file">
                                            <span className="fileBlock-icon">
                                                <img
                                                    className="file-icon"
                                                    src={getFormatIcon(file)}
                                                />
                                            </span>
                                            <span className="fileBlock-text">
                                                {file.title}
                                            </span>
                                        </div>
                                        <div className="fileBlock-control">
                                            <LicenseEditor
                                                validationFieldPath={`$.distributions[${fileIndex}].license`}
                                                validationFieldLabel="Distribution Licence"
                                                value={file.license || ""}
                                                onChange={edit("license")}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="question-security-classification">
                    <h4>
                        <span>
                            What is the sensitivity or security classification
                            of this dataset?
                            <ValidationRequiredLabel validationFieldPath="$.informationSecurity.classification" />
                        </span>
                        <span className="tooltip-container">
                            <PurpleToolTip
                                className="tooltip no-print"
                                launcher={() => (
                                    <div className="tooltip-launcher-icon help-icon">
                                        <img
                                            src={helpIcon}
                                            alt="Security classifications, click for more information"
                                        />
                                    </div>
                                )}
                                innerElementClassName="inner"
                            >
                                {() => (
                                    <>
                                        Magda security classification refers to
                                        the Attorney-General Department’s
                                        Sensitive and Classification policy. It
                                        is important that the appropriate
                                        security classification level is
                                        selected to protect the confidentiality,
                                        integrity and availability of the data.
                                        The framework is as follows:{" "}
                                        <a
                                            target="_blank"
                                            href="/page/security-classification"
                                        >
                                            {config.baseExternalUrl}
                                            page/security-classification
                                        </a>
                                    </>
                                )}
                            </PurpleToolTip>
                        </span>
                    </h4>
                    <div className="row">
                        <div className="col-sm-6">
                            <ReactSelect
                                validationFieldPath="$.informationSecurity.classification"
                                validationFieldLabel="Dataset Sensitivity or Security Classification"
                                customValidator={classificationValidator}
                                isSearchable={false}
                                options={
                                    Object.keys(codelists.classification).map(
                                        key => ({
                                            label:
                                                codelists.classification[key],
                                            value: key
                                        })
                                    ) as any
                                }
                                value={
                                    informationSecurity.classification
                                        ? {
                                              label:
                                                  codelists.classification[
                                                      informationSecurity
                                                          .classification
                                                  ],
                                              value:
                                                  informationSecurity.classification
                                          }
                                        : null
                                }
                                onChange={(item: any) => {
                                    editInformationSecurity("classification")(
                                        item.value
                                    );
                                    if (
                                        ValidationManager.shouldValidate(
                                            "$.datasetPublishing.publishAsOpenData.dga"
                                        )
                                    ) {
                                        // --- trigger publish to dga validtion as well
                                        setTimeout(() => {
                                            ValidationManager.onInputFocusOut(
                                                "$.datasetPublishing.publishAsOpenData.dga"
                                            );
                                        }, 1);
                                    }
                                }}
                            />
                        </div>
                    </div>
                    {informationSecurity.classification === "PROTECTED" ? (
                        <div className="row">
                            <div className="col-sm-12">
                                <div className="au-page-alerts au-page-alerts--warning">
                                    <div>
                                        Protected datasets must be stored within
                                        the Protected Enclave
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    {informationSecurity.classification === "SECRET" ||
                    informationSecurity.classification === "TOP SECRET" ? (
                        <div className="row">
                            <div className="col-sm-12">
                                <div className="au-page-alerts au-page-alerts--warning">
                                    <div>
                                        Secret or Top Secret classified data
                                        must not be stored on any departmental
                                        network, and must be managed as a
                                        physical asset
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
                {informationSecurity.classification === "OFFICIAL:SENSITIVE" ? (
                    <div className="question-sensitivity">
                        <h4>
                            <span>
                                What sensitivity markers should be added to this
                                dataset?
                                <ValidationRequiredLabel validationFieldPath="$.informationSecurity.disseminationLimits" />
                            </span>
                            <span className="tooltip-container">
                                <PurpleToolTip
                                    className="tooltip no-print"
                                    launcher={() => (
                                        <div className="tooltip-launcher-icon help-icon">
                                            <img
                                                src={helpIcon}
                                                alt="Security classifications, click for more information"
                                            />
                                        </div>
                                    )}
                                    innerElementClassName="inner"
                                >
                                    {() => (
                                        <>
                                            Visit this page for more detail on
                                            Access Restrictions - Information
                                            Management Markers:{" "}
                                            <a
                                                target="_blank"
                                                href="https://www.protectivesecurity.gov.au/information/sensitive-classified-information/Pages/default.aspx"
                                            >
                                                https://www.protectivesecurity.gov.au/information/sensitive-classified-information/Pages/default.aspx
                                            </a>
                                        </>
                                    )}
                                </PurpleToolTip>
                            </span>
                        </h4>
                        <div className="row">
                            <div className="col-sm-8">
                                <ReactSelect
                                    validationFieldPath="$.informationSecurity.disseminationLimits"
                                    validationFieldLabel="Dataset Sensitivity Markers"
                                    isSearchable={false}
                                    isMulti={true}
                                    options={
                                        Object.keys(
                                            codelists.disseminationLimits
                                        ).map(key => ({
                                            label:
                                                codelists.disseminationLimits[
                                                    key
                                                ],
                                            value: key
                                        })) as any
                                    }
                                    value={
                                        informationSecurity.disseminationLimits &&
                                        informationSecurity.disseminationLimits
                                            .length
                                            ? informationSecurity.disseminationLimits.map(
                                                  item => ({
                                                      label:
                                                          codelists
                                                              .disseminationLimits[
                                                              item
                                                          ],
                                                      value: item
                                                  })
                                              )
                                            : []
                                    }
                                    onChange={(items: any) =>
                                        editInformationSecurity(
                                            "disseminationLimits"
                                        )(items.map(item => item.value))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
