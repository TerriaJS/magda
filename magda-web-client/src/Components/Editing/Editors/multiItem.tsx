import React from "react";
import Editor from "./Editor";
import "./multiItem.scss";

export abstract class MultiItemEditor<V> extends React.Component<
    {
        value?: V[];
        editor: Editor<V>;
        enabled?: boolean;
        createNewValue: Function;
        onChange?: Function;
        canBeAdded: (value: V) => boolean;
        addOnChange: boolean;
        renderAbove?: boolean;
    },
    { value?: V[]; newValue: V }
> {
    constructor(props) {
        super(props);
        this.state = {
            newValue: props.createNewValue()
        };
    }

    change(newValueFromControl) {
        this.setState(
            {
                newValue: newValueFromControl
            },
            () => {
                if (
                    this.props.addOnChange &&
                    this.props.canBeAdded(newValueFromControl)
                ) {
                    this.add();
                }
            }
        );
    }

    addHandler(event) {
        event.preventDefault();

        this.add();
    }

    add() {
        const value = this.value();
        let newValue = this.state.newValue;
        if (Array.isArray(value) && value.indexOf(newValue) !== -1) {
            return;
        }
        if (newValue) {
            value.push(newValue);
            newValue = this.props.createNewValue();
        }
        this.setState({ value, newValue });
        if (this.props.onChange) {
            this.props.onChange(value);
        }
    }

    deleteIndex(index) {
        return () => {
            const value = this.value();
            value.splice(index, 1);
            this.setState({ value });
            if (this.props.onChange) {
                this.props.onChange(value);
            }
        };
    }

    value() {
        let value = this.state.value;
        if (!value && this.props.value) {
            value = this.props.value.slice();
        }
        value = value || [];
        return value;
    }
}

export class ListMultiItemEditor<V> extends MultiItemEditor<V> {
    // add a renderer? class method to render out the multi-list-item-editor-container with
    // 'multi-list-item-editor-item'

    renderSelectedOptions(enabled, value, editor) {
        if (!enabled && (!value || !value.length)) {
            return null;
        }
        return (
            <div className="multi-list-item-editor-container clearfix">
                {value.map((val, i) => {
                    return (
                        <div key={i} className="multi-list-item-editor-item">
                            {editor.view(val)}
                            {enabled && (
                                <button
                                    className="edit-button"
                                    onClick={this.deleteIndex(i)}
                                >
                                    &#215;
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }
    render() {
        const { editor, enabled, renderAbove } = this.props;
        const { newValue } = this.state;
        const value = this.value();
        return (
            <div className="list-multi-item-editor-container">
                {renderAbove
                    ? this.renderSelectedOptions(enabled, value, editor)
                    : null}
                {enabled && (
                    <React.Fragment>
                        {editor.edit(newValue, this.change.bind(this), value, {
                            onKeyUp: (e: any) => {
                                if (e.keyCode !== 13) return;
                                this.addHandler(e);
                            }
                        })}
                        {!this.props.addOnChange && (
                            <button
                                className="au-btn add-button"
                                onClick={this.addHandler.bind(this)}
                                disabled={!this.props.canBeAdded(newValue)}
                            >
                                Add
                            </button>
                        )}
                    </React.Fragment>
                )}
                {!enabled && (!value || !value.length) && "NOT SET"}
                {renderAbove
                    ? null
                    : this.renderSelectedOptions(enabled, value, editor)}
            </div>
        );
    }

    static create<V>(
        singleEditor: Editor<V>,
        createNewValue: () => V,
        canBeAdded: (value: V) => boolean = value => !!value,
        addOnChange: boolean = false,
        renderAbove: boolean = true
    ): Editor<V[]> {
        return {
            edit: (
                outerMultiValue: V[] | undefined,
                onChange: (innerMultiValue: V[] | undefined) => void
            ) => {
                return (
                    <ListMultiItemEditor<V>
                        value={outerMultiValue}
                        editor={singleEditor}
                        enabled={true}
                        createNewValue={createNewValue}
                        onChange={onChange}
                        canBeAdded={canBeAdded}
                        addOnChange={addOnChange}
                        renderAbove={renderAbove}
                    />
                );
            },
            view: (value: V[] | undefined) => {
                return (
                    <ListMultiItemEditor<V>
                        value={value}
                        editor={singleEditor}
                        enabled={false}
                        createNewValue={createNewValue}
                        canBeAdded={canBeAdded}
                        addOnChange={addOnChange}
                        renderAbove={renderAbove}
                    />
                );
            }
        };
    }
}
