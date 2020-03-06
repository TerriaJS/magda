// eslint-disable-next-line
import "es6-shim";
import "raf/polyfill";
import "core-js/fn/symbol/iterator";
import "core-js/es6/symbol";
import "core-js/fn/object/entries";
import "core-js/fn/object/values";
import "./helpers/scroll-polyfill";
import logger from "redux-logger";
import "./index.scss";
import { BrowserRouter, Route } from "react-router-dom";

import thunkMiddleware from "redux-thunk";
import React from "react";
import ReactDOM from "react-dom";
import { gapi } from "./analytics/ga";
import { Provider } from "react-redux";
import reducer from "./reducers/reducer";
import { createStore, applyMiddleware, compose } from "redux";
import AppContainer from "./AppContainer";
import PropTypes from "prop-types";
import ScrollToTop from "./helpers/ScrollToTop";
import "./i18n";

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const store = createStore(
    reducer,
    composeEnhancers(
        applyMiddleware(
            thunkMiddleware, // lets us dispatch() functions
            logger // neat middleware that logs actions
        )
    )
);

class GAListener extends React.Component {
    static contextTypes = {
        router: PropTypes.object
    };

    componentDidMount() {
        this.sendPageView(this.context.router.history.location);
        this.context.router.history.listen(this.sendPageView);
    }

    sendPageView(location) {
        // Send pageview event to the initialised tracker(s).
        gapi.pageview(location.pathname);
    }

    render() {
        return this.props.children;
    }
}

ReactDOM.render(
    <Provider store={store}>
        <BrowserRouter>
            <GAListener>
                <ScrollToTop>
                    <Route path="/" component={AppContainer} />
                </ScrollToTop>
            </GAListener>
        </BrowserRouter>
    </Provider>,
    document.getElementById("root")
);
