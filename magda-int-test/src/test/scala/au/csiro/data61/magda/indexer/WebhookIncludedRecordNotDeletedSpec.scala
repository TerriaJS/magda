package au.csiro.data61.magda.indexer

import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.StatusCodes.{Accepted, OK}
import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.test.util.Generators
import spray.json.{JsObject, _}

import scala.concurrent.Await
import scala.concurrent.duration._

class WebhookIncludedRecordNotDeletedSpec extends WebhookSpecBase {

  describe("when webhook received") {

    it(
      "given a combination of deletions and insertions, it should not delete anything that was included as a record"
    ) {
      val gen = for {
        gennedDataSets <- dataSetsGen
        dataSets = gennedDataSets.map(_._1)
        dataSetsToDelete <- Generators.subListGen(dataSets)
        deletedDataSetsToSave <- Generators.subListGen(dataSetsToDelete)
      } yield (dataSetsToDelete, deletedDataSetsToSave)

      forAll(gen) {
        case (dataSetsToDelete, deletedDataSetsToSave) =>
          val builtIndex = buildIndex()
          Await.result(builtIndex.indexer.ready, 120 seconds)
          builtIndex.indexNames.foreach { idxName =>
            refresh(idxName)
          }

          val events = dataSetsToDelete.map(
            dataSet =>
              RegistryEvent(
                id = None,
                eventTime = None,
                eventType = EventType.DeleteRecord,
                userId = 0,
                data = JsObject("recordId" -> JsString(dataSet.identifier)),
                tenantId = 1
              )
          )

          val payload = WebHookPayload(
            action = "records.changed",
            lastEventId = 104856,
            events = Some(events.toList),
            records = Some(
              deletedDataSetsToSave.map(x => dataSetToRecord((x, Nil))).toList
            ),
            aspectDefinitions = None,
            deferredResponseUrl = None
          )

          Post("/", payload) ~> addSingleTenantIdHeader ~> builtIndex.webhookApi.routes ~> check {
            status shouldBe Accepted
          }

          val expectedDataSets = deletedDataSetsToSave

          builtIndex.indexNames.foreach { idxName =>
            refresh(idxName)
          }
          blockUntilExactCount(expectedDataSets.size, builtIndex.indexId)

          Get("/v0/datasets?query=*&limit=10000") ~> addSingleTenantIdHeader ~> builtIndex.searchApi.routes ~> check {
            status shouldBe OK
            val result = responseAs[SearchResult]

            result.dataSets.length shouldEqual expectedDataSets.length
            result.dataSets.map(_.identifier).toSet shouldEqual expectedDataSets
              .map(_.identifier)
              .toSet
          }

          builtIndex.indexNames.foreach { idxName =>
            deleteIndex(idxName)
          }
      }
    }
  }
}
