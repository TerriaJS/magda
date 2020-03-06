import React, { RefObject } from "react";
import Editor from "./Editor";
import uuidv4 from "uuid/v4";
import { ListMultiItemEditor } from "./multiItem";

export function codelistEditor(
    options: any,
    reorder = false,
    defaultOptionText: string = ""
): Editor<string> {
    return {
        edit: (value: any, onChange: Function, valuesToAvoid?: any) => {
            const callback = event => {
                onChange(event.target.value);
            };
            value = value || "";
            valuesToAvoid = valuesToAvoid || [];
            let keys = Object.keys(options);
            if (reorder) {
                keys = keys.sort(alphaLabelSort(options));
            }
            return (
                <select
                    className="au-select"
                    defaultValue={value}
                    onChange={callback}
                    key={valuesToAvoid.join("-")}
                >
                    <option value="" disabled>
                        {defaultOptionText
                            ? defaultOptionText
                            : "Please select one"}
                    </option>
                    {keys
                        .filter(item => valuesToAvoid.indexOf(item) === -1)
                        .map((val, i) => {
                            return (
                                <option key={i} value={val}>
                                    {options[val]}
                                </option>
                            );
                        })}
                </select>
            );
        },
        view: (value: any) => {
            return (
                <React.Fragment>
                    {(options[value] && `${options[value]}`) ||
                        value ||
                        "NOT SET"}
                </React.Fragment>
            );
        }
    };
}

export function codelistRadioEditor(
    idNamespace: string,
    options: any,
    reorder = false,
    disabled = false
): Editor<string> {
    return {
        edit: (
            value: any,
            onChange: Function,
            multiValues: any = undefined,
            extraProps = {}
        ) => {
            const callback = event => {
                onChange(event.target.value);
            };
            value = value || "";
            let keys = Object.keys(options);
            if (reorder) {
                keys = keys.sort(alphaLabelSort(options));
            }

            const {
                isValidationError,
                validationErrorMessage,
                ref,
                onBlur
            } = extraProps;

            const errorMessageId = `input-error-text-${uuidv4()}`;

            const extraRadioInputProps = {};
            if (isValidationError) {
                extraRadioInputProps["aria-invalid"] = true;
                extraRadioInputProps["aria-describedby"] = errorMessageId;
            }

            return (
                <div
                    className={`code-list-radio-editor ${
                        isValidationError ? "invalid" : ""
                    }`}
                    ref={ref as RefObject<HTMLDivElement>}
                >
                    {isValidationError ? (
                        <div className="error-message-container">
                            <span className="au-error-text" id={errorMessageId}>
                                {validationErrorMessage}
                            </span>
                        </div>
                    ) : null}
                    <div className="code-list-radio-editor-input-container">
                        {keys.map((val, i) => {
                            return (
                                <div
                                    className="au-control-input au-control-input--block"
                                    key={i}
                                >
                                    <input
                                        className="au-control-input__input"
                                        type="radio"
                                        value={val}
                                        name={val}
                                        id={idNamespace + "-" + val}
                                        onChange={e => {
                                            callback(e);
                                            if (onBlur) {
                                                setTimeout(onBlur, 1);
                                            }
                                        }}
                                        checked={value === val}
                                        disabled={disabled}
                                        {...extraRadioInputProps}
                                    />{" "}
                                    <label
                                        className="au-control-input__text"
                                        htmlFor={idNamespace + "-" + val}
                                    >
                                        {options[val]}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        },
        view: (value: any) => {
            return (
                <React.Fragment>
                    {(options[value] && `${options[value]}`) ||
                        value ||
                        "NOT SET"}
                </React.Fragment>
            );
        }
    };
}

function alphaLabelSort(labels, order = 1) {
    return (a, b) => {
        a = labels[a].toLowerCase();
        b = labels[b].toLowerCase();
        if (a > b) {
            return order;
        } else if (a < b) {
            return -order;
        } else {
            return 0;
        }
    };
}

export function multiCodelistEditor(
    options: { [key: string]: string },
    reorder = false,
    defaultOptionText: string = ""
): Editor<string[]> {
    const single = codelistEditor(options, reorder, defaultOptionText);
    return ListMultiItemEditor.create(single, () => "");
}
