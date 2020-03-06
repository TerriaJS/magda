package au.csiro.data61.magda.registry

import akka.actor.Actor
import akka.actor.ActorLogging
import akka.actor.ActorSystem
import akka.actor.DeadLetter
import akka.actor.Props
import akka.event.Logging
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.HttpResponse
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives.complete
import akka.http.scaladsl.server.{
  MalformedQueryParamRejection,
  RejectionHandler
}
import akka.stream.ActorMaterializer
import au.csiro.data61.magda.AppConfig
import au.csiro.data61.magda.client.AuthApiClient
import scalikejdbc.GlobalSettings
import scalikejdbc.config.TypesafeConfig
import scalikejdbc.config.TypesafeConfigReader
import scalikejdbc.config.EnvPrefix
import scalikejdbc.config.DBs
import com.typesafe.config.Config
import scalikejdbc.LoggingSQLAndTimeSettings

import scala.concurrent.ExecutionContextExecutor

object RegistryApp extends App {

  implicit val config: Config = AppConfig.conf()
  implicit val system: ActorSystem = ActorSystem("registry-api", config)
  implicit val executor: ExecutionContextExecutor = system.dispatcher
  implicit val materializer: ActorMaterializer = ActorMaterializer()
  implicit def myRejectionHandler: RejectionHandler =
    RejectionHandler
      .newBuilder()
      .handle {
        case MalformedQueryParamRejection(parameterName, errorMsg, cause) =>
          complete(
            HttpResponse(
              StatusCodes.BadRequest,
              entity =
                s"The query parameter `$parameterName` was malformed. Details:\n$errorMsg \n$cause"
            )
          )
      }
      .result()

  class Listener extends Actor with ActorLogging {

    def receive: PartialFunction[Any, Unit] = {
      case d: DeadLetter => log.info(d.message.toString)
    }
  }

  val logger = Logging(system, getClass)

  logger.info("Starting MAGDA Registry")

  case class DBsWithEnvSpecificConfig(configToUse: Config)
      extends DBs
      with TypesafeConfigReader
      with TypesafeConfig
      with EnvPrefix {

    override val config: Config = configToUse
  }

  DBsWithEnvSpecificConfig(config).setupAll()

  val listener = system.actorOf(Props(classOf[Listener]))
  system.eventStream.subscribe(listener, classOf[DeadLetter])

  val role =
    if (config.hasPath("role") && config.getString("role") == "readonly")
      ReadOnly
    else Full

  val webHookActorOpt = if (role == Full) {
    val actor = system.actorOf(
      WebHookActor.props(config.getString("http.externalUrl.v0")),
      name = "WebHookActor"
    )
    actor ! WebHookActor.Process(ignoreWaitingForResponse = true)
    Some(actor)
  } else None

  val recordPersistence = new DefaultRecordPersistence(config)
  val eventPersistence = new DefaultEventPersistence(recordPersistence)

  val api = new Api(
    webHookActorOpt,
    new RegistryAuthApiClient(),
    config,
    system,
    executor,
    materializer
  )

  val interface = Option(System.getenv("npm_package_config_interface"))
    .orElse(Option(config.getString("http.interface")))
    .getOrElse("127.0.0.1")

  val port = Option(System.getenv("npm_package_config_port"))
    .map(_.toInt)
    .orElse(Option(config.getInt("http.port")))
    .getOrElse(6101)

  Http().bindAndHandle(api.routes, interface, port)
}
