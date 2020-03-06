import React, { useState, FunctionComponent } from "react";
import { Region } from "helpers/datasetSearch";
import CountrySelect from "./CountrySelect";
import TerritorySelect from "./TerritorySelect";
import StateSelect from "./StateSelect";
import RegionSelect from "./RegionSelect";
import AreaSelect from "./AreaSelect";
import SpatialDataPreviewer from "./SpatialDataPreviewer";
import { config } from "config";

import { BoundingBox } from "helpers/datasetSearch";

interface StateType {
    countryRegion?: Region;
    territoryOrSteRegion?: Region;
    sa4Region?: Region;
    sa3Region?: Region;
}

interface PropsType {
    countryId?: string;
    territoryOrSteId?: string;
    sa4Id?: string;
    sa3Id?: string;
    bbox?: BoundingBox;
    onChange?: (
        region?: Region,
        countryId?: string,
        steIdOrTerritoryId?: string,
        sa4?: string,
        sa3?: string,
        bbox?: BoundingBox
    ) => void;
}

export type OptionType = Region;

const initialState = props => ({
    countryRegion: props.countryRegion,
    territoryOrSteRegion: props.territoryOrSteRegion,
    sa4Region: props.sa4Region,
    sa3Region: props.sa3Region
});

const DEFAULT_BBOX = {
    west: config.boundingBox.west,
    north: config.boundingBox.north,
    south: config.boundingBox.south,
    east: config.boundingBox.east
};

const RegionPanel: FunctionComponent<PropsType> = props => {
    const [state, setState] = useState<StateType>(initialState(props));
    const onChange: (state: StateType, props: PropsType) => void = (
        state,
        props
    ) => {
        if (typeof props.onChange !== "function") return;
        if (state.sa3Region) {
            props.onChange(state.sa3Region);
        } else if (state.sa4Region) {
            props.onChange(
                state.sa4Region,
                undefined,
                undefined,
                undefined,
                props.sa3Id
            );
        } else if (state.territoryOrSteRegion) {
            if (state.territoryOrSteRegion.lv1Id === "1") {
                props.onChange(
                    state.territoryOrSteRegion,
                    undefined,
                    undefined,
                    props.sa4Id,
                    props.sa3Id
                );
            } else {
                // --- there will be no any futher level down for territory
                props.onChange(state.territoryOrSteRegion);
            }
        } else if (state.countryRegion) {
            if (state.countryRegion.regionId === "1") {
                // --- select main land
                props.onChange(
                    state.countryRegion,
                    props.countryId,
                    props.territoryOrSteId,
                    props.sa4Id,
                    props.sa3Id
                );
            } else {
                // --- offshore territory
                props.onChange(
                    state.countryRegion,
                    props.countryId,
                    props.territoryOrSteId
                );
            }
        } else {
            props.onChange(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                DEFAULT_BBOX
            );
        }
    };

    return (
        <div className="region-panel">
            <div className="row">
                <div className="col-sm-6 country-select-container">
                    <div className="country-select-heading">Country</div>
                    <CountrySelect
                        value={state.countryRegion}
                        regionId={props.countryId}
                        onChange={(option, notResetOtherRegions) =>
                            setState(state => {
                                notResetOtherRegions = !!notResetOtherRegions;
                                const newState = {
                                    ...state,
                                    countryRegion: option
                                        ? { ...option }
                                        : undefined
                                };
                                if (!notResetOtherRegions) {
                                    newState.territoryOrSteRegion = undefined;
                                    newState.sa4Region = undefined;
                                    newState.sa3Region = undefined;
                                }
                                onChange(newState, props);
                                return newState;
                            })
                        }
                    />
                </div>
            </div>
            {props.countryId === "2" ? (
                <>
                    <div className="row">
                        <div className="col-sm-6 offshore-territories-select-container">
                            <div className="offshore-territories-select-heading">
                                Offshore Remote Territories
                            </div>
                            <TerritorySelect
                                value={state.territoryOrSteRegion}
                                regionId={props.territoryOrSteId}
                                countryRegion={state.countryRegion}
                                onChange={(option, notResetOtherRegions) =>
                                    setState(state => {
                                        notResetOtherRegions = notResetOtherRegions
                                            ? true
                                            : false;
                                        const newState = {
                                            ...state,
                                            sa4Region: undefined,
                                            sa3Region: undefined,
                                            territoryOrSteRegion: option
                                                ? { ...option }
                                                : undefined
                                        };
                                        onChange(newState, props);
                                        return newState;
                                    })
                                }
                            />
                        </div>
                    </div>
                </>
            ) : null}

            {props.countryId === "1" ? (
                <>
                    <div className="row">
                        <div className="col-sm-4 state-select-container">
                            <div className="state-select-heading">
                                State <span> (optional)</span>
                            </div>
                            <StateSelect
                                value={state.territoryOrSteRegion}
                                regionId={props.territoryOrSteId}
                                countryRegion={state.countryRegion}
                                onChange={(option, notResetOtherRegions) =>
                                    setState(state => {
                                        notResetOtherRegions = notResetOtherRegions
                                            ? true
                                            : false;
                                        const newState = {
                                            ...state,
                                            territoryOrSteRegion: option
                                                ? { ...option }
                                                : undefined
                                        };
                                        if (!notResetOtherRegions) {
                                            newState.sa4Region = undefined;
                                            newState.sa3Region = undefined;
                                        }
                                        onChange(newState, props);
                                        return newState;
                                    })
                                }
                            />
                        </div>
                        <div className="col-sm-8 region-select-container">
                            <div className="region-select-heading">
                                Region (ABS SA4) <span>(optional)</span>
                            </div>
                            <RegionSelect
                                value={state.sa4Region}
                                regionId={props.sa4Id}
                                countryRegion={state.countryRegion}
                                steRegion={state.territoryOrSteRegion}
                                onChange={(option, notResetOtherRegions) =>
                                    setState(state => {
                                        const newState = {
                                            ...state,
                                            sa4Region: option
                                                ? { ...option }
                                                : undefined
                                        };
                                        if (!notResetOtherRegions) {
                                            newState.sa3Region = undefined;
                                        }
                                        onChange(newState, props);
                                        return newState;
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-sm-6 area-select-container">
                            <div className="area-select-heading">
                                Area (ABS SA3) <span>(optional)</span>
                            </div>
                            <AreaSelect
                                value={state.sa3Region}
                                regionId={props.sa3Id}
                                countryRegion={state.countryRegion}
                                steRegion={state.territoryOrSteRegion}
                                sa4Region={state.sa4Region}
                                onChange={option =>
                                    setState(state => {
                                        const newState = {
                                            ...state,
                                            sa3Region: option
                                                ? { ...option }
                                                : undefined
                                        };
                                        onChange(newState, props);
                                        return newState;
                                    })
                                }
                            />
                        </div>
                    </div>
                </>
            ) : null}

            {props.countryId ? (
                <div className="row">
                    <div className="col-sm-12 spatial-data-previewer-container">
                        <SpatialDataPreviewer
                            bbox={
                                props.countryId ||
                                props.territoryOrSteId ||
                                props.sa4Id ||
                                props.sa3Id
                                    ? props.bbox
                                    : DEFAULT_BBOX
                            }
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default RegionPanel;
