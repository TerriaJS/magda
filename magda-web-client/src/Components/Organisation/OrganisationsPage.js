import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { fetchPublishersIfNeeded } from "actions/publisherActions";
import OrganisationSummary from "./OrganisationSummary";
import ErrorHandler from "Components/Error/ErrorHandler";
import getPageNumber from "helpers/getPageNumber";
import ProgressBar from "Components/Common/ProgressBar";
import Breadcrumbs from "Components/Common/Breadcrumbs";
import queryString from "query-string";
import PropTypes from "prop-types";
import debounce from "lodash/debounce";
import Pagination from "Components/Common/Pagination";
import "./OrganisationsPage.scss";
import search from "assets/search-dark.svg";
import { Medium } from "Components/Common/Responsive";
import { withRouter } from "react-router-dom";
import MagdaNamespacesConsumer from "Components/i18n/MagdaNamespacesConsumer";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";

class OrganisationsPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inputText: ""
        };
        this.onUpdateSearchText = this.onUpdateSearchText.bind(this);
        this.handleSearchFieldEnterKeyPress = this.handleSearchFieldEnterKeyPress.bind(
            this
        );
        this.onPageChange = this.onPageChange.bind(this);
        this.clearSearch = this.clearSearch.bind(this);
        this.onClickSearch = this.onClickSearch.bind(this);
        this.searchInputFieldRef = null;
        props.history.listen(location => {
            this.debounceUpdateSearchQuery.cancel();
        });
    }

    debounceUpdateSearchQuery = debounce(this.updateSearchQuery, 3000);

    onPageChange(i) {
        this.debounceUpdateSearchQuery(
            queryString.parse(this.props.location.search).q,
            i
        );
        this.debounceUpdateSearchQuery.flush();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.location.search !== this.props.location.search) {
            this.debounceUpdateSearchQuery.cancel();
            this.fetchData();
        }
    }

    componentDidMount() {
        const { q } = queryString.parse(this.props.location.search);
        const inputText = q && q.trim().length > 0 ? q : "";
        this.setState({ inputText });
        this.fetchData();
    }

    updateQuery(query) {
        if (
            typeof query.q === "undefined" &&
            typeof query.page === "undefined"
        ) {
            this.context.router.history.push({
                pathname: "/organisations"
            });
        } else {
            this.context.router.history.push({
                pathname: "/organisations",
                search: queryString.stringify(
                    Object.assign(
                        queryString.parse(this.props.location.search),
                        query
                    )
                )
            });
        }
    }

    fetchData() {
        const { q, page } = queryString.parse(this.props.location.search);
        let searchText = "*";
        if (q && q.trim().length > 0) {
            searchText = q;
        }
        const pageIndex = page
            ? page
            : getPageNumber(this.props)
            ? getPageNumber(this.props)
            : 1;
        this.props.fetchPublishersIfNeeded(pageIndex, searchText);
    }

    handleSearchFieldEnterKeyPress(event) {
        if (event.charCode === 13) {
            this.debounceUpdateSearchQuery(this.state.inputText, 1);
            this.debounceUpdateSearchQuery.flush();
        }
    }

    updateSearchQuery(text, page) {
        if (this.searchInputFieldRef) this.searchInputFieldRef.blur();
        this.updateQuery({
            q: text ? text.trim() : text,
            page: page
        });
    }

    clearSearch() {
        this.setState({
            inputText: ""
        });
        this.debounceUpdateSearchQuery();
        this.debounceUpdateSearchQuery.flush();
    }

    onUpdateSearchText(e) {
        this.setState({ inputText: e.target.value });
        this.debounceUpdateSearchQuery(e.target.value, 1);
    }

    onClickSearch() {
        this.debounceUpdateSearchQuery(this.state.inputText, 1);
        this.debounceUpdateSearchQuery.flush();
    }

    renderContent(translate) {
        if (this.props.error) {
            return <ErrorHandler error={this.props.error} />;
        } else {
            if (this.props.publishers.length === 0) {
                return (
                    <div className="au-page-alerts au-page-alerts--error">
                        {translate([
                            "noPublishersMatchSearchMessage",
                            "No publishers match your query"
                        ])}
                        <button
                            className="clear-btn au-btn au-btn--tertiary"
                            type="button"
                            onClick={this.clearSearch}
                        >
                            Clear search
                        </button>
                    </div>
                );
            }
            return (
                <div>
                    {this.props.keyword &&
                        this.props.keyword.trim().length > 0 &&
                        this.props.keyword.trim() !== "*" && (
                            <div className="result-count">
                                {`Results matching "${this.props.keyword}" (${
                                    this.props.hitCount
                                })`}
                                <button
                                    className="clear-btn au-btn au-btn--tertiary"
                                    type="button"
                                    onClick={this.clearSearch}
                                >
                                    Clear search
                                </button>
                            </div>
                        )}
                    {this.props.publishers.map(p => (
                        <OrganisationSummary publisher={p} key={p.identifier} />
                    ))}
                </div>
            );
        }
    }

    renderSearchBar(translate) {
        const placeholderText = translate([
            "publishersSearchPlaceholder",
            "Search for Publishers"
        ]);

        return (
            <div className="organization-search">
                <label htmlFor="organization-search" className="sr-only">
                    {placeholderText}
                </label>
                <input
                    className="au-text-input au-text-input--block organization-search"
                    name="organization-search"
                    id="organization-search"
                    type="text"
                    value={this.state.inputText}
                    placeholder={placeholderText}
                    onChange={this.onUpdateSearchText}
                    onKeyPress={this.handleSearchFieldEnterKeyPress}
                    ref={el => (this.searchInputFieldRef = el)}
                />
                <button
                    className="search-icon au-btn"
                    onClick={this.onClickSearch}
                >
                    <img src={search} alt="search" />
                </button>
            </div>
        );
    }

    render() {
        const currentPage =
            +queryString.parse(this.props.location.search).page || 1;
        const searchResultsPerPage = this.props.configuration
            .searchResultsPerPage;

        return (
            <MagdaNamespacesConsumer ns={["publishersPage"]}>
                {translate => (
                    <MagdaDocumentTitle
                        prefixes={[
                            translate(["publishersBreadCrumb", "Publishers"]),
                            `Page ${currentPage}`
                        ]}
                    >
                        <div className="publishers-viewer">
                            <Medium>
                                <Breadcrumbs
                                    breadcrumbs={[
                                        <li key="organisations">
                                            <span>
                                                {translate([
                                                    "publishersBreadCrumb",
                                                    "Publishers"
                                                ])}
                                            </span>
                                        </li>
                                    ]}
                                />
                            </Medium>

                            <div className="row">
                                <div className="publishers-viewer__header">
                                    <div className="col-sm-8">
                                        <h1>
                                            {translate([
                                                "publishersPageTitle",
                                                "Publishers"
                                            ])}
                                        </h1>
                                    </div>

                                    <div className="col-sm-4">
                                        {this.renderSearchBar(translate)}
                                    </div>
                                </div>

                                <div className="col-sm-8 org-result-page-body">
                                    {this.props.isFetching ? (
                                        <ProgressBar />
                                    ) : (
                                        this.renderContent(translate)
                                    )}
                                </div>
                            </div>
                            {!this.props.isFetching &&
                                !this.props.error &&
                                this.props.hitCount > searchResultsPerPage && (
                                    <Pagination
                                        currentPage={currentPage}
                                        maxPage={Math.ceil(
                                            this.props.hitCount /
                                                searchResultsPerPage
                                        )}
                                        location={this.props.location}
                                        totalItems={this.props.hitCount}
                                    />
                                )}
                        </div>
                    </MagdaDocumentTitle>
                )}
            </MagdaNamespacesConsumer>
        );
    }
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators(
        {
            fetchPublishersIfNeeded: fetchPublishersIfNeeded
        },
        dispatch
    );
}

function mapStateToProps(state, ownProps) {
    const publishers = state.publisher.publishers;
    const isFetching = state.publisher.isFetchingPublishers;
    const hitCount = state.publisher.hitCount;
    const error = state.publisher.errorFetchingPublishers;
    const keyword = state.publisher.keyword;
    return {
        publishers,
        isFetching,
        hitCount,
        error,
        keyword,
        strings: state.content.strings,
        configuration: state.content.configuration
    };
}

OrganisationsPage.contextTypes = {
    router: PropTypes.object.isRequired
};

const PublishersViewerWithRouter = withRouter(props => (
    <OrganisationsPage {...props} />
));

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PublishersViewerWithRouter);
