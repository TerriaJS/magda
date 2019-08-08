## 0.0.56

General:

-   Add multi-tenant support. Deployed as single tenant by default.

Registry:

-   Changed database schema.
-   Provide services based on Tenant IDs.
-   Fixed PATCH request to registry won't trigger notification to webhook

Gateway:

-   Add tenant ID header to client requests.
-   Add ArcGIS/ESRI Authentication provider, including support for on-premise instances of ArcGIS Portal.
-   Add Vanguard (WS-FED) Authentication provider

Search:

-   Prevent freeText query from being None which will cause score to be 0
-   Add tenant specific search.

Indexer:

-   Fixed indexer throws an error when temporalCoverage aspects intervals is an empty array
-   Index datasets with tenant ID.
-   Fixed indexer throws an error when affiliatedOrganisation field is created

Cataloging:

-   Added new aspects for publishing state and spatial coverage
-   Updated Indexer and Search API to support publishingState
-   Updated new dataset demo UI page to support adding new datasets
-   Updated dataset ui page to be able to edit fields
-   Added editor / editor type abstraction for making state management simpler for large forms.
-   Added "Add Catalog" page

UI:

-   Made dataset page printer friendly
-   Display search box placeholder text at a lower opacity while the field is in focus.
-   Showed text message if there are no tags to display in a dataset page.
-   Removed gap after data quality star rating
-   Replaced star emoji in static page markdown with quality star icon
-   Refactored web client to group similar things together
-   Implemented basic admin pages in react ui
-   Started implementing new add dataset flow design changes
-   Fixed web-client code loaded & run twice
-   Added basic spatial preview to add dataset
-   Revised add dataset first metadata page for conformance with design
-   Improved edit dataset page overall styling & editor behaviour
-   Show Database ownership information on dataset page (Admin Only)
-   Added vocabulary suggestion for keywords & themes input on new dataset page
-   Extracted keyword will be filtered by vocabulary APIs
-   New add dataset page design
-   Added new progress meter
-   New design for file upload area
-   New dropdown box design on `Dataset details and contents` page
-   New Design for Multiple Tags input for keywords & Themes on `Dataset details and contents` page
-   New Design for Accrual Periodicity Recurrence input on `Dataset details and contents` page
-   New Design Spatial area input on `Dataset details and contents` page
-   New Design for text input & text area input on add dataset pages
-   Next & save button style adjustment on add dataset pages
-   Update pagination to meet WCAG and use correct semantic HTML tags.
-   New Design for files review box on `Details and Content` page
-   Moved dataset description to Details and Contents page & added `additional notes` text box to submit page
-   Added words count to Textarea
-   Adjusted tooltip style & layout
-   Overall page layout adjustment for `Details and Content` page
-   fixed: keywords & themes extraction might produce duplicate keywords for different files
-   Added ability to set the owning org unit in Add Dataset flow.
-   Restricted dataset contact point display options to team members, team or org and made it save in the registry.
-   Stopped keywords & themes extraction producing duplicate keywords for different files
-   Capped the maximum input to retext for keyword extraction to prevent browser freezeup
-   Made all keywords extracted lower case
-   Made extracted keywords fall back on non-vocabulary-filtered keywords if it doesn't find enough keywords matching the vocabulary.

Gateway:

-   Add ArcGIS/ESRI Authentication provider, including support for on-premise instances of ArcGIS Portal.
-   Add Vanguard (WS-FED) Authentication provider
-   Made organisation field an autocomplete in add dataset page.

Access Control:

-   Introduced Role & Permission Structure
-   Recognise unauthenticated users as anonymous users role
-   Introduced Open Policy Agent as policy evaluation engine
-   Search API will return datasets based on user's Roles & Permissions
-   Users with access to draft datasets can see a new `drafts` tab
-   Organization hierarchy & make Organization hierarchy data available for access control
-   Filter datasets based on user's current organization unit
-   Added API to see what users will approve a potential dataset

Others:

-   Made registry-api DB pool settings configurable via Helm
-   Make broken link sleuther recrawl period configurable via Helm
-   Format minion will trust dcat format if other measures indicate a ZIP format
-   Format minion will trust dcat format if other measures indicate a ESRI REST format
-   Added ASC to 4 stars rating list
-   Made registry-api DB pool settings configurable via Helm
-   Make broken link sleuther recrawl period configurable via Helm
-   Format minion will trust dcat format if other measures indicate a ZIP format
-   Format minion will trust dcat format if other measures indicate a ESRI REST format
-   Added ASC to 4 stars rating list

## 0.0.55

UI:

-   Updated design system components
-   Integrate sentry release notification and source map upload
-   Added "role" to account page
-   Fixed clicking out of search filter causes the results to refetch
-   Provide access to CKAN Data API for enabled resources
-   Changed label of email validation error message in suggest dataset page to be consistent with rest of the error messages in that page

Correspondence:

-   Broadened search for a valid dataset email contact address

Others:

-   Upgraded JDK version for magda-builder-scala to 8u201
-   Added craco to allow for some Create React App overrides for a faster build and to allow use of PDFjs without warnings.
-   Fixed Unable to use Google / Facebook Login on Preview Site
-   Fixed warnings: `as` props is compulsory for AUpageAlert & boolean value was sent to `id` props
-   Fixed docker build cache issue that causes DB image not build

## 0.0.54

Connectors:

-   Add organisation ignore filter to CKAN connector

UI:

