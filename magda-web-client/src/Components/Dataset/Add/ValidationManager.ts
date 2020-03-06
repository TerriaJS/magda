import { config } from "config";
import { State } from "./DatasetAddCommon";
import JsonPath from "jsonpath";
import {
    RefObject,
    useState,
    useEffect,
    useRef,
    MutableRefObject
} from "react";
import uniq from "lodash/uniq";

/**
 * A global module to manage / coordinate validation workflow.
 * The overall workflow:
 * - every UI component should attempt to register itself to participant the validation
 * - ValidationManager will determine whether should get the component involved in the validation process based on config
 * - UI components are also responsible for
 *   - Register the component when componentDidMount and de-register itself when componentWillUnmount
 *     - Supplie functions for updating component's valid / invalid status (see definition of `ValidationItem`)
 *   - call `onInputFocusOut` when focus is removed from the component
 *   - `ValidationManager` supplies `useValidation` hook to facilite this process
 * - `ValidationManager` also provides function like `validateAll` to validate all active components on screen
 * - To enable `ValidationManager`, `setStateDataGetter` should also be called when the page component is mounted so that `ValidationManager` has access to state data
 */

/**
 * A list of field json path (query against [add dataset page state](https://github.com/magda-io/magda/blob/master/magda-web-client/src/Components/Dataset/Add/DatasetAddCommon.ts#L133) that should be validated / Mandatory.
 * We currently don't use json path here to query any json data.
 * Use json path as a standard way to name the mandatory field only.
 * e.g. ["$.dataset.title", "$.distributions[1].license", "$.dataset.defaultLicense"]
 */
export type ValidationFieldList = string[];

export type ElementLikeType = {
    getBoundingClientRect: () => ClientRect | DOMRect | null;
    scrollIntoView: (arg?: boolean | ScrollIntoViewOptions) => void;
    blur: () => void;
    focus: (options?: FocusOptions) => void;
};

export type RefType<T = ElementType> =
    | MutableRefObject<T | null>
    | RefObject<T>;

export type ElementType =
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | HTMLDivElement
    | HTMLSpanElement
    | ElementLikeType;

/**
 * Type for a custom validator. It accepts these parameters:
 * - fieldValue: The current value of the input
 * - state: the whole add dataset state data
 * - validationItem: a ValidationItem, containing information like field label and json path, that might useful for generating a custom error message
 *
 * The custom validator may return an object the following fields
 *    - useDefaultValidator: a boolean value to indicate whether the field value is valid (true) or not (false).
 *    - `undefined`, indicating that the default `isEmpty` validator should be used to re-validate the field
 *    - a string, indicating that validation has failed - the returned string should be used as an error message.
 *
 * If the custom validator doesn't return a string and the field value is invalid, a standard error message will be displayed:
 *  "The [field name] is invalid."
 *
 * A custom validator should not produce any side effects
 */

/**
 * @typedef CustomValidatorType Type for a custom validator function.
 *
 * The custom validator may return an object the following fields：
 *    - useDefaultValidator: (Optional, boolean). Default to `false`.
 *        If `false`, the custom validator's validation result will be used.
 *        If `true`, the built-in validator `isEmpty` will be used.
 *    - valid: (Optional, boolean) a boolean value to indicate whether the field value is valid (true) or not (false).
 *    - validationMessage: (Optional, string) Custom error message. If this field doesn't exist, the standard error message ("The [field name] is invalid.") will be used.
 *
 * @param {*} fieldValue The current value of the input
 * @param {State} state the whole add dataset state data
 * @param {ValidationItem} validationItem  a ValidationItem, containing information like field label and json path, that might useful for generating a custom error message
 * @returns {{
 *     useDefaultValidator?: boolean;
 *     valid?: boolean;
 *     validationMessage?: string;
 * }}
 */
export type CustomValidatorType = (
    fieldValue: any,
    state: State,
    validationItem: ValidationItem
) => {
    valid?: boolean;
    validationMessage?: string;
    useDefaultValidator?: boolean;
};

