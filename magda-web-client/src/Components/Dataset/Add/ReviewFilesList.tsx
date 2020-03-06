import React, { useState, FunctionComponent } from "react";
import { getFormatIcon } from "../View/DistributionIcon";
import { Distribution } from "./DatasetAddCommon";
import iconWhiteArrowLeft from "assets/left-arrow-white.svg";
import iconWhiteArrowUp from "assets/up-arrow-white.svg";

import "./ReviewFilesList.scss";

interface PropsType {
    files: Distribution[];
    isOpen?: boolean;
}

interface StateType {
    isOpen: boolean;
    showMore: boolean;
}

const ITEM_NUM_TRIGGER_SHOW_MORE = 5;

const ReviewFilesList: FunctionComponent<PropsType> = props => {
    const [state, setState] = useState<StateType>({
        isOpen: props.isOpen === false ? false : true,
        showMore: false
    });
    const { isOpen, showMore } = state;
    if (!props.files || !Array.isArray(props.files) || !props.files.length)
        return null;
    return (
        <div className="review-files-list-outer-container">
            <div className="review-files-list-container">
                <div className="header-container">
                    <div className="heading">Review files</div>
                    <button
                        aria-label={
                            isOpen
                                ? "Close Review File List"
                                : "Expand Review File List"
                        }
                        className="expand-button"
                        onClick={() =>
                            setState(state => ({
                                ...state,
                                isOpen: state.isOpen ? false : true
                            }))
                        }
                    >
                        <img
                            src={isOpen ? iconWhiteArrowLeft : iconWhiteArrowUp}
                        />
                    </button>
                </div>
                {isOpen ? (
                    <div className="body-container">
                        <div className="body-text-container">
                            <p>
                                Magda has reviewed your files and pre-populated
                                metadata fields based on the contents.
                            </p>
                            <p>
                                Please review carefully, and update any fields
                                as required.
                            </p>
                        </div>
                        <div className="file-icons-container">
                            {props.files.map((file, i) =>
                                (i > ITEM_NUM_TRIGGER_SHOW_MORE - 1 &&
                                    showMore) ||
                                i < ITEM_NUM_TRIGGER_SHOW_MORE ? (
                                    <div
                                        key={i}
                                        className="file-icon-item clearfix"
                                    >
                                        <img
                                            className="file-icon"
                                            src={getFormatIcon(file)}
                                        />
                                        <div className="file-title">
                                            {file.title}
                                        </div>
                                    </div>
                                ) : null
                            )}
                        </div>
                        {props.files.length > ITEM_NUM_TRIGGER_SHOW_MORE ? (
                            <div className="show-more-button-container">
                                <button
                                    className="show-more-button"
                                    aria-label={
                                        showMore ? "Show Less" : "Show More"
                                    }
                                    onClick={() =>
                                        setState(state => ({
                                            ...state,
                                            showMore: state.showMore
                                                ? false
                                                : true
                                        }))
                                    }
                                >
                                    {showMore ? "Show Less..." : "Show More..."}
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ReviewFilesList;
