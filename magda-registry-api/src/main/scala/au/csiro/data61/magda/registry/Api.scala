package au.csiro.data61.magda.registry

import java.util.concurrent.TimeUnit

import akka.actor.{ActorRef, ActorSystem}
import akka.event.Logging
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.model.StatusCodes._
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server._
import akka.stream.Materializer
import akka.util.Timeout
import com.typesafe.config.Config

import scala.concurrent.ExecutionContext
import scala.concurrent.duration.FiniteDuration

/**
  * @apiDefine GenericError
  * @apiError (Error 500) {String} Response "Failure"
  */

class Api(
    val webHookActorOption: Option[ActorRef],
    val authApiClient: RegistryAuthApiClient,
    implicit val config: Config,
    implicit val system: ActorSystem,
    implicit val ec: ExecutionContext,
    implicit val materializer: Materializer
) extends Protocols {
  val logger = Logging(system, getClass)

  implicit def rejectionHandler =
    RejectionHandler
      .newBuilder()
      .handleAll[MethodRejection] { rejections =>
        val methods = rejections map (_.supported)
        lazy val names = methods map (_.name) mkString ", "

        options {
          complete(s"Supported methods : $names.")
        } ~
          complete(
            MethodNotAllowed,
            s"HTTP method not allowed, supported methods: $names!"
          )
      }
      .handleAll[MalformedRequestContentRejection] { rejections =>
        val messages =
          ("The request content did not have the expected format:" +: rejections
            .map(_.message)).mkString("\n")
        complete(
          StatusCodes.BadRequest,
          au.csiro.data61.magda.registry.ApiError(messages)
        )
      }
      .result()

  val myExceptionHandler = ExceptionHandler {
    case e: Exception => {
      logger.error(e, "Exception encountered")

      complete(
        StatusCodes.InternalServerError,
        au.csiro.data61.magda.registry
          .ApiError("The server encountered an unexpected error.")
      )
    }
  }

  implicit val timeout = Timeout(FiniteDuration(1, TimeUnit.SECONDS))

  val recordPersistence = new DefaultRecordPersistence(config)
  val eventPersistence = new DefaultEventPersistence(recordPersistence)

  val roleDependentRoutes = webHookActorOption match {
    case Some(webHookActor) =>
      pathPrefix("aspects") {
        new AspectsService(
          config,
          authApiClient,
          webHookActor,
          system,
          materializer
        ).route
      } ~
        pathPrefix("records") {
          new RecordsService(
            config,
            webHookActor,
            authApiClient,
            system,
            materializer,
            recordPersistence,
            eventPersistence
          ).route
        } ~
        pathPrefix("hooks") {
          new HooksService(
            config,
            webHookActor,
            authApiClient,
            system,
            materializer
          ).route
        }
    case None =>
      pathPrefix("aspects") {
        new AspectsServiceRO(config, authApiClient, system, materializer).route
      } ~
        pathPrefix("records") {
          new RecordsServiceRO(
            authApiClient,
            config,
            system,
            materializer,
            recordPersistence,
            eventPersistence
          ).route
        }
  }

  val routes = handleExceptions(myExceptionHandler) {
      pathPrefix("v0") {
        path("ping") { complete("OK") } ~
        pathPrefix("status") {
          path("live") { complete("OK") } ~
          path("ready") { complete(ReadyStatus(true)) }
        } ~ roleDependentRoutes
      }
    }
}
