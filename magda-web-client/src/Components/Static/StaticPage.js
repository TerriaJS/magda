import React, { Component } from "react";
import { withRouter } from "react-router";
import Breadcrumbs from "Components/Common/Breadcrumbs";
import { Medium } from "Components/Common/Responsive";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";
import { safeLoadFront } from "yaml-front-matter/dist/yamlFront";
import { connect } from "react-redux";
import "./StaticPage.scss";

import { fetchStaticPage, updateStaticPage } from "actions/staticPagesActions";
import { bindActionCreators } from "redux";

import { ToggleEditor } from "Components/Editing/ToggleEditor";
import { textEditor } from "Components/Editing/Editors/textEditor";
import { markdownEditor } from "Components/Editing/Editors/markdownEditor";

class StaticPage extends Component {
    componentDidMount() {
        if (this.props.match.params.pageId) {
            this.props.fetchStaticPage(this.props.match.params.pageId);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.match.params.pageId !== this.props.match.params.pageId) {
            this.props.fetchStaticPage(this.props.match.params.pageId);
        }
    }

    render() {
        const title = this.props.page.title;
        const contentRaw = this.props.page.content;

        const content = safeLoadFront(contentRaw);
        const bodyContent = content.__content;

        const breadcrumb = [
            <li key={0}>
                <span>{title}</span>
            </li>
        ];

        const hasEditPermissions = this.props.hasEditPermissions;

        const save = field => {
            return newValue => {
                const { title, content } = this.props.page;
                const page = { title, content };
                page[field] = newValue;
                this.props.updateStaticPage(
                    this.props.match.params.pageId,
                    page
                );
            };
        };

        return (
            <MagdaDocumentTitle prefixes={[title]}>
                <div
                    className={`static-page-container page-${this.props.path}`}
                >
                    <Medium>
                        <Breadcrumbs breadcrumbs={breadcrumb} />
                    </Medium>
                    <div className="row">
                        <div className="col-sm-12">
                            <h1>
                                <ToggleEditor
                                    editable={hasEditPermissions}
                                    value={title}
                                    onChange={save("title")}
                                    editor={textEditor}
                                />
                            </h1>
                            <ToggleEditor
                                editable={hasEditPermissions}
                                value={bodyContent}
                                onChange={save("content")}
                                editor={markdownEditor}
                            />{" "}
                            {hasEditPermissions && (
                                <p>
                                    <a href="/admin/pages">Manage Pages</a>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </MagdaDocumentTitle>
        );
    }
}

function mapStateToProps(state, old) {
    const path = old.match.params.pageId;
    const hasEditPermissions =
        state.userManagement &&
        state.userManagement.user &&
        state.userManagement.user.isAdmin;
    return {
        strings: state.content.strings,
        path,
        page: state.staticPages[path] || {
            title: "Loading...",
            content: "Loading..."
        },
        hasEditPermissions: hasEditPermissions ? true : false
    };
}

const mapDispatchToProps = dispatch => {
    return bindActionCreators(
        {
            fetchStaticPage,
            updateStaticPage
        },
        dispatch
    );
};

export default withRouter(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(StaticPage)
);
