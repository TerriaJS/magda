package au.csiro.data61.magda.registry

import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.TenantId._
import akka.stream.scaladsl.Source
import spray.json._
import gnieh.diffson.sprayJson._
import scalikejdbc._
import akka.NotUsed

trait EventPersistence {

  def streamEventsSince(
      sinceEventId: Long,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      tenantId: TenantId
  ): Source[RegistryEvent, NotUsed]

  def streamEventsUpTo(
      lastEventId: Long,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      tenantId: TenantId
  ): Source[RegistryEvent, NotUsed]

  def getLatestEventId(implicit session: DBSession): Option[Long]

  def getEvents(
      implicit session: DBSession,
      pageToken: Option[Long] = None,
      start: Option[Int] = None,
      limit: Option[Int] = None,
      lastEventId: Option[Long] = None,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      eventTypes: Set[EventType] = Set(),
      tenantId: TenantId
  ): EventsPage
}

class DefaultEventPersistence(recordPersistence: RecordPersistence)
    extends Protocols
    with DiffsonProtocol
    with EventPersistence {
  val eventStreamPageSize = 1000

  def streamEventsSince(
      sinceEventId: Long,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      tenantId: TenantId
  ): Source[RegistryEvent, NotUsed] = {
    Source
      .unfold(sinceEventId)(offset => {
        val events = DB readOnly { implicit session =>
          getEvents(
            session = session,
            pageToken = Some(offset),
            start = None,
            limit = Some(eventStreamPageSize),
            recordId = recordId,
            aspectIds = aspectIds,
            tenantId = tenantId
          )
        }
        events.events.lastOption.map(last => (last.id.get, events))
      })
      .mapConcat(page => page.events)

  }

  def streamEventsUpTo(
      lastEventId: Long,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      tenantId: TenantId
  ) = {
    Source
      .unfold(0L)(offset => {
        val events = DB readOnly { implicit session =>
          getEvents(
            session = session,
            pageToken = Some(offset),
            start = None,
            limit = Some(eventStreamPageSize),
            lastEventId = Some(lastEventId),
            recordId = recordId,
            aspectIds = aspectIds,
            tenantId = tenantId
          )
        }
        events.events.lastOption.map(last => (last.id.get, events))
      })
      .mapConcat(page => page.events)
  }

  def getLatestEventId(implicit session: DBSession): Option[Long] = {
    sql"""select
          eventId,
          from Events
          order by eventId desc
          limit 1""".map(rs => rs.long("eventId")).headOption().apply()
  }

  /**
    * Find events that meet the given criteria. This is a fundamental api mainly used by the registry to find
    * and send events to their subscribers, such as an indexer.
    *
    * See [[au.csiro.data61.magda.registry.WebHookActor.SingleWebHookActor]] for the implementation that provides
    * event service for all web hooks, such as indexer and minions.
    *
    * @param session an implicit DB session
    * @param pageToken The ID of event must be greater than the specified value. Optional and default to None.
    * @param start Specify the number of initial events to be dropped. Optional and default to None.
    * @param limit Specify the max number of events to be returned. Optional and default to None.
    * @param lastEventId The ID of event must NOT be greater than the specified value. Optional and default to None.
    * @param recordId The data recordId field of event must equal to this value. Optional and default to None.
    * @param aspectIds The data aspectId field of event must equal to one of the specified values. Optional and default to empty Set.
    * @param eventTypes The type of event must equal to one of the specified values. Optional and default to empty Set.
    * @param tenantId The returned events will be filtered by this tenant ID.
    *                 If it is a system ID, events belonging to all tenants are included (no tenant filtering).
    * @return EventsPage containing events that meet the specified requirements
    */
  def getEvents(
      implicit session: DBSession,
      pageToken: Option[Long] = None,
      start: Option[Int] = None,
      limit: Option[Int] = None,
      lastEventId: Option[Long] = None,
      recordId: Option[String] = None,
      aspectIds: Set[String] = Set(),
      eventTypes: Set[EventType] = Set(),
      tenantId: TenantId
  ): EventsPage = {
    val filters: Seq[Option[SQLSyntax]] = Seq(
      pageToken.map(v => sqls"eventId > $v"),
      lastEventId.map(v => sqls"eventId <= $v"),
      recordId.map(v => sqls"data->>'recordId' = $v")
    )

    val tenantFilter = Some(SQLUtil.tenantIdToWhereClause(tenantId))
    val theFilters = (filters ++ List(tenantFilter)).filter(_.isDefined)

    val eventTypesFilter =
      if (eventTypes.isEmpty) sqls"1=1"
      else
        SQLSyntax.joinWithOr(
          eventTypes
            .map(v => v.value)
            .map(v => sqls"eventtypeid = $v")
            .toArray: _*
        )

    val linkAspects = recordPersistence.buildReferenceMap(session, aspectIds)
    val dereferenceSelectors: Set[SQLSyntax] =
      linkAspects.toSet[(String, PropertyWithLink)].map {
        case (aspectId, propertyWithLink) =>
          if (propertyWithLink.isArray) {
            sqls"""$aspectId IN (select aspectId
                         from RecordAspects
                         where RecordAspects.data->${propertyWithLink.propertyName} @> (Events.data->'recordId')::jsonb)"""
          } else {
            sqls"""$aspectId IN (select aspectId
                         from RecordAspects
                         where RecordAspects.data->>${propertyWithLink.propertyName} = Events.data->>'recordId')"""
          }
      }

    val aspectsSql =
      if (aspectIds.isEmpty) None
      else
        Some(
          SQLSyntax.joinWithOr(
            (aspectIds
              .map(v => sqls"data->>'aspectId' = $v") + sqls"data->>'aspectId' IS NULL").toArray: _*
          )
        )
    val dereferenceSelectorsSql =
      if (dereferenceSelectors.isEmpty) None
      else Some(SQLSyntax.joinWithOr(dereferenceSelectors.toArray: _*))

    val whereClause = SQLSyntax.where(
      SQLSyntax
        .joinWithAnd(theFilters.map(_.get): _*)
        .and((aspectsSql, dereferenceSelectorsSql) match {
          case (Some(aspectSql), Some(dereferenceSql)) =>
            aspectSql.or(dereferenceSql)
          case (Some(aspectSql), None)      => aspectSql
          case (None, Some(dereferenceSql)) => dereferenceSql
          case (None, None)                 => sqls"1=1"
        })
        .and(eventTypesFilter)
    )

    var lastEventIdInPage: Option[Long] = None
    val events =
      sql"""select
            eventId,
            eventTime,
            eventTypeId,
            userId,
            data,
            tenantId
          from Events
          $whereClause
          order by eventTime asc
          offset ${start.getOrElse(0)}
          limit ${limit.getOrElse(1000)}"""
        .map(rs => {
          // Side-effectily track the sequence number of the very last result.
          lastEventIdInPage = Some(rs.long("eventId"))
          rowToEvent(rs)
        })
        .list
        .apply()

    EventsPage(
      lastEventIdInPage.isDefined,
      lastEventIdInPage.map(_.toString),
      events
    )
  }

  private def rowToEvent(rs: WrappedResultSet): RegistryEvent = {
    RegistryEvent(
      id = rs.longOpt("eventId"),
      eventTime = rs.offsetDateTimeOpt("eventTime"),
      eventType = EventType.withValue(rs.int("eventTypeId")),
      userId = rs.int("userId"),
      data = JsonParser(rs.string("data")).asJsObject,
      tenantId = rs
        .bigIntOpt("tenantid")
        .map(BigInt.apply)
        .getOrElse(MAGDA_ADMIN_PORTAL_ID)
    )
  }
}