export interface ValidationItem<T = ElementType> {
    /**
     * the json path will be used:
     * - as the id of the ValidationItem
     * - to query input value from [add dataset page state](https://github.com/magda-io/magda/blob/5d9adef14f8aeea5bf3039ecad7c362601393307/magda-web-client/src/Components/Dataset/Add/DatasetAddCommon.ts#L133)
     *
     * @type {string}
     * @memberof ValidationItem
     */
    jsonPath: string;

    /**
     * Field label / name
     */
    label: string;

    /**
     * If customValidator exists, it will be used to validate the current input
     */
    customValidator?: CustomValidatorType;

    /**
     * ValidationManager will call this function to turn on the `Invalid` style of the input ctrl
     * that is belong to this `ValidationItem` when necessary
     */
    setError: (errorMesssage: string) => void;

    /**
     * ValidationManager will call this function to turn off the `Invalid` style of the input ctrl
     * that is belong to this `ValidationItem` when necessary
     */
    clearError: () => void;

    /**
     * A react reference of a DOM element that belongs to this `ValidationItem`.
     * ValidationManager will try move this Dom element into viewport when necessary
     */
    elRef: RefType<T>;
}

const validationFieldList: ValidationFieldList = config.mandatoryFields.map(
    convertConfigFieldItem
);
let validationItems: ValidationItem[] = [];
let stateDataGetter: () => State;

/**
 * Convert field name string in the config to json path that we use internally
 *
 * @param {string} field
 * @returns {string[]}
 */
function convertConfigFieldItem(field: string): string {
    switch (field) {
        case "dataset.title":
            return "$.dataset.title";
        case "dataset.description":
            return "$.dataset.description";
        case "dataset.defaultLicense":
            return "$.dataset.defaultLicense";
        case "files.title":
            return "$.distributions[*].title";
        case "files.format":
            return "$.distributions[*].format";
        case "files.license":
            return "$.distributions[*].license";
        case "distributions.title":
            return "$.distributions[*].title";
        case "distributions.format":
            return "$.distributions[*].format";
        case "distributions.license":
            return "$.distributions[*].license";
        case "dataset.publisher":
            return "$.dataset.publisher";
        case "licenseLevel":
            return "$.licenseLevel";
        case "dataset.defaultLicense":
            return "$.dataset.defaultLicense";
        case "informationSecurity.classification":
            return "$.informationSecurity.classification";
        case "informationSecurity.disseminationLimits":
            return "$.informationSecurity.disseminationLimits";
        case "publishToDga":
            return "$.datasetPublishing.publishAsOpenData.dga";
        default:
            throw new Error(`Unknown mandatory field config name: ${field}`);
    }
}

export const setStateDataGetter = (getter: () => State) => {
    stateDataGetter = getter;
};

function getStateData() {
    if (typeof stateDataGetter === "undefined") {
        throw new Error("State data getter function is not set yet!");
    }
    return stateDataGetter();
}

function findItemByExactJsonPathMatch(
    jsonPath: string
): ValidationItem | undefined {
    if (!jsonPath) {
        return undefined;
    }
    return validationItems.find(item => item.jsonPath === jsonPath);
}

function findItemsByJsonPath(jsonPath: string): ValidationItem[] {
    if (!jsonPath) {
        return [];
    }
    const item = findItemByExactJsonPathMatch(jsonPath);
    if (typeof item !== "undefined") {
        // --- we will stop if we find an exact matched item
        return [item];
    }

    const items: ValidationItem[] = [];

    const stateData = getStateData();
    JsonPath.paths(stateData, jsonPath)
        .map(item => JsonPath.stringify(item))
        .forEach(resolvedJsonPath => {
            const item = findItemByExactJsonPathMatch(resolvedJsonPath);
            if (typeof item !== "undefined") {
                items.push(item);
            }
        });
    return items;
}

function findItemsByJsonPaths(jsonPaths: string[]): ValidationItem[] {
    if (!jsonPaths || !jsonPaths.length) {
        return [];
    }
    return uniq(jsonPaths.flatMap(jsonPath => findItemsByJsonPath(jsonPath)));
}

