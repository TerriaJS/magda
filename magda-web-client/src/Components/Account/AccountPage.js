import React from "react";
import "./AccountPage.scss";
import Login from "./AccountLoginPage";
import { connect } from "react-redux";
import queryString from "query-string";
import { requestAuthProviders } from "actions/userManagementActions";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";
import { bindActionCreators } from "redux";
import Breadcrumbs from "Components/Common/Breadcrumbs";
import { Medium } from "Components/Common/Responsive";

class Account extends React.Component {
    constructor(props) {
        super(props);

        const params = queryString.parse(window.location.search);

        this.state = {
            signInError: params.signInError
        };
    }

    componentDidMount() {
        this.props.requestAuthProviders();
    }

    renderRoles() {
        const user = this.props.user;
        return (
            <div>
                Roles:{" "}
                {user.roles && user.roles.length ? (
                    <ul>{user.roles.map(role => this.renderRole(role))}</ul>
                ) : (
                    "N/A"
                )}
            </div>
        );
    }

    renderRole(roleItem) {
        return (
            <li key={roleItem.id}>
                {roleItem.name}
                <div>Role Permissions: </div>
                {roleItem.permissionIds && roleItem.permissionIds.length ? (
                    <ul>
                        {roleItem.permissionIds.map(permissionId =>
                            this.renderPermissionById(permissionId)
                        )}
                    </ul>
                ) : (
                    "N/A"
                )}
            </li>
        );
    }

    getPermissionById(permissionId) {
        const user = this.props.user;
        if (!user.permissions || !user.permissions.length) return null;
        for (let i = 0; i < user.permissions.length; i++) {
            if (user.permissions[i].id === permissionId)
                return user.permissions[i];
        }
        return null;
    }

    renderPermissionById(permissionId) {
        const permission = this.getPermissionById(permissionId);
        return (
            <li key={permissionId}>{permission ? permission.name : "N/A"}</li>
        );
    }

    render() {
        const pageTitle = this.props.user.id ? "Account" : "Sign In";
        return (
            <MagdaDocumentTitle prefixes={[pageTitle]}>
                <div className="account">
                    <Medium>
                        <Breadcrumbs
                            breadcrumbs={[
                                <li key="account">
                                    <span>Account</span>
                                </li>
                            ]}
                        />
                    </Medium>
                    {!this.props.user.id && (
                        <Login
                            signInError={
                                this.props.location.state &&
                                this.props.location.state.signInError
                            }
                            providers={this.props.providers}
                            location={this.props.location}
                        />
                    )}
                    {this.props.user.id && (
                        <div>
                            <h1>Account</h1>
                            <p>Display Name: {this.props.user.displayName}</p>
                            {this.props.user.orgUnit && (
                                <p>
                                    Organisation Unit:{" "}
                                    {this.props.user.orgUnit.name}
                                </p>
                            )}
                            <p>Email: {this.props.user.email}</p>
                            {this.renderRoles()}
                            {this.props.user.isAdmin && (
                                <a href="/admin" className="au-btn">
                                    Administrate
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </MagdaDocumentTitle>
        );
    }
}

function mapStateToProps(state) {
    let {
        userManagement: { user, providers, providersError }
    } = state;

    return {
        user,
        providers,
        providersError
    };
}

const mapDispatchToProps = dispatch => {
    return bindActionCreators(
        {
            requestAuthProviders
        },
        dispatch
    );
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Account);
