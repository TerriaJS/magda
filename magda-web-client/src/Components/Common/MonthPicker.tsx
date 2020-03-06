import React from "react";
import "./MonthPicker.scss";
import moment from "moment";
import defined from "helpers/defined";

const MONTH_NAMES = [
    ["Jan", "Feb", "Mar"],
    ["Apr", "May", "Jun"],
    ["Jul", "Aug", "Sep"],
    ["Oct", "Nov", "Dec"]
];

type Props = {
    year?: number;
    month?: number;
    default?: Date;
    onChange: (year?: number, month?: number) => void;
    validationError?: string;
};

const checkYearValid = (year?: number) => {
    // NOTE: moment(undefined).isValid() === true
    return typeof year !== "undefined" && moment({ year }).isValid();
};

export function MonthPicker(props: Props) {
    const yearValid = checkYearValid(props.year);

    const onMonthChange = (month: number) => {
        props.onChange(props.year, month);
    };

    const onYearChange = (year: string) => {
        const yearNumber = Number.parseInt(year);
        props.onChange(
            !Number.isNaN(yearNumber) ? yearNumber : undefined,
            props.month
        );
    };

    const monthIndex = (rowIndex: number, colIndex: number) =>
        rowIndex * MONTH_NAMES[0].length + colIndex;

    const displayYearError = defined(props.year) && !yearValid;

    const errorMessage = displayYearError
        ? "Invalid year"
        : props.validationError;

    return (
        <table className="month-picker">
            <tbody>
                <tr>
                    <th colSpan={3}>
                        <div className={"year-input-container"}>
                            <input
                                type="year"
                                placeholder={
                                    props.default &&
                                    !Number.isNaN(props.default.getFullYear())
                                        ? props.default.getFullYear().toString()
                                        : ""
                                }
                                onChange={event =>
                                    onYearChange(event.target.value)
                                }
                                value={props.year || ""}
                                className="au-text-input au-text-input--block"
                            />
                            {errorMessage && (
                                <span className="month-picker-prompt">
                                    {errorMessage}
                                </span>
                            )}
                        </div>
                    </th>
                </tr>

                {MONTH_NAMES.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((monthAbbr, columnIndex) => {
                            const thisMonthIndex = monthIndex(
                                rowIndex,
                                columnIndex
                            );

                            const isDefaultMonth =
                                !yearValid &&
                                props.default &&
                                thisMonthIndex === props.default.getMonth();
                            const isSelectedMonth =
                                yearValid &&
                                typeof props.month !== "undefined" &&
                                props.month === thisMonthIndex;
                            /** This month is active if it's the currently selected month, or if there's no valid selected year and it's the default month */
                            const isActive = isSelectedMonth || isDefaultMonth;

                            return (
                                <td key={monthAbbr}>
                                    <button
                                        onClick={() =>
                                            onMonthChange(thisMonthIndex)
                                        }
                                        disabled={!yearValid}
                                        className={`au-btn btn-facet-option btn-month ${
                                            isActive ? "is-active" : ""
                                        }`}
                                    >
                                        {monthAbbr}
                                    </button>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default MonthPicker;
