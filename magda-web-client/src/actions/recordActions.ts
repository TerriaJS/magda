import fetch from "isomorphic-fetch";
import { config } from "../config";
import { actionTypes } from "../constants/ActionTypes";
import { RecordAction, RawDataset } from "../helpers/record";
import { FetchError } from "../types";
import { ensureAspectExists } from "api-clients/RegistryApis";
import request from "helpers/request";

export function requestDataset(id: string): RecordAction {
    return {
        type: actionTypes.REQUEST_DATASET,
        id
    };
}

export function receiveDataset(json: RawDataset): RecordAction {
    return {
        type: actionTypes.RECEIVE_DATASET,
        json
    };
}

export function requestDatasetError(error: FetchError): RecordAction {
    return {
        type: actionTypes.REQUEST_DATASET_ERROR,
        error
    };
}

export function requestDistribution(id: string): RecordAction {
    return {
        type: actionTypes.REQUEST_DISTRIBUTION,
        id
    };
}

export function receiveDistribution(json: any): RecordAction {
    return {
        type: actionTypes.RECEIVE_DISTRIBUTION,
        json
    };
}

export function requestDistributionError(error: FetchError): RecordAction {
    return {
        type: actionTypes.REQUEST_DISTRIBUTION_ERROR,
        error
    };
}

export function receiveAspectModified(
    aspect: string,
    patch: any
): RecordAction {
    return {
        type: actionTypes.RECEIVE_ASPECT_MODIFIED,
        json: {
            aspect: aspect,
            patch: patch
        }
    };
}

export function resetFetchRecord() {
    return {
        type: actionTypes.RESET_FETCH_RECORD
    };
}

export function createNewDataset(json: Object): RecordAction {
    return {
        type: actionTypes.REQUEST_DATASET_CREATE,
        json
    };
}

export function receiveNewDataset(json: Object): RecordAction {
    return {
        type: actionTypes.RECEIVE_NEW_DATASET,
        json
    };
}

export function createNewDatasetError(error: FetchError): RecordAction {
    return {
        type: actionTypes.DATASET_CREATE_ERROR,
        error
    };
}

export function createNewDatasetReset(error: FetchError): RecordAction {
    return {
        type: actionTypes.DATASET_CREATE_RESET,
        error
    };
}

export function fetchDatasetFromRegistry(id: string): Function {
    return (dispatch: Function) => {
        dispatch(requestDataset(id));
        let parameters =
            "dereference=true&aspect=dcat-dataset-strings&optionalAspect=dcat-distribution-strings&optionalAspect=dataset-distributions&optionalAspect=temporal-coverage&" +
            "optionalAspect=usage&optionalAspect=access&optionalAspect=dataset-publisher&optionalAspect=source&optionalAspect=source-link-status&optionalAspect=dataset-quality-rating&" +
            "optionalAspect=spatial-coverage&optionalAspect=publishing&optionalAspect=dataset-access-control&optionalAspect=provenance&optionalAspect=information-security&optionalAspect=currency";
        const url =
            config.registryReadOnlyApiUrl +
            `records/${encodeURIComponent(id)}?${parameters}`;

        return fetch(url, config.fetchOptions)
            .then(response => {
                if (!response.ok) {
                    let statusText = response.statusText;
                    // response.statusText are different in different browser, therefore we unify them here
                    if (response.status === 404) {
                        statusText = "Not Found";
                    }
                    throw Error(statusText);
                }
                return response.json();
            })
            .then((json: any) => {
                if (json.records) {
                    if (json.records.length > 0) {
                        return dispatch(receiveDataset(json.records[0]));
                    } else {
                        throw new Error("Not Found");
                    }
                } else {
                    return dispatch(receiveDataset(json));
                }
            })
            .catch(error =>
                dispatch(
                    requestDatasetError({
                        title: error.name,
                        detail: error.message
                    })
                )
            );
    };
}

export function fetchDistributionFromRegistry(id: string): any {
    return (dispatch: Function) => {
        dispatch(requestDistribution(id));
        let url: string =
            config.registryReadOnlyApiUrl +
            `records/${encodeURIComponent(
                id
            )}?aspect=dcat-distribution-strings&optionalAspect=source-link-status&optionalAspect=source&optionalAspect=visualization-info&optionalAspect=access&optionalAspect=usage&optionalAspect=dataset-format&optionalAspect=ckan-resource&optionalAspect=publishing`;
        return fetch(url, config.fetchOptions)
            .then(response => {
                if (!response.ok) {
                    let statusText = response.statusText;
                    // response.statusText are different in different browser, therefore we unify them here
                    if (response.status === 404) {
                        statusText = "Not Found";
                    }
                    throw Error(statusText);
                }
                return response.json();
            })
            .then((json: any) => {
                return dispatch(receiveDistribution(json));
            })
            .catch(error =>
                dispatch(
                    requestDistributionError({
                        title: error.name,
                        detail: error.message
                    })
                )
            );
    };
}

export function modifyRecordAspect(
    id: string,
    aspect: string,
    field: string,
    value: any
): any {
    return async (dispatch: Function) => {
        id = encodeURIComponent(id);
        aspect = encodeURIComponent(aspect);
        let url = config.registryFullApiUrl + `records/${id}/aspects/${aspect}`;

        if (field.indexOf("/") !== -1) {
            let body = await fetch(url);
            body = await body.json();
            let val = body;

            let keys = field.split("/");
            for (let index = 0; index < keys.length - 1; index++) {
                val = val[keys[index]] || (val[keys[index]] = {});
            }
            val[keys[keys.length - 1]] = value;
            field = keys[0];
            value = body[keys[0]];
        }

        const patch = [{ op: "add", path: `/${field}`, value }];

        let options = Object.assign({}, config.fetchOptions, {
            method: "PATCH",
            body: JSON.stringify(patch),
            headers: {
                "Content-type": "application/json"
            }
        });
        return fetch(url, options)
            .then(response => {
                if (!response.ok) {
                    let statusText = response.statusText;
                    // response.statusText are different in different browser, therefore we unify them here
                    if (response.status === 404) {
                        statusText = "Not Found";
                    }
                    throw Error(statusText);
                }
                return response.json();
            })
            .then((json: any) => {
                return dispatch(receiveAspectModified(aspect, json));
            })
            .catch(error =>
                dispatch(
                    requestDistributionError({
                        title: error.name,
                        detail: error.message
                    })
                )
            );
        // return {
        //     type: actionTypes.MODIFY_DATASET_ASPECT,
        //     id,
        //     aspect,
        //     field,
        //     value
    };
}

export function createRecord(
    inputDataset: any,
    inputDistributions: any,
    aspects: any
): any {
    return async (dispatch: Function, getState: () => any) => {
        dispatch(createNewDataset(inputDataset));
        try {
            // make sure all the aspects exist (this should be improved at some point, but will do for now)
            const aspectPromises = Object.entries(aspects).map(
                ([aspect, definition]) => ensureAspectExists(aspect, definition)
            );
            await Promise.all(aspectPromises);

            for (const distribution of inputDistributions) {
                await request(
                    "POST",
                    `${config.registryFullApiUrl}records`,
                    distribution
                );
            }
            const json = await request(
                "POST",
                `${config.registryFullApiUrl}records`,
                inputDataset
            );
            return dispatch(receiveNewDataset(json));
        } catch (error) {
            // --- throw out error so it can be caught by try/catch
            throw error;
        }
    };
}
