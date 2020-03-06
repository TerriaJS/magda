/**
 * Abstract Editor. Can view or edit.
 */
import * as ValidationManager from "../../Dataset/Add/ValidationManager";
import { RefObject } from "react";
export default interface Editor<V> {
    edit: (
        value: V | undefined,
        onChange: (value: V | undefined) => void,
        multiValues?: any,
        extraProps?: ExtraPropsType
    ) => JSX.Element;
    view: (value: V | undefined) => JSX.Element;
}

type ExtraPropsType = {
    isValidationError?: boolean;
    validationErrorMessage?: string;
    ref?: RefObject<ValidationManager.ElementType>;
    onBlur?: () => void;
    // --- We use `extraProps` to pass on props value to underneath input ctrl when used with AlwaysEditor
    [otherKeys: string]: any;
};
