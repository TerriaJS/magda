import React, { Component } from "react";
import { Small } from "./Responsive";
import Spinner from "Components/Common/Spinner";
import ChartDatasetEncoder from "helpers/ChartDatasetEncoder";
import ChartConfig from "./ChartConfig";
import downArrowIcon from "assets/downArrow.svg";
import upArrowIcon from "assets/upArrow.svg";
import memoize from "memoize-one";
import { gapi } from "analytics/ga";
import { DataLoadingResult } from "helpers/CsvDataLoader";
import { ParsedDistribution } from "helpers/record";

import "./DataPreviewChart.scss";

type PropsType = {
    dataLoadError: Error | null;
    dataLoadingResult: DataLoadingResult | null;
    isLoading: boolean;
    distribution: ParsedDistribution;
    onChangeTab: (string) => void;
};

type StateType = {
    error: Error | null;
    avlXCols: any[];
    avlYCols: any[];
    xAxis: any;
    yAxis: any;
    chartOption: any;
    isExpanded: boolean;
    chartType: string;
    chartTitle: string;
};

let ReactEcharts;

const defaultChartType = "bar";

// we only do the auto redirect in the first time,
// subsequent tab switching does not trigger redirect
const switchTabOnFirstGo = memoize(
    props => props.onChangeTab("table"),
    (prev, next) =>
        prev.distribution.identifier === next.distribution.identifier
);

class DataPreviewChart extends Component<PropsType, StateType> {
    private chartDatasetEncoder: ChartDatasetEncoder = new ChartDatasetEncoder();

    constructor(props) {
        super(props);
        this.state = this.getResetState({
            chartType: defaultChartType,
            chartTitle: this.props.distribution.title
                ? this.props.distribution.title
                : "",
            isExpanded: true
        });
        this.onChartConfigChanged = this.onChartConfigChanged.bind(this);
        this.onToggleButtonClick = this.onToggleButtonClick.bind(this);
        this.onDismissError = this.onDismissError.bind(this);
    }

    getResetState(extraOptions: any = {}) {
        const options = {
            avlXCols: [],
            avlYCols: [],
            xAxis: null,
            yAxis: null,
            chartOption: null
        };
        if (!extraOptions) return options;
        else return { ...options, ...extraOptions };
    }

    resetChartState(extraOptions: any = {}) {
        this.setState(this.getResetState(extraOptions));
    }

    processChartDataUpdates(prevProps?: PropsType, prevState?: StateType) {
        if (
            prevProps &&
            prevProps.dataLoadingResult === this.props.dataLoadingResult &&
            prevState &&
            prevState.chartTitle === this.state.chartTitle &&
            prevState.chartType === this.state.chartType &&
            prevState.xAxis === this.state.xAxis &&
            prevState.yAxis === this.state.yAxis
        ) {
            return;
        }

        if (this.props.dataLoadError || !this.props.dataLoadingResult) {
            this.resetChartState({
                error: this.props.dataLoadError
                    ? this.props.dataLoadError
                    : null
            });
            return;
        }

        this.chartDatasetEncoder.processData(
            this.props.distribution,
            this.props.dataLoadingResult
        );

        let chartType = this.state.chartType;
        if (!this.state.xAxis || !this.state.yAxis) {
            this.chartDatasetEncoder.setDefaultParameters();
        } else {
            this.chartDatasetEncoder.setX(this.state.xAxis);
            this.chartDatasetEncoder.setY(this.state.yAxis);
        }

        if (!chartType) chartType = defaultChartType;
        this.chartDatasetEncoder.setChartType(chartType);
        const chartOption = this.chartDatasetEncoder.getChartOption("");

        this.setState({
            avlXCols: this.chartDatasetEncoder.getAvailableXCols(),
            avlYCols: this.chartDatasetEncoder.getAvailableYCols(),
            xAxis: this.chartDatasetEncoder.xAxis,
            yAxis: this.chartDatasetEncoder.yAxis,
            chartType,
            chartOption
        });
    }

