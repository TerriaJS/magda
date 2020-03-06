package au.csiro.data61.magda.registry

import java.util.UUID

import spray.json._
import gnieh.diffson.sprayJson._
import scalikejdbc._
import au.csiro.data61.magda.model.Registry._

import scala.util.{Failure, Success, Try}

object HookPersistence extends Protocols with DiffsonProtocol {

  def getAll(implicit session: DBSession): List[WebHook] = {
    sql"""select
            webhookId,
            userId,
            name,
            active,
            lastEvent,
            url,
            isWaitingForResponse,
            (
              select array_agg(eventTypeId)
              from WebHookEvents
              where WebHookEvents.webHookId=WebHooks.webHookId
            ) as eventTypes,
            config,
            enabled,
            lastRetryTime,
            retryCount
          from WebHooks"""
      .map(rowToHook)
      .list
      .apply()
  }

  def getById(implicit session: DBSession, id: String): Option[WebHook] = {
    sql"""select
            webhookId,
            userId,
            name,
            active,
            lastEvent,
            url,
            isWaitingForResponse,
            (
              select array_agg(eventTypeId)
              from WebHookEvents
              where WebHookEvents.webHookId=WebHooks.webHookId
            ) as eventTypes,
            config,
            enabled,
            lastRetryTime,
            retryCount
          from WebHooks
          where webHookId=$id"""
      .map(rowToHook)
      .single
      .apply()
  }

  /**
    * Register a new web hook. The new hook subscribes to receive new events that occur after the registration
    * and meet the criteria specified by the hook:
    *
    *   1. the event types (specified in hook.eventTypes).
    *   2. the aspect IDs (specified in hook.config, both compulsory and optional aspect IDs.
    *       See [[au.csiro.data61.magda.model.Registry.WebHookConfig]] for other config parameters.).
    *
    * The registry will use the above criteria to find events from events table then send them to the hook.
    * In the current implementation, all web hooks are tenant independent. That is, in multi-tenant mode, a web
    * hook will receive events belonging to all tenants.
    *
    * See [[au.csiro.data61.magda.registry.WebHookActor.SingleWebHookActor]] for the implementation that provides
    * event service for all web hooks, such as indexer and minions.
    *
    * @param session
    * @param hook
    * @return
    */
  def create(implicit session: DBSession, hook: WebHook): Try[WebHook] = {
    val theHookId = hook.id match {
      case None     => UUID.randomUUID().toString()
      case Some(id) => id
    }

    sql"""insert into WebHooks (webHookId, userId, name, active, lastEvent, url, config, enabled)
          values ($theHookId, 0, ${hook.name}, ${hook.active}, (select eventId from Events order by eventId desc limit 1), ${hook.url}, ${hook.config.toJson.compactPrint}::jsonb, ${hook.enabled})""".update
      .apply()

    val batchParameters = hook.eventTypes
      .map(
        eventType =>
          Seq('webhookId -> theHookId, 'eventTypeId -> eventType.value)
      )
      .toSeq
    sql"""insert into WebHookEvents (webhookId, eventTypeId) values ({webhookId}, {eventTypeId})"""
      .batchByName(batchParameters: _*)
      .apply()

    Success(
      WebHook(
        id = Some(theHookId),
        userId = Some(0),
        name = hook.name,
        active = hook.active,
        lastEvent = None, // TODO: include real lastEvent
        url = hook.url,
        eventTypes = hook.eventTypes,
        isWaitingForResponse = None,
        config = hook.config,
        enabled = hook.enabled
      )
    )
  }

  def delete(implicit session: DBSession, hookId: String): Try[Boolean] = {
    Try {
      sql"delete from WebHookEvents where webHookId=$hookId".update.apply()
      sql"delete from WebHooks where webHookId=$hookId".update.apply() > 0
    }
  }

