import React from "react";
import { useAsync } from "react-async-hook";
import Select from "react-select";
import find from "lodash/find";
import partition from "lodash/partition";

import ReactSelectStyles from "Components/Common/react-select/ReactSelectStyles";

import {
    listOrgUnits,
    getOrgUnitById,
    OrgUnitWithRelationship
} from "api-clients/OrgUnitApis";

type Props = {
    orgUnitId?: string;
    custodianOrgUnitId?: string;
    onChange: (orgUnitId: string) => void;
};

const getOrgUnitName = async (id?: string) => {
    if (typeof id !== "string") {
        return undefined;
    }
    try {
        const orgUnit = await getOrgUnitById(id);
        return orgUnit.name;
    } catch (e) {
        return undefined;
    }
};

const orgUnitsToOptionItems = (orgUnits: OrgUnitWithRelationship[]) =>
    orgUnits.map(option => ({
        label: option.name,
        value: option.id
    }));

export default function OrgUnitDropdown({
    orgUnitId,
    custodianOrgUnitId,
    onChange: onChangeCallback
}: Props) {
    const { loading, error, result, execute } = useAsync(async () => {
        const orgUnits = await listOrgUnits({
            orgUnitsOnly: true,
            relationshipOrgUnitId: custodianOrgUnitId
        });
        const custodianName = await getOrgUnitName(custodianOrgUnitId);
        return { orgUnits, custodianName };
    }, [custodianOrgUnitId]);

    if (loading) {
        return <span>Loading...</span>;
    } else if (error || !result || result.orgUnits.length === 0) {
        return (
            <div className="au-body au-page-alerts au-page-alerts--error">
                <span style={{ verticalAlign: "-2px" }}>
                    Could not retrieve data custodian list, or there are no data
                    custodians in the system.
                </span>
                <button
                    className="au-btn au-btn--tertiary"
                    onClick={() => execute(custodianOrgUnitId)}
                >
                    Try Again
                </button>
            </div>
        );
    } else {
        const selectedValue =
            typeof orgUnitId !== "undefined" &&
            find(result.orgUnits, option => option.id === orgUnitId);

        // --- default to list options alphabetically
        const sortedResult = result.orgUnits.sort((b, a) =>
            a.name > b.name ? -1 : b.name > a.name ? 1 : 0
        );

        const options = (() => {
            if (custodianOrgUnitId) {
                // --- produce options in groups
                // --- teams in selected custodian will be shown on the top of the list
                const custodianOrgUnitLabel =
                    typeof result.custodianName === "undefined"
                        ? "Unknown Custodian"
                        : result.custodianName;
                const groups = partition(
                    sortedResult,
                    item => item.relationship !== "unrelated"
                ).map((items, key) => ({
                    label: `Teams ${
                        key ? "outside" : "in"
                    } ${custodianOrgUnitLabel}`,
                    options: orgUnitsToOptionItems(items)
                }));
                return groups;
            } else {
                // --- show options without groups
                return orgUnitsToOptionItems(sortedResult);
            }
        })();

        return (
            <Select
                className="react-select"
                isMulti={false}
                isSearchable={true}
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
                value={
                    selectedValue
                        ? {
                              label: selectedValue.name,
                              value: selectedValue.id
                          }
                        : undefined
                }
                options={options as any}
                placeholder="Select a team"
            />
        );
    }
}
