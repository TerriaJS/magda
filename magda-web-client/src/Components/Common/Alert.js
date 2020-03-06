import React from "react";
import "./Alert.scss";

const Alert = props => {
    return (
        <div>
            <div
                className={`au-page-alerts au-page-alerts--${
                    props.type
                } correspondence-alert`}
            >
                <h5>{props.header}</h5>
            </div>
            <br />
            {props.message && (
                <React.Fragment>
                    <p className="correspondence-success-message">
                        {props.message.split(".")[0]}.
                    </p>
                    <p className="correspondence-success-message">
                        {props.message.split(".")[1]}
                    </p>
                </React.Fragment>
            )}
        </div>
    );
};

export default Alert;
