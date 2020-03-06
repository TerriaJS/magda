import { ApiError } from "./generated/registry/api";

export class ServiceError extends Error {
    public e: any;

    constructor(message: string, e: any) {
        super(message);
        this.e = e;
    }
}

export class BadRequestError extends ServiceError {
    constructor(statusCode: number, errorResponse: ApiError, e: any) {
        super(
            `Status code: ${statusCode}, body:\n${JSON.stringify(
                errorResponse,
                null,
                "  "
            )}`,
            e
        );
    }
}

/**
 * Creates a {@link ServiceError} from the result of a failed call to an API generated
 * by swagger-codegen.  The result typically includes `response` (with a status code) and
 * a `body` (the JSON the server returned with the error), but may be other things if,
 * e.g., an exception occurred while attempting to invoke the service.
 *
 * @export
 * @param {*} e The result of the failed call.
 * @returns {Error} An Error created from the failed result.
 */
export default function createServiceError(e: any): Error {
    if (e && e.response && e.response.statusCode && e.body) {
        return new BadRequestError(e.response.statusCode, e.body, e);
    } else if (e && e instanceof Error) {
        return e;
    } else if (e && e.toString() !== {}.toString()) {
        return new ServiceError(e.toString(), e);
    } else if (e) {
        return new ServiceError(`${JSON.stringify(e, null, "  ")}`, e);
    } else {
        return new ServiceError(
            "An undefined service error occurred.",
            undefined
        );
    }
}
