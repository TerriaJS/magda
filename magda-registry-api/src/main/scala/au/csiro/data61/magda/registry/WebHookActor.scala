package au.csiro.data61.magda.registry

import java.time.OffsetDateTime
import java.util
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

import akka.actor.{
  Actor,
  ActorContext,
  ActorLogging,
  ActorRef,
  PoisonPill,
  Props,
  Scheduler,
  Terminated
}
import akka.stream.scaladsl.{Sink, Source, SourceQueueWithComplete}
import akka.stream.{ActorMaterializer, Attributes, OverflowStrategy}
import au.csiro.data61.magda.model.Registry._
import com.typesafe.config.Config
import scalikejdbc.DB

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import au.csiro.data61.magda.model.TenantId.AllTenantsId

object WebHookActor {
  case class Process(
      ignoreWaitingForResponse: Boolean = false,
      aspectIds: Option[List[String]] = None,
      webHookId: Option[String] = None
  )
  case class InvalidateWebHookCacheThenProcess(
      ignoreWaitingForResponse: Boolean = false,
      aspectIds: Option[List[String]] = None,
      webHookId: Option[String] = None
  )
  case class GetStatus(webHookId: String)
  case class UpdateHookStatus(
      webHookId: String,
      isRunning: Boolean,
      isProcessing: Boolean
  )
  case object InvalidateWebhookCache
  case object RetryInactiveHooks
  case class Status(isProcessing: Option[Boolean])

  val webHookActors = new ConcurrentHashMap[String, Option[ActorRef]]
  var webHooks = new ConcurrentHashMap[String, Option[WebHook]]

  /**
    * As there is no easy way to perform asynchronous FuncSpec tests,
    * this value and its related calls come to help.
    */
  val processCount: AtomicInteger = new AtomicInteger(0)

  def props(registryApiBaseUrl: String)(implicit config: Config): Props = {
    Props(
      AllWebHooksActor(
        registryApiBaseUrl,
        config.getLong("webhooks.retryInterval")
      )
    )
  }

  private def queryForAllWebHooks(): List[WebHook] = {
    DB readOnly { implicit session =>
      HookPersistence.getAll(session)
    }
  }

  private def createWebHookActor(
      context: ActorContext,
      registryApiBaseUrl: String,
      hook: WebHook,
      forceWakeUpInterval: Long
  )(implicit config: Config): ActorRef = {
    context.actorOf(
      Props(
        new SingleWebHookActor(
          hook.id.get,
          registryApiBaseUrl,
          forceWakeUpInterval
        )
      ),
      name = "WebHookActor-" + java.net.URLEncoder
        .encode(hook.id.get, "UTF-8") + "-" + java.util.UUID.randomUUID.toString
    )
  }

