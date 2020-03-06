import React from "react";
import "Components/Common/Choice.scss";

type ChoiceProps = {
    heading: string;
    blurb: string;
    href: string;
    icon: string;
    secondary?: boolean;
    className?: string;
    disabled?: boolean;
};

export default function Choice(props: ChoiceProps) {
    return (
        <div
            className={`col-sm-12 col-md-6 choice-col ${
                props.className ? props.className : ""
            }`}
        >
            <a
                href={!props.disabled ? props.href : undefined}
                className={`au-btn ${
                    props.secondary ? "au-btn--secondary" : ""
                } ${props.disabled ? "choice-disabled" : ""} choice-button`}
            >
                <h2 className="choice-button-heading">{props.heading}</h2>{" "}
                <div className="choice-icon-row">
                    <img className="choice-icon" src={props.icon} />
                    <div className="text-content">
                        {props.blurb} {props.disabled && "(coming soon)"}
                    </div>
                </div>
            </a>
        </div>
    );
}
