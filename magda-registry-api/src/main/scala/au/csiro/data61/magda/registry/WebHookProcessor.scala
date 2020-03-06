package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.marshalling.Marshal
import akka.http.scaladsl.model._
import akka.http.scaladsl.unmarshalling.Unmarshal
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.{Sink, Source}
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.TenantId.{SpecifiedTenantId}
import au.csiro.data61.magda.opa.OpaTypes.OpaQuerySkipAccessControl
import scalikejdbc._
import spray.json.JsString

import scala.collection.mutable
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import au.csiro.data61.magda.model.TenantId.AllTenantsId

/**
  * The processor sends notifications to a subscriber via web hook.
  */
class WebHookProcessor(
    actorSystem: ActorSystem,
    val publicUrl: Uri,
    recordPersistence: RecordPersistence,
    implicit val executionContext: ExecutionContext
) extends Protocols {
  private val http = Http(actorSystem)
  private implicit val materializer: ActorMaterializer =
    ActorMaterializer()(actorSystem)

  private def getTenantRecordIdsMap(
      events: List[RegistryEvent]
  ): mutable.HashMap[BigInt, Set[String]] = {
    val tenantRecordIdsMap = new mutable.HashMap[BigInt, Set[String]]
    events.foreach(event => {
      val recordId = event.data.fields("recordId").asInstanceOf[JsString].value
      val tenantId = event.tenantId
      val recordIds = tenantRecordIdsMap.getOrElse(tenantId, Set())
      tenantRecordIdsMap.put(tenantId, recordIds + recordId)
    })

    tenantRecordIdsMap
  }

  /**
    * For each event in @param eventPage, depending on the web hook configuration requirements, the following
    * information may be sent:
    *   1. the event itself.
    *   2. the record (including its aspects) directly referenced in the event.
    *   3. the records that are linked to the above direct record.
    *
    * @param webHook the web hook the notifications will be sent to
    * @param eventPage the events containing info that the web hook is interested in.
    * @return
    */
  def sendSomeNotificationsForOneWebHook(
      webHook: WebHook,
      eventPage: EventsPage
  ): Future[WebHookProcessor.SendResult] = {
    val events = eventPage.events
    val relevantEventTypes = webHook.eventTypes

    // This looks redundant, as changeEvents will always be the same as events.
    val changeEvents =
      events.filter(event => relevantEventTypes.contains(event.eventType))
    val recordChangeEvents = events.filter(
      event =>
        event.eventType.isRecordEvent || event.eventType.isRecordAspectEvent
    )
    val aspectDefinitionChangeEvents =
      events.filter(event => event.eventType.isAspectDefinitionEvent)

    val aspectDefinitionIds = aspectDefinitionChangeEvents.map(
      _.data.fields("aspectId").asInstanceOf[JsString].value
    )

    // If we're including records, get a complete record with aspects for each record ID
    val records = webHook.config.includeRecords match {
      case Some(false) | None => None
      case Some(true) =>
        DB readOnly { implicit session =>
          def getTenantDirectRecordPages(
              tenantRecordIdsMap: mutable.HashMap[BigInt, Set[String]]
          ) = {
            val tenantIds = tenantRecordIdsMap.keySet
            val recordPages = tenantIds
              .foldLeft[List[RecordsPage[Record]]](Nil)((pages, tenantId) => {
                val recordIds = tenantRecordIdsMap(tenantId)
                pages :+ recordPersistence.getByIdsWithAspects(
                  session,
                  SpecifiedTenantId(tenantId),
                  recordIds,
                  List(),
                  webHook.config.aspects.getOrElse(Nil),
                  webHook.config.optionalAspects.getOrElse(Nil),
                  webHook.config.dereference
                )
              })

            recordPages.foldLeft[List[Record]](Nil)((records, recordPage) => {
              records ++ recordPage.records
            })
          }

          def getTenantLinkingRecordPages(
              tenantRecordIdsMap: mutable.HashMap[BigInt, Set[String]],
              tenantRecordIdsExcludedMap: mutable.HashMap[BigInt, Set[String]]
          ) = {
            val tenantIds = tenantRecordIdsMap.keySet
            val recordPages = tenantIds
              .foldLeft[List[RecordsPage[Record]]](Nil)((pages, tenantId) => {
                val recordIdsExcluded =
                  tenantRecordIdsExcludedMap.getOrElse(tenantId, Nil)
                val recordIds = tenantRecordIdsMap(tenantId)
                pages :+ recordPersistence.getRecordsLinkingToRecordIds(
                  session,
                  SpecifiedTenantId(tenantId),
                  recordIds,
                  List(),
                  recordIdsExcluded,
                  webHook.config.aspects.getOrElse(Nil),
                  webHook.config.optionalAspects.getOrElse(Nil),
                  webHook.config.dereference
                )
              })

            recordPages.foldLeft[List[Record]](Nil)((records, recordPage) => {
              records ++ recordPage.records
            })
          }

          // We're going to include two types of records in the payload:
          // 1. Records that are directly referenced by one of the events.
          // 2. Records that _link_ to a record referenced by one of the events.
          //
          // For #1, we should ignore record aspect create/change/delete events that the
          // web hook didn't request.  i.e. only consider aspects in the web hook's
          // 'aspects' and 'optionalAspects' lists.  These are "direct" events/records
          // in the code below.
          //
          // For #2, aspects/optionalAspects don't control what is returned

          val directRecordChangeEvents: List[RegistryEvent] =
            recordChangeEvents.filter { event =>
              if (!event.eventType.isRecordAspectEvent)
                true
              else {
                val aspectId =
                  event.data.fields("aspectId").asInstanceOf[JsString].value
                val aspects = webHook.config.aspects
                  .getOrElse(Nil) ++ webHook.config.optionalAspects
                  .getOrElse(Nil)
                aspects.isEmpty || aspects.contains(aspectId)
              }
            }

          val directTenantRecordIdsMap =
            getTenantRecordIdsMap(directRecordChangeEvents)

          // Get records directly modified by these events.
          val directRecords =
            if (directTenantRecordIdsMap.isEmpty)
              RecordsPage(hasMore = false, None, Nil)
            else
              RecordsPage(
                hasMore = false,
                nextPageToken = None,
                records = getTenantDirectRecordPages(directTenantRecordIdsMap)
              )

          // If we're dereferencing, we also need to include any records that link to
          // changed records from aspects that we're including.
          val recordsFromDereference = webHook.config.dereference match {
            case Some(false) | None => List[Record]()
            case Some(true) =>
              val allTenantRecordIdsMap =
                getTenantRecordIdsMap(recordChangeEvents)
              if (allTenantRecordIdsMap.isEmpty) {
                Nil
              } else {
                getTenantLinkingRecordPages(
                  allTenantRecordIdsMap,
                  directTenantRecordIdsMap
                )
              }
          }

          Some(directRecords.records ++ recordsFromDereference)
        }
    }

    // In multi-tenant mode, different tenants may have different aspect definitions. However, an aspect
    // definition does not contain tenant info. Because currently no web hooks ever want to include aspect
    // definitions in a notification payload.
    // In the future, if some web hooks request them, tenant id field should be added to the definitions.
    // For now, aspectDefinitions is only as place holder. It equals to None anyway.
    // See https://github.com/magda-io/magda/issues/2078.
    val aspectDefinitions = webHook.config.includeAspectDefinitions match {
      case Some(false) | None => None
      case Some(true) =>
        DB readOnly { implicit session =>
          Some(
            AspectPersistence
              .getByIds(session, aspectDefinitionIds, AllTenantsId)
          )
        }
    }

    val payload = WebHookPayload(
      action = "records.changed",
      lastEventId = eventPage.events.lastOption.flatMap(_.id).get, //if (events.isEmpty) webHook.lastEvent.get else events.last.id.get,
      events =
        if (webHook.config.includeEvents.getOrElse(true)) Some(changeEvents)
        else None,
      records = records,
      aspectDefinitions = aspectDefinitions,
      deferredResponseUrl = Some(
        Uri(
          s"hooks/${java.net.URLEncoder.encode(webHook.id.get, "UTF-8")}/ack"
        ).resolvedAgainst(publicUrl).toString()
      )
    )

    Marshal(payload)
      .to[MessageEntity]
      .flatMap(entity => {
        val singleRequestStream = Source.single(
          HttpRequest(
            uri = Uri(webHook.url),
            method = HttpMethods.POST,
            entity = entity
          )
        )
        val responseStream =
          singleRequestStream.map((_, 1)).via(http.superPool())
        val resultStream = responseStream.mapAsync(1) {
          case (Success(response), _) =>
            if (response.status.isFailure()) {
              response.discardEntityBytes()

              DB localTx { session =>
                HookPersistence
                  .setActive(session, webHook.id.get, active = false)
              }

              Future(WebHookProcessor.HttpError(response.status))
            } else {
              // Try to deserialize the success response as a WebHook response.  It's ok if this fails.
              Unmarshal(response.entity)
                .to[WebHookResponse]
                .map {
                  webHookResponse =>
                    if (webHookResponse.deferResponse) {
                      DB localTx { session =>
                        HookPersistence.setIsWaitingForResponse(
                          session,
                          webHook.id.get,
                          isWaitingForResponse = true
                        )
                        if (webHook.retryCount > 0) {
                          HookPersistence
                            .resetRetryCount(session, webHook.id.get)
                        }
                      }
                      WebHookProcessor.Deferred
                    } else {
                      DB localTx { session =>
                        HookPersistence.setLastEvent(
                          session,
                          webHook.id.get,
                          payload.lastEventId
                        )
                        if (webHook.retryCount > 0) {
                          HookPersistence
                            .resetRetryCount(session, webHook.id.get)
                        }
                      }
                      WebHookProcessor.NotDeferred
                    }
                }
                .recover {
                  case _: Throwable =>
                    // Success response that can't be unmarshalled to a WebHookResponse.  This is fine!
                    // It just means the webhook was handled successfully.
                    DB localTx { session =>
                      HookPersistence.setLastEvent(
                        session,
                        webHook.id.get,
                        payload.lastEventId
                      )
                      if (webHook.retryCount > 0) {
                        HookPersistence.resetRetryCount(session, webHook.id.get)
                      }
                    }
                    WebHookProcessor.NotDeferred
                }
            }
          case (Failure(error), _) =>
            DB localTx { session =>
              HookPersistence.setActive(session, webHook.id.get, active = false)
            }
            Future.failed(error)
        }
        resultStream.completionTimeout(60 seconds).runWith(Sink.head)
      })
  }
}

object WebHookProcessor {
  sealed trait SendResult
  case object Deferred extends SendResult
  case object NotDeferred extends SendResult
  case class HttpError(statusCode: StatusCode) extends SendResult
}
