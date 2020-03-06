import "./FacetTemporal.scss";
import React, { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";

import MonthPicker from "Components/Common/MonthPicker";
import range from "assets/range.svg";
import defined from "helpers/defined";

interface Props {
    open: boolean;
    startYear?: number;
    startMonth?: number;
    endYear?: number;
    endMonth?: number;
    onApply: (
        startYear?: number,
        startMonth?: number,
        endYear?: number,
        endMonth?: number
    ) => void;
    earliestDate?: Date;
    latestDate?: Date;
}

function isEndBeforeStart(
    startYear?: number,
    startMonth?: number,
    endYear?: number,
    endMonth?: number
) {
    if (
        startYear === undefined ||
        startMonth === undefined ||
        endYear === undefined ||
        endMonth === undefined
    ) {
        return false;
    } else {
        return (
            endYear < startYear ||
            (endYear === startYear && endMonth < startMonth)
        );
    }
}

function FacetTemporal(props: Props) {
    const [startYear, setStartYear] = useState<number | undefined>(
        props.startYear
    );
    const [startMonth, setStartMonth] = useState<number | undefined>(
        props.startMonth
    );
    const [endYear, setEndYear] = useState<number | undefined>(props.endYear);
    const [endMonth, setEndMonth] = useState<number | undefined>(
        props.endMonth
    );

    useEffect(() => {
        setStartYear(props.startYear);
        setStartMonth(props.startMonth);
        setEndYear(props.endYear);
        setEndMonth(props.endMonth);
    }, [props.startYear, props.startMonth, props.endYear, props.endMonth]);

    const endBeforeStart = isEndBeforeStart(
        startYear,
        startMonth,
        endYear,
        endMonth
    );
    /**
     * Lags 500ms behind endBeforeStart, allowing us to wait until the user has
     * stopped typing a year before we say it's wrong
     */
    const [debouncedEndBeforeStart] = useDebounce(endBeforeStart, 500);

    /**
     * Makes sure that when clear button is called,
     * start year and end years are reset.
     */
    const resetTemporalFacet = () => {
        setStartYear(undefined),
            setStartMonth(undefined),
            setEndYear(undefined),
            setEndMonth(undefined);

        props.onApply();
    };

    const onApply = () => {
        props.onApply(startYear, startMonth, endYear, endMonth);
    };

    /** We can clear if we have any value selected at all */
    const canClear = startYear !== undefined || endYear !== undefined;

    /**
     * We can apply if we have a valid month/year for start or end,
     * and the start is before the end if both are present
     */
    const canApply =
        ((startMonth !== undefined && startYear !== undefined) ||
            (endMonth !== undefined && endYear !== undefined)) &&
        !endBeforeStart;

    // If the picker gets closed and has a valid value (e.g. by clicking away),
    // apply the current value
    useEffect(() => {
        const hasDateChanged = () =>
            startYear !== props.startYear ||
            startMonth !== props.startMonth ||
            endYear !== props.endYear ||
            endMonth !== props.endYear;
        if (!props.open && canApply && hasDateChanged()) {
            onApply();
        }
    }, [props.open]);

    const onStartChange = (year?: number, month?: number) => {
        setStartMonth(defined(month) ? month : 0);
        setStartYear(year);
    };

    const onEndChange = (year?: number, month?: number) => {
        setEndMonth(defined(month) ? month : 11);
        setEndYear(year);
    };

    if (props.open) {
        return (
            <div>
                <div className="clearfix facet-temporal facet-body">
                    <div className="facet-temporal-month-picker">
                        <MonthPicker
                            year={startYear}
                            month={startMonth}
                            onChange={onStartChange}
                            default={props.earliestDate}
                        />
                        <div className="facet-temporal-range-icon">
                            <img src={range} alt="date range" />
                        </div>
                        <MonthPicker
                            year={endYear}
                            month={endMonth}
                            onChange={onEndChange}
                            default={props.latestDate}
                            // If there's a validation warning that affects both
                            // month pickers, just make the first month picker display it

                            validationError={
                                // Make the error show if both debounced and non-debounced
                                // value are true, so that it takes 500ms to appear
                                // but hides instantly if the value becomes valid
                                endBeforeStart && debouncedEndBeforeStart
                                    ? "End date is before start date"
                                    : undefined
                            }
                        />
                    </div>

                    <div className="facet-footer">
                        <button
                            className="au-btn au-btn--secondary"
                            disabled={!canClear}
                            onClick={resetTemporalFacet}
                        >
                            {" "}
                            Clear{" "}
                        </button>
                        <button
                            className="au-btn au-btn--primary"
                            disabled={!canApply}
                            onClick={onApply}
                        >
                            {" "}
                            Apply{" "}
                        </button>
                    </div>
                </div>
            </div>
        );
    } else {
        return null;
    }
}

export default FacetTemporal;
