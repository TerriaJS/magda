import React from "react";
import { connect } from "react-redux";
import MagdaDocumentTitle from "Components/i18n/MagdaDocumentTitle";

type Props = {
    error: {
        title: string;
        detail: string;
    };
};

class ErrorHandler extends React.Component<Props> {
    render() {
        return (
            <MagdaDocumentTitle prefixes={["Error"]}>
                <div className="au-page-alerts au-page-alerts--error">
                    {this.props.error.title ? (
                        <h3>{this.props.error.title}</h3>
                    ) : null}
                    <p>{this.props.error.detail}</p>
                </div>
            </MagdaDocumentTitle>
        );
    }
}

function mapStateToProps(state) {
    return {
        strings: state.content.strings
    };
}

export default connect(
    mapStateToProps,
    null
)(ErrorHandler);
