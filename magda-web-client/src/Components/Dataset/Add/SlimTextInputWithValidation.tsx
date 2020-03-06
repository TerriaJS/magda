import React, { FunctionComponent } from "react";
import uuidv4 from "uuid/v4";
import * as ValidationManager from "../Add/ValidationManager";
const useValidation = ValidationManager.useValidation;

import editIcon from "assets/edit.svg";
import "./SlimTextInputWithValidation.scss";

interface PropsType {
    validationFieldPath: string;
    validationFieldLabel: string;
    fullWidth?: boolean;
    value?: string;
    onChange: (value: string | undefined) => void;
    [key: string]: any;
}

const SlimTextInputWithValidation: FunctionComponent<PropsType> = props => {
    const {
        validationFieldPath,
        validationFieldLabel,
        fullWidth,
        value,
        onChange,
        ...restProps
    } = props;
    const [isValidationError, validationErrorMessage, elRef] = useValidation(
        props.validationFieldPath,
        props.validationFieldLabel
    );

    const fullWidthClass =
        typeof fullWidth === "undefined" || fullWidth
            ? "full-width-ctrl"
            : "non-full-width-ctrl";

    const errorMessageId = `input-error-text-${uuidv4()}`;
    const extraProps: any = {
        ref: elRef,
        onBlur: () => {
            ValidationManager.onInputFocusOut(props.validationFieldPath);
        }
    };

    if (isValidationError) {
        extraProps["aria-invalid"] = true;
        extraProps["aria-describedby"] = errorMessageId;
    }

    return (
        <div className="SlimTextInputWithValidation">
            <div
                id={errorMessageId}
                style={{
                    display: "none"
                }}
            >
                {validationErrorMessage}
            </div>
            <input
                className={`au-text-input ${
                    isValidationError ? "au-text-input--invalid" : ""
                } ${fullWidthClass}`}
                aria-describedby={errorMessageId}
                defaultValue={typeof value === "undefined" ? "" : value}
                onChange={event => {
                    props.onChange(event.target.value);
                }}
                {...restProps}
                {...extraProps}
            />
            <div className="edit-icon-container">
                <img className="edit-icon" src={editIcon} />
            </div>
        </div>
    );
};

export default SlimTextInputWithValidation;
