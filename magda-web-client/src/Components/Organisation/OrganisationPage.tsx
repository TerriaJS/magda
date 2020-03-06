import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Link } from "react-router-dom";

import ErrorHandler from "Components/Error/ErrorHandler";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";
import MagdaNamespacesConsumer from "Components/i18n/MagdaNamespacesConsumer";
import {
    fetchPublisherIfNeeded,
    resetFetchPublisher
} from "actions/publisherActions";
import OverviewBox from "Components/Common/OverviewBox";
import ProgressBar from "Components/Common/ProgressBar";
import Breadcrumbs from "Components/Common/Breadcrumbs";
import { Medium } from "Components/Common/Responsive";
import {
    fetchSearchResultsIfNeeded,
    resetDatasetSearch
} from "actions/datasetSearchActions";
import "./OrganisationPage.scss";

class PublisherDetails extends Component<any> {
    componentDidMount() {
        this.props.fetchPublisherIfNeeded(this.props.match.params.publisherId);
    }

    componentDidUpdate(prevProps) {
        if (
            prevProps.match.params.publisherId !==
            this.props.match.params.publisherId
        ) {
            this.props.fetchPublisherIfNeeded(
                this.props.match.params.publisherId
            );
        } else if (
            this.props.publisher.name &&
            this.props.publisher.name !== this.props.searchPublisherName
        ) {
            this.props.resetDatasetSearch();
            this.props.fetchSearchResultsIfNeeded({
                publisher: this.props.publisher.name
            });
        }
    }

    componentWillUnmount() {
        this.props.resetFetchPublisher();
    }

    renderContent(translate) {
        const publisher = this.props.publisher;
        const details = publisher.aspects["organization-details"];
        const description =
            details.description && details.description.length > 0
                ? details.description
                : translate(["publisherHasNoDescMessage", "No description"]);

        const breadcrumbs = [
            <li key="organisations">
                <Link to="/organisations">
                    {translate(["publishersBreadCrumb", "Publishers"])}
                </Link>
            </li>,
            <li key={publisher.name}>
                <span>{publisher.name}</span>
            </li>
        ];

        const hitCount = this.props.hitCount ? this.props.hitCount + " " : "";

        return (
            <MagdaDocumentTitle
                prefixes={[
                    publisher.name,
                    translate(["publishersBreadCrumb", "Publishers"])
                ]}
            >
                <div className="publisher-details">
                    <div>
                        <Medium>
                            <Breadcrumbs breadcrumbs={breadcrumbs} />
                        </Medium>
                        <div className="publisher-details__body">
                            <div className="media">
                                <div className="media-body publisher-details-title">
                                    <h1>{publisher.name}</h1>
                                    {publisher.aspects &&
                                    publisher.aspects["organization-details"] &&
                                    publisher.aspects["organization-details"]
                                        .jurisdiction ? (
                                        <div>
                                            {
                                                publisher.aspects[
                                                    "organization-details"
                                                ].jurisdiction
                                            }
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="publisher-details-overview">
                                <OverviewBox content={description} />
                            </div>

                            {(details.email ||
                                details.website ||
                                details.phone) && (
                                <div className="publisher-details-contacts">
                                    <h3 className="section-heading">
                                        Contact details
                                    </h3>
                                    {details.email && (
                                        <div className="publisher-details-contacts-item">
                                            Email:&nbsp;
                                            <a
                                                href={emailLink(details.email)}
                                                className="url"
                                            >
                                                {details.email}
                                            </a>
                                        </div>
                                    )}
                                    {details.website && (
                                        <div className="publisher-details-contacts-item">
                                            Website:{" "}
                                            <a
                                                href={details.website}
                                                className="url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {details.website}
                                            </a>
                                        </div>
                                    )}
                                    {details.phone && (
                                        <div className="publisher-details-contacts-item">
                                            Phone: {details.phone}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div />

                            <br />
                            <div>
                                <Link
                                    className="au-cta-link"
                                    to={{
                                        pathname: "/search",
                                        search: `?organisation=${encodeURIComponent(
                                            publisher.name
                                        )}`,
                                        state: {
                                            showFilterExplanation: true
                                        }
                                    }}
                                >
                                    View all {hitCount}
                                    datasets from {publisher.name}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </MagdaDocumentTitle>
        );
    }

    render() {
        return (
            <MagdaNamespacesConsumer ns={["publisherPage"]}>
                {translate => {
                    if (this.props.error) {
                        return <ErrorHandler error={this.props.error} />;
                    } else if (this.props.isFetching) {
                        return <ProgressBar />;
                    } else if (
                        decodeURIComponent(
                            this.props.match.params.publisherId
                        ) === this.props.publisher.id
                    ) {
                        return (
                            <MagdaDocumentTitle
                                prefixes={[this.props.publisher.name]}
                            >
                                {this.renderContent(translate)}
                            </MagdaDocumentTitle>
                        );
                    } else {
                        return (
                            <div className="au-pager-alerts au-page-alerts--info notification__inner">
                                {translate([
                                    "publisherNotFoundMessage",
                                    "Publisher not found"
                                ])}
                            </div>
                        );
                    }
                }}
            </MagdaNamespacesConsumer>
        );
    }
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators(
        {
            fetchPublisherIfNeeded: fetchPublisherIfNeeded,
            resetFetchPublisher: resetFetchPublisher,
            fetchSearchResultsIfNeeded: fetchSearchResultsIfNeeded,
            resetDatasetSearch: resetDatasetSearch
        },
        dispatch
    );
}

function mapStateToProps(state: any, ownProps: any) {
    const publisher: any = state.publisher.publisher;
    const isFetching: boolean = state.publisher.isFetchingPublisher;
    const error: object = state.publisher.errorFetchingPublisher;
    const location: Location = ownProps.location;
    const datasetSearch: any = state.datasetSearch;
    const searchPublisherName =
        datasetSearch.queryObject && datasetSearch.queryObject.publisher;
    const hitCount = datasetSearch.hitCount;
    return {
        publisher,
        isFetching,
        location,
        searchPublisherName,
        hitCount,
        error,
        strings: state.content.strings
    };
}

function emailLink(address: string) {
    if (address.match(/^[a-z]+:/)) {
        return address;
    } else {
        return "mailto:" + address;
    }
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PublisherDetails);
