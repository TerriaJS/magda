package au.csiro.data61.magda.api

import akka.event.LoggingAdapter
import akka.http.scaladsl.model.HttpResponse
import akka.http.scaladsl.model.StatusCodes._
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{
  ExceptionHandler,
  MethodRejection,
  RejectionHandler,
  _
}

trait BaseMagdaApi {

  def getLogger: LoggingAdapter

  def rejectionHandler =
    RejectionHandler
      .newBuilder()
      .handleAll[MethodRejection] { rejections ⇒
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
      .result()

  def genericExceptionHandler() = ExceptionHandler {
    case e: Exception ⇒ {
      getLogger.error(e, "Exception encountered")

      complete(HttpResponse(InternalServerError, entity = "Failure"))
    }
  }

  def magdaRoute(inner: Route): Route = {
    handleExceptions(genericExceptionHandler) {
      inner
    }
  }
}
