package au.csiro.data61.magda.api

import akka.event.LoggingAdapter
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.model.StatusCodes._
import akka.http.scaladsl.server.Directives._
import au.csiro.data61.magda.model.misc
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.api.{model => apimodel}
import au.csiro.data61.magda.directives.TenantDirectives.requiresTenantId
import au.csiro.data61.magda.search.SearchQueryer
import com.typesafe.config.Config

/**
  * @apiDefine Search Search API
  *
  * Search API lets users discover datasets and information about their source
  * organisations.
  */

class SearchApi(val searchQueryer: SearchQueryer)(
    implicit val config: Config,
    implicit val logger: LoggingAdapter
) extends misc.Protocols
    with BaseMagdaApi
    with apimodel.Protocols {
  override def getLogger = logger

  val routes =
    magdaRoute {
      pathPrefix("v0") {

        /**
          * @apiGroup Search
          * @api {get} /v0/search/facets/:facetId/options Get Facet Options
          * @apiDescription Returns a list facet options by facet id.
          *
          * @apiParam {string="Publisher","Format"} facetId id of facet
          *
          * @apiParam (Query) {string} [facetQuery] full text search query to search within facets
          * @apiParam (Query) {number} [start=0] index of first result to return
          * @apiParam (Query) {number} [limit=10] number of results to return
          * @apiParam (Query) {string} [generalQuery] full text search query to search within datasets
          * @apiParam (Query) {string[]} [publisher] filter search query by names of organisations
          * @apiParam (Query) {string} [dateFrom] filter datasets by start date of dataset coverage
          * @apiParam (Query) {string} [dateTo] filter datasets by end date of dataset coverage
          * @apiParam (Query) {string[]} [region] filter datasets by regions
          * @apiParam (Query) {string[]} [format] filter datasets by formats
          *
          * @apiSuccess {number} hitCount number of total results.
          * @apiSuccess {FacetOption[]} options Result facet options.
          * @apiSuccess {string} options.identifier facet option id.
          * @apiSuccess {string} options.value facet option label
          * @apiSuccess {number} options.hitCount number of dataset hits
          * @apiSuccess {boolean} options.matched flag to say whether it matched or not?
          *
          * @apiSuccessExample {any} 200
          *    {
          *        "hitCount": 948,
          *        "options": [
          *            {
          *                "identifier": "...",
          *                "value": "...",
          *                "hitCount": 0,
          *                "matched": false
          *            },
          *            ...
          *       ]
          *    }
          */
        pathPrefix("facets") {
          requiresTenantId { tenantId =>
            extractRequest { request =>
              path(Segment / "options") { facetId ⇒
                (get & parameters(
                  'facetQuery ?,
                  "start" ? 0,
                  "limit" ? 10,
                  'generalQuery ?,
                  'publisher *,
                  'dateFrom ?,
                  'dateTo ?,
                  'region *,
                  'format *,
                  'publishingState *
                )) {
                  (
                      facetQuery,
                      start,
                      limit,
                      generalQuery,
                      publishers,
                      dateFrom,
                      dateTo,
                      regions,
                      formats,
                      publishingState
                  ) =>
                    val query = Query.fromQueryParams(
                      generalQuery,
                      publishers,
                      dateFrom,
                      dateTo,
                      regions,
                      formats,
                      publishingState
                    )

                    FacetType.fromId(facetId) match {
                      case Some(facetType) ⇒
                        complete(
                          searchQueryer.searchFacets(
                            request.headers
                              .find(_.is("x-magda-session"))
                              .map(_.value()),
                            facetType,
                            facetQuery,
                            query,
                            start,
                            limit,
                            tenantId
                          )
                        )
                      case None ⇒ complete(NotFound)
                    }
                }
              }
            }
          }
        } ~
          /**
            * @apiGroup Search
            * @api {get} /v0/search/datasets Search Datasets
            * @apiDescription Returns a list of results.
            *
            * @apiParam (Query) {string} [query] full text search query
            * @apiParam (Query) {number} [start=0] index of first result to return
            * @apiParam (Query) {number} [limit=10] number of results to return
            * @apiParam (Query) {number} [facetSize=10] number of facets to return
            * @apiParam (Query) {string[]} [publisher] filter search query by names of organisations
            * @apiParam (Query) {string} [dateFrom] filter datasets by start date of dataset coverage
            * @apiParam (Query) {string} [dateTo] filter datasets by end date of dataset coverage
            * @apiParam (Query) {string[]} [region] filter datasets by regions
            * @apiParam (Query) {string[]} [format] filter datasets by formats
            *
            * @apiSuccess {object} query Will reflect query specified.
            * @apiSuccess {string} hitCount number of total results.
            * @apiSuccess {Dataset[]} dataSets Result datasets.
            * @apiSuccess {object} temporal Reflects match data coverage dates.
            * @apiSuccess {object} temporal.start
            * @apiSuccess {string} temporal.start.date Returns the start date of the earliest matched result in ISO8601 format.
            * @apiSuccess {object} temporal.end
            * @apiSuccess {string} temporal.end.date Returns the end date of the latest matched result in ISO8601 format.
            * @apiSuccess {string} strategy search strategy used
            * @apiSuccess {Facets} facets Facets of results. See response of Get Facet Options for more details.
            *
            * @apiSuccessExample {any} 200
            *    {
            *        "hitCount": 948,
            *        "dataSets": [
            *            {
            *                "quality": 0.6,
            *                "catalog": "CSIRO",
            *                "identifier": "...",
            *                "spatial": {
            *                    "text": "Australia"
            *                },
            *                "description": "...",
            *                "indexed": "2018-07-13T05:29:03.534Z",
            *                "landingPage": "https://data.gov.au/dataset/...",
            *                "modified": "2017-06-13T05:31:57Z",
            *                "issued": "2017-01-23T22:04:30Z",
            *                "contactPoint": { "identifier": "someone@government.gov.au" },
            *                "languages": [ "English" ],
            *                "temporal": {
            *                    "start": {
            *                        "text": "2016-01-01"
            *                    }
            *                },
            *                "distributions": [
            *                    {
            *                        "format": "ESRI REST",
            *                        "downloadURL": "...",
            *                        "identifier": "...",
            *                        "description": "...",
            *                        "modified": "2017-01-24T...",
            *                        "license": {...},
            *                        "issued": "...",
            *                        "title": "..."
            *                    },
            *                    ...
            *                ],
            *                publisher": {
            *                    "acronym": "..",
            *                    "name": "...",
            *                    "identifier": "org-...",
            *                    "description": "...",
            *                    "imageUrl": "..."
            *                },
            *                "keywords": [ "Cycling", ... ],
            *                "title": "...",
            *                "themes": []
            *                ...
            *            },
            *            ...
            *       ],
            *       "query": {
            *           ...
            *       },
            *       "temporal": {
            *           ...
            *       },
            *       "strategy": "...",
            *       ,
            *       "facets": [
            *           ...
            *       ]
            *    }
            *
            */
          pathPrefix("datasets") {
            requiresTenantId { tenantId =>
              extractRequest { request =>
                (get & parameters(
                  'query ?,
                  "start" ? 0,
                  "limit" ? 10,
                  "facetSize" ? 10,
                  'publisher *,
                  'dateFrom ?,
                  'dateTo ?,
                  'region *,
                  'format *,
                  'publishingState *
                )) {
                  (
                      generalQuery,
                      start,
                      limit,
                      facetSize,
                      publishers,
                      dateFrom,
                      dateTo,
                      regions,
                      formats,
                      publishingState
                  ) ⇒
                    val query = Query.fromQueryParams(
                      generalQuery,
                      publishers,
                      dateFrom,
                      dateTo,
                      regions,
                      formats,
                      publishingState
                    )

                    onSuccess(
                      searchQueryer.search(
                        request.headers
                          .find(_.is("x-magda-session"))
                          .map(_.value()),
                        query,
                        start,
                        limit,
                        facetSize,
                        tenantId
                      )
                    ) { result =>
                      val status =
                        if (result.errorMessage.isDefined)
                          StatusCodes.InternalServerError
                        else StatusCodes.OK

                      pathPrefix("datasets") {
                        complete(status, result.copy(facets = None))

                        /**
                        * @apiGroup Search
                        * @api {get} /v0/search/datasets/facets Search Datasets Return Facets
                        * @apiDescription Returns the facets part of dataset search. For more details, see Search Datasets and Get Facet Options.
                        * @apiSuccessExample {any} 200
                        *                    See Search Datasets and Get Facet Options.
                        *
                        */
                      } ~ pathPrefix("facets") {
                        complete(status, result.facets)
                      } ~ pathEnd {
                        complete(status, result)
                      }
                    }
                }
              }
            }
          } ~
          /**
            * @apiGroup Search
            * @api {get} /v0/search/organisations Search Organisations
            * @apiDescription Returns a list of results.
            *
            * @apiParam (Query) {string} [query] full text search query
            * @apiParam (Query) {number} [start=0] index of first result to return
            * @apiParam (Query) {number} [limit=10] number of results to return
            *
            * @apiSuccess {string} hitCount number of total results.
            * @apiSuccess {Organisation[]} organisations[] Result organisations.
            *
            * @apiSuccessExample {any} 200
            *    {
            *        "hitCount": 948,
            *        "organisations": [
            *            {
            *                "acronym": "...",
            *                "name": "...",
            *                "email": "...@...",
            *                "identifier": "...",
            *                "addrState": "...",
            *                "datasetCount": 2,
            *                "addrSuburb": "...",
            *                "addrStreet": "...",
            *                "addrPostCode": "...",
            *                "phone": "...",
            *                "addrCountry": "Australia"
            *            },
            *            ...
            *       ]
            *    }
            */
          pathPrefix("organisations") {
            requiresTenantId { tenantId =>
              (get & parameters(
                'query ?,
                "start" ? 0,
                "limit" ? 10
              )) { (generalQuery, start, limit) ⇒
                onSuccess(
                  searchQueryer
                    .searchOrganisations(generalQuery, start, limit, tenantId)
                ) { result =>
                  val status =
                    if (result.errorMessage.isDefined)
                      StatusCodes.InternalServerError
                    else StatusCodes.OK
                  complete(status, result)
                }
              }
            }
          } ~
          /**
            * @apiGroup Search
            * @api {get} /v0/search/autoComplete Generate a suggestion list of a dataset field
            * @apiDescription Returns a suggestion list based on text content of a specified dataset field
            *
            * @apiParam (Query) {string} [field] which field will be used to generate the suggestion list; e.g. accessNotes.notes
            * @apiParam (Query) {string} [inputString] full text input
            * @apiParam (Query) {number} [limit=10] number of suggestion items to return; If larger than 100, will be capped at 100
            *
            * @apiSuccess {String[]} suggestion[] a List of suggestion item.
            *
            * @apiSuccessExample {any} 200
            *    {
            *        "inputString": "asdd",
            *        "suggestions": [
            *            "asdd sddsds",
            *            "asdd ssd sddssd",
            *            "asdd sdds",
            *            ...
            *       ]
            *    }
            */
          pathPrefix("autoComplete") {
            requiresTenantId { tenantId =>
              extractRequest { request =>
                (get & parameters(
                  "field",
                  'input ?,
                  "limit" ? 10
                )) { (field, input, limit) ⇒
                  onSuccess(
                    searchQueryer.autoCompleteQuery(
                      request.headers
                        .find(_.is("x-magda-session"))
                        .map(_.value()),
                      field,
                      input,
                      Some(limit),
                      tenantId
                    )
                  ) { result =>
                    val status =
                      if (result.errorMessage.isDefined)
                        StatusCodes.InternalServerError
                      else StatusCodes.OK
                    complete(status, result)
                  }
                }
              }
            }
          } ~
          /**
            * @apiGroup Search
            * @api {get} /v0/search/region-types Get Region Types
            * @apiDescription Returns a list of region types
            *
            * @apiSuccess {string} comments Notes for programmers.
            * @apiSuccess {RegionWMSMap[]} regionWmsMap A mepping of string to WMS layer metadata.
            *
            * @apiSuccessExample {any} 200
            *    {
            *        "comments": "...",
            *        "regionWmsMap": {
            *            "STE": {
            *                "layerName": "FID_STE_2011_AUST",
            *                "server": "https://vector-tiles.terria.io/FID_STE_2011_AUST/{z}/{x}/{y}.pbf",
            *                "regionProp": "STE_CODE11",
            *                ...
            *            },
            *            ...
            *        }
            *    }
            */
          path("region-types") { get { getFromResource("regionMapping.json") } } ~
          /**
            * @apiGroup Search
            * @api {get} /v0/search/regions Get Regions
            * @apiDescription Returns a list of regions
            * @apiParam (Query) {number} [lv1Id=None] filter by level 1 region Id
            * @apiParam (Query) {number} [lv2Id=None] filter by level 2 region Id
            * @apiParam (Query) {number} [lv3Id=None] filter by level 3 region Id
            * @apiParam (Query) {number} [lv4Id=None] filter by level 4 region Id
            * @apiParam (Query) {number} [lv5Id=None] filter by level 5 region Id
            * @apiParam (Query) {number} [start=0] index of first item to return
            * @apiParam (Query) {number} [limit=10] number of items to return
            *
            * @apiSuccess {string} hitCount number of total results.
            * @apiSuccess {Region[]} regions Region items.
            *
            * @apiSuccessExample {any} 200
            *    {
            *        "hitCount": 0,
            *        "regions": []
            *    }
            */
          path("regions") {
            requiresTenantId { tenantId =>
              (get & parameters(
                'query ?,
                "type" ?,
                "lv1Id" ?,
                "lv2Id" ?,
                "lv3Id" ?,
                "lv4Id" ?,
                "lv5Id" ?,
                "start" ? 0,
                "limit" ? 10
              )) {
                (
                    query,
                    regionType,
                    lv1Id,
                    lv2Id,
                    lv3Id,
                    lv4Id,
                    lv5Id,
                    start,
                    limit
                ) ⇒
                  complete(
                    searchQueryer.searchRegions(
                      query,
                      regionType,
                      lv1Id,
                      lv2Id,
                      lv3Id,
                      lv4Id,
                      lv5Id,
                      start,
                      limit,
                      tenantId
                    )
                  )
              }
            }
          } ~
          pathPrefix("status") {
            path("live") { complete("OK") } ~
              path("ready") { complete(ReadyStatus(true)) }
          }
      }
    }
}
