import React, { useState, FunctionComponent } from "react";
import { config } from "config";
import { Region } from "helpers/datasetSearch";
import Tabs from "./Tabs";
import RegionPanel from "./RegionPanel";
import CoordinatesPanel from "./CoordinatesPanel";

import { BoundingBox } from "helpers/datasetSearch";

import "./index.scss";
import ToolTip from "../ToolTip";

interface StateType {
    activeTabIndex: number;
    countryId?: string;
    territoryOrSteId?: string;
    sa4Id?: string;
    sa3Id?: string;
    sa2Id?: string;
    bbox?: BoundingBox;
}

/**
 * bbox: CoordinatesPanel input
 * region: RegionPanel input
 * map: reserve for future usage
 */
export type InputMethod = "bbox" | "region" | "map";

interface PropsType {
    countryId?: string;
    territoryOrSteId?: string;
    sa4Id?: string;
    sa3Id?: string;
    bbox?: BoundingBox;
    onChange?: (
        method: InputMethod,
        bbox?: BoundingBox,
        countryId?: string,
        territoryOrSteId?: string,
        sa4Id?: string,
        sa3Id?: string
    ) => void;
}

const initialState = (props: PropsType) => ({
    activeTabIndex: (() => {
        if (
            props.bbox &&
            props.bbox.east &&
            props.bbox.north &&
            props.bbox.south &&
            props.bbox.west &&
            !props.countryId &&
            !props.territoryOrSteId &&
            !props.sa4Id &&
            !props.sa3Id
        ) {
            return 1;
        }
        return 0;
    })(),
    countryId: "",
    steIdOrTerritoryId: "",
    sa4Id: "",
    sa3Id: "",
    bbox: {
        west: config.boundingBox.west,
        north: config.boundingBox.north,
        south: config.boundingBox.south,
        east: config.boundingBox.east
    }
});

const SpatialAreaInput: FunctionComponent<PropsType> = props => {
    const [state, setState] = useState<StateType>(initialState(props));
    const onRegionPanelChange = (
        region?: Region,
        countryId?: string,
        territoryOrSteId?: string,
        sa4Id?: string,
        sa3Id?: string,
        bbox?: BoundingBox
    ) => {
        if (typeof props.onChange !== "function") return;
        if (!region) {
            props.onChange(
                "region",
                bbox,
                countryId,
                territoryOrSteId,
                sa4Id,
                sa3Id
            );
            return;
        }
        // --- regionId should be used depends on current region type
        props.onChange(
            "region",
            region.boundingBox,
            region.lv1Id ? region.lv1Id : region.regionId,
            region.lv2Id
                ? region.lv2Id
                : region.lv1Id
                ? region.regionId
                : territoryOrSteId
                ? territoryOrSteId
                : undefined,
            region.lv3Id
                ? region.lv3Id
                : region.lv2Id
                ? region.regionId
                : sa4Id
                ? sa4Id
                : undefined,
            region.lv4Id
                ? region.lv4Id
                : region.lv3Id
                ? region.regionId
                : sa3Id
                ? sa3Id
                : undefined
        );
    };

    const onCoordinatesPanelChange = (bbox?: BoundingBox) => {
        if (typeof bbox === "undefined" || typeof props.onChange !== "function")
            return;
        props.onChange("bbox", bbox);
    };

    return (
        <div className="spatial-area-input">
            <div className="row">
                <div className="col-sm-12">
                    <Tabs
                        activeTabIndex={state.activeTabIndex}
                        onChange={index =>
                            setState({
                                ...state,
                                activeTabIndex: index
                            })
                        }
                    />
                    <div className="text-row">
                        {(() => {
                            switch (state.activeTabIndex) {
                                case 0:
                                    return (
                                        <span>
                                            Select the appropriate region that
                                            best matches the spatial extent of
                                            your dataset:
                                            <ToolTip>
                                                This helps data users understand
                                                the scope of your dataset.
                                            </ToolTip>
                                        </span>
                                    );
                                case 1:
                                    return (
                                        <span>
                                            We’ve determined that the
                                            coordinates of your data are:
                                            <ToolTip>
                                                This helps data users understand
                                                the scope of your dataset.
                                            </ToolTip>
                                        </span>
                                    );
                                default:
                                    throw new Error(
                                        "Invalid tab index: " +
                                            state.activeTabIndex
                                    );
                            }
                        })()}
                    </div>
                    <div className="tab-content-container">
                        {(() => {
                            switch (state.activeTabIndex) {
                                case 0:
                                    return (
                                        <RegionPanel
                                            countryId={props.countryId}
                                            territoryOrSteId={
                                                props.territoryOrSteId
                                            }
                                            sa4Id={props.sa4Id}
                                            sa3Id={props.sa3Id}
                                            bbox={props.bbox}
                                            onChange={onRegionPanelChange}
                                        />
                                    );
                                case 1:
                                    return (
                                        <CoordinatesPanel
                                            bbox={props.bbox}
                                            onChange={onCoordinatesPanelChange}
                                        />
                                    );
                                default:
                                    throw new Error(
                                        "Invalid tab index: " +
                                            state.activeTabIndex
                                    );
                            }
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpatialAreaInput;
