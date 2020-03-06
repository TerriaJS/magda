import { Request, Response } from "express";
import URI from "urijs";

export function redirectOnSuccess(toURL: string, req: Request, res: Response) {
    const source = URI(toURL)
        .setSearch("result", "success")
        .removeSearch("errorMessage");
    res.redirect(source.toString());
}

export function redirectOnError(
    err: any,
    toURL: string,
    req: Request,
    res: Response
) {
    const source = URI(toURL)
        .setSearch("result", "failure")
        .setSearch("errorMessage", err);
    res.redirect(source.toString());
}