    async componentDidMount() {
        try {
            if (!ReactEcharts) {
                ReactEcharts = (await import("echarts-for-react")).default;
            }
            this.processChartDataUpdates();
        } catch (e) {
            this.resetChartState({
                error: e
            });

            gapi.event({
                category: "Error",
                action: `Failed to display chart for ${window.location.href}: ${
                    e.message
                }`,
                label: "Chart Display Failure",
                nonInteraction: true
            });

            // if there is error, automatically switch to table view
            switchTabOnFirstGo(this.props);
        }
    }

    async componentDidUpdate(prevProps, prevState) {
        try {
            this.processChartDataUpdates(prevProps, prevState);
        } catch (e) {
            // we do not automatically switch to table view here because chart has already successfully rendered.
            // for subsequent error cause the chart to not render, we will just display an error message
            this.setState(
                this.getResetState({
                    error: e
                })
            );
        }
    }

    onChartConfigChanged(key, value) {
        this.setState({ [key]: value } as any);
    }

    onToggleButtonClick(e) {
        e.preventDefault();
        this.setState({
            isExpanded: !this.state.isExpanded
        });
    }

    onDismissError() {
        // switch to table tab on dismiss error
        this.props.onChangeTab("table");
    }

    render() {
        if (this.state.error)
            return (
                <div
                    className={`au-page-alerts au-page-alerts--error notification__inner`}
                >
                    <h3>Oops</h3>
                    <p>Chart preview not available, please try table preview</p>
                    <button
                        onClick={this.onDismissError}
                        className="switch-tab-btn"
                    >
                        Switch to table preview
                    </button>
                </div>
            );
        if (this.props.isLoading) return <Spinner height="420px" />;
        if (!ReactEcharts)
            return <div>Unexpected Error: failed to load chart component.</div>;

        if (
            this.props.dataLoadingResult &&
            this.props.dataLoadingResult.isPartialData
        ) {
            return (
                <div
                    className={`au-page-alerts au-page-alerts--error notification__inner`}
                >
                    <h3>Oops</h3>
                    <p>
                        Chart preview not available due to the overlimit data
                        file size, please try table preview
                    </p>
                    <button
                        onClick={this.onDismissError}
                        className="switch-tab-btn"
                    >
                        Switch to table preview
                    </button>
                </div>
            );
        }

        return (
            <div className="row data-preview-chart">
                <div className="col-sm-8 chart-panel-container">
                    <h4 className="chart-title">{this.state.chartTitle}</h4>
                    {this.state.chartOption ? (
                        <ReactEcharts
                            className="data-preview-chart-container"
                            style={{ height: "450px", color: "yellow" }}
                            lazyUpdate={true}
                            option={this.state.chartOption}
                            theme="au_dga"
                        />
                    ) : (
                        <div style={{ height: "450px" }}>&nbsp;</div>
                    )}
                </div>
                <div className="col-sm-4 config-panel-container">
                    {this.state.isExpanded ? (
                        <ChartConfig
                            chartType={this.state.chartType}
                            chartTitle={this.state.chartTitle}
                            xAxis={this.state.xAxis}
                            yAxis={this.state.yAxis}
                            xAxisOptions={this.state.avlXCols}
                            yAxisOptions={this.state.avlYCols}
                            onChange={this.onChartConfigChanged}
                        />
                    ) : null}
                    <Small>
                        {this.state.isExpanded ? (
                            <button
                                className="toggle-button"
                                onClick={e => this.onToggleButtonClick(e)}
                            >
                                <span>Hide chart options</span>
                                <img src={upArrowIcon} alt="upArrowIcon" />
                            </button>
                        ) : (
                            <button
                                className="toggle-button"
                                onClick={e => this.onToggleButtonClick(e)}
                            >
                                <span>Show chart options</span>
                                <img src={downArrowIcon} alt="downArrow" />
                            </button>
                        )}
                    </Small>
                </div>
            </div>
        );
    }
}

export default DataPreviewChart;