export function shouldValidate(jsonPath: string) {
    if (typeof stateDataGetter === "undefined") {
        // --- if stateDataGetter is not set, Validation function should be turned off
        return false;
    }
    if (validationFieldList.indexOf(jsonPath) !== -1) {
        return true;
    }
    const stateData = getStateData();
    const idx = validationFieldList.findIndex(fieldPath => {
        if (
            JsonPath.paths(stateData, fieldPath)
                .map(item => JsonPath.stringify(item))
                .indexOf(jsonPath) !== -1
        ) {
            return true;
        } else {
            return false;
        }
    });
    if (idx !== -1) {
        return true;
    } else {
        return false;
    }
}

export const registerValidationItem = (vItem: ValidationItem) => {
    if (
        shouldValidate(vItem.jsonPath) &&
        validationItems.indexOf(vItem) === -1
    ) {
        validationItems.push(vItem);
    }
};

export const deregisterValidationItem = (
    jsonPathOrItem: string | ValidationItem
) => {
    if (typeof jsonPathOrItem === "string") {
        const jsonPath = jsonPathOrItem;
        // --- should clearError when deregister
        validationItems
            .filter(item => item.jsonPath === jsonPath)
            .forEach(item => {
                item.clearError();
            });

        validationItems = validationItems.filter(
            item => item.jsonPath !== jsonPath
        );
    } else {
        jsonPathOrItem.clearError();
        validationItems = validationItems.filter(
            item => item !== jsonPathOrItem
        );
    }
};

function isEmptyValue(value: any) {
    if (typeof value === "undefined" || value === null) {
        return true;
    }
    if (typeof value === "string" && value.trim() === "") {
        return true;
    }
    return false;
}

function getItemsFromJsonPath(jsonPath: string) {
    return validationItems.filter(item => item.jsonPath === jsonPath);
}

/**
 * Execute validation logic on a validation item
 * If a customValidator exists for the field, it will be used,  otherwise, the default `isEmptyValue` validator will be used.
 *
 * @param {ValidationItem} item
 * @returns {(boolean | string)}
 */
function validateItem(item: ValidationItem): boolean | string {
    const jsonPath = item.jsonPath;
    const stateData = getStateData();
    const value = JsonPath.query(stateData, jsonPath)[0];

    const defaultValidationAction = () => {
        if (isEmptyValue(value)) {
            item.setError(`Error: \`${item.label}\` is a mandatory field.`);
            return false;
        } else {
            item.clearError();
            return true;
        }
    };

    if (typeof item.customValidator === "function") {
        const result = item.customValidator(value, stateData, item);

        if (result.useDefaultValidator === true) {
            return defaultValidationAction();
        } else if (result.valid === true) {
            item.clearError();
            return true;
        } else if (result.valid === false && !result.validationMessage) {
            item.setError(`Error: \`${item.label}\` is invalid.`);
            return false;
        } else if (result.valid === false && result.validationMessage) {
            item.setError(result.validationMessage);
            return false;
        } else {
            throw new Error(
                `Invalid return value from customValidator for \`${jsonPath}\``
            );
        }
    } else {
        return defaultValidationAction();
    }
}

/**
 * Input should call this function when focus is removed from it
 *
 * @param {string} jsonPath
 * @returns {boolean} True = the field is valid; False = the field is invalid;
 */
export const onInputFocusOut = (jsonPath: string) => {
    const items = getItemsFromJsonPath(jsonPath);
    if (!items || !items.length) {
        return false;
    }
    if (items.map(item => validateItem(item)).filter(r => !r).length) {
        return false;
    } else {
        return true;
    }
};

/**
 * Validate a list of validation items
 * This function will:
 * - Re-validate all inputs
 * - Set/unset invalid status of the inputs
 * - Move first invalid input (if any) into the viewport
 *
 * @param {ValidationItem[]} items
 * @returns {boolean} True = all fields are valid; False = there is at least one field is invalid;
 */
