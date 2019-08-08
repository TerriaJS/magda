import React from "react";
import Editor from "./Editor";
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
    reorder = false
): Editor<string> {
    return {
        edit: (value: any, onChange: Function) => {
            const callback = event => {
                onChange(event.target.value);
            };
            value = value || "";
            let keys = Object.keys(options);
            if (reorder) {
                keys = keys.sort(alphaLabelSort(options));
            }
            return (
                <div>
                    {keys.map(val => {
                        return (
                            <div className="au-control-input au-control-input--block">
                                <input
                                    className="au-control-input__input"
                                    type="radio"
                                    value={val}
                                    name={val}
                                    id={idNamespace + "-" + val}
                                    onChange={callback}
                                    checked={value === val}
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
