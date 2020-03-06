import { Router } from "express";
import request = require("request");

export type Probe = () => Promise<State>;

export interface ProbesList {
    [id: string]: Probe;
}

export interface OptionsIO {
    // inputs
    probes?: ProbesList;
    probeUpdateMs?: number;
    forceRun?: boolean;
    // outputs
    ready?: boolean;
    _installed?: any;
    _probes?: { [key: string]: () => any };
    since?: string;
    last?: string;
    details?: any;
    error?: any;
}

export interface State {
    ready: boolean;
    since?: string;
    last?: string;
    details?: any;
    error?: any;
    latencyMs?: number;
}

// In case anyone is confused, this does not duplicate or replace kubernetes functionality
// It just makes service and dependency status visible to everyone
export function createStatusRouter(options: OptionsIO = {}): Router {
    const router = Router();

    installUpdater(options);

    // we don't want to cache status
    router.use(function(req, res, next) {
        res.set("Cache-Control", "no-cache");
        next();
    });

    // liveness probe for knowing if service is up
    router.get("/live", function(req, res) {
        res.status(200).send("OK");
    });

    // readiness probe for knowing if service and its dependents are
    // ready to go
    router.get("/ready", function(req, res) {
        res.status(options.ready ? 200 : 500).json({
            ready: options.ready,
            since: options.since,
            last: options.last,
            details: options.details,
            now: new Date().toISOString()
        });
    });

    // added this for diagnosing service state based on latency in kubernetes
    router.get("/readySync", async function(req, res) {
        await Promise.all(Object.values(options._probes).map(x => x()));
        res.status(options.ready ? 200 : 500).json({
            ready: options.ready,
            since: options.since,
            last: options.last,
            details: options.details,
            now: new Date().toISOString()
        });
    });

    return router;
}

function installUpdater(options: OptionsIO) {
    // This is so that we cab share OptionsIO objects
    // for multiple endpoints
    if (!options._installed) {
        options.ready = !options.probes;
        options.probeUpdateMs = options.probeUpdateMs || 10000;
        options.details = {};
        options.since = new Date().toISOString();
        options._installed = {};
        options._probes = {};
    }
    if (!options.probes) {
        return;
    }
    // every probe deserves to not be blocked by state of other probes
    // so we have parallel probe checkers
    Object.entries(options.probes).forEach(probe => {
        const [id, callback] = probe;
        async function update(dontUpdate?: boolean) {
            try {
                const startMs = Date.now();
                let previousState: any = options.details[id];
                let nextState: State = {
                    ready: false
                };
                // update probe state
                try {
                    nextState = await callback();
                } catch (e) {
                    // lets not spam console with the same error message
                    // report if error message changed
                    if (!previousState || previousState.error !== e.message) {
                        console.error("ERROR", id, e.stack);
                        nextState.error = e.message;
                    }
                }
                // --- Note: typeof null === "object"
                if (!nextState || typeof nextState !== "object") {
                    nextState = {
                        ready: false
                    };
                }
                nextState.latencyMs = Date.now() - startMs;
                options.last = nextState.last = new Date().toISOString();
                // report if status changed
                if (!previousState || nextState.ready !== previousState.ready) {
                    nextState.since = new Date(startMs).toISOString();
                    console.log(
                        "STATUS",
                        id,
                        "is",
                        nextState.ready ? "up" : "down",
                        "on",
                        nextState.since
                    );
                } else {
                    nextState.since = previousState.since;
                }
                // we want to report internal details
                options.details[id] = nextState;
                // update global state
                let isReady = true;
                for (const oid of Object.keys(options.probes)) {
                    isReady =
                        isReady &&
                        options.details[oid] &&
                        options.details[oid].ready;
                }
                options.ready = isReady;
            } catch (e) {
                console.error("ERROR", id, e.stack);
            }
            if (!dontUpdate) {
                (setTimeout(update, options.probeUpdateMs) as any).unref();
            }
        }
        if (!options._installed[id]) {
            // let's not bother running this inside test cases
            const isInTest = typeof it === "function";
            if (!isInTest || options.forceRun) {
                update();
            }
            options._probes[id] = update.bind(null, true);
            options._installed[id] = true;
        }
    });
    // run it again in a minute in case OptionsIO was modified to add extra probes
    setTimeout(
        () => installUpdater(options),
        options.probeUpdateMs * 10
    ).unref();
}

export function installStatusRouter(
    app: Router,
    options: OptionsIO = {},
    routePrefix: string = ""
) {
    app.use(routePrefix + "/status", createStatusRouter(options));
}

export function createServiceProbe(
    url: string,
    statusLocation: string = "/status/ready"
): Probe {
    return async (): Promise<State> => {
        const data = await requestPromise("GET", `${url}${statusLocation}`);
        return data;
    };
}

function requestPromise(method: string, url: string) {
    return new Promise<any>((resolve, reject) => {
        request(
            {
                method,
                uri: url,
                json: true
            },
            (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    if (
                        response.statusCode >= 200 &&
                        response.statusCode <= 299
                    ) {
                        resolve(body);
                    } else {
                        reject(
                            Object.assign(
                                { statusCode: response.statusCode },
                                body
                            )
                        );
                    }
                }
            }
        );
    });
}
