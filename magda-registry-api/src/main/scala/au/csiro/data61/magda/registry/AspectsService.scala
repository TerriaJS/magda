package au.csiro.data61.magda.registry

import akka.actor.{ActorRef, ActorSystem}
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
import scalikejdbc._

import scala.util.{Failure, Success}

class AspectsService(
    config: Config,
    authClient: AuthApiClient,
    webHookActor: ActorRef,
    system: ActorSystem,
    materializer: Materializer
) extends AspectsServiceRO(config, authClient, system, materializer) {

  /**
    * @apiGroup Registry Aspects
    * @api {post} /v0/registry/aspects Create a new aspect
    *
    * @apiDescription Acknowledges a previously-deferred web hook with a given ID. Acknowledging a previously-POSTed web hook will cause the next, if any, to be sent.
    *
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiParam (body) {json} aspect The definition of the new aspect.
    * @apiParamExample {json} Request-Example
    * {
    *    "id": "string",
    *    "name": "string",
    *    "jsonSchema": {}
    * }
    * @apiSuccess (Success 200) {json} Response The created aspect
    * @apiSuccessExample {json} Response:
    *
    *    {
    *      "id": "string",
    *      "name": "string",
    *      "jsonSchema": {}
    *    }
    *
    * @apiUse GenericError
    */
  @ApiOperation(
    value = "Create a new aspect",
    nickname = "create",
    httpMethod = "POST",
    response = classOf[AspectDefinition]
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
        name = "aspect",
        required = true,
        dataType = "au.csiro.data61.magda.model.Registry$AspectDefinition",
        paramType = "body",
        value = "The definition of the new aspect."
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
  def create: Route = post {
    pathEnd {
      requireIsAdmin(authClient)(system, config) { _ =>
        requiresSpecifiedTenantId { tenantId =>
          entity(as[AspectDefinition]) { aspect =>
            val theResult = DB localTx { session =>
              AspectPersistence.create(session, aspect, tenantId) match {
                case Success(result) =>
                  complete(result)
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
  }

  /**
    * @apiGroup Registry Aspects
    * @api {put} /v0/registry/aspects/{id} Modify an aspect by ID
    *
    * @apiDescription Modifies the aspect with a given ID. If an aspect with the ID does not yet exist, it is created.
    *
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiParam (path) {string} id ID of the aspect to be saved.
    * @apiParam (body) {json} aspect The aspect to save.
    * @apiParamExample {json} Request-Example
    * {
    *    "id": "string",
    *    "name": "string",
    *    "jsonSchema": {}
    * }
    * @apiSuccess (Success 200) {json} Response The details of the aspect saved.
    * @apiSuccessExample {json} Response:
    *
    *    {
    *      "id": "string",
    *      "name": "string",
    *      "jsonSchema": {}
    *    }
    *
    * @apiUse GenericError
    */
  @Path("/{id}")
  @ApiOperation(
    value = "Modify an aspect by ID",
    nickname = "putById",
    httpMethod = "PUT",
    response = classOf[AspectDefinition],
    notes =
      "Modifies the aspect with a given ID.  If an aspect with the ID does not yet exist, it is created."
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
        name = "aspect",
        required = true,
        dataType = "au.csiro.data61.magda.model.Registry$AspectDefinition",
        paramType = "body",
        value = "The aspect to save."
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
      {
        requireIsAdmin(authClient)(system, config) { _ =>
          requiresSpecifiedTenantId { tenantId =>
            entity(as[AspectDefinition]) { aspect =>
              val theResult = DB localTx { session =>
                AspectPersistence.putById(session, id, aspect, tenantId) match {
                  case Success(result) =>
                    complete(result)
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
    }
  }

  /**
    * @apiGroup Registry Aspects
    * @api {patch} /v0/registry/aspects/{id} Modify an aspect by applying a JSON Patch
    *
    * @apiDescription The patch should follow IETF RFC 6902 (https://tools.ietf.org/html/rfc6902).
    *
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiParam (path) {string} id ID of the aspect to be saved.
    * @apiParam (body) {json} aspectPatch The RFC 6902 patch to apply to the aspect.
    * @apiParamExample {json} Request-Example
    * [
    *    {
    *        "path": "string"
    *    }
    * ]
    * @apiSuccess (Success 200) {json} Response The details of the aspect patched.
    * @apiSuccessExample {json} Response:
    *
    *    {
    *      "id": "string",
    *      "name": "string",
    *      "jsonSchema": {}
    *    }
    *
    * @apiUse GenericError
    */
  @Path("/{id}")
  @ApiOperation(
    value = "Modify an aspect by applying a JSON Patch",
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
        name = "aspectPatch",
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
          entity(as[JsonPatch]) { aspectPatch =>
            val theResult = DB localTx { session =>
              AspectPersistence
                .patchById(session, id, aspectPatch, tenantId) match {
                case Success(result) =>
                  complete(result)
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
  }

  override def route: Route =
    super.route ~
      putById ~
      patchById ~
      create
}
