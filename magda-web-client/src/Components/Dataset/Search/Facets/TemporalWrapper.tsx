import React from "react";
import moment from "moment";

import FacetTemporal from "./FacetTemporal";
import FacetHeader from "./FacetHeader";
import defined from "helpers/defined";

interface Props {
    title: string;
    id: string;
    hasQuery: boolean;
    activeDates: [string, string];
    onToggleOption: (dates: [string?, string?]) => void;
    onResetFacet: () => void;
    toggleFacet: () => void;
    isOpen: boolean;
    temporalRange?: [Date, Date];
    disableApply: boolean;
    disableOpen: boolean;
}

/**
 * Wrapper for the facetHeader and facetTemporal components
 */
export default function TemporalWrapper(props: Props) {
    const [startDateString, endDateString] = props.activeDates;

    const startDate = defined(startDateString) && moment.utc(startDateString);
    const endDate = defined(endDateString) && moment.utc(endDateString);

    const startYear = startDate ? startDate.get("year") : undefined;
    const startMonth = startDate ? startDate.get("month") : undefined;
    const endYear = endDate ? endDate.get("year") : undefined;
    const endMonth = endDate ? endDate.get("month") : undefined;

    const [earliestDate, latestDate] = props.temporalRange || [
        undefined,
        undefined
    ];

    console.log(props);

    return (
        <React.Fragment>
            <FacetHeader
                onResetFacet={props.onResetFacet}
                title={props.title}
                id={props.id}
                activeOptions={props.activeDates}
                hasQuery={props.hasQuery}
                onClick={props.toggleFacet}
                isOpen={props.isOpen}
                disabled={props.disableOpen}
            />
            <FacetTemporal
                {...{
                    startYear,
                    startMonth,
                    endYear,
                    endMonth,
                    earliestDate,
                    latestDate
                }}
                open={props.isOpen}
                onApply={(startYear, startMonth, endYear, endMonth) => {
                    const start =
                        defined(startYear) &&
                        defined(startMonth) &&
                        moment
                            .utc({
                                year: startYear,
                                month: startMonth
                            })
                            .startOf("month");

                    const end =
                        defined(endYear) &&
                        defined(endMonth) &&
                        moment
                            .utc({
                                year: endYear,
                                month: endMonth
                            })
                            .endOf("month");

                    props.onToggleOption([
                        start ? start.toISOString() : undefined,
                        end ? end.toISOString() : undefined
                    ]);
                }}
            />
        </React.Fragment>
    );
}
