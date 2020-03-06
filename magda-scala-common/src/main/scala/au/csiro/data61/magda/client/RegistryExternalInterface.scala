package au.csiro.data61.magda.client

import java.io.IOException
import java.net.URL
import java.time.ZoneOffset

import akka.actor.ActorSystem
import akka.event.Logging
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.HttpResponse
import akka.http.scaladsl.model.StatusCodes.{NotFound, OK}
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.unmarshalling.Unmarshal
import akka.stream.Materializer
import au.csiro.data61.magda.Authentication
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.misc.DataSet
import au.csiro.data61.magda.util.Collections.mapCatching
import com.typesafe.config.Config
import io.jsonwebtoken.Jwts

import scala.concurrent.{ExecutionContext, Future}
import io.jsonwebtoken.SignatureAlgorithm
import java.{util => ju}

trait RegistryInterface {

  def getDataSetsReturnToken(
      start: Long,
      size: Int
  ): Future[(Option[String], List[DataSet])]

  def getDataSetsToken(
      token: String,
      size: Int
  ): Future[(Option[String], List[DataSet])]
}

/**
  * An instance of this class is not tenant specific. That is, when making request to the registry,
  * it adds request header "X-Magda-Tenant-Id" with the value of MAGDA_SYSTEM_ID. The request will
  * be made directly to the registry instead of via the gateway. Therefore, this class should only
  * be used internally.
  *
  * @param httpFetcher
  * @param config
  * @param system
  * @param executor
  * @param materializer
  */
class RegistryExternalInterface(httpFetcher: HttpFetcher)(
    implicit val config: Config,
    implicit val system: ActorSystem,
    implicit val executor: ExecutionContext,
    implicit val materializer: Materializer
) extends RegistryInterface {
  def this()(
      implicit config: Config,
      system: ActorSystem,
      executor: ExecutionContext,
      materializer: Materializer
  ) = {
    this(HttpFetcher(new URL(config.getString("registry.baseUrl"))))(
      config,
      system,
      executor,
      materializer
    )
  }

  implicit val defaultOffset =
    ZoneOffset.of(config.getString("time.defaultOffset"))
  implicit val fetcher = httpFetcher
  implicit val logger = Logging(system, getClass)

  val authJws = Authentication.signToken(
    Jwts
      .builder()
      .claim("userId", config.getString("auth.userId")),
    system.log
  )
  val authHeader = RawHeader(Authentication.headerName, authJws)

  val systemIdHeader =
    RawHeader(MAGDA_TENANT_ID_HEADER, MAGDA_SYSTEM_ID.toString())

  val aspectQueryString =
    RegistryConstants.aspects.map("aspect=" + _).mkString("&")

  val optionalAspectQueryString =
    RegistryConstants.optionalAspects.map("optionalAspect=" + _).mkString("&")
  val baseApiPath = "/v0"
  val recordsQueryStrong = s"?$aspectQueryString&$optionalAspectQueryString"
  val baseRecordsPath = s"${baseApiPath}/records$recordsQueryStrong"

  def onError(response: HttpResponse)(entity: String) = {
    val error =
      s"Registry request failed with status code ${response.status} and entity $entity"
    logger.error(error)
    Future.failed(new IOException(error))
  }

  def getDataSetsToken(
      pageToken: String,
      number: Int
  ): scala.concurrent.Future[(Option[String], List[DataSet])] = {
    fetcher
      .get(
        path =
          s"$baseRecordsPath&dereference=true&pageToken=$pageToken&limit=$number",
        headers = Seq(systemIdHeader, authHeader)
      )
      .flatMap { response =>
        response.status match {
          case OK =>
            Unmarshal(response.entity).to[RegistryRecordsResponse].map {
              registryResponse =>
                (
                  registryResponse.nextPageToken,
                  mapCatching[Record, DataSet](
                    registryResponse.records, { hit =>
                      Conversions.convertRegistryDataSet(hit, Some(logger))
                    }, { (e, item) =>
                      logger.error(e, "Could not parse item: {}", item.toString)
                    }
                  )
                )
            }
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  def getDataSetsReturnToken(
      start: Long,
      number: Int
  ): scala.concurrent.Future[(Option[String], List[DataSet])] = {
    fetcher
      .get(
        path = s"$baseRecordsPath&dereference=true&start=$start&limit=$number",
        headers = Seq(systemIdHeader, authHeader)
      )
      .flatMap { response =>
        response.status match {
          case OK =>
            Unmarshal(response.entity).to[RegistryRecordsResponse].map {
              registryResponse =>
                (
                  registryResponse.nextPageToken,
                  mapCatching[Record, DataSet](
                    registryResponse.records, { hit =>
                      Conversions.convertRegistryDataSet(hit, Some(logger))
                    }, { (e, item) =>
                      logger.error(e, "Could not parse item: {}", item.toString)
                    }
                  )
                )
            }
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  def getWebhooks(): Future[List[WebHook]] = {
    fetcher
      .get(path = s"$baseApiPath/hooks", headers = Seq(authHeader))
      .flatMap { response =>
        response.status match {
          case OK => Unmarshal(response.entity).to[List[WebHook]]
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  def getWebhook(id: String): Future[Option[WebHook]] = {
    fetcher
      .get(path = s"$baseApiPath/hooks/$id", headers = Seq(authHeader))
      .flatMap { response =>
        response.status match {
          case OK       => Unmarshal(response.entity).to[WebHook].map(Some.apply)
          case NotFound => Future(None)
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  def putWebhook(webhook: WebHook): Future[WebHook] = {
    fetcher
      .put(
        path = s"$baseApiPath/hooks/${webhook.id.get}",
        payload = webhook,
        headers = Seq(authHeader)
      )
      .flatMap { response =>
        response.status match {
          case OK => Unmarshal(response.entity).to[WebHook]
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  /**
    * A created web hook is tenant independent, e.g. indexer and minion web hooks.
    * In the future, tenant specific web hooks may be supported.
    * @param webhook
    * @return
    */
  def createWebhook(webhook: WebHook): Future[WebHook] = {
    fetcher
      .post(
        path = s"$baseApiPath/hooks",
        payload = webhook,
        headers = Seq(authHeader)
      )
      .flatMap { response =>
        response.status match {
          case OK => Unmarshal(response.entity).to[WebHook]
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }

  def resumeWebhook(
      webhookId: String
  ): Future[WebHookAcknowledgementResponse] = {
    fetcher
      .post(
        path = s"$baseApiPath/hooks/$webhookId/ack",
        payload = WebHookAcknowledgement(succeeded = false),
        headers = Seq(authHeader)
      )
      .flatMap { response =>
        response.status match {
          case OK =>
            Unmarshal(response.entity).to[WebHookAcknowledgementResponse]
          case _ =>
            Unmarshal(response.entity).to[String].flatMap(onError(response))
        }
      }
  }
}
