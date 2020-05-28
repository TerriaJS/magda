import React, { Component } from "react";

import Breadcrumbs from "Components/Common/Breadcrumbs";
import { Medium } from "Components/Common/Responsive";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";

export default class AdminHeader extends Component<any, any> {
    render() {
        const crumbs: any[] = [];
        let title = ["Admin"];
        if (this.props.title) {
            crumbs.push(
                <li key="admin">
                    <a href="/admin">Admin</a>
                </li>
            );
            crumbs.push(
                <li key="page">
                    <span>{this.props.title}</span>
                </li>
            );
            title.splice(0, 0, this.props.title);
        } else {
            crumbs.push(
                <li key="admin">
                    <span>Admin</span>
                </li>
            );
        }

        return (
            <MagdaDocumentTitle prefixes={title}>
                <div>
                    <Medium>
                        <Breadcrumbs breadcrumbs={crumbs} />
                    </Medium>
                    <h1>{title.join(" ")}</h1>
                </div>
            </MagdaDocumentTitle>
        );
    }
}