  def setLastEvent(
      implicit session: DBSession,
      id: String,
      lastEventId: Long
  ) = {
    sql"update WebHooks set lastEvent=$lastEventId where webHookId=$id".update
      .apply()
  }

  def setIsWaitingForResponse(
      implicit session: DBSession,
      id: String,
      isWaitingForResponse: Boolean
  ) = {
    sql"update WebHooks set isWaitingForResponse=$isWaitingForResponse where webHookId=$id".update
      .apply()
  }

  def setActive(implicit session: DBSession, id: String, active: Boolean) = {
    sql"update WebHooks set active=$active where webHookId=$id".update.apply()
  }

  def retry(implicit session: DBSession, id: String) = {
    sql"update WebHooks set active=${true}, lastretrytime=NOW(), retrycount=retrycount+1 where webHookId=$id".update
      .apply()
  }

  def resetRetryCount(implicit session: DBSession, id: String) = {
    sql"update WebHooks set lastretrytime=NULL, retrycount=0 where webHookId=$id".update
      .apply()
  }

  def putById(
      implicit session: DBSession,
      id: String,
      hook: WebHook
  ): Try[WebHook] = {
    if (id != hook.id.getOrElse("")) {
      Failure(
        new RuntimeException(
          "The provided ID does not match the web hook's ID."
        )
      )
    } else {
      sql"""insert into WebHooks (webHookId, userId, name, active, lastevent, url, config, enabled)
          values (${hook.id.get}, 0, ${hook.name}, ${hook.active}, (select eventId from Events order by eventId desc limit 1), ${hook.url}, ${hook.config.toJson.compactPrint}::jsonb, ${hook.enabled})
          on conflict (webHookId) do update
          set name = ${hook.name}, active = ${hook.active}, url = ${hook.url}, config = ${hook.config.toJson.compactPrint}::jsonb""".update
        .apply()
      Success(hook)
    }
  }

  def acknowledgeRaisedHook(
      implicit session: DBSession,
      id: String,
      acknowledgement: WebHookAcknowledgement
  ): Try[WebHookAcknowledgementResponse] = {
    Try {
      val setActive = acknowledgement.active match {
        case Some(active) => sqls", active=${active}"
        case None         => sqls""
      }

      if (acknowledgement.succeeded) {
        acknowledgement.lastEventIdReceived match {
          case Some(eventId) =>
            sql"update WebHooks set isWaitingForResponse=false, lastEvent=${acknowledgement.lastEventIdReceived} ${setActive} where webHookId=$id".update
              .apply()
            WebHookAcknowledgementResponse(eventId)
          case None =>
            throw new Exception(
              "If acknowledgement succeeded is true, lastEventIdReceived must be provided"
            )
        }
      } else {
        sql"update WebHooks set isWaitingForResponse=false ${setActive} where webHookId=$id".update
          .apply()
        WebHookAcknowledgementResponse(
          sql"select lastEvent from WebHooks where webHookId=$id"
            .map(rs => rs.long("lastEvent"))
            .single
            .apply()
            .get
        )
      }
    }
  }

  private def rowToHook(rs: WrappedResultSet): WebHook = WebHook(
    id = Some(rs.string("webhookId")),
    userId = Some(rs.int("userId")),
    name = rs.string("name"),
    active = rs.boolean("active"),
    lastEvent = rs.longOpt("lastEvent"),
    url = rs.string("url"),
    eventTypes = rs
      .arrayOpt("eventTypes")
      .map(
        a =>
          a.getArray()
            .asInstanceOf[Array[Integer]]
            .map(EventType.withValue(_))
            .toSet
      )
      .getOrElse(Set()),
    isWaitingForResponse = rs.booleanOpt("isWaitingForResponse"),
    config = JsonParser(rs.string("config")).convertTo[WebHookConfig],
    enabled = rs.boolean("enabled"),
    lastRetryTime = rs.offsetDateTimeOpt("lastRetryTime"),
    retryCount = rs.int("retryCount")
  )
}
