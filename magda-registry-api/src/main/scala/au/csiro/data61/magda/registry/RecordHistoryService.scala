package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.stream.Materializer
import akka.stream.scaladsl.Sink
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.directives.AuthDirectives.requireIsAdmin
import au.csiro.data61.magda.directives.TenantDirectives.requiresTenantId
import au.csiro.data61.magda.model.Registry._
import com.typesafe.config.Config
import io.swagger.annotations._
import javax.ws.rs.Path

import scala.concurrent.Await
import scala.concurrent.duration._
import scalikejdbc.DB

/**
  * @apiGroup Registry Record History
  * @api {get} /v0/registry/records/{recordId}/history Get a list of all events affecting this record
  * @apiDescription Get a list of all aspects of a record
  * @apiParam (path) {string} recordId ID of the record to fetch.
  * @apiParam (query) {string} pageToken A token that identifies the start of a page of results. This token should not be interpreted as having any meaning, but it can be obtained from a previous page of results.
  * @apiParam (query) {number} start The index of the first event to retrieve. Specify pageToken instead will result in better performance when access high offset. If this parameter and pageToken are both specified, this parameter is interpreted as the index after the pageToken of the first record to retrieve.
  * @apiParam (query) {number} limit The maximum number of records to receive. The response will include a token that can be passed as the pageToken parameter to a future request to continue receiving results where this query leaves off.
  * @apiSuccess (Success 200) {json} Response the event list
  * @apiSuccessExample {json} Response:
                        {
                            "events": [
                                {
                                    "eventTime": "2018-08-29T07:45:48.011Z",
                                    "eventType": "CreateRecord",
                                    "tenantId": 0,
                                    "userId": 0,
                                    "data": {
                                        ...
                                    }
                                },
                                ...
                            ],
                            "hasMore": true,
                            "nextPageToken": "xxx"
                        }
  * @apiUse GenericError
  */
@Path("/records/{recordId}/history")
@io.swagger.annotations.Api(
  value = "record history",
  produces = "application/json"
)
class RecordHistoryService(
    config: Config,
    authClient: AuthApiClient,
    system: ActorSystem,
    materializer: Materializer,
    recordPersistence: RecordPersistence,
    eventPersistence: EventPersistence
) extends Protocols
    with SprayJsonSupport {

  val route =
    history ~
      version

  @ApiOperation(
    value = "Get a list of all events affecting this record",
    nickname = "history",
    httpMethod = "GET",
    response = classOf[EventsPage]
  )
  @ApiImplicitParams(
    Array(
      new ApiImplicitParam(
        name = "X-Magda-Tenant-Id",
        required = true,
        dataType = "number",
        paramType = "header",
        value = "0"
      ),
      new ApiImplicitParam(
        name = "recordId",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the record for which to fetch history."
      )
    )
  )
  def history: Route = get {
    path(Segment / "history") { id =>
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresTenantId { tenantId =>
          parameters('pageToken.as[Long].?, 'start.as[Int].?, 'limit.as[Int].?) {
            (pageToken, start, limit) =>
              complete {
                DB readOnly { session =>
                  eventPersistence.getEvents(
                    session,
                    recordId = Some(id),
                    pageToken = pageToken,
                    start = start,
                    limit = limit,
                    tenantId = tenantId
                  )
                }
              }
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record History
    * @api {get} /v0/registry/records/{recordId}/history/{eventId} Get the version of a record that existed after a given event was applied
    * @apiDescription Get the version of a record that existed after a given event was applied
    * @apiParam (path) {string} recordId ID of the record to fetch.
    * @apiParam (path) {string} eventId The ID of the last event to be applied to the record. The event with this ID need not actually apply to the record, in which case that last event prior to this even that does apply will be used.
    * @apiSuccess (Success 200) {json} Response the record detail
    * @apiSuccessExample {json} Response:
                            {
                                "data": {
                                    "aspect": {
                                        "id": "dga",
                                        "name": "data.gov.au",
                                        "type": "ckan-organization",
                                        "url": "https://data.gov.au/api/3/action/organization_show?id=760c24b1-3c3d-4ccb-8196-41530fcdebd5"
                                    },
                                    "aspectId": "source",
                                    "recordId": "org-dga-760c24b1-3c3d-4ccb-8196-41530fcdebd5",
                                    "tenantId": 0
                                },
                                "eventTime": "2011-12-10T15:40:55.987+11:00",
                                "eventType": "CreateRecordAspect",
                                "id": 11,
                                "tenantId": 0,
                                "userId": 0
                            }
    * @apiUse GenericError
    */
  @Path("/{eventId}")
  @ApiOperation(
    value =
      "Get the version of a record that existed after a given event was applied",
    nickname = "version",
    httpMethod = "GET",
    response = classOf[Record]
  )
  @ApiImplicitParams(Array(
    new ApiImplicitParam(
      name = "X-Magda-Tenant-Id",
      required = true,
      dataType = "number",
      paramType = "header",
      value = "0"
    ),
    new ApiImplicitParam(
      name = "recordId",
      required = true,
      dataType = "string",
      paramType = "path",
      value = "ID of the record to fetch."
    ),
    new ApiImplicitParam(
      name = "eventId",
      required = true,
      dataType = "string",
      paramType = "path",
      value = "The ID of the last event to be applied to the record.  The event with this ID need not actually apply to the record, in which case that last event prior to this even that does apply will be used."
    )
  ))
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 404,
        message = "No record exists with the given ID, it does not have a CreateRecord event, or it has been deleted.",
        response = classOf[ApiError]
      )
    ))
  def version = get {
    path(Segment / "history" / Segment) { (id, version) =>
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresTenantId { tenantId =>
          parameters('aspect.*, 'optionalAspect.*) {
            (aspects: Iterable[String], optionalAspects: Iterable[String]) =>
              DB readOnly { _ =>
                val events = eventPersistence.streamEventsUpTo(
                  version.toLong,
                  recordId = Some(id),
                  tenantId = tenantId
                )
                val recordSource = recordPersistence.reconstructRecordFromEvents(
                  id,
                  events,
                  aspects,
                  optionalAspects
                )
                val sink = Sink.head[Option[Record]]
                val future = recordSource.runWith(sink)(materializer)
                Await.result[Option[Record]](future, 5 seconds) match {
                  case Some(record) => complete(record)
                  case None =>
                    complete(
                      StatusCodes.NotFound,
                      ApiError("No record exists with that ID, it does not have a CreateRecord event, or it has been deleted.")
                    )
                }
            }
          }
        }
      }
    }
  }
}
