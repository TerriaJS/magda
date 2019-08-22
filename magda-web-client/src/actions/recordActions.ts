import fetch from "isomorphic-fetch";
import { config } from "../config";
import { actionTypes } from "../constants/ActionTypes";
import { RecordAction, RawDataset } from "../helpers/record";
import { FetchError } from "../types";
import request from "helpers/request";
import datasetAccessControlAspect from "@magda/registry-aspects/dataset-access-control.schema.json";

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

export function fetchDatasetFromRegistry(id: string): Function {
    return (dispatch: Function) => {
        dispatch(requestDataset(id));
        let parameters =
            "dereference=true&aspect=dcat-dataset-strings&optionalAspect=dcat-distribution-strings&optionalAspect=dataset-distributions&optionalAspect=temporal-coverage&optionalAspect=usage&optionalAspect=access&optionalAspect=dataset-publisher&optionalAspect=source&optionalAspect=source-link-status&optionalAspect=dataset-quality-rating&optionalAspect=spatial-coverage&optionalAspect=publishing&optionalAspect=dataset-access-control";
        const url =
            config.registryRoApiUrl +
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
            config.registryRoApiUrl +
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
            // -- set up access control aspect
            const state = getState();
            aspects["dataset-access-control"] = datasetAccessControlAspect;
            if (!inputDataset["aspects"]["dataset-access-control"]) {
                inputDataset["aspects"]["dataset-access-control"] = {};
            }
            if (
                state.userManagement &&
                state.userManagement.user &&
                state.userManagement.user.id
            ) {
                inputDataset["aspects"]["dataset-access-control"]["ownerId"] =
                    state.userManagement.user.id;
            }
            if (
                state.userManagement &&
                state.userManagement.user &&
                state.userManagement.user.orgUnitId
            ) {
                inputDataset["aspects"]["dataset-access-control"][
                    "orgUnitOwnerId"
                ] = state.userManagement.user.orgUnitId;
            }
            for (const [aspect, definition] of Object.entries(aspects)) {
                await ensureAspectExists(aspect, definition);
            }
            for (const distribution of inputDistributions) {
                await request(
                    "POST",
                    `${config.baseUrl}api/v0/registry/records`,
                    distribution
                );
            }
            const json = await request(
                "POST",
                `${config.baseUrl}api/v0/registry/records`,
                inputDataset
            );
            return dispatch(receiveNewDataset(json));
        } catch (error) {
            dispatch(
                createNewDatasetError({
                    title: error.name,
                    detail: error.message
                })
            );
        }
    };
}

async function ensureAspectExists(id: string, jsonSchema: any) {
    try {
        await request(
            "GET",
            `${config.baseUrl}api/v0/registry-ro/aspects/${id}`
        );
    } catch (error) {
        await request("POST", `${config.baseUrl}api/v0/registry/aspects`, {
            id,
            name: jsonSchema.title,
            jsonSchema
        });
    }
}