-   Upgraded to create-react-app 2
-   Fixed javascript error when user clicks away from facet dropdowns
-   Distribution pages: prepend file-specific icon to title
-   Added a basic new dataset page
-   Fixed javascript errors in download analytics and pie charts
-   Added results of automated metadata extraction spikes to add new dataset page

Analytics:

-   Added dataset id to dataset request/feedback where applicable
-   Added value to the "Search result and click" Google Analytics event that will show averages and other numeric aggregates in Google Analytics.
-   Upgraded Elasticsearch to v6.5.4 Elastic4s to v6.5.1
-   Elasticsearch related test cases run on Docker container than than local node
-   Made search always match all input keywords (MatchAll mode)

Indexer:

-   Fixed issues of snapshot creation & restore
-   Indexer will auto reopen index if it's closed
-   Added Geo Spatial Data Validation to Indexer
-   Added `simplifyToleranceRatio` & `requireSimplify` Parameters to Indexer & Allow them to be configured per file & per data
-   Used manual simplified STE region data
-   Fixed timeout issue when filter by WA state

Others:

-   Change content api delete response status code from to 204 to 200 so its content can be read.
-   Upgraded Elasticsearch to v6.5.4 Elastic4s to v6.5.1
-   Elasticsearch related test cases run on Docker container than than local node
-   Fixed: datasets with null description could lead to blank search result page
-   Stopped gateway from passing auth and single-hop headers through to other services

## 0.0.53

Connectors:

-   Allowed Ckan connector to pull datasets belongs to a specified organisation
-   Added `presetRecordAspects` & `extra` parameters supports to all connectors
-   Improvements on CSW connector license info retrieve

Dataset Page:

-   When `dcat-dataset-strings.creation.isOpenData` is set, show `Public / Private` label accordingly

Others:

-   Upgraded dependencies with snyk.io vulnerabilities.
-   Allowed Favicon to be configurable through API & Admin UI
-   Added `magda.reservedFor=statefulsets:NoSchedule` toleration to statefulsets.
-   Improvement indexer scala test cases for Travis
-   Made feature images easier to configure

## 0.0.52

Authentication:

-   Added `Australian Access Federation` Rapid Connect Single-Sign-On‎ Support

Ops:

-   `create-secrets` tool can create secret for `Australian Access Federation` Rapid Connect
-   Allows gateway routes to be overiden from top level values file
-   Added `enableCkanRedirection` switch to turn on or off Ckan redirection feature from gateway
-   Added `global.enablePriorityClass` switch to turn on or off `priorityClassName` on deployment templates
-   Improved responsiveness of registry-api when it's under load
-   Made the content-api accept authentication by default
-   Lowered the resource requirements for the apidocs-server based on data.gov.au usage.

Search:

-   Made the lowest quality rating for a dataset in the search index 0.01, so that 0-quality datasets rank properly relative to each other.
    Others:
-   Fixed /dashboard and /dataset?q=keyword redirects for migrating easily from CKAN sites

Accessibility:

-   Added `aria-label` field to Facet buttons to reflect the current filter selection

Connectors:

-   Made the CSV connector put the description column in the distribution description, not just the dataset one
-   Fixed: CSW connector does not capture all distributions for some datasources (e.g. TERN)
-   Fixed: CSW connector does not capture persistent URL or licences for some sources (eg. geoscience australia)

Interoperability:

-   Fixed /dashboard and /dataset?q=keyword redirects for migrating easily from CKAN sites

Development:

-   Made connector tests use the typescript of the code under test through ts-node, instead of the `/dist` directory.

Others:

-   Changed terminology for data rating to `Linked Data Rating`
-   Fixed: Empty source link shows as a working link on dataset page
-   Removed hard-coded URL for CKAN authentication, made it configurable.

## 0.0.51

Accessibility:

-   Made the image and the text wrapped in a single link and the set image alt value to null for stories on the home page
-   Made navigation items screen readable by removing unnecessary aria-hidden label from menu
-   Got screen reader to say "Open Data Quality: 3/5 stars" instead of repeating star rating text
-   Stopped tab order reverting to body after tabbing through the search box
-   Made the "Skip to Navigation" skip link go to the first navigation item rather than trying to target the wrapping `<div>`
-   Change search selection color for non-home pages
-   Fixed form error message not being heard in order by screen readers and also when field is in focus by putting them in the same label element.
-   Fixed: Error messages are not associated with their form fields on suggest dataset form
-   Made the data quality tooltip read its contents out, and link to the data quality page.

Charts:

-   Fixed chart won't displayed correctly under IE11
-   Added google analytics event when chart fails to load

Ops:

-   Add readiness and liveness probes to all services
-   Changed the migrators to look for "password" instead of "postgres-password" in the cloudsql-db-credentials secret.
-   Added shortcut to build create secrets script for magda-config repo
-   Added preemption priority classes
-   Added ability to add fully customised affinity to statefulsets in helm
-   Fixed docker image build script failed on windows platform
-   Added `cloudsql-db-credentials` to create-secrets tool
-   Only runtime dependencies will be included by docker image build script
-   Fixed an file selector error in create-secrets script when current directory & non of its sub directory has \*.json file
-   Changed SQL for querying aspects by path/value so that it could take advantage of JSONB indices.

Security:

-   Redirect HTTP requests to HTTPS URLs

Search:

