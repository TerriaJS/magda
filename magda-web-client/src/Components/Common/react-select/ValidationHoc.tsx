import React, { useRef, useMemo } from "react";
import uuidv4 from "uuid/v4";
import AsyncCreatable from "react-select/async-creatable";
import Async, { AsyncProps } from "react-select/async";
import Select, { Props as SelectProps } from "react-select/src/Select";
import Creatable, { CreatableProps } from "react-select/creatable";
import CustomInputWithValidation from "Components/Common/react-select/CustomInputWithValidation";
import ReactSelectStyles from "Components/Common/react-select/ReactSelectStyles";
import * as ValidationManager from "../../Dataset/Add/ValidationManager";
import { CustomValidatorType } from "../../Dataset/Add/ValidationManager";
import StateManager from "react-select";
const useValidation = ValidationManager.useValidation;

interface SelectExtraPropsType {
    validationFieldPath?: string;
    validationFieldLabel?: string;
    customValidator?: CustomValidatorType;
}

type PropsType<OptionType> =
    | (SelectProps<OptionType> & SelectExtraPropsType)
    | (SelectProps<OptionType> & AsyncProps<OptionType> & SelectExtraPropsType)
    | (SelectProps<OptionType> &
          CreatableProps<OptionType> &
          SelectExtraPropsType)
    | (SelectProps<OptionType> &
          AsyncProps<OptionType> &
          CreatableProps<OptionType> &
          SelectExtraPropsType);

type ReactSelectComponent<OptionType> =
    | AsyncCreatable<OptionType>
    | Select<OptionType>
    | Creatable<OptionType>
    | Async<OptionType>
    | StateManager<OptionType>;

type ReactSelectComponentType =
    | typeof AsyncCreatable
    | typeof Select
    | typeof Creatable
    | typeof Async
    | typeof StateManager;

function ValidationHoc<OptionType>(
    ReactSelectKindComponent: ReactSelectComponentType
) {
    return (props: PropsType<OptionType>) => {
        const {
            validationFieldPath,
            validationFieldLabel,
            customValidator,
            onChange,
            ...restProps
        } = props;

        const [
            isValidationError,
            validationErrorMessage,
            elRef
        ] = useValidation(
            validationFieldPath,
            validationFieldLabel,
            customValidator
        );

        const onChangeHandler = (event, action) => {
            if (onChange && typeof onChange === "function") {
                onChange(event, action);
            }
            if (validationFieldPath) {
                setTimeout(() => {
                    ValidationManager.onInputFocusOut(validationFieldPath);
                }, 1);
            }
        };

        // --- only generate once
        const errorMessageId = useMemo(
            () => `input-error-text-${uuidv4()}`,
            undefined
        );

        const selectRef = useRef<ReactSelectComponent<OptionType>>(null);
        const containerDivRef = useRef<HTMLDivElement>(null);

        elRef.current = {
            getBoundingClientRect: () => {
                if (containerDivRef && containerDivRef.current) {
                    return containerDivRef.current.getBoundingClientRect();
                } else {
                    return null;
                }
            },
            scrollIntoView: (arg?: any) => {
                if (containerDivRef && containerDivRef.current) {
                    containerDivRef.current.scrollIntoView(arg);
                }
            },
            blur: () => {
                if (selectRef && selectRef.current) {
                    selectRef.current.blur();
                }
            },
            focus: (options?: FocusOptions) => {
                if (selectRef && selectRef.current) {
                    selectRef.current.focus();
                }
            }
        };

        const Component: new () => ReactSelectComponent<
            OptionType
        > = ReactSelectKindComponent as any;

        return (
            <div
                ref={containerDivRef}
                className={`react-select-with-validation-container ${
                    isValidationError ? "invalid" : ""
                }`}
            >
                {isValidationError ? (
                    <div>
                        <span className="au-error-text" id={errorMessageId}>
                            {validationErrorMessage}
                        </span>
                    </div>
                ) : null}
                <Component
                    ref={selectRef}
                    aria-label={validationErrorMessage}
                    styles={ReactSelectStyles}
                    onChange={onChangeHandler}
                    isValidationError={isValidationError}
                    validationErrorMessage={validationErrorMessage}
                    validationElRef={elRef}
                    {...restProps}
                    components={{
                        ...(restProps.components ? restProps.components : {}),
                        Input: CustomInputWithValidation
                    }}
                />
            </div>
        );
    };
}

export default ValidationHoc;
