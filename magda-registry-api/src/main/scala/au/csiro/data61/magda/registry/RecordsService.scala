package au.csiro.data61.magda.registry

import java.util.concurrent.TimeoutException

import akka.actor.{ActorRef, ActorSystem}
import akka.event.Logging
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.stream.Materializer
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.directives.AuthDirectives.requireIsAdmin
import au.csiro.data61.magda.directives.TenantDirectives.{
  requiresTenantId,
  requiresSpecifiedTenantId
}
import au.csiro.data61.magda.model.Registry._
import com.typesafe.config.Config
import gnieh.diffson.sprayJson._
import io.swagger.annotations._
import javax.ws.rs.Path
import scalikejdbc.DB
import org.everit.json.schema.ValidationException

import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.{Failure, Success}

@Path("/records")
@io.swagger.annotations.Api(value = "records", produces = "application/json")
class RecordsService(
    config: Config,
    webHookActor: ActorRef,
    authClient: RegistryAuthApiClient,
    system: ActorSystem,
    materializer: Materializer,
    recordPersistence: RecordPersistence,
    eventPersistence: EventPersistence
) extends RecordsServiceRO(
      authClient,
      config,
      system,
      materializer,
      recordPersistence,
      eventPersistence
    ) {
  val logger = Logging(system, getClass)
  implicit val ec: ExecutionContext = system.dispatcher

  /**
    * @apiGroup Registry Record Service
    * @api {delete} /v0/registry/records/{recordId} Delete a record
    *
    * @apiDescription Delete a record
    *
    * @apiParam (path) {string} recordId ID of the record to delete.
    * @apiHeader {string} X-Magda-Session Magda internal session id
    *
    * @apiSuccess (Success 200) {json} Response the record deletion result
    * @apiSuccessExample {json} Response:
    *   {
    *     "deleted": true
    *   }
    * @apiUse GenericError
    */
  @Path("/{recordId}")
  @ApiOperation(
    value = "Delete a record",
    nickname = "deleteById",
    httpMethod = "DELETE",
    response = classOf[DeleteResult]
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
        value = "ID of the record to delete."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = true,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 400,
        message =
          "The record could not be deleted, possibly because it is used by another record.",
        response = classOf[ApiError]
      )
    )
  )
  def deleteById: Route = delete {
    path(Segment) { recordId: String =>
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresSpecifiedTenantId { tenantId =>
          val theResult = DB localTx { session =>
            recordPersistence.deleteRecord(session, tenantId, recordId) match {
              case Success(result) => complete(DeleteResult(result))
              case Failure(exception) =>
                complete(
                  StatusCodes.BadRequest,
                  ApiError(exception.getMessage)
                )
            }
          }
          webHookActor ! WebHookActor.Process()
          theResult
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {delete} /v0/registry/records Trim by source tag
    *
    * @apiDescription Trims records with the provided source that DON’T have the supplied source tag
    *
    * @apiParam (query) {string} sourceTagToPreserve Source tag of the records to PRESERVE.
    * @apiParam (query) {string} sourceId Source id of the records to delete.
    * @apiHeader {string} X-Magda-Session Magda internal session id
    *
    * @apiSuccess (Success 200) {json} Response-200 the trim result
    * @apiSuccessExample {json} Response-200:
    *   {
    *     "count": 0
    *   }
    * @apiSuccess (Success 202) {string} Response Deletion is taking a long time (normal for sources with many records) but it has worked
    * @apiError (Error 400) {string} Response The records could not be deleted, possibly because they are used by other records.
    * @apiUse GenericError
    */
  @Path("/")
  @ApiOperation(
    value = "Trim by source tag",
    notes =
      "Trims records with the provided source that DON'T have the supplied source tag",
    nickname = "trimBySourceTag",
    httpMethod = "DELETE",
    response = classOf[MultipleDeleteResult]
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
        name = "sourceTagToPreserve",
        required = true,
        dataType = "string",
        paramType = "query",
        value = "Source tag of the records to PRESERVE."
      ),
      new ApiImplicitParam(
        name = "sourceId",
        required = true,
        dataType = "string",
        paramType = "query",
        value = "Source id of the records to delete."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = true,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 202,
        message =
          "Deletion is taking a long time (normal for sources with many records) but it has worked"
      ),
      new ApiResponse(
        code = 400,
        message =
          "The records could not be deleted, possibly because they are used by other records.",
        response = classOf[ApiError]
      )
    )
  )
  def trimBySourceTag: Route = delete {
    pathEnd {
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresSpecifiedTenantId { tenantId =>
          parameters('sourceTagToPreserve, 'sourceId) {
            (sourceTagToPreserve, sourceId) =>
              val deleteFuture = Future {
                // --- DB session needs to be created within the `Future`
                // --- as the `Future` will keep running after timeout and require active DB session
                DB localTx { implicit session =>
                  recordPersistence.trimRecordsBySource(
                    tenantId,
                    sourceTagToPreserve,
                    sourceId,
                    Some(logger)
                  )
                }
              } map { result =>
                webHookActor ! WebHookActor.Process()
                result
              }

              val deleteResult = try {
                Await.result(
                  deleteFuture,
                  config.getLong("trimBySourceTagTimeoutThreshold") milliseconds
                )
              } catch {
                case e: Throwable => Failure(e)
              }

              deleteResult match {
                case Success(result) => complete(MultipleDeleteResult(result))
                case Failure(_: TimeoutException) =>
                  complete(StatusCodes.Accepted)
                case Failure(exception) =>
                  logger.error(
                    exception,
                    "An error occurred while trimming with sourceTagToPreserve $1 sourceId $2",
                    sourceTagToPreserve,
                    sourceId
                  )
                  complete(
                    StatusCodes.BadRequest,
                    ApiError(
                      "An error occurred while processing your request."
                    )
                  )
              }
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {put} /v0/registry/records/{id} Modify a record by ID
    *
    * @apiDescription Modifies a record. Aspects included in the request are created or updated, but missing aspects are not removed.
    *
    * @apiParam (path) {string} id ID of the record to be fetched.
    * @apiParam (body) {json} record The record to save.
    * @apiParamExample {json} Request-Example
    * {
    *    "id": "string",
    *    "name": "string",
    *    "aspects": {},
    *    "sourceTag": "string"
    * }
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
    value = "Modify a record by ID",
    nickname = "putById",
    httpMethod = "PUT",
    response = classOf[Record],
    notes =
      "Modifies a record.  Aspects included in the request are created or updated, but missing aspects are not removed."
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
        name = "id",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the record to be fetched."
      ),
      new ApiImplicitParam(
        name = "record",
        required = true,
        dataType = "au.csiro.data61.magda.model.Registry$Record",
        paramType = "body",
        value = "The record to save."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = true,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def putById: Route = put {
    path(Segment) { id: String =>
      requireIsAdmin(authClient)(system, config) { _ =>
        {
          requiresSpecifiedTenantId { tenantId =>
            entity(as[Record]) { recordIn =>
              val result = DB localTx { session =>
                recordPersistence.putRecordById(
                  session,
                  tenantId,
                  id,
                  recordIn,
                  Nil
                ) match {
                  case Success(recordOut) =>
                    complete(recordOut)
                  // If the exception is from validation then reveal the message to the caller,
                  // otherwise log it and return something generic.
                  case Failure(exception: ValidationException) =>
                    complete(
                      StatusCodes.BadRequest,
                      ApiError("Encountered an error - " + exception.getMessage)
                    )
                  case Failure(exception) =>
                    logger.error(
                      exception,
                      "Encountered an exception when putting a record"
                    )
                    complete(
                      StatusCodes.InternalServerError,
                      ApiError("Encountered an error")
                    )
                }
              }
              webHookActor ! WebHookActor.Process(
                ignoreWaitingForResponse = false,
                Some(recordIn.aspects.keys.toList)
              )
              result
            }
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {patch} /v0/registry/records/{id} Modify a record by applying a JSON Patch
    *
    * @apiDescription The patch should follow IETF RFC 6902 (https://tools.ietf.org/html/rfc6902).
    *
    * @apiParam (path) {string} id ID of the aspect to be saved.
    * @apiParam (body) {json} recordPatch The RFC 6902 patch to apply to the aspect.
    * @apiParamExample {json} Request-Example
    * [
    *    {
    *        "path": "string"
    *    }
    * ]
    * @apiSuccess (Success 200) {json} Response the record detail
    * @apiSuccessExample {json} Response:
    *      {
    *        "id": "string",
    *        "name": "string",
    *        "jsonSchema": {}
    *      }
    * @apiUse GenericError
    */
  @Path("/{id}")
  @ApiOperation(
    value = "Modify a record by applying a JSON Patch",
    nickname = "patchById",
    httpMethod = "PATCH",
    response = classOf[AspectDefinition],
    notes =
      "The patch should follow IETF RFC 6902 (https://tools.ietf.org/html/rfc6902)."
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
        name = "id",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the aspect to be saved."
      ),
      new ApiImplicitParam(
        name = "recordPatch",
        required = true,
        dataType = "gnieh.diffson.JsonPatchSupport$JsonPatch",
        paramType = "body",
        value = "The RFC 6902 patch to apply to the aspect."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = true,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  def patchById: Route = patch {
    path(Segment) { id: String =>
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresSpecifiedTenantId { tenantId =>
          entity(as[JsonPatch]) { recordPatch =>
            val theResult = DB localTx { session =>
              recordPersistence.patchRecordById(
                session,
                tenantId,
                id,
                recordPatch,
                Nil
              ) match {
                case Success(result) =>
                  complete(result)
                case Failure(exception) =>
                  logger.error(
                    exception,
                    "Exception encountered while PATCHing record {} with {}",
                    id,
                    recordPatch.toJson.prettyPrint
                  )
                  complete(
                    StatusCodes.BadRequest,
                    ApiError(exception.getMessage)
                  )
              }
            }
            webHookActor ! WebHookActor
              .Process(ignoreWaitingForResponse = false, Some(List(id)))
            theResult
          }
        }
      }
    }
  }

  /**
    * @apiGroup Registry Record Service
    * @api {post} /v0/registry/records Create a new record
    *
    * @apiDescription Create a new record
    *
    * @apiParam (body) {json} record The definition of the new record.
    * @apiParamExample {json} Request-Example
    * {
    *    "id": "string",
    *    "name": "string",
    *    "aspects": {},
    *    "sourceTag": "string"
    * }
    * @apiHeader {string} X-Magda-Session Magda internal session id
    *
    * @apiSuccess (Success 200) {json} Response the record created
    * @apiSuccessExample {json} Response:
    *      {
    *          "id": "string",
    *          "name": "string",
    *          "aspects": {},
    *          "sourceTag": "string"
    *      }
    * @apiError (Error 400) {string} Response could not create
    * @apiUse GenericError
    */
  @ApiOperation(
    value = "Create a new record",
    nickname = "create",
    httpMethod = "POST",
    response = classOf[Record]
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
        name = "record",
        required = true,
        dataType = "au.csiro.data61.magda.model.Registry$Record",
        paramType = "body",
        value = "The definition of the new record."
      ),
      new ApiImplicitParam(
        name = "X-Magda-Session",
        required = true,
        dataType = "String",
        paramType = "header",
        value = "Magda internal session id"
      )
    )
  )
  @ApiResponses(
    Array(
      new ApiResponse(
        code = 400,
        message =
          "A record already exists with the supplied ID, or the record includes an aspect that does not exist.",
        response = classOf[ApiError]
      )
    )
  )
  def create: Route = post {
    requireIsAdmin(authClient)(system, config) { _ =>
      requiresSpecifiedTenantId { tenantId =>
        pathEnd {
          entity(as[Record]) { record =>
            val result = DB localTx { session =>
              recordPersistence
                .createRecord(session, tenantId, record) match {
                case Success(theResult) => complete(theResult)
                case Failure(exception) =>
                  complete(
                    StatusCodes.BadRequest,
                    ApiError(exception.getMessage)
                  )
              }
            }
            webHookActor ! WebHookActor.Process(
              ignoreWaitingForResponse = false,
              Some(record.aspects.keys.toList)
            )
            result
          }
        }
      }
    }
  }

  override def route: Route =
    super.route ~
      putById ~
      patchById ~
      trimBySourceTag ~
      deleteById ~
      create ~
      new RecordAspectsService(
        webHookActor,
        authClient,
        system,
        materializer,
        config,
        recordPersistence
      ).route

}
