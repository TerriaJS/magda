import React from "react";
import { withRouter } from "react-router";
import uuidv4 from "uuid/v4";
import { MultilineTextEditor } from "Components/Editing/Editors/textEditor";

import ToolTip from "Components/Dataset/Add/ToolTip";

import {
    createRecord,
    createNewDatasetReset,
    createNewDatasetError
} from "actions/recordActions";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";

import { Steps as ProgressMeterStepsConfig } from "../../Common/AddDatasetProgressMeter";

import {
    State,
    saveState,
    OrganisationAutocompleteChoice,
    createId,
    DatasetAutocompleteChoice,
    Dataset
} from "./DatasetAddCommon";
import DetailsAndContents from "./Pages/DetailsAndContents";
import DatasetAddPeoplePage from "./Pages/People/DatasetAddPeoplePage";
import DatasetAddEndPreviewPage from "./Pages/DatasetAddEndPreviewPage";
import { createPublisher, ensureAspectExists } from "api-clients/RegistryApis";
import DatasetAddAccessAndUsePage from "./Pages/DatasetAddAccessAndUsePage";
import withAddDatasetState from "./withAddDatasetState";
import { config } from "config";

import datasetPublishingAspect from "@magda/registry-aspects/publishing.schema.json";
import dcatDatasetStringsAspect from "@magda/registry-aspects/dcat-dataset-strings.schema.json";
import spatialCoverageAspect from "@magda/registry-aspects/spatial-coverage.schema.json";
import temporalCoverageAspect from "@magda/registry-aspects/temporal-coverage.schema.json";
import datasetDistributionsAspect from "@magda/registry-aspects/dataset-distributions.schema.json";
import dcatDistributionStringsAspect from "@magda/registry-aspects/dcat-distribution-strings.schema.json";
import accessAspect from "@magda/registry-aspects/access.schema.json";
import provenanceAspect from "@magda/registry-aspects/provenance.schema.json";
import informationSecurityAspect from "@magda/registry-aspects/information-security.schema.json";
import datasetAccessControlAspect from "@magda/registry-aspects/dataset-access-control.schema.json";
import organizationDetailsAspect from "@magda/registry-aspects/organization-details.schema.json";
import datasetPublisherAspect from "@magda/registry-aspects/dataset-publisher.schema.json";
import currencyAspect from "@magda/registry-aspects/currency.schema.json";

import "./DatasetAddMetadataPage.scss";
import "./DatasetAddFilesPage.scss";
import "./DatasetAddCommon.scss";
import { autocompletePublishers } from "api-clients/SearchApis";

import ReviewFilesList from "./ReviewFilesList";

import ErrorMessageBox from "./ErrorMessageBox";

import helpIcon from "assets/help.svg";
import { User } from "reducers/userManagementReducer";
import * as ValidationManager from "../Add/ValidationManager";

const aspects = {
    publishing: datasetPublishingAspect,
    "dcat-dataset-strings": dcatDatasetStringsAspect,
    "spatial-coverage": spatialCoverageAspect,
    "temporal-coverage": temporalCoverageAspect,
    "dataset-distributions": datasetDistributionsAspect,
    "dcat-distribution-strings": dcatDistributionStringsAspect,
    access: accessAspect,
    provenance: provenanceAspect,
    "information-security": informationSecurityAspect,
    "dataset-access-control": datasetAccessControlAspect,
    "dataset-publisher": datasetPublisherAspect,
    currency: currencyAspect
};

type Props = {
    initialState: State;
    createRecord: Function;
    createNewDatasetReset: Function;
    createNewDatasetError: Function;
    isCreating: boolean;
    creationError: any;
    lastDatasetId: string;
    step: number;
    datasetId: string;
    isNewDataset: boolean;
    history: any;
    user: User;
};

class NewDataset extends React.Component<Props, State> {
    state: State = this.props.initialState;

    constructor(props) {
        super(props);
        ValidationManager.setStateDataGetter(() => {
            return this.state;
        });
    }

    componentDidMount() {
        if (this.props.isNewDataset) {
            this.props.history.replace(
                `/dataset/add/metadata/${this.props.datasetId}/${
                    this.props.step
                }`
            );
        }
    }

    steps: any = [
        () => (
            <DetailsAndContents
                edit={this.edit}
                setState={this.setState.bind(this)}
                stateData={this.state}
                user={this.props.user}
            />
        ),
        () => (
            <DatasetAddPeoplePage
                edit={this.edit}
                dataset={this.state.dataset}
                publishing={this.state.datasetPublishing}
                provenance={this.state.provenance}
                user={this.props.user}
            />
        ),
        () => (
            <DatasetAddAccessAndUsePage
                edit={this.edit}
                editState={this.editState}
                stateData={this.state}
                editStateWithUpdater={this.setState.bind(this)}
            />
        ),
        config.featureFlags.previewAddDataset
            ? () => <DatasetAddEndPreviewPage />
            : this.renderSubmitPage.bind(this)
    ];