-   Added boosting to results which have location information that overlaps a known region whose name/shortname appears in query text.
-   Fixed stream processing issue when re-indexing, mitigating out-of-memory risk too
-   Fixed index trimming failure issue when re-indexing
-   Fixed: indexer throws an error when processes spatial data number with more than one decimal places
-   Fixed stream processing issue when re-indexing, mitigating out-of-memory risk too

Others:

-   Download unknown project open data license URLs to extract human readable licence
-   Removed the .bin extension from the logo

## 0.0.50

-   Added configurable argument to `magda-web-server` module to accept Google Analytics IDs
-   Make datasetSearchSuggestionScoreThreshold and searchResultsPerPage runtime configurable
-   Hide dataset source for csv datasets
-   Make sure MS Excel format does not break into two.
-   Make home page items come from content api
-   Make header menu items come from content api
-   Remove all global references to config.appName and allow getting this configuration item from content api
-   Changed some existing content ids to group things better
-   Reorganised content api to require less number of requests to get small JSON content items
-   Email Templates are configurable from content API
-   Allow a CKAN non-root path to be used for redirects
-   Allow CKAN resource downloads to pass through to CKAN to maintain links
-   Add something to mock admin interface to make users admins and not
-   Take CSW connector distribution access url and format from distributor field under distributionInfo as well as from transfer options (previous.)
-   Delete registry API /records/{recordId}/aspects endpoint
-   Hook actors will report its status to its parent actor when changes
-   Updated external links on About page to open in new window
-   Fixed some WA source spatial data are not indexed properly
-   Boost the score weighting of name & acronym field during org seaching
-   Sort by relevence unless keyword is "\*" (in this case sort by Alphabetical order) during org search
-   Removed search.data.gov.au-specific third party javascript
-   Added ability to include arbitrary HTML in `index.html` through the content api
-   Fixed: added added vendor prefix to `au-select` component CSS
-   Fixed content-api test case logic
-   Migrate static pages to a json structure and make it editable.
-   Hide "Download" button for distributions without downloadUrl
-   Fixed content-api migrator script version conflict issue
-   Make footer area configurable
-   Fixed broken document link in docs/README.md
-   Show quality rating only if present
-   Fixed: cached auth api response causing login problems
-   Upgraded java version for `magda-scala-builder` docker image to fix `unsatisfiable constraints` error
-   Make jurisdiction field available from registry api
-   Fixed an issue of scss-compiler not updated all variables
-   Added more configurable scss variables
-   Added internationalisation library to frontend
-   Adjusted content-api to prevent SQL injection
-   Made occurrences of "organisation" in the front-end configurable through internationalisation.
-   Make jurisdiction information available from search api
-   Organisation search result from search api will be aggregated based on jurisdiction and name
-   Updated helm config to allow for statefulsets to be kept off GKE preemptible nodes.
-   Switched `<a>` element in `HeaderNav` to be `<Link>` from `react-router-dom` to maintain router history
-   Fixed: minion crawler may go into an endless loop
-   Fixed an issue caused search Panel option filter stop working
-   The CkanTransformer will remove generic organisation descriptions.
-   Fixed non-RC versions not being released to docker hub.
-   Fixed DAP connector not automatically being released to docker hub.
-   Fixed an issue that `create-secrets` didn't handle `cloudsql-instance-credentials` & `storage-account-credentials` probably
-   `create-secrets` will load ENV vars according to question data types
-   Include Magda user agent in external HTTP resource accesses
-   Made admin UI create CSV connector with internal URL
-   Fixed magda-apidocs-server incorrectly builds into \$PWD directory on windows
-   Fixed an issue that DAP connector not handle access error correctly
-   Stopped caching anything requested through the admin ui.
-   Removed old admin ui code
-   Made access notes show up on distribution page with configurable text
-   Added contact point to distribution page, made title configurable
-   When `match-part` search strategy is used, a message is shown on UI
-   Made broken link minion per domain request wait time configurable
-   Fixed mobile menu not show-up properly
-   Made the events page size and the webhook timeout configurable in the registry.
-   Stopped the format minion from stalling on long URLs

## 0.0.49

-   In web dataset page, made facet search reset when user clicks on facet button so that it does not show result from last time.
-   Made issued and update date not appear when valid dates are not available.
-   Specify correct externalURL and namespace for gitlab to fix deployment auth.
-   Add a CSV connector
-   Rename config page to admin; include connector management functionality
-   Update content API to accept csvs
-   Enable admin api and fix up admin api ability to work in speficied namespace
-   Set CSW connector MD_Metadata dateStamp as issue date
-   Made "Ask a question" button send the question directly to the contactPoint for the dataset if possible.
-   Added ability to ensure that all emails go to default recipient despite what their normal recipient would be.
-   Made contact point visible on dataset page
-   Allowed UI SCSS variables to be changed via k8s job
-   Added a `set-scss-vars` script for updating UI SCSS variables
-   Fixed that `leaflet.css` had not been included by SCSS compiler
-   Allowed the cluster to be protected by a password
-   Made the add a dataset form appear where the results get to a certain configurable score threshold
-   Made the CSW connector look for names for service-based datasets in another place
-   Made CSW connector gracefully handle datasets without ids instead of crashing
-   Fixed Gitlab UI only preview failed to download main CSS file
-   Removed CORS handling from Scala APIs, should be entirely handled by the gateway.
-   Made the format minion listen to `dcat-distribution-strings` instead of `dataset-distributions`, should be more efficient
-   Better support for SPSS files in the format minion
-   Made files marked with a ".extension" format resolve to "extension" correctly in the format minion.
-   Fixed an redirection issue when handling 404 status from registry API
-   Re-added admin api to released docker images
-   Made gateway nominate its container port to fix it working with a password and also the GCE ingress
-   Stopped the helm chart from assuming that the `postgres` user password and the `proxyuser` password are the same in GKE deploys
-   Fixed the storage account credentials being created incorrectly through the secrets tool
-   Allows gateway to redirect trailing slash for APIDocs module

