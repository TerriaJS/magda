package au.csiro.data61.magda.indexer.external.registry

import scala.concurrent.Future
import akka.actor.ActorSystem
import akka.stream.Materializer
import com.typesafe.config.Config
import scala.concurrent.ExecutionContext
import au.csiro.data61.magda.model.Registry.{WebHook, EventType, WebHookConfig}
import au.csiro.data61.magda.model.Registry.RegistryConstants
import akka.event.LoggingAdapter
import akka.event.Logging
import au.csiro.data61.magda.client.RegistryExternalInterface

object RegisterWebhook {
  sealed trait InitResult
  case object ShouldCrawl extends InitResult
  case object ShouldNotCrawl extends InitResult

  def initWebhook(interface: RegistryExternalInterface)(
      implicit config: Config,
      system: ActorSystem,
      executor: ExecutionContext,
      materializer: Materializer
  ): Future[InitResult] = {

    val logger = Logging(system, getClass)

    logger.info(
      "Looking up existing webhook with id {}",
      config.getString("registry.webhookId")
    )
    interface.getWebhook(config.getString("registry.webhookId")).flatMap {
      case Some(existingHook) =>
        logger.info("Hook already exists, updating...")
        registerIndexerWebhook(
          interface,
          RegistryConstants.aspects,
          RegistryConstants.optionalAspects,
          true
        ).map { _ =>
          logger.info("Updated, attempting to resume...")
          interface.resumeWebhook(config.getString("registry.webhookId"))
        } map { _ =>
          logger.info("Successfully resumed webhook")

          ShouldNotCrawl
        }
      case None =>
        logger.info("No hook exists, registering a new one")
        registerIndexerWebhook(
          interface,
          RegistryConstants.aspects,
          RegistryConstants.optionalAspects
        ).map { _ =>
          logger.info("Successfully registered new webhook")

          ShouldCrawl
        }
    }
  }

  private def registerIndexerWebhook(
      interface: RegistryExternalInterface,
      aspects: List[String],
      optionalAspects: List[String],
      isUpdate: Boolean = false
  )(
      implicit config: Config,
      system: ActorSystem,
      executor: ExecutionContext,
      materializer: Materializer
  ): Future[Unit] = {
    val webhook = WebHook(
      id = Some(config.getString("registry.webhookId")),
      name = "Indexer",
      eventTypes = Set(
        EventType.CreateRecord,
        EventType.PatchRecordAspect,
        EventType.DeleteRecord,
        EventType.CreateRecordAspect,
        EventType.PatchRecord,
        EventType.DeleteRecordAspect
      ),
      url = config.getString("registry.webhookUrl"),
      config = WebHookConfig(
        aspects = Some(aspects),
        optionalAspects = Some(optionalAspects),
        includeEvents = Some(true),
        includeRecords = Some(true),
        dereference = Some(true)
      ),
      userId = Some(0), // TODO: Will have to change this when it becomes important
      isWaitingForResponse = None,
      active = true
    )

    val doRegister = if (isUpdate) {
      interface.putWebhook(webhook)
    } else {
      interface.createWebhook(webhook)
    }

    doRegister
      .map { _ =>
        system.log.info("Successfully added webhook")

        Unit
      }
      .recover {
        case e: Throwable =>
          system.log.error(e, "Failed to add webhook")
          throw e
      }
      .map(_ => Unit)
  }
}
