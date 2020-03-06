import React from "react";
import { useAsync } from "react-async-hook";
import Select from "react-select";
import { config } from "config";

import ReactSelectStyles from "Components/Common/react-select/ReactSelectStyles";

import { OrgUnit, listOrgUnitsAtLevel } from "api-clients/OrgUnitApis";

type Props = {
    orgUnitId?: string;
    onChange: (orgUnitId: string) => void;
};

const getCustodians: () => Promise<OrgUnit[]> = async () => {
    try {
        const result = await listOrgUnitsAtLevel(config.custodianOrgLevel);
        // --- list Custodians alphabetically
        result.sort((b, a) => (a.name > b.name ? -1 : b.name > a.name ? 1 : 0));
        return result;
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export default function CustodianDropdown({
    orgUnitId,
    onChange: onChangeCallback
}: Props) {
    const { loading, error, result, execute } = useAsync(getCustodians, []);

    if (loading) {
        return <span>Loading...</span>;
    } else if (error || !result || result.length === 0) {
        return (
            <div className="au-body au-page-alerts au-page-alerts--error">
                <span style={{ verticalAlign: "-2px" }}>
                    Could not retrieve data custodians, or there are no data
                    custodians in the system.
                </span>
                <button className="au-btn au-btn--tertiary" onClick={execute}>
                    Try Again
                </button>
            </div>
        );
    } else {
        const value = result.find(option => option.id === orgUnitId);

        return (
            <Select
                className="react-select"
                isMulti={false}
                isSearchable={false}
                onChange={(rawValue, action) => {
                    const value = rawValue as
                        | { value: string }
                        | undefined
                        | null;
                    if (value) {
                        onChangeCallback(value.value);
                    }
                }}
                styles={ReactSelectStyles}
                value={value && { label: value.name, value: value.id }}
                options={result.map(option => ({
                    label: option.name,
                    value: option.id
                }))}
                placeholder="Select a data custodian"
            />
        );
    }
}
