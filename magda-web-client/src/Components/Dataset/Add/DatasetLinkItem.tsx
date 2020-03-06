import React, { useState } from "react";
import { useAsync } from "react-async-hook";
import defer from "helpers/defer";
import moment from "moment";
import {
    Distribution,
    DistributionState
} from "Components/Dataset/Add/DatasetAddCommon";
import "./DatasetLinkItem.scss";

import { AlwaysEditor } from "Components/Editing/AlwaysEditor";
import { dateEditor } from "Components/Editing/Editors/dateEditor";
import { getFormatIcon } from "../View/DistributionIcon";
import editIcon from "../../../assets/edit.svg";
import dismissIcon from "../../../assets/dismiss.svg";

import SlimTextInputWithValidation from "../Add/SlimTextInputWithValidation";
import * as ValidationManager from "./ValidationManager";
import ValidationRequiredLabel from "../../Dataset/Add/ValidationRequiredLabel";
import { MultilineTextEditor } from "Components/Editing/Editors/textEditor";

type Props = {
    distribution: Distribution;
    idx: number;
    editDistribution: (
        updater: (distribution: Distribution) => Distribution
    ) => void;
    deleteDistribution: () => void;
    className?: string;
};

type ProcessingProps = {
    distribution: Distribution;
};

type EditViewProps = {
    distribution: Distribution;
    idx: number;
    editDistribution: (
        updater: (distribution: Distribution) => Distribution
    ) => void;
    editMode: boolean;
    setEditMode: (editMode: boolean) => void;
};

type CompleteViewProps = {
    distribution: Distribution;
    editMode: boolean;
    setEditMode: (editMode: boolean) => void;
    deleteDistribution: () => void;
};