  private case class AllWebHooksActor(
      registryApiBaseUrl: String,
      webHooksRetryInterval: Long
  )(implicit val config: Config)
      extends Actor
      with ActorLogging {

    // The message processing in "receive" has blocking code. Use a dedicate dispatcher.
    // See https://doc.akka.io/docs/akka/2.5/dispatchers.html
    implicit val executionContext: ExecutionContext =
      context.system.dispatchers.lookup("webhooks.AllWebHooksActor-dispatcher")
    private implicit val scheduler: Scheduler = this.context.system.scheduler

    import akka.pattern.after
    private def retry[T](
        op: () => Future[T],
        delay: FiniteDuration,
        retries: Int,
        onRetry: (Int, Throwable) => Unit = (_, _) => {}
    ): Future[T] =
      Future { op() } flatMap (x => x) recoverWith {
        case e: Throwable if retries > 0 =>
          after(delay, scheduler)({
            onRetry(retries - 1, e)
            retry(op, delay, retries - 1, onRetry)
          })
      }

    private def getRegisteredWebHooksF: Future[List[WebHook]] = {
      retry(
        () =>
          Future {
            log.debug("    queryForAllWebHooks()")
            queryForAllWebHooks()
          },
        30 seconds,
        10,
        (retryCount, e) =>
          log.error(
            e,
            "Failed to get webhooks, {} retries left until I crash",
            retryCount
          )
      ).recover {
        case e: Throwable =>
          log.error(e, "Failed to get webhooks for processing")
          // This is a massive deal. Let it crash and let kubernetes deal with it.
          System.exit(1)
          throw e
      }
    }

    private def updateWebHooksCacheF(
        webHooks: List[WebHook]
    ): Future[String] = {
      log.debug(s"    setupF() started with webHooks size of ${webHooks.size}.")
      // Create a child actor for each WebHook that doesn't already have one.
      val currentHooks: Set[String] =
        webHooks.filter(_.active).filter(_.enabled).map(_.id.get).toSet

      // Shut down actors for WebHooks that no longer exist.
      val exitingKeys: util.Enumeration[String] = webHookActors.keys()
      while (exitingKeys.hasMoreElements) {
        val k = exitingKeys.nextElement()
        if (!currentHooks.contains(k)) {
          val theActor = webHookActors.get(k).get
          // When theActor is terminated, its parent (WebHookActor) will receive Terminated message.
          context.watch(theActor)
          log.debug(
            s"*** WebHookActor will terminate actor ${theActor.hashCode()}."
          )
          theActor ! PoisonPill
          webHookActors.remove(k)
          WebHookActor.webHooks.remove(k)
        }
      }

      // Create actors (therefore web hook processors) for new WebHooks if they are active and enabled.
      webHooks
        .filter(_.active)
        .filter(_.enabled)
        .foreach(hook => {
          log.debug(s"    handle hook ${hook.id}")
          val id = hook.id.get
          webHookActors.getOrDefault(id, None) match {
            case None =>
              log.info("    Creating new web hook actor for {}.", id)
              val actorRef =
                WebHookActor.createWebHookActor(
                  context,
                  registryApiBaseUrl,
                  hook,
                  webHooksRetryInterval
                )

              webHookActors.put(id, Some(actorRef))
              WebHookActor.webHooks.put(
                id,
                Some(
                  hook.copy(isRunning = Some(true), isProcessing = Some(false))
                )
              )
            case _ =>
          }
        })

      log.debug("    webHooks filtering done.")
      Future.successful("ok")
    }

    private def setupF(): Future[String] = {
      for {
        hooks <- getRegisteredWebHooksF
        result <- updateWebHooksCacheF(hooks)
      } yield {
        log.debug(s"    setupF() ended with $result.")
        result
      }
    }

    // Set the initial delay to a large value so that it
    // will not interfere with scala test on message of RetryInactiveHooks.
    scheduler.schedule(
      5000 milliseconds,
      webHooksRetryInterval milliseconds,
      self,
      RetryInactiveHooks
    )

    def getStatus(webHookId: String): WebHookActor.Status = {
      webHooks.getOrDefault(webHookId, None) match {
        case None => WebHookActor.Status(None)
        case Some(hook: WebHook) =>
          Status(hook.isProcessing)
      }
    }

    private def sendProcessToAllActors(
        ignoreWaitingForResponse: Boolean,
        aspectIds: Option[List[String]]
    ): Unit = {
      val actors: util.Set[util.Map.Entry[String, Option[ActorRef]]] =
        webHookActors.entrySet()
      val iterator: util.Iterator[util.Map.Entry[String, Option[ActorRef]]] =
        actors.iterator()
      while (iterator.hasNext) {
        val entry: util.Map.Entry[String, Option[ActorRef]] = iterator.next()
        val actorRef = entry.getValue.get
        log.debug(
          s"    Received Process; Send aspectIds $aspectIds to actor ${actorRef.hashCode()}"
        )
        actorRef ! Process(ignoreWaitingForResponse, aspectIds)
      }
    }

    private def sendProcess(
        ignoreWaitingForResponse: Boolean = false,
        aspectIds: Option[List[String]] = None,
        webHookId: Option[String] = None
    ): Unit = {
      webHookId match {
        case Some(id) =>
          val actorRef = webHookActors.getOrDefault(id, None)
          if (actorRef.isDefined) {
            log.debug(
              s"    Send $aspectIds to actor ${actorRef.get.hashCode()}"
            )
            actorRef.get ! Process(ignoreWaitingForResponse, aspectIds)
          } else {
            log.warning(s"    Web hook actor of $id not found.")
            throw new RuntimeException(s"Web hook actor of $id not found.")
          }
        case None =>
          sendProcessToAllActors(ignoreWaitingForResponse, aspectIds)
      }
    }

    def receive: PartialFunction[Any, Unit] = {
      case RetryInactiveHooks =>
        log.debug(s"Received RetryInactiveHooks")
        Future {
          retryAllInactiveHooks(webHooksRetryInterval)
        }
      case InvalidateWebhookCache =>
        log.debug("Received InvalidateWebhookCache")
        setupF()
      case Process(ignoreWaitingForResponse, aspectIds, webHookId) =>
        log.debug(
          s"Received Process, $ignoreWaitingForResponse, $aspectIds, $webHookId"
        )
        Future {
          sendProcess(ignoreWaitingForResponse, aspectIds, webHookId)
        }
      case InvalidateWebHookCacheThenProcess(
          ignoreWaitingForResponse,
          aspectIds,
          webHookId
          ) =>
        log.debug(
          s"Received InvalidateWebHookCacheThenProcess, $ignoreWaitingForResponse, $aspectIds, $webHookId"
        )
        setupF().map(
          _ => sendProcess(ignoreWaitingForResponse, aspectIds, webHookId)
        )
      case UpdateHookStatus(webHookId, isRunning, isProcessing) =>
        log.debug(
          s"Received UpdateHookStatus, $webHookId, $isRunning, $isProcessing"
        )
        webHooks.get(webHookId) match {
          case Some(hook: WebHook) =>
            webHooks.put(
              webHookId,
              Some(
                hook.copy(
                  isRunning = Some(isRunning),
                  isProcessing = Some(isProcessing)
                )
              )
            )
          case _ => Nil
        }
      case GetStatus(webHookId) =>
        val status = getStatus(webHookId)
        if (status.isProcessing.nonEmpty && status.isProcessing.get)
          log.debug(s"Received GetStatus $status for $webHookId")

        sender() ! getStatus(webHookId)
      case Terminated(a) ⇒
        log.debug(s"*** Actor ${a.hashCode()} has been terminated.")
    }

    private def retryAllInactiveHooks(retryInterval: Long): Unit = {

      log.info("Start to retry all inactive webhooks...")

      val hooks = DB readOnly { implicit session =>
        HookPersistence.getAll(session).filter(_.enabled)
      }

      val hookIds = hooks
        .map { hook =>
          if (!hook.active) {
            hook.copy(
              isProcessing = Some(false),
              isRunning = Some(false)
            )
          } else {
            val status = getStatus(hook.id.get)
            hook.copy(
              isRunning = Some(status.isProcessing.nonEmpty),
              isProcessing = Some(status.isProcessing.getOrElse(false))
            )
          }
        }
        .filter { hook =>
          if (hook.active && hook.isRunning.get) {
            false
          } else {
            if (hook.lastRetryTime.isEmpty) true
            else {
              val expectedDiff = Math.pow(2, hook.retryCount) * retryInterval / 1000
              val isOutOfBackoffTimeWin = OffsetDateTime.now
                .minusSeconds(expectedDiff.toLong)
                .isAfter(hook.lastRetryTime.get)
              if (!isOutOfBackoffTimeWin) {
                log.info(
                  s"Skip retry ${hook.id} as it is still in backoff time window. Last retry time: ${hook.lastRetryTime.get}.."
                )
              }
              isOutOfBackoffTimeWin
            }
          }
        }
        .flatMap(_.id.toList)

      if (hookIds.nonEmpty) {
        log.info(
          s"Invalidate Webhook Cache for retry $hookIds inactive hooks..."
        )

        DB localTx { implicit session =>
          hookIds.foreach(hookId => {
            HookPersistence.retry(session, hookId)
            log.info(s"   Added new hook $hookId to DB.")
          })
        }

        for {
          result <- setupF()
        } yield {
          if (result != "ok")
            throw new RuntimeException("Failed in setupF()")
          else {
            log.debug(s"    Cache webHookActors size: ${webHookActors.size()}")
            val actors: util.Set[util.Map.Entry[String, Option[ActorRef]]] =
              webHookActors.entrySet()
            val iterator
                : util.Iterator[util.Map.Entry[String, Option[ActorRef]]] =
              actors.iterator()
            while (iterator.hasNext) {
              val entry: util.Map.Entry[String, Option[ActorRef]] =
                iterator.next()
              entry.getValue.get ! Process(ignoreWaitingForResponse = true)
            }
            log.info("Completed retry all inactive webhooks.")
          }
        }

      } else {
        log.info(
          "Completed retry all inactive webhooks: No inactive webhook need to be restarted..."
        )
      }
    }
  }

