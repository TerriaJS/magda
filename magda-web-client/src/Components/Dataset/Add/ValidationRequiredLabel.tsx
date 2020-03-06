import React, { FunctionComponent } from "react";
import { shouldValidate } from "./ValidationManager";

type RequiredLabelPropsType = {
    validationFieldPath: string;
};

const ValidationRequiredLabel: FunctionComponent<
    RequiredLabelPropsType
> = props => {
    if (shouldValidate(props.validationFieldPath)) {
        return <>&nbsp;(*)</>;
    } else {
        return null;
    }
};

export default ValidationRequiredLabel;
