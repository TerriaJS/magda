import React, { ReactNode } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { createNewDatasetReset } from "actions/recordActions";
import { Link } from "react-router-dom";
import { withRouter, match } from "react-router";
import "./AddDatasetProgressMeter.scss";
import iconTick from "assets/tick.svg";
import { History, Location } from "history";

type urlFunc = (datasetId: string) => string;
interface StepItem {
    title: string;
    url: string | urlFunc;
}

interface PropsType {
    history: History;
    location: Location;
    createNewDatasetReset: Function;
    match: match<{
        dataset: string;
        step: string;
    }>;
}

export const Steps: StepItem[] = [
    {
        title: "Add files",
        url: datasetId =>
            datasetId ? `/dataset/add/files/${datasetId}` : "/dataset/add/files"
    },
    {
        title: "Details and Contents",
        url: "/dataset/add/metadata/${datasetId}/0"
    },
    {
        title: "People and Production",
        url: "/dataset/add/metadata/${datasetId}/1"
    },
    {
        title: "Access and User",
        url: "/dataset/add/metadata/${datasetId}/2"
    },
    {
        title: "Submit for Approval",
        url: "/dataset/add/metadata/${datasetId}/3"
    }
];

function createStepUrl(datasetId, item: StepItem) {
    if (typeof item.url === "string") {
        return item.url.replace("${datasetId}", datasetId);
    } else if (typeof item.url === "function") {
        return item.url(datasetId);
    } else {
        throw new Error("Invalid step item config.");
    }
}

const AddDatasetProgressMeter = (props: PropsType) => {
    function determineDatasetId() {
        return props.match.params.dataset;
    }

    function determineCurrentStep() {
        const stepNo = parseInt(props.match.params.step);
        if (Number.isNaN(stepNo)) {
            return 0;
        } else {
            return stepNo + 1;
        }
    }

    function renderStepItem(
        item: StepItem,
        idx: number,
        currentStep: number,
        datasetId: string
    ) {
        type Status = {
            class: "past-item" | "current-item" | "future-item";
            iconItem: ReactNode;
        };

        const status: Status = (() => {
            if (currentStep < idx) {
                return {
                    class: "future-item",
                    iconItem: <div className="round-number-icon">{idx + 1}</div>
                } as Status;
            } else if (currentStep > idx) {
                return {
                    class: "past-item",
                    iconItem: <img className="step" src={iconTick} />
                } as Status;
            } else {
                return {
                    class: "current-item",
                    iconItem: <div className="round-number-icon">{idx + 1}</div>
                } as Status;
            }
        })();

        const inner = (
            <div className="step-item">
                {status.iconItem}
                <div className="step-item-title">{item.title}</div>
            </div>
        );

        if (status.class === "past-item") {
            return (
                <Link
                    key={idx}
                    className={`col-sm-2 step-item-container past-item`}
                    to={createStepUrl(datasetId, item)}
                    onClick={() => {
                        props.createNewDatasetReset();
                    }}
                >
                    {inner}
                </Link>
            );
        } else {
            return (
                <div
                    key={idx}
                    className={`col-sm-2 step-item-container ${status.class}`}
                >
                    {inner}
                </div>
            );
        }
    }

    const currentStep = determineCurrentStep();
    const datasetId = determineDatasetId();

    return (
        <div className="add-dataset-progress-meter">
            <div className="container">
                <div className="col-sm-2 step-item-heading">
                    <div className="heading">Add a dataset</div>
                </div>
                <div className="col-sm-10 step-item-body">
                    {Steps.map((item, idx) =>
                        renderStepItem(item, idx, currentStep, datasetId)
                    )}
                </div>
            </div>
        </div>
    );
};

const mapDispatchToProps = dispatch => {
    return bindActionCreators(
        {
            createNewDatasetReset: createNewDatasetReset
        },
        dispatch
    );
};

export default withRouter(
    connect(
        null,
        mapDispatchToProps
    )(AddDatasetProgressMeter)
);
