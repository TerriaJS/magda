/* eslint-disable no-undef */
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Small } from "Components/Common/Responsive";

import "./footer.scss";

const externalLinkRegex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-/]))?/;

function FooterLink({ link }) {
    if (link.href.indexOf("mailto") === 0) {
        return <a href={link.href}>{link.label}</a>;
    } else if (link.href === "feedback") {
        return (
            <a
                href="#feedback"
                onClick={() => {
                    zE(function() {
                        zE.activate();
                    });
                    return false;
                }}
            >
                {link.label}
            </a>
        );
    } else if (
        externalLinkRegex.test(link.href) ||
        link.href.substring(0, 1) === "/"
    ) {
        return (
            <a target="_blank" rel="noopener noreferrer" href={link.href}>
                {link.label}
            </a>
        );
    } else {
        return <Link to={`/${encodeURI(link.href)}`}>{link.label}</Link>;
    }
}

function FooterNavs({ footerNavs }) {
    return footerNavs.map(item => (
        <nav
            className="au-footer__navigation col-md-3 col-sm-6 col-xs-6"
            key={item.label}
        >
            <h3 className="au-display-lg">{item.label}</h3>

            <ul className="au-link-list">
                {item.links.map((link, i) => (
                    <li key={i}>
                        <FooterLink link={link} />
                    </li>
                ))}
            </ul>
        </nav>
    ));
}

function Copyright({ href, logoSrc, logoClassName, logoAlt, htmlContent }) {
    return (
        <div className="copyright">
            <div
                className="copyright-text"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            <a
                target="_blank"
                rel="noopener noreferrer"
                href={href}
                className="logo-link"
            >
                <img
                    src={logoSrc}
                    className={"logo " + logoClassName}
                    alt={logoAlt}
                />
            </a>
        </div>
    );
}

function Footer({ footerMediumNavs, footerSmallNavs, footerCopyRightItems }) {
    return (
        <footer
            className="au-footer au-body au-body--dark footer"
            role="contentinfo"
            aria-label="footer"
        >
            <div className="container-fluid">
                <Small>
                    {matched => (
                        <FooterNavs
                            footerNavs={
                                matched ? footerSmallNavs : footerMediumNavs
                            }
                        />
                    )}
                </Small>
                {footerCopyRightItems.length ? (
                    <section className="footer-end col-md-3 col-sm-6 col-xs-6">
                        {footerCopyRightItems.map((item, idx) => (
                            <Copyright
                                key={idx}
                                href={item.href}
                                logoSrc={item.logoSrc}
                                logoClassName={item.logoClassName}
                                logoAlt={item.logoAlt}
                                htmlContent={item.htmlContent}
                            />
                        ))}
                    </section>
                ) : null}
            </div>
        </footer>
    );
}

const mapStateToProps = state => {
    return {
        footerMediumNavs: state.content.footerMediumNavs,
        footerSmallNavs: state.content.footerSmallNavs,
        footerCopyRightItems: state.content.footerCopyRightItems
    };
};

export default connect(mapStateToProps)(Footer);
