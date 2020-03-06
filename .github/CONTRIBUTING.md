This is a work in progress and will change as we flesh out the process better. If there's any suggestions you'd like to make, please make them :).

# Getting Started

Before you do anything naturally you'll want to start by making sure you understand the [README.md](https://github.com/magda-io/magda/blob/master/README.md) first.

If you're writing code then you'll want to run through [the building and running documentation](https://github.com/magda-io/magda/blob/master/doc/building-and-running.md) to get yourself set up too.

# How to Contribute

How you contribute will depend on your relationship to the project:

-   Core team - i.e. you're contributing a significant amount of time per week, probably as part of your job at Data61 (although we're very keen to collaborate with other organisations!)
-   External Contributor - i.e. you're using Magda and want to contribute features or bug fixes on a more casual basis - outside of our sprints.

## Core Team Members

We make use of [ZenHub](https://www.zenhub.com/) to add extra project-management functionality into Github, so you'll want to have that installed (it comes as a browser extension) also - it's all free for public repos.

Magda uses Github issues as its base unit of work - each user story, bug, chore etc should have an issue attached to it. Issues (particularly user stories or other issues related to adding features) are often grouped into epics, which are special ZenHub-only issues that group them.

Magda currently works in 2-week sprints, tracked as milestones in Github. At the start of each sprint, we run a short sprint-planning session in which we decide what we're going to work on in the next sprint and estimate on each issue. Because issues have estimates attached to them, wherever possible they should be divided up into simple, discrete tasks - i.e. try to avoid creating mega-issues with many steps that will take weeks to get through, instead prefer to create multiple issues, potentially grouping them into an epic or using Zenhub's ability to make one issue dependent on another to group them together.

### Developer Workflow

1. Issue is created / written up, and labels applied - particularly apply the "bug" or "good first issue" labels if relevant
2. Issue is added to a sprint during a sprint-planning meeting, moves to the _Backlog_ column
3. Developer starts the issue - makes sure it's assigned to them, drags it to the _In Progress_ column
4. Developer works on the issue, submits it as a Pull Request and drags it to the _Pull Request_ column
5. PR is reviewed by another core team member, comments are fixed, approved
6. PR is merged **by the reviewer** when they're happy, and the branch it came from is deleted.
7. Reviewer drags the issue into the _QA_ column if there's a UI part to it that needs to be QA'd by the designer, otherwise go to step 10.
8. `master` is deployed to dev (at the moment this is manual)
9. Issue is QA'd by the designer - if something needs changing a comment is left on the issue `@`ing the developer and it's dragged back to _In Progress_, - go to step 4. Otherwise...
10. Issue is dragged to the _Done_ column by the person who approved the QA.
11. At the end of the sprint, all issues in `Done` are closed.

Unfortunately this process is all manual at the moment, so it's important that you keep on top of manually moving your issues along the columns as they progress. As the process becomes more stable we'll look at creating some kind of bot to make things a bit less manual.

## External Contributors

We don't expect people outside the core team to go through the same process as core team members. The workflow for external contributions goes something like this:

1. Make sure there's an issue for what you're doing - if you're thinking of sending us a PR for something, make an issue for it first so we can discuss it with you!
2. Make sure you make a comment in the issue letting us know that you've started work.
3. Fork the repo and make some commits
4. Make a PR on `magda-io/magda` - keeping to the standards below
5. Respond to PR review comments
6. PR gets merged into `master`
7. Changes become part of the next release!

# Standards

-   Where practical, changes should be accompanied by unit tests. Unfortunately there's still a lot of untested code in the code base - if you're modifying untested code, try to at least write tests to test _what you've changed_.
    -   The front-end is (currently) an exception to this as it's still very experimental
-   Javascript/Typescript must be formatted with [Prettier](https://github.com/prettier/prettier), Scala should be formatted with [Scalariform](https://github.com/scala-ide/scalariform).
-   All contributors should be listed in CONTRIBUTORS.md - in your first PR, please make sure you've added yourself!
-   All changes should be recorded as a bullet point in CHANGES.md, as part of the PR that made those changes.

# Release Cycle

Currently the release cycle for Magda isn't very clever - every time there's a new release we increment the version number and push new images to DockerHub. Releases aren't planned to any real schedule, although they should happen at least fortnightly.
