package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.stream.Materializer
import au.csiro.data61.magda.directives.TenantDirectives.requiresTenantId
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.registry.Directives.withRecordOpaQuery
import com.typesafe.config.Config
import io.swagger.annotations._
import javax.ws.rs.Path
import scalikejdbc.DB
import au.csiro.data61.magda.client.AuthOperations

@Path("/records/{recordId}/aspects")
@io.swagger.annotations.Api(
  value = "record aspects",
  produces = "application/json"
)
class RecordAspectsServiceRO(
    authApiClient: RegistryAuthApiClient,
    system: ActorSystem,
    materializer: Materializer,
    config: Config,
    recordPersistence: RecordPersistence
) extends Protocols
    with SprayJsonSupport {

  /**
    * @apiGroup Registry Record Aspects
    * @api {get} /v0/registry/records/{recordId}/aspects/{aspectId} Get a record aspect by ID
    * @apiDescription Get a list of all aspects of a record
    * @apiParam (path) {string} recordId ID of the record for which to fetch an aspect
    * @apiParam (path) {string} aspectId ID of the aspect to fetch
    * @apiHeader {string} X-Magda-Session Magda internal session id
    * @apiSuccess (Success 200) {json} Response the aspect detail
    * @apiSuccessExample {json} Response:
    *    {
    *      "format": "text/csv",
    *      "mediaType": "text/csv",
    *      "name": "qcat-outdoor~AIR_TEMP~9.csv",
    *      "downloadURL": "https://data.csiro.au/dap/ws/v2/collections/17914/data/103023",
    *      "licence": "CSIRO Data Licence",
    *      "id": 103023,
    *      "accessURL": "https://data.csiro.au/dap/ws/v2/collections/17914/data"
    *    }
    * @apiUse GenericError
    */
  @Path("/{aspectId}")
  @ApiOperation(
    value = "Get a record aspect by ID",
    nickname = "getById",
    httpMethod = "GET",
    response = classOf[Aspect]
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
        value = "ID of the record for which to fetch an aspect."
      ),
      new ApiImplicitParam(
        name = "aspectId",
        required = true,
        dataType = "string",
        paramType = "path",
        value = "ID of the aspect to fetch."
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
        message = "No record or aspect exists with the given IDs.",
        response = classOf[ApiError]
      )
    )
  )
  def getById = get {
    path(Segment / "aspects" / Segment) {
      (recordId: String, aspectId: String) =>
        requiresTenantId { tenantId =>
          {
            withRecordOpaQuery(
              AuthOperations.read,
              recordPersistence,
              authApiClient,
              Some(recordId)
            )(
              config,
              system,
              materializer,
              system.dispatcher
            ) { opaQueries =>
              DB readOnly { session =>
                recordPersistence
                  .getRecordAspectById(
                    session,
                    tenantId,
                    recordId,
                    aspectId,
                    opaQueries
                  ) match {
                  case Some(recordAspect) => complete(recordAspect)
                  case _ =>
                    complete(
                      StatusCodes.NotFound,
                      ApiError(
                        "No record or aspect exists with the given IDs."
                      )
                    )
                }
              }
            }
          }
        }
    }
  }

  def route =
    getById
}