    edit = <K extends keyof State>(aspectField: K) => (field: string) => (
        newValue: any
    ) => {
        this.setState((state: any) => {
            return {
                [aspectField]: { ...state[aspectField], [field]: newValue }
            } as Pick<State, K>;
        });
    };

    editState = <K extends keyof State>(field: K) => (newValue: any) => {
        this.setState({ [field]: newValue } as Pick<State, K>);
    };

    render() {
        const { distributions } = this.state;

        let { step } = this.props;

        step = Math.max(Math.min(step, this.steps.length - 1), 0);

        const nextIsPublish = step + 1 >= this.steps.length;

        const nextButtonCaption = () => {
            if (nextIsPublish) {
                if (config.featureFlags.previewAddDataset) {
                    return "Send Us Your Thoughts";
                } else if (this.state.isPublishing) {
                    return "Publishing as draft...";
                } else {
                    return "Publish draft dataset";
                }
            } else {
                return ProgressMeterStepsConfig[step + 2].title;
            }
        };

        const nextButtonOnClick = () => {
            if (nextIsPublish) {
                if (config.featureFlags.previewAddDataset) {
                    window.location.href =
                        "mailto:magda@csiro.au?subject=Add Dataset Feedback";
                } else {
                    this.performPublishDataset();
                }
            } else {
                this.gotoStep(step + 1);
            }
        };

        return (
            <div className="dataset-add-files-root dataset-add-meta-data-pages">
                <div className="row">
                    <div className="col-sm-12">
                        <ReviewFilesList
                            key={step}
                            files={distributions}
                            isOpen={step < 1 ? true : false}
                        />
                    </div>
                </div>
                {this.steps[step]()}
                <br />
                <br />
                <ErrorMessageBox />
                <br />
                <div className="row next-save-button-row">
                    <div className="col-sm-12">
                        <button
                            className="au-btn next-button"
                            onClick={nextButtonOnClick}
                        >
                            Next: {nextButtonCaption()}
                        </button>
                        <button
                            className="au-btn au-btn--secondary save-button"
                            onClick={this.saveAndExit.bind(this)}
                        >
                            Save and exit
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    resetError() {
        this.props.createNewDatasetReset();
    }

    async saveAndExit() {
        try {
            await this.resetError();
            saveState(this.state, this.props.datasetId);
            this.props.history.push(`/dataset/list`);
        } catch (e) {
            this.props.createNewDatasetError(e);
        }
    }

    async gotoStep(step) {
        try {
            await this.resetError();
            if (ValidationManager.validateAll()) {
                saveState(this.state, this.props.datasetId);
                this.props.history.push(
                    "../" + this.props.datasetId + "/" + step
                );
            }
        } catch (e) {
            this.props.createNewDatasetError(e);
        }
    }

    renderSubmitPage() {
        const { datasetPublishing } = this.state;
        return (
            <div className="row dataset-submit-page">
                <div className="col-sm-12">
                    <h2 className="with-underline">
                        Additional notes or comments
                    </h2>
                    <h3>
                        Optional space to leave a note for the dataset Approver
                    </h3>
                    <ToolTip icon={helpIcon}>
                        Leave any additional comments you feel are relevant to
                        this dataset
                    </ToolTip>
                    <div>
                        <MultilineTextEditor
                            value={datasetPublishing.notesToApprover}
                            placeholder="Enter additional notes"
                            onChange={this.edit("datasetPublishing")(
                                "notesToApprover"
                            )}
                        />
                    </div>
                </div>
            </div>
        );
    }

    async performPublishDataset() {
        try {
            await this.resetError();

            await this.publishDataset();
            this.props.history.push(`/dataset/${this.props.lastDatasetId}`);
        } catch (e) {
            this.setState({
                isPublishing: false
            });
            this.props.createNewDatasetError(e);
        }
    }

    async publishDataset() {
        saveState(this.state, this.props.datasetId);

        const {
            dataset,
            datasetPublishing,
            spatialCoverage,
            temporalCoverage,
            distributions,
            licenseLevel,
            informationSecurity,
            datasetAccess,
            provenance,
            currency
        } = this.state;

        this.setState({
            isPublishing: true
        });

        let publisherId;
        if (dataset.publisher) {
            publisherId = await getOrgIdFromAutocompleteChoice(
                dataset.publisher
            );
            this.edit("dataset")("publisher")({
                name: dataset.publisher.name,
                publisherId
            });
        }

        const inputDistributions = distributions.map(distribution => {
            const aspect =
                licenseLevel === "dataset"
                    ? {
                          ...distribution,
                          license: dataset.defaultLicense
                      }
                    : distribution;

            return {
                id: createId("dist"),
                name: distribution.title,
                aspects: {
                    "dcat-distribution-strings": aspect
                }
            };
        });

        const preProcessDatasetAutocompleteChoices = (
            choices?: DatasetAutocompleteChoice[]
        ) =>
            choices &&
            choices.map(choice => ({
                id: choice.existingId ? [choice.existingId] : undefined,
                name: !choice.existingId ? choice.name : undefined
            }));

        const inputDataset = {
            id: this.props.datasetId,
            name: dataset.title,
            aspects: {
                publishing: datasetPublishing,
                "dcat-dataset-strings": buildDcatDatasetStrings(dataset),
                "spatial-coverage": spatialCoverage,
                "temporal-coverage": temporalCoverage,
                "dataset-distributions": {
                    distributions: inputDistributions.map(d => d.id)
                },
                access: datasetAccess,
                "information-security": informationSecurity,
                "dataset-access-control": {
                    orgUnitOwnerId: dataset.owningOrgUnitId,
                    custodianOrgUnitId: dataset.custodianOrgUnitId
                },
                currency: {
                    ...currency,
                    supersededBy:
                        currency.status === "SUPERSEDED"
                            ? preProcessDatasetAutocompleteChoices(
                                  currency.supersededBy
                              )
                            : undefined,
                    retireReason:
                        currency.status === "RETIRED"
                            ? currency.retireReason
                            : undefined
                },
                provenance: {
                    mechanism: provenance.mechanism,
                    sourceSystem: provenance.sourceSystem,
                    derivedFrom: preProcessDatasetAutocompleteChoices(
                        provenance.derivedFrom
                    ),
                    affiliatedOrganizationIds:
                        provenance.affiliatedOrganizations &&
                        (await Promise.all(
                            provenance.affiliatedOrganizations.map(org =>
                                getOrgIdFromAutocompleteChoice(org)
                            )
                        )),
                    isOpenData: provenance.isOpenData
                },
                "dataset-publisher": publisherId && {
                    publisher: publisherId
                }
            }
        };

        if (!inputDataset.aspects["dataset-access-control"].orgUnitOwnerId) {
            delete inputDataset.aspects["dataset-access-control"];
        }

        await this.props.createRecord(
            inputDataset,
            inputDistributions,
            aspects
        );
    }
}

async function getOrgIdFromAutocompleteChoice(
    organization: OrganisationAutocompleteChoice
) {
    let orgId: string;
    if (!organization.existingId) {
        // Do a last check to make sure the publisher really doesn't exist
        const existingPublishers = await autocompletePublishers(
            {},
            organization.name
        );

        const match = existingPublishers.options.find(
            publisher =>
                publisher.value.toLowerCase().trim() ===
                organization!.name.toLowerCase().trim()
        );

        if (!match) {
            // OK no publisher, lets add it
            await ensureAspectExists(
                "organization-details",
                organizationDetailsAspect
            );

            orgId = uuidv4();
            await createPublisher({
                id: orgId,
                name: organization.name,
                aspects: {
                    "organization-details": {
                        name: organization.name,
                        title: organization.name,
                        imageUrl: "",
                        description: "Added manually during dataset creation"
                    }
                }
            });
        } else {
            orgId = match.identifier;
        }
    } else {
        orgId = organization.existingId;
    }

    return orgId;
}

function mapStateToProps(state, old) {
    let datasetId = old.match.params.dataset;
    let isNewDataset = false;
    if (!datasetId || datasetId === "-") {
        datasetId = "dataset-" + uuidv4();
        isNewDataset = true;
    }
    const step = parseInt(old.match.params.step);
    const isCreating =
        state.record.newDataset && state.record.newDataset.isCreating;
    const creationError =
        state.record.newDataset && state.record.newDataset.error;
    const lastDatasetId =
        !isCreating &&
        state.record.newDataset &&
        state.record.newDataset.dataset &&
        state.record.newDataset.dataset.id;
    return {
        datasetId,
        isNewDataset,
        step,
        isCreating,
        creationError,
        lastDatasetId
    };
}

const mapDispatchToProps = dispatch => {
    return bindActionCreators(
        {
            createRecord: createRecord,
            createNewDatasetReset: createNewDatasetReset,
            createNewDatasetError: createNewDatasetError
        },
        dispatch
    );
};

export default withAddDatasetState(
    withRouter(
        connect(
            mapStateToProps,
            mapDispatchToProps
        )(NewDataset)
    )
);

function buildDcatDatasetStrings(value: Dataset) {
    return {
        title: value.title,
        description: value.description,
        issued: value.issued && value.issued.toISOString(),
        modified: value.modified && value.modified.toISOString(),
        languages: value.languages,
        publisher: value.publisher && value.publisher.name,
        accrualPeriodicity: value.accrualPeriodicity,
        themes: value.themes && value.themes.keywords,
        keywords: value.keywords && value.keywords.keywords,
        defaultLicense: value.defaultLicense
    };
}
