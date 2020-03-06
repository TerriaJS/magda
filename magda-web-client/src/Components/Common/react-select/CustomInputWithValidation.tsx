import React, { MutableRefObject } from "react";
import { components } from "react-select";
import { InputProps } from "react-select/src/components/Input";
import { ElementType } from "Components/Dataset/Add/ValidationManager";

type ValidationProps = {
    isValidationError?: boolean;
    validationErrorMessage?: string;
    validationElRef?: MutableRefObject<ElementType>;
    errorMessageId?: string;
};

const CustomInputWithValidation = (props: InputProps) => {
    const selectProps = (props as any).selectProps as ValidationProps;
    if (selectProps.isValidationError === true) {
        return <components.Input {...props} aria-invalid={true} />;
    } else {
        return <components.Input {...props} />;
    }
};

export default CustomInputWithValidation;
