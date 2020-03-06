import React, { useState } from "react";
import {
    Distribution,
    DistributionState,
    DistributionSource
} from "Components/Dataset/Add/DatasetAddCommon";
import "./AddDatasetLinkSection.scss";

import isUrl from "is-url";
import uuid from "uuid";
import DatasetLinkItem from "./DatasetLinkItem";

type Props = {
    type: DistributionSource.DatasetUrl | DistributionSource.Api;
    distributions: Distribution[];
    addDistribution: (distribution: Distribution) => void;
    editDistribution: (
        index: number
    ) => (updater: (distribution: Distribution) => Distribution) => void;
    deleteDistribution: (index: number) => () => void;
};

const AddDatasetLinkSection = (props: Props) => {
    const { type } = props;
    const [url, setUrl] = useState("");
    const [validationErrorMessage, setValidationErrorMessage] = useState("");
    const distributions = props.distributions
        .map((item, idx) => ({ distribution: item, idx }))
        .filter(item => item.distribution.creationSource === props.type);

    const fetchUrl = () => {
        if (!isUrl(url)) {
            setValidationErrorMessage("Please input an valid URL!");
        } else {
            setValidationErrorMessage("");

            props.addDistribution({
                id: uuid.v4(),
                downloadURL: url,
                creationSource: type,
                title: url,
                modified: new Date(),
                format: "",
                _state: DistributionState.Processing,
                _progress: 50
            });

            setUrl("");
        }
    };

    return (
        <div
            className={`row add-dataset-link-section ${
                type === DistributionSource.DatasetUrl
                    ? "source-dataset-url"
                    : "source-api"
            }`}
        >
            <div className="col-sm-12">
                <h2 className="section-heading">
                    {type === DistributionSource.DatasetUrl
                        ? "(and/or) Link to a dataset already hosted online"
                        : "(and/or) Link to an API or web service"}
                </h2>
                {distributions.length ? (
                    <>
                        <div className="row link-items-section">
                            <div className="col-sm-12">
                                {distributions.map(item => (
                                    <DatasetLinkItem
                                        idx={item.idx}
                                        key={item.idx}
                                        distribution={item.distribution}
                                        editDistribution={props.editDistribution(
                                            item.idx
                                        )}
                                        deleteDistribution={props.deleteDistribution(
                                            item.idx
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="row link-items-section-heading">
                            <div className="col-sm-12">
                                <h2>
                                    {type === DistributionSource.DatasetUrl
                                        ? "More dataset URL to add?"
                                        : "More web services to add?"}
                                </h2>
                            </div>
                        </div>
                    </>
                ) : null}
                <h4 className="url-input-heading">What is the URL?</h4>

                <div>
                    <span className="au-error-text">
                        {validationErrorMessage}
                    </span>
                </div>

                <input
                    className={`au-text-input url-input ${
                        validationErrorMessage ? "invalid" : ""
                    }`}
                    placeholder="Enter the download URL"
                    onChange={e => setUrl(e.target.value)}
                    onKeyUp={e => {
                        if (e.keyCode === 13) {
                            fetchUrl();
                        }
                    }}
                    value={url}
                />

                <button className="au-btn fetch-button" onClick={fetchUrl}>
                    Fetch
                </button>
            </div>
        </div>
    );
};

export default AddDatasetLinkSection;
