import React from "react";
import { connect } from "react-redux";
import { withRouter, RouterProps } from "react-router";
import FileDrop from "react-file-drop";

import ToolTip from "Components/Dataset/Add/ToolTip";
import DatasetFile from "Components/Dataset/Add/DatasetFile";
import AddDatasetLinkSection from "Components/Dataset/Add/AddDatasetLinkSection";
import StorageOptionsSection from "Components/Dataset/Add/StorageOptionsSection";

import { getFiles } from "helpers/readFile";

import {
    State,
    Distribution,
    DistributionState,
    DistributionSource,
    saveState,
    KeywordsLike
} from "./DatasetAddCommon";
import withAddDatasetState from "./withAddDatasetState";
import uniq from "lodash/uniq";
import * as ValidationManager from "../Add/ValidationManager";
import { config } from "config";

import "./DatasetAddFilesPage.scss";
import "./DatasetAddCommon.scss";

class DatasetAddFilesPage extends React.Component<
    { dataset: string; initialState: State } & RouterProps,
    State
> {
    state = this.props.initialState;

    constructor(props) {
        super(props);
        this.addDistribution = this.addDistribution.bind(this);
        this.editDistribution = this.editDistribution.bind(this);
        this.deleteDistribution = this.deleteDistribution.bind(this);
        ValidationManager.setStateDataGetter(() => {
            return this.state;
        });
    }

    async onBrowse() {
        this.addFiles(await getFiles("*.*"));
    }

    async onDrop(fileList: FileList | null, event: any) {
        if (fileList) this.addFiles(fileList, event);
    }

    updateLastModifyDate() {
        this.setState(state => {
            const modifiedDates = state.distributions
                .filter(f => f.modified)
                .map(f => new Date(f.modified))
                .filter(d => !isNaN(d.getTime()))
                .map(d => d.getTime())
                .sort((a, b) => b - a);
            return {
                ...state,
                dataset: {
                    ...state.dataset,
                    modified: modifiedDates.length
                        ? new Date(modifiedDates[0])
                        : new Date()
                }
            };
        });
    }

    private isDirItem(idx: number, event: any) {
        try {
            if (!event) return false;
            // --- access web browser raw API to test whether it's a directory
            const rawItem = event.dataTransfer.items[idx];
            // --- test `getAsEntry` first as it could be the future standard
            const rawEntry = rawItem.getAsEntry
                ? rawItem.getAsEntry()
                : rawItem.webkitGetAsEntry();
            if (rawEntry.isFile === false || rawEntry.isDirectory === true)
                return true;
            else return false;
        } catch (e) {
            // --- If the API is not supported, the web browser must not support drop a directory
            return false;
        }
    }

    addFiles = async (fileList: FileList, event: any = null) => {
        for (let i = 0; i < fileList.length; i++) {
            const thisFile = fileList.item(i);

            if (!thisFile || this.isDirItem(i, event)) {
                // --- skip the directory item
                continue;
            }

            const newFile: Distribution = {
                datasetTitle: toTitleCase(
                    turnPunctuationToSpaces(
                        trimExtension(thisFile.name || "File Name")
                    )
                ).trim(),
                title: thisFile.name,
                byteSize: thisFile.size,
                modified: new Date(thisFile.lastModified),
                format: fileFormat(thisFile),
                _state: DistributionState.Added,
                license: "world",
                creationSource: DistributionSource.File
            };

            processFile(thisFile, update => {
                this.setState(state => {
                    let newState: State = Object.assign({}, state, {
                        distributions: state.distributions.slice(0)
                    });
                    Object.assign(newFile, update);
                    return newState;
                });
            }).then(() => {
                this.setState(state => {
                    let newState = Object.assign({}, state, {
                        distributions: state.distributions.slice(0)
                    });

                    let file: any = newFile;
                    const {
                        dataset,
                        temporalCoverage,
                        spatialCoverage
                    } = state;
                    for (const key in file) {
                        // these fields don't belong in a distribution
                        switch (key) {
                            case "datasetTitle":
                                if (
                                    !dataset["title"] ||
                                    dataset["title"] === ""
                                ) {
                                    dataset["title"] = file[key];
                                }
                                file[key] = undefined;
                                break;
                            case "keywords":
                            case "themes":
                                const existing = dataset[key]
                                    ? (dataset[key] as KeywordsLike)
                                    : {
                                          keywords: [],
                                          derived: false
                                      };
                                const fileKeywords: string[] = file[key] || [];

                                dataset[key] = {
                                    keywords: uniq(
                                        existing.keywords.concat(fileKeywords)
                                    ),
                                    derived:
                                        existing.derived ||
                                        fileKeywords.length > 0
                                };
                                file[key] = undefined;
                                break;
                            case "spatialCoverage":
                                Object.assign(spatialCoverage, file[key]);
                                file[key] = undefined;
                                break;
                            case "temporalCoverage":
                                temporalCoverage.intervals = temporalCoverage.intervals.concat(
                                    file[key].intervals
                                );
                                file[key] = undefined;
                                break;
                        }
                    }

                    if (
                        config.datasetThemes &&
                        config.datasetThemes.length &&
                        newState.dataset &&
                        newState.dataset.keywords &&
                        newState.dataset.keywords.keywords &&
                        newState.dataset.keywords.keywords.length
                    ) {
                        const keywords = newState.dataset.keywords.keywords.map(
                            item => item.toLowerCase()
                        );
                        const themesBasedOnKeywords = config.datasetThemes.filter(
                            theme =>
                                keywords.indexOf(theme.toLowerCase()) !== -1
                        );
                        if (themesBasedOnKeywords.length) {
                            const existingThemesKeywords = newState.dataset
                                .themes
                                ? newState.dataset.themes.keywords
                                : [];
                            newState.dataset.themes = {
                                keywords: themesBasedOnKeywords.concat(
                                    existingThemesKeywords
                                ),
                                derived: true
                            };
                        }
                    }

                    return newState;
                });
            });

            this.setState(state => {
                let newState = {
                    distributions: state.distributions.slice(0)
                };
                newState.distributions.push(newFile);
                return newState;
            });
        }
        this.updateLastModifyDate();
    };

    addDistribution = (distribution: Distribution) => {
        this.setState(state => {
            const newDistribution = state.distributions.concat(distribution);
            return {
                ...state,
                distributions: newDistribution
            };
        });
    };

    editDistribution = (index: number) => (
        updater: (distribution: Distribution) => Distribution
    ) => {
        this.setState(state => {
            const newDistributions = state.distributions.concat();
            newDistributions[index] = updater(newDistributions[index]);
            return {
                ...state,
                distributions: newDistributions
            };
        });
        this.updateLastModifyDate();
    };

    deleteDistribution = (index: number) => () => {
        this.setState(state => {
            const newDistributions = state.distributions.filter((item, idx) => {
                if (idx === index) return false;
                return true;
            });
            return {
                ...state,
                distributions: newDistributions
            };
        });
    };

    render() {
        const localFiles = this.state.distributions.filter(
            file => file.creationSource === DistributionSource.File
        );

        return (
            <div className="container-fluid dataset-add-file-page">
                <div className="row top-area-row">
                    <div className="col-xs-12 top-text-area">
                        <h1>Add your dataset to pre-populate metadata</h1>
                        <p>
                            Our Publishing Tool can review your dataset contents
                            and pre-populate metadata. Just add all the files or
                            services that make up your dataset.
                        </p>
                        <p>
                            You can upload your dataset as files, add a link to
                            files already hosted online, or add a link to a web
                            service, or any combination of the three.
                        </p>
                        <p>
                            All our processing happens in your internet browser,
                            we only store a copy of your files if you ask us to,
                            and you can edit or delete the metadata at any time.
                        </p>
                        <p>
                            Want to upload your entire data catalogue in one go?
                            Use our <a>Bulk Upload tool</a>
                        </p>
                    </div>
                </div>

                <div className="row add-files-heading">
                    <div className="col-xs-12">
                        <h3>Add files</h3>
                        <StorageOptionsSection
                            files={localFiles}
                            shouldUploadToStorageApi={
                                this.state.shouldUploadToStorageApi
                            }
                            setShouldUploadToStorageApi={value => {
                                this.setState(state => {
                                    const newState = {
                                        ...state,
                                        shouldUploadToStorageApi: value
                                    };
                                    if (value) {
                                        // --- delete dataset location data when upload to storage api is selected
                                        const {
                                            location: originalLocation,
                                            ...newDatasetAccess
                                        } = { ...state.datasetAccess };
                                        newState.datasetAccess = newDatasetAccess;
                                    }
                                    return newState;
                                });
                            }}
                            dataAccessLocation={
                                this.state.datasetAccess.location
                                    ? this.state.datasetAccess.location
                                    : ""
                            }
                            setDataAccessLocation={value =>
                                this.setState(state => ({
                                    ...state,
                                    datasetAccess: {
                                        ...state.datasetAccess,
                                        location: value
                                    }
                                }))
                            }
                        />
                    </div>

                    {localFiles.length > 0 && (
                        <div className="col-xs-12 tip-area">
                            <ToolTip>
                                We recommend ensuring dataset file names are
                                descriptive so users can easily understand the
                                contents.
                            </ToolTip>
                        </div>
                    )}
                </div>

                <div className="row files-area">
                    <div className="col-xs-12">
                        <div className="row">
                            {localFiles.map((file: Distribution, i) => {
                                let isLastRow;
                                if (localFiles.length % 2) {
                                    isLastRow = i >= localFiles.length - 1;
                                } else {
                                    isLastRow = i >= localFiles.length - 2;
                                }
                                return (
                                    <div
                                        key={i}
                                        className={`col-xs-6 dataset-add-files-fileListItem ${
                                            isLastRow ? "last-row" : ""
                                        }`}
                                    >
                                        <DatasetFile
                                            idx={i}
                                            file={file}
                                            onChange={this.editDistribution(i)}
                                            onDelete={this.deleteDistribution(
                                                i
                                            )}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {localFiles.length > 0 && (
                            <div className="more-files-to-add-text">
                                More files to add?
                            </div>
                        )}
                    </div>
                </div>

                <div className="row justify-content-center">
                    <div
                        className="col-xs-12"
                        onClick={this.onBrowse.bind(this)}
                    >
                        <FileDrop
                            onDrop={this.onDrop.bind(this)}
                            className="dataset-add-files-dropZone"
                            targetClassName="dataset-add-files-dropTarget"
                        >
                            <button
                                className="au-btn filedrop-zone-button"
                                aria-label="Press enter key to upload files"
                            />
                        </FileDrop>
                    </div>
                </div>

                <AddDatasetLinkSection
                    type={DistributionSource.DatasetUrl}
                    distributions={this.state.distributions}
                    addDistribution={this.addDistribution}
                    editDistribution={this.editDistribution}
                    deleteDistribution={this.deleteDistribution}
                />

                <AddDatasetLinkSection
                    type={DistributionSource.Api}
                    distributions={this.state.distributions}
                    addDistribution={this.addDistribution}
                    editDistribution={this.editDistribution}
                    deleteDistribution={this.deleteDistribution}
                />

                <div
                    className="row next-save-button-row"
                    style={{ marginTop: "6em" }}
                >
                    <div className="col-xs-12">
                        {localFiles.filter(
                            (file: Distribution) =>
                                file._state === DistributionState.Ready
                        ).length === localFiles.length && (
                            <React.Fragment>
                                <button
                                    className="au-btn next-button"
                                    onClick={this.reviewMetadata.bind(this)}
                                >
                                    Next: Review Metadata
                                </button>
                                <button
                                    className="au-btn au-btn--secondary save-button"
                                    onClick={this.saveAndExit.bind(this)}
                                >
                                    Save and Exit
                                </button>
                            </React.Fragment>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    saveAndExit() {
        saveState(this.state, this.props.dataset);
        this.props.history.push(`/dataset/list`);
    }

    reviewMetadata() {
        if (ValidationManager.validateAll()) {
            const id = saveState(this.state, this.props.dataset);
            this.props.history.push(`/dataset/add/metadata/${id}/0`);
        }
    }
}

function trimExtension(filename: string) {
    return filename.substr(0, filename.lastIndexOf(".")) || filename;
}

function turnPunctuationToSpaces(filename: string) {
    return filename.replace(PUNCTUATION_REGEX, " ");
}
const PUNCTUATION_REGEX = /[-_]+/g;

function toTitleCase(str: string) {
    return str.replace(/\w\S*/g, function(txt) {
        return (
            txt.charAt(0).toUpperCase() +
            txt
                .substr(1)
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .toLowerCase()
        );
    });
}

function readFileAsArrayBuffer(file: any): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        var fileReader = new FileReader();
        fileReader.onload = function() {
            resolve(this.result as ArrayBuffer);
        };
        fileReader.readAsArrayBuffer(file);
    });
}

async function processFile(thisFile: any, update: Function) {
    update({ _state: DistributionState.Reading });

    const input: any = {
        file: thisFile
    };

    input.arrayBuffer = await readFileAsArrayBuffer(thisFile);
    input.array = new Uint8Array(input.arrayBuffer);

    update({ _state: DistributionState.Processing });

    const runExtractors = await import("Components/Dataset/MetadataExtraction").then(
        mod => mod.runExtractors
    );

    await runExtractors(input, update);

    update({ _state: DistributionState.Ready });
}

function mapStateToProps(state, old) {
    let dataset = old.match.params.dataset;
    return {
        dataset
    };
}

function fileFormat(file): string {
    const extensionIndex = file.name.lastIndexOf(".");
    const extensionLength = file.name.length - extensionIndex - 1;
    if (extensionIndex !== -1 && extensionLength > 0 && extensionLength < 5) {
        return file.name.substr(extensionIndex + 1).toUpperCase();
    } else {
        return file.type || "unknown";
    }
}

export default withAddDatasetState(
    withRouter(connect(mapStateToProps)(DatasetAddFilesPage))
);
