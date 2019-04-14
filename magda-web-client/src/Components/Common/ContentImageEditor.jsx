import React, { Component } from "react";
import { config } from "config";
import readFile from "helpers/readFile";
import { writeContent } from "actions/contentActions";

class ContentImageEditor extends Component {
    state = {
        imageItemId: ""
    };

    updateState(update: any) {
        this.setState((state, props) => Object.assign({}, state, update));
    }

    componentDidMount() {
        this.updateState({ imageItemId: this.props.imageItemId });
    }

    async changeImage() {
        if (this.props.hasEditPermissions) {
            const { data, file } = await readFile(
                this.props.accept,
                "ArrayBuffer"
            );
            await writeContent(
                this.props.imageItemId,
                new Blob([new Uint8Array(data)]),
                file.type
            );
            this.updateState({
                imageItemId: this.props.imageItemId + "?time=" + Date.now()
            });
        }
    }

    render() {
        const { hasEditPermissions } = this.props;
        const { imageItemId } = this.state;
        return (
            <React.Fragment>
                <img
                    src={config.contentApiURL + imageItemId}
                    alt="LOADING; CLICK TO SET;"
                    style={{
                        maxHeight: "70px",
                        maxWidth: "367px",
                        cursor: "pointer"
                    }}
                    onError={function(e) {
                        e.target.alt = hasEditPermissions
                            ? "CLICK TO SET"
                            : "NODE";
                    }}
                    onClick={this.changeImage.bind(this)}
                />
                {hasEditPermissions && (
                    <button
                        className="au-btn au-btn--tertiary"
                        onClick={this.changeImage.bind(this)}
                    >
                        Change Image
                    </button>
                )}
            </React.Fragment>
        );
    }
}

export default ContentImageEditor;
