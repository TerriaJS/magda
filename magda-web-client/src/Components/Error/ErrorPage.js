import React from "react";
import queryString from "query-string";
import ErrorHandler from "./ErrorHandler";
import Error401 from "./Error401";
import Error403 from "./Error403";
import Error404 from "./Error404";
import Error500 from "./Error500";

export default function ErrorPage({ location }) {
    const query = queryString.parse(location.search);
    const errorCode = query.errorCode;
    switch (errorCode) {
        case "401":
            return <Error401 errorData={query} />;
        case "403":
            return <Error403 errorData={query} />;
        case "404":
            return <Error404 errorData={query} />;
        case "500":
            return <Error500 errorData={query} />;
        default:
            return (
                <ErrorHandler
                    error={{
                        title: "Unkown Error:",
                        detail: `An error with unrecoginised error code: \`${errorCode}\` has ocurred.`
                    }}
                />
            );
    }
}
