package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import akka.event.Logging
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.stream.Materializer
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.directives.TenantDirectives.requiresTenantId
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.registry.Directives.withRecordOpaQuery
import com.typesafe.config.Config
import io.swagger.annotations._
import javax.ws.rs.Path
import scalikejdbc.DB

import au.csiro.data61.magda.client.AuthOperations
import scala.concurrent.ExecutionContext

@Path("/records")
@io.swagger.annotations.Api(value = "records", produces = "application/json")
class RecordsServiceRO(
    authApiClient: RegistryAuthApiClient,
    config: Config,
    system: ActorSystem,
    materializer: Materializer,
    recordPersistence: RecordPersistence,
    eventPersistence: EventPersistence
) extends Protocols
    with SprayJsonSupport {

  private val logger = Logging(system, getClass)
  implicit private val ec: ExecutionContext = system.dispatcher

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records Get a list of all records
    * @apiDescription Get a list of all records
    * @apiParam (query) {string[]} aspect The aspects for which to retrieve data, specified as multiple occurrences of this query parameter. Only records that have all of these aspects will be included in the response.
    * @apiParam (query) {string[]} optionalAspect The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter. These aspects will be included in a record if available, but a record will be included even if it is missing these aspects.
    * @apiParam (query) {string} pageToken A token that identifies the start of a page of results. This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results.
    * @apiParam (query) {number} start The index of the first record to retrieve. When possible, specify pageToken instead as it will result in better performance. If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve.
    * @apiParam (query) {number} limit The maximum number of records to receive. The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off.
    * @apiParam (query) {boolean} dereference true to automatically dereference links to other records; false to leave them as links. Dereferencing a link means including the record itself where the link would be. Dereferencing only happens one level deep, regardless of the value of this parameter.
    * @apiParam (query) {string[]} aspectQuery Filter the records returned by a value within the aspect JSON. Expressed as 'aspectId.path.to.field:value’, url encoded. NOTE: This is an early stage API and may change greatly in the future
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the record detail
    * @apiSuccessExample {json} Response:
    *  [
    *      {
    *          "id": "string",
    *          "name": "string",
    *          "aspects": {},
    *          "sourceTag": "string"
    *      }
    *  ]
    * @apiUse GenericError
    */
  @ApiOperation(
    value = "Get a list of all records",
    nickname = "getAll",
    httpMethod = "GET",
    response = classOf[Record],
    responseContainer = "List"
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "aspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."
      ),
      new ApiImplicitParam(
        name = "optionalAspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  These aspects will be included in a record if available, but a record will be included even if it is missing these aspects."
      ),
      new ApiImplicitParam(
        name = "pageToken",
        required = false,
        dataType = "string",
        paramType = "query",
        value =
          "A token that identifies the start of a page of results.  This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results."
      ),
      new ApiImplicitParam(
        name = "start",
        required = false,
        dataType = "number",
        paramType = "query",
        value =
          "The index of the first record to retrieve.  When possible, specify pageToken instead as it will result in better performance.  If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve."
      ),
      new ApiImplicitParam(
        name = "limit",
        required = false,
        dataType = "number",
        paramType = "query",
        value =
          "The maximum number of records to receive.  The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off."
      ),
      new ApiImplicitParam(
        name = "dereference",
        required = false,
        dataType = "boolean",
        paramType = "query",
        value =
          "true to automatically dereference links to other records; false to leave them as links.  Dereferencing a link means including the record itself where the link would be.  Dereferencing only happens one level deep, regardless of the value of this parameter."
      ),
      new ApiImplicitParam(
        name = "aspectQuery",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "Filter the records returned by a value within the aspect JSON. Expressed as 'aspectId.path.to.field:value', url encoded. NOTE: This is an early stage API and may change greatly in the future"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def getAll: Route = get {
    pathEnd {
      requiresTenantId { tenantId =>
        parameters(
          'aspect.*,
          'optionalAspect.*,
          'pageToken.as[Long] ?,
          'start.as[Int].?,
          'limit.as[Int].?,
          'dereference.as[Boolean].?,
          'aspectQuery.*
        ) {
          (
              aspects,
              optionalAspects,
              pageToken,
              start,
              limit,
              dereference,
              aspectQueries
          ) =>
            val parsedAspectQueries = aspectQueries.map(AspectQuery.parse)

            withRecordOpaQuery(
              AuthOperations.read,
              recordPersistence,
              authApiClient
            )(
              config,
              system,
              materializer,
              ec
            ) { opaQueries =>
              complete {
                DB readOnly { session =>
                  recordPersistence.getAllWithAspects(
                    session,
                    tenantId,
                    aspects,
                    optionalAspects,
                    opaQueries,
                    pageToken,
                    start,
                    limit,
                    dereference,
                    parsedAspectQueries
                  )
                }
              }
            }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records/summary Get a list of all records as summaries
    * @apiDescription Get a list of all records as summaries
    * @apiParam (query) {string} pageToken A token that identifies the start of a page of results. This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results.
    * @apiParam (query) {number} start The index of the first record to retrieve. When possible, specify pageToken instead as it will result in better performance. If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve.
    * @apiParam (query) {number} limit The maximum number of records to receive. The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off.
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the record summary
    * @apiSuccessExample {json} Response:
    *  [
    *        {
    *            "id": "string",
    *            "name": "string",
    *            "aspects": [
    *              "string"
    *            ]
    *        }
    *  ]
    * @apiUse GenericError
    */
  @Path("/summary")
  @ApiOperation(
    value = "Get a list of all records as summaries",
    nickname = "getAllSummary",
    httpMethod = "GET",
    response = classOf[RecordSummary],
    responseContainer = "List"
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "pageToken",
        required = false,
        dataType = "string",
        paramType = "query",
        value =
          "A token that identifies the start of a page of results.  This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results."
      ),
      new ApiImplicitParam(
        name = "start",
        required = false,
        dataType = "number",
        paramType = "query",
        value =
          "The index of the first record to retrieve.  When possible, specify pageToken instead as it will result in better performance.  If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve."
      ),
      new ApiImplicitParam(
        name = "limit",
        required = false,
        dataType = "number",
        paramType = "query",
        value =
          "The maximum number of records to receive.  The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def getAllSummary: Route = get {
    path("summary") {
      requiresTenantId { tenantId =>
        parameters('pageToken.?, 'start.as[Int].?, 'limit.as[Int].?) {
          (pageToken, start, limit) =>
            withRecordOpaQuery(
              AuthOperations.read,
              recordPersistence,
              authApiClient
            )(
              config,
              system,
              materializer,
              ec
            ) { opaQueries =>
              complete {
                DB readOnly { session =>
                  recordPersistence
                    .getAll(
                      session,
                      tenantId,
                      opaQueries,
                      pageToken,
                      start,
                      limit
                    )
                }
              }
            }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records/count Get the count of records matching the parameters
    * @apiDescription Get the count of records matching the parameters. If no parameters are specified, the count will be approximate for performance reasons.
    * @apiParam (query) {string[]} aspect The aspects for which to retrieve data, specified as multiple occurrences of this query parameter. Only records that have all of these aspects will be included in the response.
    * @apiParam (query) {string[]} aspectQuery Filter the records returned by a value within the aspect JSON. Expressed as 'aspectId.path.to.field:value’, url encoded. NOTE: This is an early stage API and may change greatly in the future
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the record count
    * @apiSuccessExample {json} Response:
    *    {
    *      "count": 0
    *    }
    * @apiUse GenericError
    */
  @Path("/count")
  @ApiOperation(
    value =
      "Get the count of records matching the parameters. If no parameters are specified, the count will be approximate for performance reasons.",
    nickname = "getCount",
    httpMethod = "GET",
    response = classOf[CountResponse]
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "aspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."
      ),
      new ApiImplicitParam(
        name = "aspectQuery",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "Filter the records returned by a value within the aspect JSON. Expressed as 'aspectId.path.to.field:value', url encoded. NOTE: This is an early stage API and may change greatly in the future"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def getCount: Route = get {
    path("count") {
      requiresTenantId { tenantId =>
        parameters('aspect.*, 'aspectQuery.*) { (aspects, aspectQueries) =>
          val parsedAspectQueries = aspectQueries.map(AspectQuery.parse)

          withRecordOpaQuery(
            AuthOperations.read,
            recordPersistence,
            authApiClient
          )(
            config,
            system,
            materializer,
            ec
          ) { opaQueries =>
            complete {
              DB readOnly { session =>
                CountResponse(
                  recordPersistence
                    .getCount(
                      session,
                      tenantId,
                      opaQueries,
                      aspects,
                      parsedAspectQueries
                    )
                )
              }
            }
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records/pagetokens Get a list tokens for paging through the records
    * @apiPrivate
    * @apiDescription Get a list tokens for paging through the records
    * @apiParam (query) {string[]} aspect The aspects for which to retrieve data, specified as multiple occurrences of this query parameter. Only records that have all of these aspects will be included in the response.
    * @apiParam (query) {number} limit The size of each page to get tokens for.
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response a list of page token
    * @apiSuccessExample {json} Response:
    *   [
    *      "string"
    *   ]
    * @apiUse GenericError
    */
  @Path("/pagetokens")
  @ApiOperation(
    value = "Get a list tokens for paging through the records",
    nickname = "getPageTokens",
    httpMethod = "GET",
    response = classOf[String],
    responseContainer = "List"
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "aspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."
      ),
      new ApiImplicitParam(
        name = "limit",
        required = false,
        dataType = "number",
        paramType = "query",
        value = "The size of each page to get tokens for."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def getPageTokens: Route = get {
    path("pagetokens") {
      pathEnd {
        requiresTenantId { tenantId =>
          import scalikejdbc._
          parameters('aspect.*, 'limit.as[Int].?) { (aspect, limit) =>
            withRecordOpaQuery(
              AuthOperations.read,
              recordPersistence,
              authApiClient
            )(
              this.config,
              system,
              materializer,
              ec
            ) { opaQueries =>
              complete {
                DB readOnly { session =>
                  "0" :: recordPersistence
                    .getPageTokens(
                      session,
                      tenantId,
                      aspect,
                      opaQueries,
                      limit
                    )
                }
              }
            }
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records/{id} Get a record by ID
    * @apiDescription Gets a complete record, including data for all aspects.
    * @apiParam (path) {string} id ID of the record to be fetched.
    * @apiParam (query) {string[]} aspect The aspects for which to retrieve data, specified as multiple occurrences of this query parameter. Only records that have all of these aspects will be included in the response.
    * @apiParam (query) {string[]} optionalAspect The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter. These aspects will be included in a record if available, but a record will be included even if it is missing these aspects.
    * @apiParam (query) {boolean} dereference true to automatically dereference links to other records; false to leave them as links. Dereferencing a link means including the record itself where the link would be. Dereferencing only happens one level deep, regardless of the value of this parameter.
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the record detail
    * @apiSuccessExample {json} Response:
    *      {
    *          "id": "string",
    *          "name": "string",
    *          "aspects": {},
    *          "sourceTag": "string"
    *      }
    * @apiUse GenericError
    */
  @Path("/{id}")
  @ApiOperation(
    value = "Get a record by ID",
    nickname = "getById",
    httpMethod = "GET",
    response = classOf[Record],
    notes = "Gets a complete record, including data for all aspects."
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "id",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the record to be fetched."
      ),
      new ApiImplicitParam(
        name = "aspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  Only records that have all of these aspects will be included in the response."
      ),
      new ApiImplicitParam(
        name = "optionalAspect",
        required = false,
        dataType = "string",
        paramType = "query",
        allowMultiple = true,
        value =
          "The optional aspects for which to retrieve data, specified as multiple occurrences of this query parameter.  These aspects will be included in a record if available, but a record will be included even if it is missing these aspects."
      ),
      new ApiImplicitParam(
        name = "dereference",
        required = false,
        dataType = "boolean",
        paramType = "query",
        value =
          "true to automatically dereference links to other records; false to leave them as links.  Dereferencing a link means including the record itself where the link would be.  Dereferencing only happens one level deep, regardless of the value of this parameter."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 404,
        message = "No record exists with that ID.",
        response = classOf[ApiError]
      )
    )
  )
  def getById: Route = get {
    path(Segment) { id =>
      requiresTenantId { tenantId =>
        parameters('aspect.*, 'optionalAspect.*, 'dereference.as[Boolean].?) {
          (aspects, optionalAspects, dereference) =>
            withRecordOpaQuery(
              AuthOperations.read,
              recordPersistence,
              authApiClient,
              Some(id)
            )(
              config,
              system,
              materializer,
              ec
            ) { opaQueries =>
              DB readOnly { session =>
                recordPersistence.getByIdWithAspects(
                  session,
                  tenantId,
                  id,
                  opaQueries,
                  aspects,
                  optionalAspects,
                  dereference
                ) match {
                  case Some(record) => complete(record)
                  case None =>
                    complete(
                      StatusCodes.NotFound,
                      ApiError(
                        "No record exists with that ID or it does not have the required aspects."
                      )
                    )
                }
              }
            }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {get} /v0/registry/records/summary/{id} Get a summary record by ID
    * @apiDescription Gets a summary record, including all the aspect ids for which this record has data.
    * @apiParam (path) {string} id ID of the record to be fetched.
    * @apiHeader {number} X-Magda-Tenant-Id Magda internal tenant id
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the record summary detail
    * @apiSuccessExample {json} Response:
    *      {
    *        "id": "string",
    *        "name": "string",
    *        "aspects": [
    *            "string"
    *        ]
    *      }
    * @apiUse GenericError
    */
  @Path("/summary/{id}")
  @ApiOperation(
    value = "Get a summary record by ID",
    nickname = "getByIdSummary",
    httpMethod = "GET",
    response = classOf[RecordSummary],
    notes =
      "Gets a summary record, including all the aspect ids for which this record has data."
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "id",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the record to be fetched."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = false,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 404,
        message = "No record exists with that ID.",
        response = classOf[ApiError]
      )
    )
  )
  def getByIdSummary: Route = get {
    path("summary" / Segment) { id =>
      requiresTenantId { tenantId =>
        withRecordOpaQuery(
          AuthOperations.read,
          recordPersistence,
          authApiClient,
          Some(id)
        )(
          config,
          system,
          materializer,
          ec
        ) { opaQueries =>
          DB readOnly { session =>
            recordPersistence.getById(session, tenantId, opaQueries, id) match {
              case Some(record) => complete(record)
              case None =>
                complete(
                  StatusCodes.NotFound,
                  ApiError("No record exists with that ID.")
                )
            }
          }
        }
      }
    }
  }

  def route: Route =
    getAll ~
      getCount ~
      getAllSummary ~
      getPageTokens ~
      getById ~
      getByIdSummary ~
      new RecordAspectsServiceRO(
        authApiClient,
        system,
        materializer,
        config,
        recordPersistence
      ).route ~
      new RecordHistoryService(
        config,
        authApiClient,
        system,
        materializer,
        recordPersistence,
        eventPersistence
      ).route
}
