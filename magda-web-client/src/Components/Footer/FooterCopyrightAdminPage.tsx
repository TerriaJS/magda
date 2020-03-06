import React, { Component } from "react";

import ContentAdminPage from "Components/Admin/ContentAdminPage";
import { ToggleEditor } from "Components/Editing/ToggleEditor";
import { textEditor } from "Components/Editing/Editors/textEditor";
import { base64ImageEditor } from "Components/Editing/Editors/imageEditor";
import { withRouter } from "react-router";

class StoriesAdminPage extends Component<any, any> {
    render() {
        const pathPrefix = `footer/copyright`;
        return (
            <ContentAdminPage
                title="Footer Copyright"
                itemTitle="Copyright"
                generateNewId={id => `${pathPrefix}/${Date.now()}`}
                titleFromItem={item =>
                    item.content.logoAlt || item.content.htmlContent
                }
                pattern={`${pathPrefix}/*`}
                newContent={{
                    order: 999,
                    logoSrc:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAKCAYAAAD2Fg1xAAAAI0lEQVR42u3PAREAMAgAoTe50bceHjRgXm0HjIiIiIiIiEh9iR0O99ylthgAAAAASUVORK5CYII=",
                    href: "http://magda.io",
                    htmlContent: "New Copyright"
                }}
                hasOrder={true}
                edit={this.edit.bind(this)}
            />
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
                    Prefix:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={textEditor}
                        value={value.htmlContent}
                        onChange={save("htmlContent")}
                    />
                </p>
                <p style={{ backgroundColor: "grey" }}>
                    Image:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={base64ImageEditor}
                        value={value.logoSrc}
                        onChange={save("logoSrc")}
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
                <p>
                    Hover Text:{" "}
                    <ToggleEditor
                        editable={true}
                        editor={textEditor}
                        value={value.logoAlt}
                        onChange={save("logoAlt")}
                    />
                </p>
            </div>
        );
    }
}

export default withRouter(StoriesAdminPage);
