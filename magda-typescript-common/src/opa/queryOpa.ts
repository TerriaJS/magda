import fetch from "isomorphic-fetch";
import getAuthDecision from "./getAuthDecision";

export default async function queryOpa(
    query: string,
    input: object,
    unknowns: string[],
    jwtToken: string,
    opaUrl: string
) {
    const body = {
        query,
        input,
        unknowns
    };

    const res = await fetch(`${opaUrl}compile`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
            ...(jwtToken ? { "X-Magda-Session": jwtToken } : {})
        }
    });

    if (res.status === 200) {
        return getAuthDecision(await res.json());
    } else {
        throw new Error(
            "Could not contact OPA - " +
                res.statusText +
                " " +
                (await res.text())
        );
    }
}
