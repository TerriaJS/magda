package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import akka.stream.Materializer
import au.csiro.data61.magda.opa.OpaTypes._
import com.typesafe.config.Config
import scalikejdbc.DB
import scala.util.{Failure, Success, Try}

import scala.concurrent.{ExecutionContext, Future}
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.client.HttpFetcher
import java.net.URL
import au.csiro.data61.magda.client.AuthOperations

class RegistryAuthApiClient(
    authHttpFetcher: HttpFetcher
)(
    implicit config: Config,
    system: ActorSystem,
    ec: ExecutionContext,
    materializer: Materializer
) extends AuthApiClient(authHttpFetcher) {
  def this()(
      implicit config: Config,
      system: ActorSystem,
      executor: ExecutionContext,
      materializer: Materializer
  ) = {
    this(
      HttpFetcher(
        new URL(config.getString("authApi.baseUrl"))
      )
    )(
      config,
      system,
      executor,
      materializer
    )
  }

  def queryForRecords(
      jwt: Option[String],
      operationType: AuthOperations.OperationType,
      opaPolicyIds: List[String],
      recordId: Option[String] = None
  ): Future[List[(String, List[List[OpaQuery]])]] = {

    /** Is this query for a single record that already has a policy? */
    val singleRecordWithPolicySet = recordId.isDefined && !opaPolicyIds.isEmpty
    val defaultPolicyIdOpt =
      if (!singleRecordWithPolicySet && config.hasPath("opa.recordPolicyId"))
        Some(config.getString("opa.recordPolicyId"))
      else None

    val allPolicyIds = defaultPolicyIdOpt match {
      case (Some(defaultPolicyId)) =>
        opaPolicyIds :+ defaultPolicyId
      case (None) => opaPolicyIds
    }

    super.queryRecord(
      jwt,
      operationType,
      allPolicyIds
    )

  }
}
