import React from "react";
import Choice from "Components/Common/Choice";
import { config } from "config";

import iconSearch from "assets/icon-search.svg";
import iconDocument from "assets/icon-document.svg";
import iconSave from "assets/icon-save.svg";

import iconUpload from "assets/add-files.svg";
import iconDataEntry from "assets/list-ul.svg";
import iconMultiFiles from "assets/files.svg";

import "./DatasetAddPage.scss";

class AddDataset extends React.Component<any, any> {
    render() {
        return (
            <div className="add-dataset-page-container">
                <div className="heading-wrapper">
                    <div className="container">
                        <div className="row">
                            <div className="col-sm-12">
                                <div className="heading container">
                                    Add a Dataset
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lower-header-wrapper">
                    <div className="container">
                        <div className="row">
                            <div className="col-sm-12">
                                <div className="row lower-header-icons">
                                    <div className="col-sm-4 block">
                                        <img
                                            src={iconSearch}
                                            className="icon-search"
                                        />
                                    </div>
                                    <div className="col-sm-4 block">
                                        <img
                                            src={iconDocument}
                                            className="icon-document"
                                        />
                                    </div>
                                    <div className="col-sm-4 block">
                                        <img
                                            src={iconSave}
                                            className="icon-oval"
                                        />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-sm-4 text-block-container">
                                        <div className="text-block text-block-1">
                                            You can easily{" "}
                                            <strong>
                                                add a new record of a dataset to
                                                your internal catalogue
                                            </strong>{" "}
                                            to enable powerful search and
                                            discovery features.
                                        </div>
                                    </div>
                                    <div className="col-sm-4 text-block-container">
                                        <div className="text-block text-block-2">
                                            The MAGDA Publishing Tool can{" "}
                                            <strong>
                                                review your files and
                                                pre-populate metadata
                                            </strong>{" "}
                                            to ensure every dataset has a
                                            complete and high quality metadata
                                            record, without the need for arduous
                                            data entry.
                                        </div>
                                    </div>
                                    <div className="col-sm-4 text-block-container">
                                        <div className="text-block text-block-3">
                                            You can{" "}
                                            <strong>
                                                save your metadata records as a
                                                draft
                                            </strong>{" "}
                                            until you are ready to submit them
                                            for approval.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container">
                    <div className="row body-heading-row">
                        <div className="col-sm-12">
                            <p>
                                Choose how you would like to add your dataset to
                                your catalogue:
                            </p>
                        </div>
                    </div>

                    {config.featureFlags.previewAddDataset && (
                        <div className="row preview-message-row">
                            <div className="col-sm-8 col-sm-offset-2">
                                <div className="au-page-alerts au-page-alerts--warning">
                                    <h3>This is a Preview Only!</h3>
                                    <p>
                                        This version is intended to preview the
                                        new Add Dataset functionality for
                                        feedback. When you get to the end of
                                        this process{" "}
                                        <strong>
                                            your dataset will not be saved on
                                            the server
                                        </strong>
                                        , but it will persist locally as a
                                        draft.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="row main-body-row">
                        <div className="container">
                            <div className="row choice-row">
                                <Choice
                                    className={"choice-files col-sm-offset-3"}
                                    heading="Have a single dataset comprised of multiple files or services?"
                                    icon={iconUpload}
                                    blurb="Add your dataset to pre-populate metadata using the Magda Publishing Tool"
                                    href="/dataset/add/files"
                                />
                            </div>
                            <div className="row choice-row">
                                <Choice
                                    className={"choice-no-files"}
                                    heading="No files to upload?"
                                    icon={iconDataEntry}
                                    blurb="Manually add the dataset record and the metadata."
                                    href="/dataset/add/metadata/-/0"
                                    secondary
                                />
                                <Choice
                                    className={"choice-multiple"}
                                    heading="Adding multiple datasets?"
                                    icon={iconMultiFiles}
                                    blurb="Add your entire dataset catalogue using our bulk CSV tool or open data catalogue"
                                    href="/catalog/add"
                                    secondary
                                    disabled={true}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default AddDataset;