function validateSelectedItems(items: ValidationItem[]) {
    let offsetY: number;
    let elRef: RefType<ElementType> | undefined;
    let hasInvalidItem = false;

    items.forEach(item => {
        if (!validateItem(item)) {
            hasInvalidItem = true;

            if (!item.elRef.current) {
                // --- if element ref is not ready
                // --- skip moving viewport
                return;
            }
            const offset = getOffset(item.elRef);
            if (typeof offsetY === "undefined") {
                elRef = item.elRef;
                if (offset) {
                    offsetY = offset.top;
                }
            } else if (offset && offset.top < offsetY) {
                elRef = item.elRef;
                offsetY = offset.top;
            }
        }
    });

    if (typeof elRef !== "undefined" && elRef.current) {
        // --- there is an invalid input
        // --- try to move into viewport
        // --- please note: we use [Scroll behavior polyfill](https://github.com/iamdustan/smoothscroll)
        elRef.current.scrollIntoView({ behavior: "smooth" });
        if (typeof elRef.current.focus === "function") {
            elRef.current.focus();
        }
    }

    return !hasInvalidItem;
}

/**
 * Validate all registered inputs.
 * This function should be called when user requests to move to next page.
 * This function will:
 * - Re-validate all inputs
 * - Set/unset invalid status of the inputs
 * - Move first invalid input (if any) into the viewport
 *
 * @returns {boolean} True = all fields are valid; False = there is at least one field is invalid;
 */
export const validateAll = () => validateSelectedItems(validationItems);

/**
 * Validate all inputs matching a list of json Paths.
 * This function should be called when user requests to move to next page.
 * This function will:
 * - Re-validate all inputs
 * - Set/unset invalid status of the inputs
 * - Move first invalid input (if any) into the viewport
 * @param {string[]} fieldPathList a list of json path for selecting inputs
 * @returns {boolean} True = all fields are valid; False = there is at least one field is invalid;
 */
export const validateFields = (fieldPathList: string[] = []) => {
    if (typeof stateDataGetter === "undefined") {
        // --- if stateDataGetter is not set, Validation function should be turned off
        return true;
    }

    const items = findItemsByJsonPaths(fieldPathList);
    if (!items.length) {
        return true;
    }

    return validateSelectedItems(items);
};

export const getOffset = (el: RefType<ElementType>) => {
    if (!el.current) {
        return null;
    }
    const rect = el.current.getBoundingClientRect();
    if (!rect) {
        return null;
    }
    return {
        top: rect.top + document.body.scrollTop,
        left: rect.left + document.body.scrollLeft
    };
};

export const deregisterAllValidationItem = () => {
    validationItems = [];
};

interface ValidationHookStateType<T extends ElementType> {
    ref: MutableRefObject<T | null>;
    isValidationError: boolean;
    validationErrorMessage: string;
}

export const useValidation = <T extends ElementType = ElementType>(
    fieldJsonPath: string | undefined,
    fieldLabel: string | undefined,
    customValidator?: CustomValidatorType
): [boolean, string, MutableRefObject<T | null>] => {
    const [state, setState] = useState<ValidationHookStateType<T>>({
        ref: useRef<T>(null),
        isValidationError: false,
        validationErrorMessage: ""
    });

    useEffect(() => {
        const validationItem = {
            jsonPath: fieldJsonPath ? fieldJsonPath : "",
            label: fieldLabel ? fieldLabel : "",
            elRef: state.ref,
            setError: errorMessage => {
                setState({
                    ref: state.ref,
                    isValidationError: true,
                    validationErrorMessage: errorMessage
                });
            },
            customValidator,
            clearError: () => {
                setState({
                    ref: state.ref,
                    isValidationError: false,
                    validationErrorMessage: ""
                });
            }
        };
        if (fieldJsonPath) {
            registerValidationItem(validationItem);
        }
        return () => {
            if (fieldJsonPath) {
                deregisterValidationItem(validationItem);
            }
        };
    }, [fieldJsonPath, fieldLabel, customValidator]);

    return [state.isValidationError, state.validationErrorMessage, state.ref];
};
