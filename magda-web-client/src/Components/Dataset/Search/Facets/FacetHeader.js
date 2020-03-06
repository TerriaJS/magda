import React, { Component } from "react";
import "./FacetHeader.scss";
import publisher_passive from "assets/publisher-passive.svg";
import format_passive from "assets/format-passive.svg";
import temporal_passive from "assets/temporal-passive.svg";
import region_passive from "assets/region-passive.svg";
import publisher_active from "assets/publisher-active.svg";
import format_active from "assets/format-active.svg";
import temporal_active from "assets/temporal-active.svg";
import region_active from "assets/region-active.svg";
import remove_light from "assets/remove-light.svg";
import { config } from "config";
import upperFirst from "lodash/upperFirst";

const IconList = {
    publisher_passive,
    format_passive,
    temporal_passive,
    region_passive,
    publisher_active,
    format_active,
    temporal_active,
    region_active
};
/**
 * Facet header component, contains a title of the facet and a reset button when there is a active facet
 */
class FacetHeader extends Component {
    constructor(props) {
        super(props);
        this.state = { buttonActive: false };
        this.headerDiv = React.createRef();
    }

    componentDidMount() {
        if (this.props.updateComponentAlignment) {
            this.props.updateComponentAlignment(
                this.headerDiv.current.getBoundingClientRect().x
            );
        }
    }

    componentDidUpdate() {
        // if it has filter and the button is not active
        // then set it to active
        if (this.hasFilter() !== this.state.buttonActive) {
            this.setState({
                buttonActive: this.hasFilter()
            });
        }

        if (this.props.updateComponentAlignment) {
            this.props.updateComponentAlignment(
                this.headerDiv.current.getBoundingClientRect().x
            );
        }
    }

    displayMonth(date) {
        return (
            config.months[new Date(date).getUTCMonth()] +
            " " +
            new Date(date).getUTCFullYear()
        );
    }

    calculateTitle() {
        if (this.props.title === "date range") {
            if (!this.hasFilter()) {
                return <span> Any date </span>;
            } else if (
                this.props.activeOptions[0] &&
                !this.props.activeOptions[1]
            ) {
                return (
                    <span>
                        {" "}
                        since {this.displayMonth(this.props.activeOptions[0])}
                    </span>
                );
            } else if (
                this.props.activeOptions[1] &&
                !this.props.activeOptions[0]
            ) {
                return (
                    <span>
                        {" "}
                        before {this.displayMonth(this.props.activeOptions[1])}
                    </span>
                );
            }
            return (
                <span>
                    {" "}
                    from {this.displayMonth(this.props.activeOptions[0])} -{" "}
                    {this.displayMonth(this.props.activeOptions[1])}{" "}
                </span>
            );
        } else {
            if (!this.hasFilter()) {
                return <span>{"Any " + this.props.title}</span>;
            } else if (this.props.activeOptions.length === 1) {
                return (
                    <span>
                        {this.props.activeOptions[0].value ||
                            this.props.activeOptions[0].regionType +
                                ": " +
                                this.props.activeOptions[0].regionName}{" "}
                    </span>
                );
            } else {
                return (
                    <span>
                        {`${this.props.title}s : ${
                            this.props.activeOptions.length
                        }`}{" "}
                    </span>
                );
            }
        }
    }

    calculateAltText() {
        // --- this.props.name can be used for the filter name except date filter
        const filterName = this.props.title;
        if (this.props.id === "temporal") {
            if (!this.hasFilter()) {
                return "Date filter: any date";
            } else if (
                this.props.activeOptions[0] &&
                !this.props.activeOptions[1]
            ) {
                return `Date filter: since ${this.displayMonth(
                    this.props.activeOptions[0]
                )}`;
            } else if (
                this.props.activeOptions[1] &&
                !this.props.activeOptions[0]
            ) {
                return `Date filter: before ${this.displayMonth(
                    this.props.activeOptions[1]
                )}`;
            }
            return `Date filter: from ${this.displayMonth(
                this.props.activeOptions[0]
            )} - ${this.displayMonth(this.props.activeOptions[1])}`;
        } else {
            if (!this.hasFilter()) {
                return `${upperFirst(filterName)} filter: any ${filterName}`;
            } else if (this.props.activeOptions.length === 1) {
                return `${upperFirst(filterName)} filter: ${this.props
                    .activeOptions[0].value ||
                    this.props.activeOptions[0].regionType +
                        ": " +
                        this.props.activeOptions[0].regionName}`;
            } else {
                return `${upperFirst(
                    filterName
                )} filter: ${this.props.activeOptions
                    .map(option => option.value)
                    .join(", ")}`;
            }
        }
    }

    calculateRemoveAltText() {
        if (this.props.id === "temporal") {
            return "Remove date filter";
        }
        const filterName = this.props.title;
        return `Remove ${filterName} filter`;
    }

    hasFilter() {
        let hasFilter = true;
        if (this.props.title === "date range") {
            if (this.props.activeOptions.every(o => !o)) {
                hasFilter = false;
            }
        } else {
            if (
                !this.props.activeOptions ||
                this.props.activeOptions.length === 0 ||
                !this.props.activeOptions[0] ||
                (this.props.title === "location" &&
                    !this.props.activeOptions[0].regionType)
            ) {
                hasFilter = false;
            }
        }
        return hasFilter;
    }

    render() {
        return (
            <div
                className={`facet-header ${
                    this.hasFilter() ? "not-empty" : ""
                }`}
                ref={this.headerDiv}
            >
                <button
                    className={`au-btn au-btn--secondary btn-facet ${
                        this.props.title
                    } ${this.props.isOpen ? "is-open" : ""}`}
                    onClick={this.props.onClick}
                    aria-label={this.calculateAltText()}
                    disabled={this.props.disabled}
                >
                    <img
                        className="facet-icon"
                        alt=""
                        src={
                            this.state.buttonActive
                                ? IconList[`${this.props.id}_active`]
                                : IconList[`${this.props.id}_passive`]
                        }
                    />
                    {this.calculateTitle()}
                </button>
                {this.props.hasQuery && (
                    <button
                        onClick={this.props.onResetFacet}
                        className="btn-remove au-btn"
                        aria-label={this.calculateRemoveAltText()}
                    >
                        <img alt="" src={remove_light} />
                    </button>
                )}
            </div>
        );
    }
}

FacetHeader.defaultProps = { title: "" };

export default FacetHeader;
