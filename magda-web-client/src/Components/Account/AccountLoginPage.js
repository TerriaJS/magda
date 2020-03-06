import React from "react";
import fbLogo from "assets/login/fb-logo.svg";
import googleLogo from "assets/login/google-logo.svg";
import arcgisLogo from "assets/login/esri-logo.svg";
import aafLogo from "assets/login/aaf-logo.png";
import "./AccountLoginPage.scss";
import { config } from "config";
const { baseUrl } = config;

export default function Login(props) {
    const previousUrl =
        props.location.state &&
        props.location.state.from &&
        props.location.state.from.pathname
            ? props.location.state.from.pathname
            : "/account";
    const baseRedirectUrl = `${window.location.protocol}//${
        window.location.host
    }`;
    const oauthRedirect = `${baseRedirectUrl}/sign-in-redirect?redirectTo=${previousUrl}`;

    const makeLoginUrl = type =>
        `${baseUrl}auth/login/${type}?redirect=${encodeURIComponent(
            oauthRedirect
        )}`;

    return (
        <div className="row login__row">
            {props.signInError && (
                <div className="col-xs-12">
                    <div className="alert alert-danger">
                        <strong>Sign In Failed!</strong> {props.signInError}
                    </div>
                </div>
            )}
            <div className="col-sm-6 col-md-5">
                <h2>Sign In / Register through External Provider</h2>
                <ul className="login__providers">
                    {props.providers.indexOf("facebook") !== -1 && (
                        <li className="login__provider">
                            <a href={makeLoginUrl("facebook")}>
                                <img
                                    src={fbLogo}
                                    className="login__logo"
                                    alt="logo"
                                />
                                Facebook
                            </a>
                        </li>
                    )}
                    {props.providers.indexOf("google") !== -1 && (
                        <li className="login__provider">
                            <a href={makeLoginUrl("google")}>
                                <img
                                    src={googleLogo}
                                    className="login__logo"
                                    alt="logo"
                                />
                                Google
                            </a>
                        </li>
                    )}
                    {props.providers.indexOf("arcgis") !== -1 && (
                        <li className="login__provider">
                            <a href={makeLoginUrl("arcgis")}>
                                <img
                                    src={arcgisLogo}
                                    className="login__logo"
                                    alt="logo"
                                />
                                Esri
                            </a>
                        </li>
                    )}
                    {props.providers.indexOf("aaf") !== -1 && (
                        <li className="login__provider">
                            <a href={makeLoginUrl("aaf")}>
                                <img
                                    src={aafLogo}
                                    className="login__logo"
                                    alt="logo"
                                />
                                AAF
                            </a>
                        </li>
                    )}
                    {props.providers.indexOf("vanguard") !== -1 && (
                        <li className="login__provider">
                            <a href={makeLoginUrl("vanguard")}>
                                <img
                                    src={aafLogo}
                                    className="login__logo"
                                    alt="logo"
                                />
                                Vanguard
                            </a>
                        </li>
                    )}
                </ul>
            </div>
            {props.providers.indexOf("ckan") !== -1 && (
                <div className="col-sm-6 col-md-5">
                    <h2>Sign In with Data.gov.au</h2>
                    <p>This will use your existing data.gov.au account.</p>
                    <form
                        action={makeLoginUrl("ckan")}
                        method="post"
                        className="login__form"
                    >
                        <div className="login__input-group input-group">
                            <div className="input-group-addon">
                                <span className="glyphicon glyphicon-user" />
                            </div>
                            <label htmlFor="username">User name</label>
                            <input
                                className="au-text-input au-text-input--block"
                                id="username"
                                type="text"
                                placeholder="Username"
                                name="username"
                            />
                        </div>
                        <div className="login__input-group input-group">
                            <div className="input-group-addon">
                                <span className="glyphicon glyphicon-lock" />
                            </div>
                            <label htmlFor="password">Password</label>
                            <input
                                className="au-text-input au-text-input--block"
                                type="password"
                                name="password"
                                placeholder="Password"
                            />
                        </div>
                        <div className="pull-right">
                            <input
                                type="submit"
                                className="au-btn"
                                value="Sign in"
                            />
                        </div>
                    </form>
                    <br />
                    <h2>Register</h2>
                    <p>
                        To register a new data.gov.au account,{" "}
                        <a
                            className="au-cta-link"
                            href="https://data.gov.au/user/register"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            click here
                        </a>
                        /> .
                    </p>
                </div>
            )}
        </div>
    );
}
