import React, { createRef, RefObject } from "react";
import Editor from "./Editors/Editor";
import * as ValidationManager from "../Dataset/Add/ValidationManager";
import { CustomValidatorType } from "../Dataset/Add/ValidationManager";

interface AlwaysEditorProps<V> {
    value: V | undefined;
    onChange: (value: V | undefined) => void;
    editor: Editor<V>;
    validationFieldPath?: string;
    validationFieldLabel?: string;
    customValidator?: CustomValidatorType;
    renderAbove?: boolean;
}

interface AlwaysEditorState {
    isValidationError: boolean;
    validationErrorMessage: string;
}

/**
 * Will always show editing interface.
 * Interchangable with ToggleEditor.
 */
export class AlwaysEditor<V> extends React.Component<
    AlwaysEditorProps<V>,
    AlwaysEditorState
> {
    private ref: RefObject<ValidationManager.ElementType> = createRef();

    constructor(props) {
        super(props);
        this.state = {
            isValidationError: false,
            validationErrorMessage: ""
        };
    }

    change(value: V | undefined) {
        this.props.onChange(value);
    }

    componentDidMount() {
        if (this.props.validationFieldPath) {
            ValidationManager.registerValidationItem({
                jsonPath: this.props.validationFieldPath,
                label: this.props.validationFieldLabel
                    ? this.props.validationFieldLabel
                    : "",
                elRef: this.ref,
                customValidator: this.props.customValidator,
                setError: errorMessage => {
                    this.setState({
                        isValidationError: true,
                        validationErrorMessage: errorMessage
                    });
                },
                clearError: () => {
                    this.setState({
                        isValidationError: false,
                        validationErrorMessage: ""
                    });
                }
            });
        }
    }

    componentWillUnmount() {
        if (this.props.validationFieldPath) {
            ValidationManager.deregisterValidationItem(
                this.props.validationFieldPath
            );
        }
    }

    updateState(update: any) {
        this.setState(Object.assign({}, this.state, update));
    }

    render() {
        let { value, editor } = this.props;
        if (typeof this.props.validationFieldPath !== "undefined") {
            return editor.edit(value, this.change.bind(this), undefined, {
                ref: this.ref,
                isValidationError: this.state.isValidationError,
                validationErrorMessage: this.state.validationErrorMessage,
                onBlur: () => {
                    ValidationManager.onInputFocusOut(this.props
                        .validationFieldPath as string);
                }
            });
        } else {
            return editor.edit(value, this.change.bind(this));
        }
    }
}