## 0.0.48

-   Add No results label when there are no results in organisation and location facets.
-   Make sure CKAN connector doesn't loop forever if server reports wrong dataset count or empty page
-   Remove AU govt logo and add more space to top menu.
-   Whitelist KMZ.
-   Rename sleuthers to minions
-   Add ability to change content (logo).
-   CSW connector will exit with code 1 if error happens
-   Fixed an issue of format enhancer processing MIME
-   Fixed an issue that format enhancer may exit when dcat-string not available
-   Updated email template & make email clickable
-   Updated aims connector URL
-   Raised the default resources for registry-api.
-   Added API document for Minions
-   Updated magda links in footer.
-   Switch apidocs root to `<host>`
-   Removed unused jQuery dependency from format-minion
-   Split the registry api into full and read only modes that can run separately in production
-   Take open data connector license from dataset level to distribution level and add basic black box test
-   Fix logo vertical alignment and partially hidden issue
-   Made header padding even
-   Made the broken link minion use `GET` for everything and ignore the data.
-   Fixed trim with zero records deleted returning 400

## 0.0.47

-   Document public portions of authorization api
-   Document search api
-   Make contents API and contents database migrator for storing items which will be dynamically configurable in the future.
-   Hyperlink organisation url on organisation page
-   Align format facet based on its position on the page
-   Reformat page title to be consistent throughout
-   Remove browser default button background for search facet (for safari and IE)
-   Removed `x-powered-by` & `server` headers from response
-   Updated header logo to be correct branding type
-   Uses the Header component from Design System
-   Registry will now periodically retry Webhook
-   Fixed an issue that connector record triming might not fully completed
-   Fixed an issue that indexer webhook event types not properly setup
-   Removed feedback-api, discussions-api and discussions-db as they're no longer used
-   Moved standard and data.gov.au config to a separate repo
-   Added better readiness probes to elasticsearch
-   Adjusted resources requirements/limits
-   Push footer below the fold while loading page content
-   Unify tooltip styles across different instances, remove react-tooltip
-   Change chart config dropdown label from xAxis to X axis and yAxis to Y axis
-   Unify H1 size
-   Fixed an issue that dataset / organisation debounced search request not cancel upon URL changes
-   Upgraded terriajs server to 2.7.4 to address redirect vulnerability.
-   Added apiDoc for indexer

## 0.0.46

-   Make pagination on mobile responsive.
-   Added cronjob for broken-link-sleuther
-   Remove all starting non word chars from organisation title
-   Make pagination on mobile responsive.
-   Fixed inconsistent case with format
-   Made broken links sleuther perform a get request with content range when head request returns 405 (method not allowed).
-   Make pagination on mobile responsive.
-   Fixed a facet overflow issue on desktop
-   Allow user apply default date in filter
-   Mobile menu style change
-   Fixed Not found redirect working differently in different browsers, and fixed not found error preventing new record from showing
-   Added mechanism to produce api documentation
-   Fixed an issue where organisation Page dataset links set incorrect `publisher` query parameter
-   Remove extra slash when additional info is missing on dataset page and distribution page
-   Added a tooltip to organisation filter if it's clicked to from the org page the first time
-   Hid filters on mobile
-   Made it so that if you follow a link with filters active on mobile, the next search you make cancels them
-   Added a more generic purple tooltip component
-   Added `create-secrets` script for managing secrets
-   Make source link wrap and add line break
-   Made dev connector jobs execute every week only

## 0.0.45

-   Redirect CKAN/DGA Urls
-   Add config for fallback banner
-   prevent old content being loaded when navigating through page history
-   Display a 'clear search' link after error message
-   Fixed inconsistent breakpoints
-   Unify styles of tagline for search results
-   Unify result count style
-   Fixed a date filter bug that freeze UI on slow internet
-   Fixed the error 'Can't call setState (or forceUpdate) on an unmounted component' for Data Preview
-   Fixed `Clear All` button not clear filter panel UI state
-   Change non-homepage search placeholder text color to WCAG AAA compliant
-   Added more details in organisations/publishers page to reflect design.
-   Adjusted sitemap and robots.txt to help google navigate around better
-   Made the javascript work with chrome 41 (googlebot)
-   Made the fallback banner site url configurable

## 0.0.44

