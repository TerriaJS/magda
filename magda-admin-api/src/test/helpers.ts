import request from "supertest";
import * as fixtures from "./fixtures";
import mockAuthorization from "magda-typescript-common/src/test/mockAuthorization";
import { State, ConnectorState, ConfigState, JobState } from "./arbitraries";
import express from "express";
import nock from "nock";
import _ from "lodash";

export function getConnectors(
    app: express.Application,
    jwtSecret: string,
    isAdmin: boolean = true
): Promise<request.Response> {
    return mockAuthorization(
        "http://admin.example.com",
        isAdmin,
        jwtSecret,
        request(app).get("/connectors")
    );
}

export function getBasicState(connectorName: string = "connector"): State {
    return getStateForStatus("active", connectorName);
}

export function getStateForStatus(
    status: string,
    connectorName: string = "connector"
): State {
    return {
        [connectorName]: {
            config: {
                type: "type",
                name: "name",
                sourceUrl: "sourceUrl"
            },
            job: {
                startTime: "startTime",
                completionTime: "completionTime",
                status
            }
        }
    };
}

export function mockConnectorConfig(
    k8sApiScope: nock.Scope,
    statusCode: number,
    namespace: string,
    state?: State,
    optionally: boolean = false
) {
    const req = k8sApiScope.get(
        `/api/v1/namespaces/${namespace}/configmaps/connector-config`
    );

    if (optionally) {
        req.optionally();
    }

    return req.reply(
        statusCode,
        statusCode === 200
            ? fixtures.getConfigMap(_(state)
                  .mapValues((value: ConnectorState) => value.config)
                  .pickBy(_.identity)
                  .value() as { [id: string]: ConfigState })
            : "fail"
    );
}

export function mockJobs(
    k8sApiScope: nock.Scope,
    statusCode: number,
    namespace: string,
    state?: State
) {
    k8sApiScope.get(`/apis/batch/v1/namespaces/${namespace}/jobs`).reply(
        statusCode,
        statusCode === 200
            ? fixtures.getJobs(_(state)
                  .mapValues((value: ConnectorState) => value.job)
                  .pickBy(_.identity)
                  .value() as { [id: string]: JobState })
            : "fail"
    );
}
export function mockJobStatus(
    k8sApiScope: nock.Scope,
    statusCode: number,
    name: string,
    namespace: string,
    state?: State,
    optionally: boolean = false
) {
    const req = k8sApiScope.get(
        `/apis/batch/v1/namespaces/${namespace}/jobs/connector-${name}/status`
    );

    if (optionally) {
        req.optionally();
    }

    return req.reply(
        statusCode,
        statusCode === 200
            ? (fixtures.getJobs(_(state)
                  .mapValues((value: ConnectorState) => value.job)
                  .pickBy(_.identity)
                  .value() as { [id: string]: JobState }) as any)
            : "fail"
    );
}

export function putConnector(
    app: express.Application,
    id: string,
    body: any,
    jwtSecret: string,
    isAdmin: boolean = true
): Promise<request.Response> {
    return mockAuthorization(
        "http://admin.example.com",
        isAdmin,
        jwtSecret,
        request(app)
            .put(`/connectors/${id}`)
            .send(body)
    );
}

export function deleteConnector(
    app: express.Application,
    id: string,
    jwtSecret: string,
    isAdmin: boolean = true
): Promise<request.Response> {
    return mockAuthorization(
        "http://admin.example.com",
        isAdmin,
        jwtSecret,
        request(app).delete(`/connectors/${id}`)
    );
}

export function mockDeleteJob(
    k8sApiScope: nock.Scope,
    statusCode: number,
    id: string,
    namespace: string
) {
    k8sApiScope
        .delete(`/apis/batch/v1/namespaces/${namespace}/jobs/connector-${id}`, {
            kind: "DeleteOptions",
            apiVersion: "batch/v1",
            propagationPolicy: "Background"
        })
        .reply(statusCode, {
            code: statusCode
        });
}

export function mockCreateJob(
    k8sApiScope: nock.Scope,
    statusCode: number,
    namespace: string,
    body?: any,
    optionally: boolean = false
) {
    const req = k8sApiScope.post(
        `/apis/batch/v1/namespaces/${namespace}/jobs`,
        body
    );

    if (optionally) {
        req.optionally();
    }

    return req.reply(statusCode, {});
}

export function startConnector(
    app: express.Application,
    id: string,
    jwtSecret: string,
    isAdmin: boolean = true
): Promise<request.Response> {
    return mockAuthorization(
        "http://admin.example.com",
        isAdmin,
        jwtSecret,
        request(app).post(`/connectors/${id}/start`)
    );
}

export function stopConnector(
    app: express.Application,
    id: string,
    jwtSecret: string,
    isAdmin: boolean = true
): Promise<request.Response> {
    return mockAuthorization(
        "http://admin.example.com",
        isAdmin,
        jwtSecret,
        request(app).post(`/connectors/${id}/stop`)
    );
}
