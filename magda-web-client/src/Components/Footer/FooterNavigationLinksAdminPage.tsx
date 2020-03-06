import React, { Component } from "react";

import ContentAdminPage from "Components/Admin/ContentAdminPage";
import { ToggleEditor } from "Components/Editing/ToggleEditor";
import { textEditor } from "Components/Editing/Editors/textEditor";
import { withRouter } from "react-router";

import { readContent, updateContent } from "actions/contentActions";

class StoriesAdminPage extends Component<any, any> {
    state = {
        category: null
    };

    updateState(update: any) {
        this.setState((state, props) => Object.assign({}, state, update));
    }
    componentDidMount() {
        const { category, size } = this.props.match.params;
        const categoryPathPrefix = `footer/navigation/${size}/category/${category}`;
        readContent(categoryPathPrefix).then(category =>
            this.updateState({ category })
        );
    }
    render() {
        const { category, size } = this.props.match.params;
        const pathPrefix = `footer/navigation/${size}/category-links/${category}`;

        let cat: any = this.state.category;
        const categoryLabel = cat ? cat.label : "Loading...";
        const categoryPathPrefix = `footer/navigation/${size}/category/${category}`;
        const saveCategoryLabel = value => {
            updateContent(categoryPathPrefix, {
                label: value
            });
        };
        return (
            <div>
                <ContentAdminPage
                    title={categoryLabel}
                    itemTitle="Link"
                    generateNewId={id => `${pathPrefix}/${Date.now()}`}
                    titleFromItem={item => item.content.label}
                    pattern={`${pathPrefix}/*`}
                    newContent={{
                        order: 999,
                        label: "Link",
                        href: "http://magda.io"
                    }}
                    hasOrder={true}
                    edit={this.edit.bind(this)}
                />
                <p>
                    Edit Label:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={textEditor}
                        value={categoryLabel}
                        onChange={saveCategoryLabel}
                    />
                </p>
                <p>
                    <a href={`/admin/footer-navigation/${size}`}>
                        Back to Footer Navigation
                    </a>
                </p>
            </div>
        );
    }
    edit(item, onChange) {
        const save = field => {
            return value => {
                onChange(
                    Object.assign({}, item.content, {
                        [field]: value
                    })
                );
            };
        };
        const value = item.content;
        return (
            <div>
                <p>
                    Label:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={textEditor}
                        value={value.label}
                        onChange={save("label")}
                    />
                </p>
                <p>
                    Link:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={textEditor}
                        value={value.href}
                        onChange={save("href")}
                    />
                </p>
            </div>
        );
    }
}

export default withRouter(StoriesAdminPage);