-   Added more analytics events for Downloads/Views by Organisation, Search result click and Dataset request/feedback
-   Removed `button` element for distribution download link on dataset page.
-   Updated documentation for setting up `Docker Edge` for Kubernetes.
-   Modified error message text and omitted homepage articles if search error occurs.
-   Changed chart icons on dataset page
-   Made `elasticsearch` supports synonyms
-   Upgraded `elasticsearch` to v6.3.0
-   Enable organisation search
-   Disabled scroll to zoom on dataset preview map until map is clicked on and added terria zoom controls to preview map
-   Change appearance of mobile search box
-   Improve filter button icon alignment
-   adjust dataset page layout to accomodate new mobile design
-   Disable /auth route in production & change gateway health checking endpoint to /v0/healthz
-   Stopped indexer skipping datasets that have no distributions. These datasets can now be discovered via search.
-   Added more heuristics to charting, made it parse dates and sort the x axis.
-   Improve chart view on mobile
-   Fixed `Ask a question about this dataset` button (on dataset page) won't open form on safari browser
-   Remove input content from Scala service Malformat query parameter error message
-   Improved mobile navigation
-   Improved dataset page paddings and margins
-   Moved express helmet to gateway module
-   Make chart title wrap
-   Upgraded TerriaJS to 6.0.4 in preview map
-   Changed the preview map to not use terrain.
-   Made CORS, CSP, Node-Helmet and proxied routes configurable through helm.
-   Add links to about page
-   Fixed a rendering glitch with react modal
-   Trim empty rows off before table rendering to prevent empty rows after sorting by column
-   Make suggestion form scrollable on short screen
-   Default button color fix
-   Small improvement on how search box looks on mobile and desktop
-   Improve organisation search page
-   Added extra contact fields to registry & search organization API
-   Added connector for CSIRO DAP (thanks @jevy-wangfei!)
-   Adjust line spacing for dataset page
-   Fix the bug that which does not allow add another option to publisher or format filters once you have performed a search using the filter.
-   Improved CSW connector to avoid incorrect organisation information being picked
-   Replace banner svg icon
-   Improved styling of suggest dataset form
-   Improve distribution link alignment
-   Improve UI for chart loading error
-   Make dataset ask a question form only scrollable on short screens
-   Added auto gzip compress to gateway
-   Made CSW connector retrieve country field from alternative JSON path
-   Fixed Sitemap times out if input is invalid
-   Fixed Organisation content position moved (flicking) during data loading
-   Fixed Organisation page router history issue
-   Fixed Search Panel `Clear` button doesn't work
-   Fixed bug where dataset ids where "undefined" in distribution URLs.
-   Corrected incorrect source-link-status aspect name in UI dataset request URL
-   Updated URL of City of Launceston connector.
-   Keep search text in synch.
-   Make pagination on mobile responsive.
-   Made CKAN harvesters execute on an hourly basis.

## 0.0.43

