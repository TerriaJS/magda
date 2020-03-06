import React from "react";
import Editor from "./Editors/Editor";
import "./Style.scss";

interface ToggleEditorProps<V> {
    value: any;
    onChange: Function;
    editor: Editor<V>;
    editable: boolean;
}

/**
 * Will toggle between editing and viewing with an edit button.
 * Will always show if editable is false.
 * Can specify custom viewer by specifying children which will be rendered instead of viewer of the editor.
 * Interchangable with AlwaysEditor.
 */
export class ToggleEditor<V> extends React.Component<ToggleEditorProps<V>> {
    state = {
        value: undefined,
        isEditing: false
    };

    change(value) {
        this.updateState({ value });
    }

    save(event: React.MouseEvent<HTMLButtonElement>) {
        if (this.props.value !== this.state.value) {
            this.props.onChange(this.state.value);
        }
        this.updateState({ isEditing: false });
    }

    edit(event: React.MouseEvent<HTMLButtonElement>) {
        this.updateState({ isEditing: true });
    }

    cancel(event: React.MouseEvent<HTMLButtonElement>) {
        this.updateState({ isEditing: false, value: this.props.value });
    }

    updateState(update: any) {
        this.setState((state, props) => Object.assign({}, state, update));
    }

    componentDidCatch(error, info) {
        // You can also log the error to an error reporting service
        console.error(error);
    }

    render() {
        let { value } = this.state;
        let { editor, editable } = this.props;
        if (value === undefined) {
            value = this.props.value;
        }

        if (typeof editable !== "boolean") {
            throw new Error(
                "The `editable` property of ToggleEditor is compulsory and requires a boolean value"
            );
        }

        const isEditing = editable && this.state.isEditing;

        return (
            <div className="toggle-editor-container">
                {isEditing ? (
                    <React.Fragment>
                        {editor.edit(value, this.change.bind(this))}
                        {this.state.value !== undefined &&
                            this.props.value !== this.state.value && (
                                <button
                                    className="au-btn save-button"
                                    onClick={this.save.bind(this)}
                                >
                                    Save
                                </button>
                            )}
                        <button
                            className="au-btn cancel-button"
                            onClick={this.cancel.bind(this)}
                        >
                            Cancel
                        </button>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {editable && (
                            <button
                                className="toggle-edit-button"
                                title="Edit data item"
                                onClick={this.edit.bind(this)}
                            >
                                &#9998;
                            </button>
                        )}
                        {this.props.children
                            ? this.props.children
                            : editor.view(value)}
                        {""}
                    </React.Fragment>
                )}
            </div>
        );
    }
}
