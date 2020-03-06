import React from "react";
import { Link } from "react-router-dom";

import "./MatchingStatus.scss";

export default function MatchingStatus(props: {
    datasets: Array<any>;
    strategy: string;
}) {
    if (props.datasets.length > 0) {
        if (props.strategy === "match-part") {
            return (
                <div className="no-matching">
                    The following datasets match some but not all of your search
                    criteria
                </div>
            );
        } else {
            return null;
        }
    } else {
        return (
            <div>
                <div className="no-matching">
                    <div className="au-page-alerts au-page-alerts--info">
                        <p>
                            <strong>
                                Sorry, we couldn't find any datasets that match
                                your search
                            </strong>
                        </p>
                        <p>
                            Please try a different search term, check your
                            spelling or{" "}
                            <Link to="suggest">suggest a dataset</Link>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}
