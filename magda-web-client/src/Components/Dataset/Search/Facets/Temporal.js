import {
    setDateFrom,
    setDateTo,
    resetDateFrom,
    resetDateTo
} from "actions/datasetSearchActions";
import { connect } from "react-redux";
import defined from "helpers/defined";
import React, { Component } from "react";
import TemporalWrapper from "./TemporalWrapper";

class Temporal extends Component {
    constructor(props) {
        super(props);
        this.onResetTemporalFacet = this.onResetTemporalFacet.bind(this);
        this.onToggleTemporalOption = this.onToggleTemporalOption.bind(this);
        this.state = {
            disableApplyTemporal: false
        };
    }

    onToggleTemporalOption(datesArray) {
        const dateTo = datesArray[1] ? datesArray[1] : undefined;
        const dateFrom = datesArray[0] ? datesArray[0] : undefined;
        this.props.updateQuery({
            dateFrom: dateFrom,
            dateTo: dateTo,
            page: undefined
        });
        this.props.dispatch(setDateTo(dateTo));
        this.props.dispatch(setDateFrom(dateFrom));
        this.props.closeFacet();
    }

    onResetTemporalFacet() {
        this.props.updateQuery({
            dateFrom: undefined,
            dateTo: undefined,
            page: undefined
        });
        // dispatch event
        this.props.dispatch(resetDateFrom());
        this.props.dispatch(resetDateTo());
        this.props.closeFacet();
        this.setState(() => {
            return {
                disableApplyTemporal: false
            };
        });
    }

    render() {
        return (
            <TemporalWrapper
                title="date range"
                id="temporal"
                hasQuery={
                    defined(this.props.activeDateFrom) ||
                    defined(this.props.activeDateTo)
                }
                activeDates={[
                    this.props.activeDateFrom,
                    this.props.activeDateTo
                ]}
                onToggleOption={this.onToggleTemporalOption}
                onResetFacet={this.onResetTemporalFacet}
                toggleFacet={this.props.toggleFacet}
                isOpen={this.props.isOpen}
                temporalRange={this.props.temporalRange}
                disableApply={this.state.disableApplyTemporal}
                disableOpen={!defined(this.props.temporalRange)}
            />
        );
    }
}

function mapStateToProps(state) {
    let { datasetSearch } = state;
    return {
        activeDateFrom: datasetSearch.activeDateFrom,
        activeDateTo: datasetSearch.activeDateTo,
        temporalRange: datasetSearch.temporalRange
    };
}

export default connect(mapStateToProps)(Temporal);
