import React from "react";

import {
    listContent,
    deleteContent,
    writeContent
} from "actions/contentActions";
import { config } from "config";
import { ToggleEditor } from "Components/Editing/ToggleEditor";
import { textEditor } from "Components/Editing/Editors/textEditor";

import readFile from "helpers/readFile";
import readImage from "helpers/readImage";
import resizeImage from "helpers/resizeImage";
import AdminHeader from "Components/Admin/AdminHeader";

export default class HighlightsAdminPage extends React.Component<any, any> {
    state = {
        deleteId: "",
        items: []
    };

    updateState(update: any) {
        this.setState((state, props) => Object.assign({}, state, update));
    }

    refresh() {
        listContent("home/highlights/*", "home/highlight-images/*").then(
            highlights => {
                let items = {};
                for (const item of highlights) {
                    if (item.id.indexOf("home/highlight-images/") === 0) {
                        const [, , id, width] = item.id.split("/");
                        items[id] = items[id] || { images: [] };
                        items[id].images.push(width);
                        items[id].images.sort();
                    } else if (item.id.indexOf("home/highlights/") === 0) {
                        const [, , id] = item.id.split("/");
                        items[id] = items[id] || { images: [] };
                        Object.assign(items[id], item.content);
                    }
                }
                items = Object.entries(items).map(params => {
                    let [id, body] = params;
                    return Object.assign(body, { id });
                });
                this.updateState({ items });
            }
        );
    }

    componentDidMount() {
        this.refresh();
    }

    render() {
        const { items } = this.state;

        items.sort((a: any, b: any) => (a.id > b.id ? 1 : -1));

        return (
            <div>
                <AdminHeader title={"Highlights"} />
                {items.length === 0 ? (
                    <p>No highlights</p>
                ) : (
                    <div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Highlight Image</th>
                                    <th>Text / Link</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(this.renderItem.bind(this))}
                            </tbody>
                        </table>
                    </div>
                )}
                <h2>Add New</h2>
                <button onClick={this.addNewItem.bind(this)}>
                    Add New Highlight
                </button>
            </div>
        );
    }

    renderItem(item) {
        const save = field => {
            return async value => {
                const { text, url } = item;
                const toSave = {
                    text: text || undefined,
                    url: url || undefined
                };
                toSave[field] = value || undefined;
                Object.assign(item, toSave);
                await writeContent(
                    `home/highlights/${item.id}`,
                    toSave,
                    "application/json"
                );
            };
        };

        const { deleteId } = this.state;
        return (
            <tr>
                <td>
                    <img
                        src={`${config.contentApiURL}home/highlight-images/${
                            item.id
                        }/${item.images[Math.min(1, item.images.length - 1)]}`}
                        alt="Highlight"
                        style={{
                            maxWidth: "367px",
                            maxHeight: "70px"
                        }}
                    />
                </td>
                <td>
                    <p>
                        Text:{" "}
                        <ToggleEditor
                            editable={true}
                            editor={textEditor}
                            value={item.text}
                            onChange={save("text")}
                        />
                        <br />
                        Link:{" "}
                        <ToggleEditor
                            editable={true}
                            editor={textEditor}
                            value={item.url}
                            onChange={save("url")}
                        />
                    </p>
                </td>
                <td>
                    {item.id === deleteId ? (
                        <div className="au-body au-page-alerts au-page-alerts--warning">
                            <div>Do you really want to delete this item?</div>
                            <div>
                                <button
                                    className="au-btn"
                                    onClick={() => this.deleteItem(item)}
                                >
                                    Yes
                                </button>{" "}
                                <button
                                    className="au-btn au-btn--secondary"
                                    onClick={() =>
                                        this.updateState({ deleteId: "" })
                                    }
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() =>
                                this.updateState({
                                    deleteId: item.id
                                })
                            }
                        >
                            Delete
                        </button>
                    )}
                </td>
            </tr>
        );
    }

    async deleteItem(item) {
        let toDelete = await listContent(
            `home/highlights/${item.id}`,
            `home/highlight-images/${item.id}/*`
        );
        for (let item of toDelete) {
            await deleteContent(item.id);
        }
        this.refresh();
    }

    async addNewItem() {
        try {
            console.log("Reading file");
            const { data } = await readFile("image/*", "DataURL");
            const image = await readImage(data);
            if (image.width < 720) {
                throw new Error("Image width must be at least 720px");
            }
            if (image.height < 978) {
                throw new Error("Image height must be at least 978px");
            }

            console.log("Resizing image");

            const images = {};

            for (let w of [
                [0, 550, 978],
                [720, 720, 405],
                [1080, 1080, 677],
                [1440, 1440, 902],
                [2160, 2160, 1353]
            ]) {
                const [dim, width, height] = w;
                if (image.width >= width) {
                    images[`${dim}w`] = resizeImage(image, width, height);
                }
            }

            if (Object.keys(images).length < 2) {
                throw new Error(
                    " [ Less than two images could be generated. Please try a different image. ]"
                );
            }

            console.log("Uploading images");

            const id = `home/highlights/${Date.now()}`;
            await writeContent(id, {}, "application/json");

            for (const width of Object.keys(images)) {
                const newId = `${id.replace(
                    "highlights",
                    "highlight-images"
                )}/${width}`;
                await writeContent(newId, images[width], "image/jpeg");
            }

            console.log("done");

            this.refresh();
        } catch (e) {
            console.error(e);
        }
    }
}