const DatasetLinkItemComplete = (props: CompleteViewProps) => {
    const { distribution, setEditMode, editMode, deleteDistribution } = props;

    return (
        <div className="dataset-link-item-complete">
            <button
                className={`edit-button au-btn au-btn--secondary`}
                aria-label="Edit distribution metadata"
                onClick={() => setEditMode(!editMode)}
            >
                <img src={editIcon} />
            </button>
            <button
                className={`delete-button au-btn au-btn--secondary`}
                arial-label="Delete distribution metadata"
                onClick={() => deleteDistribution()}
            >
                <img src={dismissIcon} />
            </button>
            <div>
                <h3 className="link-item-title">{distribution.title}</h3>
                <div className="link-item-details">
                    <div>
                        <b>Format:</b>{" "}
                        {distribution.format ? distribution.format : "N/A"}
                    </div>
                    <div>
                        <b>Last Modified:</b>{" "}
                        {moment(distribution.modified).format("DD/MM/YYYY")}
                    </div>
                    <div>
                        <b>URL:</b> {distribution.downloadURL}
                    </div>
                    <div>
                        <b>Service description:</b>{" "}
                        {distribution.description
                            ? distribution.description
                            : "N/A"}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DatasetLinkItemProcessing = (props: ProcessingProps) => {
    const distribution = props.distribution;

    const progress = distribution._progress ? distribution._progress : 0;
    let width = Math.ceil((progress / 100) * 330);
    if (width < 5) width = 5;

    return (
        <div className="processing-item">
            <div className="distribution-in-progress">
                <div className="distribution-icon-area">
                    <img
                        className="format-icon"
                        src={getFormatIcon(
                            {
                                downloadURL: distribution.downloadURL
                            },
                            "gis"
                        )}
                    />
                    <div className="format-text">{distribution.format}</div>
                </div>
                <div className="distribution-info">
                    <div className="distribution-name">
                        <div className="distribution-name">
                            {distribution.title}
                        </div>
                    </div>
                    <div className="distribution-progress-bar">
                        <div
                            className="distribution-progress-bar-content"
                            style={{ width: `${width}px` }}
                        >
                            &nbsp;
                        </div>
                        <div
                            className="distribution-progress-bar-box"
                            style={{ width: `${width}px` }}
                        >
                            &nbsp;
                        </div>
                    </div>
                    <div className="distribution-status">
                        Reviewing service - {distribution._progress}% complete
                    </div>
                </div>
            </div>
        </div>
    );
};

const DatasetLinkItemEditing = (props: EditViewProps) => {
    const {
        idx,
        setEditMode,
        editMode,
        distribution,
        editDistribution
    } = props;

    const editFormat = (newValue: string | undefined) =>
        editDistribution(distribution => ({
            ...distribution,
            format: newValue
        }));
    const editTitle = (newValue: string | undefined) =>
        editDistribution(distribution => ({
            ...distribution,
            title: newValue ? newValue : ""
        }));
    const editModified = (newValue: Date | undefined) =>
        editDistribution(fidistributionle =>
            typeof newValue === "undefined"
                ? distribution
                : { ...distribution, modified: newValue }
        );
    const editDescription = (newValue: string | undefined) =>
        editDistribution(distribution => ({
            ...distribution,
            description: newValue ? newValue : ""
        }));

    return (
        <div className="dataset-link-item-edit">
            <button
                className={`au-btn link-item-save-button`}
                arial-label="Save changes"
                onClick={() => {
                    if (
                        ValidationManager.validateFields([
                            `$.distributions[${idx}].title`,
                            `$.distributions[${idx}].format`
                        ])
                    ) {
                        setEditMode(!editMode);
                    }
                }}
            >
                Save
            </button>
            <div className="row">
                <div className="col-sm-6 title-field-input-area">
                    <span>
                        Title:&nbsp;&nbsp;{" "}
                        <ValidationRequiredLabel
                            validationFieldPath={`$.distributions[${idx}].title`}
                        />
                    </span>
                    &nbsp;&nbsp;
                    <SlimTextInputWithValidation
                        validationFieldLabel="Title"
                        validationFieldPath={`$.distributions[${idx}].title`}
                        value={distribution.title}
                        onChange={editTitle}
                        placeholder="Please enter title..."
                    />
                </div>
                <div className="col-sm-6 format-field-input-area">
                    <span>
                        Format:{" "}
                        <ValidationRequiredLabel
                            validationFieldPath={`$.distributions[${idx}].format`}
                        />
                    </span>
                    &nbsp;&nbsp;
                    <SlimTextInputWithValidation
                        validationFieldLabel="Format"
                        validationFieldPath={`$.distributions[${idx}].format`}
                        value={distribution.format}
                        onChange={editFormat}
                        placeholder="Please enter format..."
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-sm-12">
                    <span>Last Modified: </span>
                    &nbsp;&nbsp;
                    <AlwaysEditor
                        value={distribution.modified}
                        onChange={editModified}
                        editor={dateEditor}
                    />
                </div>
            </div>
            <div className="row">
                <div className="col-sm-12 description-input-area">
                    <MultilineTextEditor
                        validationFieldPath={`$.distributions[${idx}].description`}
                        validationFieldLabel="Service Description"
                        value={distribution.description}
                        placeholder="Enter service description text..."
                        onChange={editDescription}
                    />
                </div>
            </div>
        </div>
    );
};

const DatasetLinkItem = (props: Props) => {
    const [editMode, setEditMode] = useState(false);

    useAsync(async () => {
        await defer(2000);
        props.editDistribution(distribution => ({
            ...distribution,
            _state: DistributionState.Ready
        }));
        return {};
    }, [props.distribution.id]);

    if (props.distribution._state !== DistributionState.Ready) {
        return (
            <div
                className={`dataset-link-item-container ${
                    props.className ? props.className : ""
                }`}
            >
                <DatasetLinkItemProcessing distribution={props.distribution} />
            </div>
        );
    } else if (editMode) {
        return (
            <div className="dataset-link-item-container">
                <DatasetLinkItemEditing
                    idx={props.idx}
                    distribution={props.distribution}
                    editDistribution={props.editDistribution}
                    setEditMode={setEditMode}
                    editMode={editMode}
                />
            </div>
        );
    } else {
        return (
            <div className="dataset-link-item-container">
                <DatasetLinkItemComplete
                    distribution={props.distribution}
                    setEditMode={setEditMode}
                    editMode={editMode}
                    deleteDistribution={props.deleteDistribution}
                />
            </div>
        );
    }
};

export default DatasetLinkItem;