-   Fix design system react import for SASS overrides
-   Add breadcrumb for dataset page and distribution page
-   Added further styling filters to coverup markdown rendering on dataset pages
-   Added UNSAFE\_ annotations or refactored to prepare for [React async rendering](https://reactjs.org/blog/2018/03/27/update-on-async-rendering.html).
-   Hide zendesk floating feedback button on mobile
-   Modified the look and layout of the distribution pages.
-   Made close button on suggest form rounded and thicker
-   Location and Date filters can be applied by clicking outside of the box
-   Changed registry /records api `pageToken` as long type parameter to avoid runtime error
-   Improved mobile responsiveness on dataset and search results page
-   Updated homepage tagline.
-   Upgraded `basemaps.cartocdn.com` url to HTTPS.
-   Upgraded `rollbar.js` 2.3.9 -> 2.4.1
-   Added community link to header
-   Map filter clear button only active when region is selected
-   Fixed a bug in search filter that makes filters irresponsible
-   Fixed a bug on not able to get correct distribution and blank dataset title in breadcrumb
-   Changed chart icons on dataset page
-   Fixed: Enter a dataset page with `*` query string will see a blank page
-   Fixed: when checking if fetch is required, dataset id from url params need to be decoded
-   Enable organisation search

## 0.0.42

-   Implemented the new pagination design
-   remove border for basal button style to prevent duplication
-   Use http://colorbrewer2.org/#type=sequential&scheme=BuPu&n=3 for data vis palette
-   Do not load preview map on mobile, give user option to view in national map instead
-   Added redirect for CKAN dataset URLs (UUID or slug) to their new canonical location
-   Fixed pagination bar shows incorrect result count
-   Added Zendesk feedback widget activated via footer link
-   Made end of content spacing consistent
-   Added `flex` display and set consistent padding from footer.
-   Added filter count to search results
-   Made filter selections move only when applied on publisher and format
-   reset pagination on query change
-   Removed underline from organisations in search
-   Modified styling for `ask a question` button to use secondary AUButton styling.
-   Restricted markdown <strong> tag to be default style.
-   Added `bottom-border` property to make dataset filters stand out more.
-   Fixed page refresh when using a dataset tag as a link.
-   Replaced underscores with spaces on distribution links, making them wrap on mobile
-   Improved modal design on report/ask a question on a dataset
-   Removed `totalCount` field from registry api pagination objects.
-   Added `/count` endpoint to registry api
-   Set default quality to 0 when indexing
-   Use Async appender for logback logging
-   Removed logging to file
-   Akka logging setting adjustment
-   Made publisher and format filter search use the search backend instead of client-side autocomplete.
-   Updated data quality explanation
-   Made go-to-external-distribution button into an <a> tag instead of a javascript button.
-   Update some results found message

## 0.0.41

-   Create Suggest a Dataset Page
-   Add Suggest a Dataset on search results page
-   Fixed display of chart axis config dropdowns in Firefox.
-   Fixed LanguageAnalyzerSpec from generating stop words as search values.
-   Updated prettier config to not reformat package.json in to an invalid 4 space tab width.
-   Positioned the buttons & format icons at middle position of the Files & APIs section
-   Made publisher acronym search case insensitive & added test cases
-   Added vertical spacing for `DataPreview` chart fields.
-   Added file icon and divider to search results
-   Stopped format/publisher filter search returning wrong doc counts when there's no text query.
-   Fixed a issue that state region layer could be removed from region filter panel map
-   Adjust search box placeholder color to be more visible on mobile and more consistent on desktop
-   Corrected email template style to be inline with designs.
-   Switched development/preview to use let's encrypt certificates for HTTPS.

## 0.0.40

-   Changed Publishers to Organisations in UI
-   Modified `MonthPicker` tooltip icon's right padding
-   Location filter: Make state selectable on the inital region filter panel open
-   Made region and dataset configurable in search api.
-   Added publisher name acronyms to elasticsearch
-   Removed underline on coat of arms.
-   Implemented `Tooltip` component to replace `react-tooltip` from `QualityIndicator`
-   Made region and dataset configurable in search api.
-   Fixed open in national map button not send correct URL

## 0.0.39

-   implemented new UI palette with accessibility improvements
-   remove MUI
-   remove /contact page as it duplicates functions of feedback form
-   Use DTA design system for Feedback form
-   Use DTA design system for all form elements
-   Changed linked data rating sleuther to `PUT` instead of `PATCH` data quality aspect
-   Made linked data rating sleuther take output of broken link sleuther into account
-   Removed datasetQualityAspectDef from sleuther-broken-link
-   Update the look of facet searchbox to be consistent with DTA design system
-   Mobile Aus Gov logo links to homepage
-   Change the tag type of the background link on the homepage in order to correct the page refreshing when it shouldn't
-   Added gitlab CI build config
-   Fixed indexer's ability to make/retrieve ES backups
-   Added ability for magda-postgres to retrieve WAL backup as "immediate" rather than catching all the way up with the WAL log.
-   Removed implied ability for magda postgres to use a backup method other than WAL (this never actually worked in practice)
-   Replaced old `node-ci` script with `run-in-submodules`, which allows a command to be run in submodules based on matching
    the values in `package.json`.
-   Removed `border-bottom` property for `Open Data Quality:` from DatasetSummary/Details page
-   Apply Design System skip link/links styles
-   Add schema.org/Dataset microdata semantic markup
-   Use colours from DTA design guide
-   Fixed distribution previews
-   Made CSP report uri configurable
-   Added stubbed correspondence api
-   Added link to publisher page for publisher on dataset summary.
-   Recent search will not save "\*" search
-   Reduced homepage tagline bottom margin
-   Brought back homepage animation
-   Chart is available for Non-time series CSV data files now
-   Map preview on `nationalmap` will be processed by `MagdaCatalogItem`
-   Fixed a few issues with `format-sleuther`
-   `format-sleuther` will use accessURL if download URL not available
-   `format-sleuther` will recognise `www:download-1.0-http—csiro-oa-app` as `CSIRO Open App`
-   `format-sleuther` will recognise `WWW:DOWNLOAD-1.0-http--downloaddata` as `html`
-   `MagdaCatalogItem` will use accessURL if download URL not available
-   `MagdaCatalogItem` will use `dataset-format` (if available) to determine CatalogItem type
-   Added `ESRI REST` (ArcGIS) support to `MapPreview`
-   Fixed the GAP under preview map loading box
-   Switched to using yarn as the package manager
-   Merge duplicate publisher records before display on publisher page
-   Made frontend GA post to both terria and dga google analytics.
-   Tagged correspondence api as a typescript api.
-   Made auto deploy for master -> dev server reconfigure jobs.
-   Fixed up docker scripts to make them handle multiple versions of yarn packages coexisting.
-   Updated footer with govau design systems components.
-   Made magda-web-server look for magda-web-client using require.resolve.
-   Added tooltip to future dates on datepicker
-   Header adjustment for new design system.
-   Updated notification with govau design systems components & fixed a few minor error handling related issues
-   Implemented SMTP client with `nodemailer` for correspondence api
-   Simplified the way that search queries are sent to elasticsearch and boosted title to higher importance.
-   Modified `Show full description` font-size.
-   Added `recrawl` API endpoints to sleuther framework
-   Added spacing between dataset publisher and created date.
-   Fixed up datasets always showing as 0 stars.
-   Added bottom margin to all static pages.
-   Modified offending CSS properties in `MarkdownViewer`.
-   Recent search caches images to avoid flickering icons issue on the first display
-   Added standard space in between Download / New tab buttons on `DatasetDetails`.
-   Reimplemented links from publisher names to their respective page.
-   Make search filters stay on until specifically dismissed
-   Added ui-only preview job to gitlab.
-   Modified `DatasetSummary` description style to be default `au-body`
-   Tweaked `au-btn` border-right to be white for search facets.
-   Remove feedback form & button from both desktop & mobile view
-   Made all data.gov.au environments use mailgun.
-   Map Preview: Set default camera to Australia
-   Map Preview: Mute errors from users
-   Map Preview: Report selected distribution to console
-   Adjusted pagination button styles
-   Bumped regions index version to 21 because of region shortname

## 0.0.38

-   Use button styles from DTA design guide
-   Use grid system from DTA design guide
-   Mobile search filter new look
-   Feedback CSP endpoint now accepts both `application/csp-report` & `application/json` content-type
-   When closed, hamburger menu on mobile switches to a X
-   Will Scroll to top of the page when goes from link to link
-   Made search filter icons consistent in color when they are applied
-   Modified search results `Quality:` text to `Open Data Quality:`
-   Removed excess vertical whitespace from hamburger menu
-   Dataset page: Change icon for distribution page
-   Changed data visualisation table height for either 5 or 10 rows, vertical scroll otherwise.
-   DataPreview Table|Chart is hidden if no data is present.
-   Empty search won't be saved as recent search item
-   Adjust display of feedback link on mobile to be fixed in footer
-   Stopped filters from disappearing when search is submitted
-   Added loading spinner for preview map and dataset visualisation.
-   Adjusted recent search box style
-   Added delete button to recent search box
-   Same search text with different filters will be considered as same searches
-   Fixed an issue that accessURL won't be displayed on distribution page.
-   Will not show distribution page if only accessURL is available.
-   Handle gracefully when local storage is disabled (for recent search history widget)
-   Fixed an issue that registry excludes linking aspects when there are no links
-   Visual adjustments on Homepage & dataset page
-   Changes on homepage config: different background & lozenge on different day
-   Allow turn off homepage stories by set stories field to null
-   Remove 'unspecified' item from publisher & format aggregation
-   Added file icon hover tooltip on dataset page
-   Brought back mobile version home page story style to avoid being run into each other
-   Updated text for homepage articles.
-   Update Privacy/About/Data Rating pages
-   Updated SEO-friendliness of various headings (h3->h2)
-   Display all publishers and hide search on publishers page
-   Added `margin-bottom` spacing for footer links on mobile.
-   Removed `box-shadow` style from selected search facets buttons
-   Hide the \* when I click on the Dataset link in header or click through from a Publisher
-   If format info is available from sleuther, format sleuther info should be used
-   Enable homepage stories and updated homepage config
-   Upgraded TerriaJs to 5.7.0 to fix the issue with previewing certain datasets
-   Created `ISSUE_TEMPLATE.md` file
-   Stopped user feedback from being duplicated
-   Useless patch request to registry API should not trigger any event creation
-   Allow users to select recent search item by arrow keys
-   Add 3 more government CSW services
-   Hide feedback form from mobile view
-   Upgraded React and associates to v16.3
-   Ensured scroll bars are shown on Chrome/Webkit except on search facet autocomplete lists
-   Fixed an issue that users may see an error after page 4
-   Fixed an issue that prevents users from searching current search text by clicking search button or pressing enter key
-   keep distance between search box and the first story on mobile view
-   Fixed an issue search may not be added to recent search list in some cases
-   Make small position adjustment to the recent search icon
-   Moved homepage config from S3 to local
-   Added spacing between download & new tab button on dataset page
-   Added spacing on byline of dataset page
-   Made data quality rating use stars across search results and quality page, and made both use quality aspect.
-   Fix placement and color of search box on desktop and mobile

## 0.0.37

-   Make search filter lozenges wrap when too long
-   Hide created and updated dates if dates are not available
-   Update email address for feedback including in map preview errors
-   Make facets stack on mobile
-   Use params q= 'xxx' to persist the search text in search page, dataset page and distribution pages
-   Added Download button/link click tracking via Google Analytics
-   Add CircleCI configuration to automatically build and deploy the public web interface
-   Hid `Projects` on header
-   Added recent searches function
-   Extend eslint ruleset to enforce the use of the prettier tool
-   Upgrade public web interface (but not preview map) to React 16
-   Set `node-sass` (required by magda-web-client) version to `4.8.1` to solve lerna bootstrap 404 error.
-   Added dataset quality page
-   Added `Powered by Magda` footer link
-   Modified `API Docs` footer link to use HTTPS
-   Modified .vscode/settings to hide ALL `.css` files in @magda-web-client.
-   Added Rollbar exception reporting for client side javascript
-   Added IE9/10 polyfills so that the upgrade-your-browser message comes up
-   Added a development unauthenticated API proxy for testing without CORS problems
-   Updated date display format on search page
-   Added Slash between created and updated date on dataset page
-   Added in quality indicator tooltip for dataset lists
-   Added new window link to Data61 from the "Developed by `data61-logo`" in footer.
-   Added tooltip to search icon
-   Hid download button on dataset page when download url is not available
-   Updated footer links and layout
-   Fixed an issue that prevents csv-geo-au data source to be opened in national map
-   responsive background image for homepage
-   Hidden top `go back to old site` for mobile views
-   New Homepage Design except stories
-   Open in National Map button now send config via postMessage (except IE <=11)
-   Fixed web-server crash in in kubernete pod
-   Removed query language from search api
-   Stopped elasticsearch automatically creating indexes.
-   Stopped recent searches showing "\*" as a dot
-   Made recent searches work from parts deeper than `/`
-   Brought back recent search feature to new home design & implemented the new design
-   Added the data.gov.au s3 bucket to allow script sources
-   Removed API docs from footer temporarily
-   Changed "request dataset" link in footer to a mailto link
-   Added the data.gov.au s3 bucket to allowed script sources
-   Added feedback uri to server config.
-   Modified search results `Quality:` text to `Open Data Quality:`
-   Added eslint to travis build
-   Fixed search.data.gov.au-specific problem where directing back to data.gov.au would cause an redirect back to search.data.gov.au

## 0.0.36

-   Fixed a bug that stopped datasets with URL reserved characters in their id from being viewed.
-   Map Previewer will select WMS data source by default (if available) for better big data handling

## 0.0.35

-   Fixed preview map data loading issue: replaced dev site url
-   Fixed `third-party.js` url in homepage

## 0.0.34

-   Added +x permissions to docker image scripts that didn't have them.
-   Fixed bug where navigation buttons were reversed in the new search results page.
-   Added support to search for regions in the location filter by a short name and configured STE state regions to allow searching by acronym
-   Map previewer will pick data distribution with best support for a dataset
-   Map previewer will communicate with TerriaJs via `postMessage` rather than url
-   Default map for map previewer has been changed to `Positron (Light)`
-   Implement new dataset page design. Brought back Map previewer & Charter previewer.
-   Added `onLoadingStart` & `onLoadingEnd` event handlers to the `DataPreviewMap` component of `magda-web-client` module.
-   Made a click on the "Go back" link on the banner tag the user with a `noPreview` cookie for VWO to pick up on.
-   Added request logging to `magda-web-server`.
-   Added liveness probes to all helm services.
-   Added a CSP and HSTS to magda web.
-   Added default Cache-Control header to GET requests that go through the gateway.
-   Fixed build process to produce minified release version of TerriaMap instead of dev version.
-   Added robots.txt
-   Minor visual adjustment based on Tash's feedback

## 0.0.33

-   Added ability to get records from the registry by the value of their aspects.
-   Set `kubernetes-client` (required by magda-admin-api) version to `3.17.2` to solve a travis build issue
-   Stopped the registry api from timing out and returning an error code when trimming by source tag / id - now returns 202 if it takes too long.
-   Added route for `/pages/*` requests so that `magda-web-server` won't response `Cannot GET /page/*`
-   Added format sleuther
-   Set `kubernetes-client` (required by magda-admin-api) version to `3.17.2` to solve the travis build issue.
-   Added ability to get records from the registry by the value of their aspects.
-   Added access control layer to Authorization APIs: All `private` APIs (uri starts with /private/) can only be accessed by Admin users.
-   Auth API will return `401` status code for un-authorized users and `403` if the APIs require `admin` level access
-   Added test cases for ApiClient class
-   Added test cased for Authorization APIs
-   Fixed minor frontend issue when Authorization APIs return non-json response
-   Updated visualization sleuther to stream file downloads and csv parsing, and relax time field specifications.
-   Added `userId` parameter to `package.json` of `magda-gateway` module
-   Added execution permission to `setup.sh` to solve the issue that `magda-elastic-search` failed to start in minikube
-   Updated format sleuther to be a bit more optimistic in its sleuthing
-   Re-added viz sleuther to default helm config
-   Added index to `"publisher"` field in recordaspects table in order to stop indexer webhook queries taking 10 minutes.
-   Added a CONTRIBUTING.md file
-   Fixed an issue that `Preview Map` doesn't support WFS API
-   Made the indexer listen to delete record events and remove the deleted record from the index
-   Added prettier `pre-commit` hook to make sure consistent code style
-   Formatted existing typescript source code using `prettier`
-   Updated `building-and-running.md`
-   Added preview map support for geojson data type
-   Merged latest changes (commits on or before 1st Feb 2018) from TerrisMap to `magda-preview-map` module
-   Map previewer will zoom to dataset (except KML data)
-   Removed `year` facet from search results, replaced it with a temporal field with earliest and latest dates in search results.
-   Added Google Analytics Tag Manager Code / VWO code to `<head>`
-   Added `feedback-api` microservice to collect feedback and create GitHub issues from it.
-   Duplicated tags with different cases are now merged (at frontend)
-   Tags contain possible separators (i.e. , ; | or /) are now split into shorter tags (at frontend)
-   Separated database migrations from database images to facilitate use of managed SQL services - they now live in `magda-migrator-xx` directories and run as jobs on helm upgrade/install
-   Added configuration for Google Cloud SQL
-   Normalised DB names - now everything is magda-xx-db
-   Made docker build scripts automatically adjust `FROM` statements to add `localhost:5000/` and the correct version tag where necessary
-   Made datasets with years < 1000 AD index as being from the year 2xxx, as all that we've seen are typos so far.
-   Changes on feedback form: Added (\*) to `Email` & `Feedback` fields heading. Added tooltip to display the validation error.
-   Changes on feedback form: the distance between right border of the feedback form and browser window should be the same as the bottom border.

## 0.0.32

-   Connectors now create organizations, datasets, and distributions with IDs prefixed by the type of record and by the ID of the connector. For example, `org-bom-Australian Bureau of Meteorology` is the organization with the ID `Australian Bureau of Meteorology` from the connector with ID `bom`. Other type prefixes are `ds` for dataset and `dist` for distribution. This change avoids conflicting IDs from different sources.
-   Fixed a race condition in the registry that could lead to an error when multiple requests tried to create/update the same record simultaneously, which is fairly common when creating organizations in the CSW connector.
-   Updated hooks so that each hook when running can skip over irrelevant events
-   Made sure hook processing resumes when either the registry or the sleuther wakes back up.
-   SA1 regions are no longer named after the SA2 region that contains them, reducing noise in the region search results. To find an actual SA1, users will need to search for its ID.
-   The broken link sleuther now has its retry count for external links configurable separately to the retry count for contacting the registry, with a default of 3.
-   Connectors now tag datasets that they've created with a `sourcetag` attribute - at the end of a crawl, they delete all records that were created by them without the latest `sourceTag`.
-   Optimised the query that finds new events for each webhook
-   Stopped async webhooks posting `success: false` on an uncaught failure, as this just causes them to process the same data and fail over and over.
-   Stopped the broken link sleuther from failing completely when it gets a string that isn't a valid URL - now records as "broken".
