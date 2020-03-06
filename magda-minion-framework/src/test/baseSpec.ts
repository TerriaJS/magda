import {} from "mocha";
import sinon from "sinon";
import express from "express";
const portfinder = require("portfinder");
import { Server } from "http";

/**
 * This performs functions common to all the minion framework tests, like muting error logging
 * (because we'll be deliberately causing errors in tests), finding free ports to listen on for
 * testing the API, and setting up an express app to test against.
 *
 * @param caption The caption to put in the "describe" block that goes around this test
 * @param fn A function in which to execute tests - this passes a number of arguments as no-arg functions
 *           that will return the latest value - these values change during test setup so they can't be
 *           passed directly during the test setup.
 */
export default function baseSpec(
    caption: string,
    fn: (
        expressApp: () => express.Express,
        expressServer: () => Server,
        listenPort: () => number,
        beforeEachProperty: () => void
    ) => void
) {
    describe(caption, function() {
        this.timeout(10000);
        let expressApp: express.Express;
        let expressServer: Server;
        let listenPort: number;

        before(() => {
            sinon.stub(console, "info");

            const originalConsoleError = console.error;
            sinon.stub(console, "error").callsFake((...args) => {
                if (!args[0] || !args[0].ignore) {
                    originalConsoleError(...args);
                }
            });

            return portfinder.getPortPromise().then((port: number) => {
                listenPort = port;
            });
        });

        after(() => {
            sinon.restore(console);
        });

        function beforeEachProperty() {
            if (expressServer) {
                expressServer.close();
            }
            expressApp = express();
            const originalListen = expressApp.listen;
            sinon.stub(expressApp, "listen").callsFake(port => {
                expressServer = originalListen.bind(expressApp)(port);
                return expressServer;
            });
        }

        fn(
            () => expressApp,
            () => expressServer,
            () => listenPort,
            beforeEachProperty
        );
    });
}
