import React, { Component } from "react";

import ContentAdminPage from "Components/Admin/ContentAdminPage";

import ContentImageEditor from "Components/Admin/ContentImageEditor";

import { ToggleEditor } from "Components/Editing/ToggleEditor";
import { textEditor } from "Components/Editing/Editors/textEditor";
import { markdownEditor } from "Components/Editing/Editors/markdownEditor";

export default class StoriesAdminPage extends Component {
    render() {
        return (
            <ContentAdminPage
                title="Stories"
                itemTitle="Story"
                generateNewId={id => `home/stories/${Date.now()}`}
                titleFromItem={item => item.content.title}
                pattern="home/stories/*"
                newContent={{
                    title: "New Story Title",
                    order: 999,
                    content: "New Story Content",
                    titleUrl: "http://magda.io"
                }}
                hasOrder={true}
                edit={editStory}
            />
        );
    }
}

function editStory(item, onChange) {
    const itemId = item.id;
    const save = field => value => {
        item.content[field] = value;
        onChange(item.content);
    };
    return (
        <div>
            <h1>
                <ToggleEditor
                    editable={true}
                    value={item.content.title}
                    onChange={save("title")}
                    editor={textEditor}
                />
            </h1>
            <p>
                <ContentImageEditor
                    hasEditPermissions={true}
                    imageItemId={itemId.replace("stories", "story-images")}
                    accept="image/*"
                />
            </p>
            <p>
                Linked to:{" "}
                <ToggleEditor
                    editable={true}
                    value={item.content.titleUrl}
                    onChange={save("titleUrl")}
                    editor={textEditor}
                />
            </p>

            <ToggleEditor
                editable={true}
                value={item.content.content}
                onChange={save("content")}
                editor={markdownEditor}
            />
        </div>
    );
}