  /**
    * An instance of this class provides subscription service to its subscriber via web hook processor.
    * See [[au.csiro.data61.magda.registry.WebHookProcessor]].
    * In multi-tenant mode, it will send events belonging to all tenants to the subscriber.
    * The subscriber is therefore considered tenant independent. That is, the subscriber
    * will process events for all tenants.
    *
    * In the future, it may provide event service to tenant specific subscriber.
    *
    * @param id
    * @param registryApiBaseUrl
    * @param forceWakeUpInterval
    * @param config
    */
  private class SingleWebHookActor(
      val id: String,
      val registryApiBaseUrl: String,
      forceWakeUpInterval: Long
  )(implicit val config: Config)
      extends Actor
      with ActorLogging {
    val recordPersistence = new DefaultRecordPersistence(config)
    val eventPersistence = new DefaultEventPersistence(recordPersistence)
    case object WakeUp
    import context.dispatcher
    private val SOURCE_QUEUE_BUFFER_SIZE =
      config.getInt("webhooks.SingleWebHookActorSourceQueueSize")
    private val processor = new WebHookProcessor(
      context.system,
      registryApiBaseUrl,
      recordPersistence,
      context.dispatcher
    )
    implicit val materializer: ActorMaterializer = ActorMaterializer()
    private var isProcessing: Boolean = false
    private var currentQueueLength = 0

    def getWebhook: WebHook =
      DB readOnly { implicit session =>
        HookPersistence.getById(session, id) match {
          case None =>
            throw new RuntimeException(s"No WebHook with ID $id was found.")
          case Some(webHook) => webHook
        }
      }

    def notifyHookStatus(): Unit = {
      val currentlyIsProcessing = currentQueueLength != 0
      if (isProcessing != currentlyIsProcessing) {
        isProcessing = currentlyIsProcessing
        context.parent ! UpdateHookStatus(
          id,
          isRunning = true,
          isProcessing = isProcessing
        )
      }
    }

    private val indexQueue: SourceQueueWithComplete[Boolean] =
      Source
        .queue[Boolean](SOURCE_QUEUE_BUFFER_SIZE, OverflowStrategy.backpressure)
        .map { x =>
          currentQueueLength += 1
          notifyHookStatus()
          x
        }
        .delay(
          config.getInt("webhooks.actorTickRate") milliseconds,
          OverflowStrategy.backpressure
        )
        .withAttributes(Attributes.inputBuffer(1, 1)) // Make sure we only execute once per webhookActorTickRate to prevent sending an individual post for every event.
        .mapAsync(1) { ignoreWaitingForResponse =>
          try {
            val webHook = getWebhook

            if (!ignoreWaitingForResponse && webHook.isWaitingForResponse
                  .getOrElse(false)) {
              log.info(
                "Skipping WebHook {} as it's marked as waiting for response",
                webHook.id
              )
              Future.successful(false)
            } else {
              val eventPage = DB readOnly { implicit session =>
                eventPersistence.getEvents(
                  session,
                  webHook.lastEvent,
                  None,
                  Some(config.getInt("webhooks.eventPageSize")),
                  None,
                  None,
                  (webHook.config.aspects ++ webHook.config.optionalAspects).flatten.toSet,
                  webHook.eventTypes,
                  AllTenantsId
                )
              }

              val previousLastEvent = webHook.lastEvent
              val lastEvent = eventPage.events.lastOption.flatMap(_.id)

              if (lastEvent.isEmpty) {
                log.info(
                  "WebHook {}: Up to date at event {}",
                  this.id,
                  previousLastEvent
                )
                Future.successful(false)
              } else {
                log.info(
                  "WebHook {} Processing {}-{}: STARTING",
                  this.id,
                  previousLastEvent,
                  lastEvent
                )

                processor
                  .sendSomeNotificationsForOneWebHook(
                    webHook,
                    eventPage
                  )
                  .map {
                    case WebHookProcessor.Deferred =>
                      // response deferred
                      log.info(
                        "WebHook {} Processing {}-{}: DEFERRED BY RECEIVER",
                        this.id,
                        previousLastEvent,
                        lastEvent
                      )
                    case WebHookProcessor.NotDeferred =>
                      // POST succeeded, is there more to do?
                      log.info(
                        "WebHook {} Processing {}-{}: DELIVERED",
                        this.id,
                        previousLastEvent,
                        lastEvent
                      )

                      if (previousLastEvent != lastEvent) {
                        self ! Process()
                      }
                    case WebHookProcessor.HttpError(status) =>
                      // encountered an error while communicating with the hook recipient - deactivate the hook until its manually fixed
                      log.info(
                        "WebHook {} Processing {}-{}: HTTP FAILURE {}, DEACTIVATING",
                        this.id,
                        previousLastEvent,
                        lastEvent,
                        status.reason()
                      )
                      context.parent ! InvalidateWebhookCache
                  }
                  .recover {
                    case e =>
                      // Error communicating with the hook recipient - log the failure and wait until the next Process() call to resume.
                      log.error(
                        e,
                        "WebHook {} Processing {}-{}: FAILED",
                        this.id,
                        previousLastEvent,
                        lastEvent
                      )
                  }
              }
            }
          } catch {
            // --- make only capture nonFatal error
            // --- So that fatal error can still terminate JVM
            case NonFatal(e) =>
              log.error(e, "Encountered non-fatal error")
              Future.successful(false)
          }
        }
        .map { x =>
          currentQueueLength -= 1
          log.debug(
            s"*** ${self.hashCode()} DONE. ${processCount.decrementAndGet()}"
          )
          notifyHookStatus()
          x
        }
        .to(Sink.ignore)
        .run()

    context.system.scheduler.schedule(
      forceWakeUpInterval milliseconds,
      forceWakeUpInterval milliseconds,
      self,
      WakeUp
    )

    def receive: PartialFunction[Any, Unit] = {
      case Process(ignoreWaitingForResponse, _, _) =>
        log.debug(
          s"SingleWebHookActor received Process, queueing $ignoreWaitingForResponse"
        )
        log.debug(
          s"*** ${self.hashCode()} Will process ${processCount.incrementAndGet()}"
        )
        indexQueue.offer(ignoreWaitingForResponse)
      case WakeUp =>
        log.debug(s"SingleWebHookActor received $WakeUp")
        if (currentQueueLength == 0) {
          log.info("Force to wake up idle WebHook {}...", this.id)
          indexQueue.offer(true)
        }
      case GetStatus =>
        log.debug("SingleWebHookActor received GetStatus")
        sender() ! Status(Some(currentQueueLength != 0))
    }
  }
}
