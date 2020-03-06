import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { connect } from "react-redux";
import RLDD from "react-list-drag-and-drop/lib/RLDD";

import Reveal from "Components/Common/Reveal";
import Spinner from "Components/Common/Spinner";

import {
    createContent,
    listContent,
    deleteContent,
    updateContent,
    writeContent
} from "actions/contentActions";
import humanFileSize from "helpers/humanFileSize";
import AdminHeader from "./AdminHeader";

class ContentAdminPage extends Component<any, any> {
    state = {
        newId: "",
        newIdValid: false,
        newIdAdded: false,
        deleteId: "",
        editId: "",
        viewId: "",
        list: [],
        listLoading: true,
        orderChanged: false
    };

    refresh() {
        listContent(this.props.pattern).then(list => {
            list.sort((a, b) => {
                a = (a.content && a.content.order) || 0;
                b = (b.content && b.content.order) || 0;
                return a - b;
            });
            this.updateState({ list, listLoading: false, orderChanged: false });
        });
    }

    updateState(update: any) {
        this.setState((state, props) => Object.assign({}, state, update));
    }

    componentDidMount() {
        this.refresh();
    }

    newIdChange(e) {
        const value = e.target.value;
        if (value.match(/^[a-z0-9-]*$/)) {
            this.updateState({ newId: value, newIdValid: !!value });
        }
    }

    async addNew(e) {
        let newId = this.props.generateNewId(
            (this.props.newIdInput && this.state.newId) || ""
        );

        await createContent(newId, this.props.newContent);

        this.updateState({ newId: "", newIdValid: false, newIdAdded: newId });
        this.refresh();
    }

    async deleteItemConfirm(id) {
        await deleteContent(id);
        this.refresh();
    }

    async deleteItem(id) {
        this.updateState({ deleteId: id });
    }

    render() {
        const {
            edit,
            title,
            itemTitle,
            hasEditPermissions,
            hasOrder
        } = this.props;

        const { editId, list, listLoading } = this.state;

        if (!hasEditPermissions) {
            return <span>For admins only</span>;
        }
        if (listLoading) {
            return <Spinner />;
        }

        return (
            <div>
                <AdminHeader title={title} />

                {edit &&
                list.filter((item: any) => item.id === editId).length > 0 ? (
                    this.renderEdit(
                        list.filter((item: any) => item.id === editId)[0]
                    )
                ) : (
                    <div>
                        {list.length === 0 ? (
                            <p>No {itemTitle} found.</p>
                        ) : hasOrder ? (
                            this.renderOrdered()
                        ) : (
                            this.renderUnordered()
                        )}

                        {this.renderNewForm()}
                    </div>
                )}
            </div>
        );
    }

    renderUnordered() {
        const { itemTitle, titleFromItem } = this.props;
        const { list } = this.state;
        return (
            <table>
                <thead>
                    <tr>
                        <th>{itemTitle}</th>
                        <th>Size</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((item: any) => {
                        return (
                            <tr>
                                <td>{titleFromItem(item)}</td>
                                <td>{humanFileSize(item.length)}</td>
                                <td>{this.renderItemControls(item)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }

    renderOrdered() {
        const { titleFromItem } = this.props;
        const { list, orderChanged } = this.state;
        const itemStyle = {
            display: "block",
            border: "1px solid black",
            padding: ".5em",
            cursor: "pointer"
        };
        return (
            <div>
                <RLDD
                    items={list.map((item, id) => {
                        return { id, item };
                    })}
                    itemRenderer={(wrapper: any) => {
                        let item = wrapper.item;
                        return (
                            <div style={itemStyle}>
                                <h3>
                                    {titleFromItem(item)}{" "}
                                    <small>
                                        [{humanFileSize(item.length)}]
                                    </small>
                                </h3>
                                <div>{this.renderItemControls(item)}</div>
                            </div>
                        );
                    }}
                    onChange={items => {
                        this.updateState({
                            list: items.map((item: any) => item.item),
                            orderChanged: true
                        });
                    }}
                />
                {orderChanged && (
                    <React.Fragment>
                        <button
                            className="au-btn"
                            onClick={this.saveOrder.bind(this)}
                        >
                            Save order
                        </button>
                        <button
                            className="au-btn"
                            onClick={this.refresh.bind(this)}
                        >
                            Cancel
                        </button>
                    </React.Fragment>
                )}
            </div>
        );
    }

    renderNewForm() {
        const { itemTitle, newIdInput, link } = this.props;

        const { newId, newIdValid, newIdAdded } = this.state;
        const canAddNew = !newIdInput || newIdValid;
        return (
            <div>
                <Reveal label={`Add New ${itemTitle}`}>
                    <h2>Add New {itemTitle}</h2>
                    <div>
                        {newIdInput && (
                            <React.Fragment>
                                <p>
                                    <label htmlFor="inputId">
                                        Please insert an id for the{" "}
                                        {itemTitle.toLowerCase()}. It must be
                                        all lowercase and only consist of
                                        alphanumeric characters and dash.
                                    </label>
                                </p>
                                <input
                                    id="inputId"
                                    className="au-text-input"
                                    value={newId}
                                    required
                                    pattern="[a-z0-9-]+"
                                    onChange={this.newIdChange.bind(this)}
                                />
                            </React.Fragment>
                        )}
                        {canAddNew && (
                            <button
                                className="au-btn"
                                onClick={this.addNew.bind(this)}
                            >
                                Add {itemTitle}
                            </button>
                        )}
                    </div>
                    {newIdAdded &&
                        (link ? (
                            <Redirect to={link(newIdAdded)} />
                        ) : (
                            <span>Added!</span>
                        ))}
                </Reveal>
            </div>
        );
    }

    async saveOrder() {
        await Promise.all(
            this.state.list.map(async (item: any, index) => {
                if (item.content.order !== index) {
                    await updateContent(item.id, { order: index });
                }
            })
        );
        this.refresh();
    }

    renderItemControls(item) {
        const { link, edit } = this.props;
        const { deleteId, viewId } = this.state;
        return (
            <div>
                {edit ? (
                    <button
                        onClick={() => this.updateState({ editId: item.id })}
                    >
                        Edit
                    </button>
                ) : item.id === viewId ? (
                    <Redirect to={link(item.id)} />
                ) : (
                    <button
                        onClick={() => this.updateState({ viewId: item.id })}
                    >
                        View
                    </button>
                )}{" "}
                {item.id === deleteId ? (
                    <div className="au-body au-page-alerts au-page-alerts--warning">
                        <div>Do you really want to delete this item?</div>
                        <div>
                            <button
                                className="au-btn"
                                onClick={this.deleteItemConfirm.bind(
                                    this,
                                    item.id
                                )}
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
                        onClick={() => this.updateState({ deleteId: item.id })}
                    >
                        Delete
                    </button>
                )}
            </div>
        );
    }
    renderEdit(item) {
        const { itemTitle } = this.props;
        const save = async data => {
            data.order = item.content.order;
            await writeContent(item.id, data, "application/json");
            this.refresh();
        };
        return (
            <div>
                <h2>Edit {itemTitle}</h2>
                {this.props.edit(item, save)}
                <button onClick={() => this.updateState({ editId: "" })}>
                    Done
                </button>
            </div>
        );
    }
}

function mapStateToProps(state, old) {
    const hasEditPermissions =
        (state.userManagement &&
            state.userManagement.user &&
            state.userManagement.user.isAdmin) ||
        undefined;
    return {
        hasEditPermissions
    };
}

export default connect(mapStateToProps)(ContentAdminPage);
