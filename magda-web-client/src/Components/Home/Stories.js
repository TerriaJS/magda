import React, { Component } from "react";
import StoryBox from "./StoryBox";
import { Medium, Small } from "Components/Common/Responsive";
import "./Stories.scss";
import downArrow from "assets/downArrow-homepage-more-stories.svg";
import { CSSTransition, TransitionGroup } from "react-transition-group";

class Stories extends Component {
    constructor(props) {
        super(props);
        this.state = {
            shouldShowStories: false
        };
        this.showStories = this.showStories.bind(this);
    }

    componentDidMount() {
        window.addEventListener("scroll", this.showStories);
    }

    showStories() {
        this.setState({
            shouldShowStories: true
        });
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.showStories);
    }

    render() {
        const { stories } = this.props;
        if (!stories || !stories.length) {
            return null;
        }
        const rows = [];
        for (let x = 0; x < stories.length; x += 4) {
            rows.push(stories.slice(x, x + 4));
        }
        return (
            <div className="homepage-stories">
                <Small>
                    {this.state.shouldShowStories ? (
                        <TransitionGroup>
                            <CSSTransition
                                classNames="animation"
                                enter={false}
                                exit={false}
                                appear={true}
                                timeout={{ appear: 500 }}
                            >
                                <div className="row" key="stories-boxes">
                                    <div className="col-md-12">
                                        {stories.map((story, index) => (
                                            <StoryBox
                                                idx={index}
                                                story={story}
                                                className="story-box-{index}"
                                                key={index}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CSSTransition>
                        </TransitionGroup>
                    ) : (
                        <div className="homepage-stories-show-stories-button-container">
                            <button
                                className="homepage-stories-show-stories-button"
                                onClick={() => {
                                    this.setState({
                                        shouldShowStories: true
                                    });
                                }}
                            >
                                <div>Latest News</div>
                                <img src={downArrow} alt="more-stories" />
                            </button>
                        </div>
                    )}
                </Small>
                <Medium>
                    <TransitionGroup>
                        <CSSTransition
                            classNames="animation"
                            enter={false}
                            exit={false}
                            appear={true}
                            timeout={{ appear: 500 }}
                        >
                            <div>
                                {rows.map((row, r) => {
                                    switch (row.length) {
                                        case 1:
                                            return (
                                                <div
                                                    className="row"
                                                    key="stories-boxes"
                                                >
                                                    <div className="col-md-4">
                                                        <StoryBox
                                                            idx={r * 4}
                                                            story={row[0]}
                                                            className="stories"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        case 2:
                                        case 3:
                                            return (
                                                <div
                                                    className="stories-container"
                                                    key={r}
                                                >
                                                    {row.map((story, i) => (
                                                        <div
                                                            className={`col-${
                                                                row.length
                                                            }`}
                                                            key={i}
                                                        >
                                                            <StoryBox
                                                                idx={r * 4 + i}
                                                                story={story}
                                                                className="stories"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        default:
                                            return (
                                                <div
                                                    className="stories-container"
                                                    key={r}
                                                >
                                                    <div className="col-3">
                                                        <StoryBox
                                                            idx={r * 4 + 0}
                                                            story={row[0]}
                                                            className="stories"
                                                        />
                                                    </div>
                                                    <div className="col-3">
                                                        <div className="row-2">
                                                            <StoryBox
                                                                idx={r * 4 + 1}
                                                                story={row[1]}
                                                                className="row stories"
                                                            />
                                                            <StoryBox
                                                                idx={r * 4 + 2}
                                                                story={row[2]}
                                                                className="row stories"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-3">
                                                        <StoryBox
                                                            idx={r * 4 + 3}
                                                            story={row[3]}
                                                            className="stories"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                    }
                                })}
                            </div>
                        </CSSTransition>
                    </TransitionGroup>
                </Medium>
            </div>
        );
    }
}

export default Stories;
