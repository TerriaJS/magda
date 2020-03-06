package au.csiro.data61.magda.client

import java.net.URL

import akka.actor.ActorSystem
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.{StatusCodes, _}
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.unmarshalling.Unmarshal
import akka.stream.Materializer
import akka.util.ByteString
import au.csiro.data61.magda.model.Auth.{AuthProtocols, User}
import au.csiro.data61.magda.opa.OpaTypes.OpaQuery
import au.csiro.data61.magda.opa._
import com.typesafe.config.Config
import spray.json._

import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._

class AuthApiClient(authHttpFetcher: HttpFetcher)(
    implicit val config: Config,
    implicit val system: ActorSystem,
    implicit val executor: ExecutionContext,
    implicit val materializer: Materializer
) extends AuthProtocols {

  private val logger = system.log

  def this()(
      implicit config: Config,
      system: ActorSystem,
      executor: ExecutionContext,
      materializer: Materializer
  ) = {
    this(HttpFetcher(new URL(config.getString("authApi.baseUrl"))))(
      config,
      system,
      executor,
      materializer
    )
  }

  def getUserPublic(userId: String): Future[User] = {
    val responseFuture = authHttpFetcher.get(s"/v0/public/users/$userId")

    responseFuture.flatMap(
      response =>
        response.status match {
          case StatusCodes.OK => Unmarshal(response.entity).to[User]
          case _ =>
            Unmarshal(response.entity)
              .to[String]
              .map(error => throw new Exception(error))
        }
    )
  }

  def queryRecord(
      jwtToken: Option[String],
      operationType: AuthOperations.OperationType,
      policyIds: List[String]
  ): Future[List[(String, List[List[OpaTypes.OpaQuery]])]] = {
    Future.sequence(
      policyIds.map(
        policyId =>
          queryPolicy(jwtToken, operationType, policyId).map(
            result => (policyId, result)
          )
      )
    )
  }

  private def queryPolicy(
      jwtToken: Option[String],
      operationType: AuthOperations.OperationType,
      policyId: String
  ): Future[List[List[OpaQuery]]] = {
    val requestData: String = s"""{
                                 |  "query": "data.$policyId.${operationType.id}",
                                 |  "unknowns": ["input.object"]
                                 |}""".stripMargin

    val headers = jwtToken match {
      case Some(jwt) => List(RawHeader("X-Magda-Session", jwt))
      case None      => List()
    }

    authHttpFetcher
      .post(
        s"/v0/opa/compile",
        HttpEntity(ContentTypes.`application/json`, requestData),
        headers
      )
      .flatMap(receiveOpaResponse[List[List[OpaQuery]]](_, policyId) { json =>
        OpaParser.parseOpaResponse(json)
      })
  }

  private def receiveOpaResponse[T](
      res: HttpResponse,
      policyId: String
  )(fn: JsValue => T): Future[T] = {
    if (res.status.intValue() != 200) {
      res.entity.dataBytes.runFold(ByteString(""))(_ ++ _).flatMap { body =>
        logger
          .error(s"OPA failed to process the request: {}", body.utf8String)
        Future.failed(
          new Exception(
            s"Failed to retrieve access control decision from OPA for $policyId: ${body.utf8String}"
          )
        )
      }
    } else {
      res.entity.toStrict(10.seconds).map { entity =>
        fn(entity.data.utf8String.parseJson)
      }
    }
  }
}
