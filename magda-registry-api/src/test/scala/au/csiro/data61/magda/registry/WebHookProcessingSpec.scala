package au.csiro.data61.magda.registry

import akka.actor.ActorRef
import akka.http.scaladsl.Http
import akka.http.scaladsl.marshalling.ToResponseMarshallable
import akka.http.scaladsl.model.{StatusCode, StatusCodes}
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import au.csiro.data61.magda.model.Registry
import au.csiro.data61.magda.model.Registry._
import gnieh.diffson._
import gnieh.diffson.sprayJson._
import org.scalatest.{BeforeAndAfterAll, BeforeAndAfterEach}
import scalikejdbc._
import spray.json._

import scala.collection.mutable.ArrayBuffer
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.util.Random

class WebHookProcessingSpec
    extends ApiSpec
    with BeforeAndAfterAll
    with BeforeAndAfterEach {

  override def afterEach(): Unit = {
    Util.clearWebHookActorsCache()
  }

  case class ExpectedEventIdAndTenantId(eventId: Int, tenantId: BigInt)
  case class ExpectedRecordIdAndTenantId(recordId: String, tenantId: BigInt)

  describe("includes") {
    it("aspectDefinitions if events modified them") { param =>
      testWebHook(param, None) { (payloads, _) =>
        val testId = "testId"
        val aspectDefinition =
          AspectDefinition(testId, "testName", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.head.records.get.length shouldBe 0
        payloads.head.aspectDefinitions.get.length shouldBe 1
        payloads.head.aspectDefinitions.get.head.id shouldBe testId
      }
    }

    it("records if events modified them") { param =>
      testWebHook(param, None) { (payloads, _) =>
        val testId = "testId"
        val record = Record(testId, "testName", Map())
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
        )
        payloads.head.aspectDefinitions.get.length shouldBe 0
      }
    }

    it("records for events modifying aspects that were requested") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A", "B")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
        payloads.clear()

        val testId = "testId"
        val record = Record(
          testId,
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        // Generate and process events with IDs of 4, 5, 6.
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(4, TENANT_1),
            ExpectedEventIdAndTenantId(5, TENANT_1),
            ExpectedEventIdAndTenantId(6, TENANT_1)
          )
        )

        payloads.clear()

        val modified = record.copy(
          aspects = Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
        // Generate and process event with ID of 7.
        param.asAdmin(Put(s"/v0/records/$testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(7, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
        )
        payloads.head.aspectDefinitions.get.length shouldBe 0
      }
    }

    it("requested aspects in records") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A", "B")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val b = AspectDefinition("B", "B", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val record = Record(
          "testId",
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modified = record.copy(
          aspects = Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
        param.asAdmin(Put("/v0/records/testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()

        payloads.head.records.get.head.aspects.equals(
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
      }
    }

    it("optional aspects in records") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config
          .copy(aspects = Some(List("A")), optionalAspects = Some(List("B")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val b = AspectDefinition("B", "B", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val record = Record(
          "testId",
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modified = record.copy(
          aspects = Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
        param.asAdmin(Put("/v0/records/testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()

        payloads.head.records.get.head.aspects.equals(
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
      }
    }
  }

  describe("doesn't include") {
    it("unrequested aspects in records") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val b = AspectDefinition("B", "B", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val record = Record(
          "testId",
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modified = record.copy(
          aspects = Map(
            "A" -> JsObject("foo" -> JsString("bar2")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
        param.asAdmin(Put("/v0/records/testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.head.records.get.head.aspects.get("A").isDefined shouldBe true
        payloads.head.records.get.head.aspects.get("B").isDefined shouldBe false
      }
    }
  }

  describe("posts") {
    it(
      "for hooks listening to a single aspect even if multiple aspects were updated"
    ) { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Will not process this event (with ID of 3).
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0

        val testId = "testId"
        val record = Record(
          testId,
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        // Generate events with IDs of 4, 5, 6 but only process 4, 5.
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(4, TENANT_1),
            ExpectedEventIdAndTenantId(5, TENANT_1)
          )
        )
        payloads.clear()

        val modified = record.copy(
          aspects = Map(
            "A" -> JsObject("foo" -> JsString("bar2")),
            "B" -> JsObject("bvalue" -> JsString("new value"))
          )
        )
        // Generate and process event with ID of 7.
        param.asAdmin(Put(s"/v0/records/$testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(7, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
        )
      }
    }

    it(
      "for aspects that were only optionally requested even if they're not present on the record"
    ) { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config
          .copy(aspects = Some(List("B")), optionalAspects = Some(List("C")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        // Generate but not process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
        payloads.clear()

        val testId = "testId"
        val record = Record(
          testId,
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        // Generate events with IDs of 4, 5, 6 but only process 4 and 6.
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(4, TENANT_1),
            ExpectedEventIdAndTenantId(6, TENANT_1)
          )
        )
        payloads.clear()

        val modified = record.copy(
          aspects = Map("B" -> JsObject("bvalue" -> JsString("new value")))
        )
        // Generate and process event with ID of 7.
        param.asAdmin(Put(s"/v0/records/$testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(7, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
        )
        payloads.head.aspectDefinitions.get.length shouldBe 0
      }
    }

    describe("for event:") {
      it("record created") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.CreateRecord))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "testId"
          val record = Record(testId, "testName", Map())
          // Generate and process event with ID of 2.
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.CreateRecord
          assertRecordsInPayloads(
            List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
          )
        }
      }

      it("record created, with legacy tenantId = NULL value") { param =>
        try {
          // First make an inactive hook
          val hook = defaultWebHook.copy(
            url = "http://localhost:" + server.localAddress.getPort.toString + "/hook",
            active = false,
            enabled = true,
            eventTypes = Set(EventType.CreateRecord)
          )

          val hookId = hook.id.get
          Util.getWebHookActor(hookId) shouldBe None

          param.asAdmin(Post("/v0/hooks", hook)) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          // Make sure it's inactive.
          Util.waitUntilAllDone(1000)
          Util.getWebHookActor(hookId) shouldBe None

          // Insert a record to put an event into the table
          val testId = "testId"
          val record = Record(testId, "testName", Map())

          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            MAGDA_ADMIN_PORTAL_ID
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          // By default this will have given the event a tenant id, set that tenant id back to NULL
          DB localTx { implicit session =>
            sql"UPDATE events SET tenantid = NULL".update.apply()
          }

          // Make sure we can see that event when we request history with the default tenant id
          Get(s"/v0/records/${record.id}/history") ~> addTenantIdHeader(
            MAGDA_ADMIN_PORTAL_ID
          ) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[EventsPage].events.length shouldEqual 1
          }

          def response(): ToResponseMarshallable = {
            StatusCodes.OK
          }

          this.currentResponse = Some(response)

          Util.waitUntilAllDone()
          payloads.length should be(0)

          // Turn the hook on
          val actor = param.webHookActor
          actor ! WebHookActor.RetryInactiveHooks
          Util.waitUntilAllDone(1000)

          // Check the hook again to see if it's live now
          Util.getWebHookActor(hookId) should not be None

          // We should now get the event, and the tenant id should be the default
          payloads.length should be(1)
          payloads.last.lastEventId shouldBe 2

          assertEventsInPayloads(
            List(ExpectedEventIdAndTenantId(2, MAGDA_ADMIN_PORTAL_ID))
          )
          payloads.head.events.get.head.eventType shouldBe EventType.CreateRecord
          assertRecordsInPayloads(
            List(ExpectedRecordIdAndTenantId(testId, MAGDA_ADMIN_PORTAL_ID))
          )
        } finally {
          payloads.clear()
        }
      }

      it("aspect definition created") { param =>
        val webHook = defaultWebHook.copy(
          eventTypes = Set(EventType.CreateAspectDefinition)
        )
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val a = AspectDefinition("A", "A", Some(JsObject()))
          // Generate and process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))

          payloads.head.events.get.head.eventType shouldBe EventType.CreateAspectDefinition
          payloads.head.aspectDefinitions.get.length shouldBe 1
        }
      }

      it("record aspect created by posting a new record") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.CreateRecordAspect))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val a = AspectDefinition("A", "A", Some(JsObject()))
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          val testId = "testId"
          val record = Record(
            testId,
            "testName",
            Map("A" -> JsObject("foo" -> JsString("bar")))
          )
          // Generate events with IDs of 3 and 4 but only process 4.
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(4, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.CreateRecordAspect
          assertRecordsInPayloads(
            List(ExpectedRecordIdAndTenantId(testId, TENANT_1))
          )
        }
      }

      it("record deleted") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.DeleteRecord))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "testId"
          val record = Record(testId, "testName", Map())
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          // Generate and process event with ID of 3.
          param.asAdmin(Delete(s"/v0/records/$testId")) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.DeleteRecord
          val theMap =
            payloads.head.events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("recordId") shouldBe JsString(testId)
        }
      }

      it("patching an aspect definition") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchAspectDefinition))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "A"
          val a = AspectDefinition(testId, "A", Some(JsObject()))
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }
          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          param.asAdmin(
            Patch(
              s"/v0/aspects/$testId",
              JsonPatch(Replace(Pointer.root / "name", JsString("foo")))
            )
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchAspectDefinition
          val theMap =
            payloads(0).events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("aspectId") shouldBe JsString(testId)
        }
      }

      it("overwriting an aspect definition") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchAspectDefinition))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "A"
          val a = AspectDefinition(testId, "A", Some(JsObject()))
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          // Generate and process event with ID of 3.
          param.asAdmin(Put(s"/v0/aspects/$testId", a.copy(name = "B"))) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchAspectDefinition
          val theMap =
            payloads.head.events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("aspectId") shouldBe JsString(testId)
        }
      }

      it("patching a record") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchRecord))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "testId"
          val record = Record(testId, "testName", Map())
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          // Generate and process event with ID of 3.
          param.asAdmin(
            Patch(
              s"/v0/records/$testId",
              JsonPatch(Replace(Pointer.root / "name", JsString("foo")))
            )
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchRecord
          val theMap =
            payloads.head.events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("recordId") shouldBe JsString(testId)
        }
      }

      it("overwriting a record") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchRecord))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val testId = "testId"
          val record = Record(testId, "testName", Map())
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          // Generate and process event with ID of 3.
          param.asAdmin(Put(s"/v0/records/$testId", record.copy(name = "blah"))) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchRecord
          val theMap =
            payloads(0).events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("recordId") shouldBe JsString(testId)
        }
      }

      it("patching a record aspect") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchRecordAspect))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val a = AspectDefinition("A", "A", Some(JsObject()))
          // Generate but not process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          // Generate but not process event with ID of 3.
          val testId = "testId"
          val record = Record(
            testId,
            "testName",
            Map("A" -> JsObject("foo" -> JsString("bar")))
          )
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          // Generate events with IDs of 4 and 5 but only process 5.
          param.asAdmin(
            Patch(
              s"/v0/records/$testId",
              JsonPatch(
                Replace(
                  Pointer.root / "aspects" / "A" / "foo",
                  JsString("bar2")
                )
              )
            )
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(5, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchRecordAspect
          val theMap =
            payloads.head.events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("recordId") shouldBe JsString(testId)
        }
      }

      it("overwriting a record aspect") { param =>
        val webHook =
          defaultWebHook.copy(eventTypes = Set(EventType.PatchRecordAspect))
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val a = AspectDefinition("A", "A", Some(JsObject()))
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val testId = "testId"
          val record = Record(
            testId,
            "testName",
            Map("A" -> JsObject("foo" -> JsString("bar")))
          )
          param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          param.asAdmin(
            Put(
              s"/v0/records/$testId",
              record
                .copy(aspects = Map("A" -> JsObject("foo" -> JsString("bar2"))))
            )
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(5, TENANT_1)))
          payloads.head.events.get.head.eventType shouldBe EventType.PatchRecordAspect
          val theMap =
            payloads.head.events.get.head.data.convertTo[Map[String, JsValue]]
          theMap("recordId") shouldBe JsString(testId)
        }
      }
    }
  }
  describe("does not post") {
    it("for aspects that were not requested") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Generate but not process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0

        // Generate events with IDs of 4, 5, 6 but only process 4, 5.
        val record = Record(
          "testId",
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(4, TENANT_1),
            ExpectedEventIdAndTenantId(5, TENANT_1)
          )
        )
        payloads.clear()

        val modified = record.copy(
          aspects = Map("B" -> JsObject("bvalue" -> JsString("new value")))
        )
        // Generate but not process event with ID of 7.
        param.asAdmin(Put("/v0/records/testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0
      }
    }

    it("unless all non-optional aspects are present on the record") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A", "C")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val a = AspectDefinition("A", "A", Some(JsObject()))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Generate but not process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0

        // Generate events with IDs of 4, 5, 6 but only process 4, 5
        val testId = "testId"
        val record = Record(
          testId,
          "testName",
          Map(
            "A" -> JsObject("foo" -> JsString("bar")),
            "B" -> JsObject("bvalue" -> JsString("yep"))
          )
        )
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(4, TENANT_1),
            ExpectedEventIdAndTenantId(5, TENANT_1)
          )
        )
        payloads.clear()

        val modified = record.copy(
          aspects = Map("B" -> JsObject("bvalue" -> JsString("new value")))
        )
        // Generate but not process event with ID of 7.
        param.asAdmin(Put(s"/v0/records/$testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 0
      }
    }
  }

  describe("does not duplicate") {
    it("records") { param =>
      testWebHook(param, None) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect",
            |    "type": "object",
            |    "properties": {
            |        "a": {
            |            "title": "A test",
            |            "type": "string"
            |        }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val testId = "testId"
        val record = Record(testId, "testName", Map())
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val modified = record.copy(name = "new name")
        // Generate and process event with ID of 4.
        param.asAdmin(Put(s"/v0/records/$testId", modified)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(3, TENANT_1),
            ExpectedEventIdAndTenantId(4, TENANT_1)
          ),
          payloadsSize = 2
        )

        for (i <- 1 to 50) {
          val withAspect = modified.copy(
            aspects = Map("A" -> JsObject(Map("a" -> JsString(i.toString))))
          )
          param.asAdmin(Put(s"/v0/records/$testId", withAspect)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }
        }

        Util.waitUntilAllDone()

        val events = payloads.foldLeft(List[RegistryEvent]())(
          (a, payload) => payload.events.getOrElse(Nil) ++ a
        )
        events.length shouldBe 52
        val records = payloads.foldLeft(List[Record]())(
          (a, payload) => payload.records.getOrElse(Nil) ++ a
        )
        records.length shouldBe payloads.length
        records.map(_.id).distinct.length shouldBe 1
        records.map(_.id).distinct.head shouldBe testId
      }
    }

    it("aspect definitions") { param =>
      testWebHook(param, None) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect",
            |    "type": "object",
            |    "properties": {
            |        "a": {
            |            "title": "A test",
            |            "type": "string"
            |        }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 1
        payloads.clear()

        for (i <- 1 to 50) {
          val withAspect = a.copy(name = i.toString)
          param.asAdmin(Put("/v0/aspects/A", withAspect)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }
        }

        Util.waitUntilAllDone()

        val events = payloads.foldLeft(List[RegistryEvent]())(
          (a, payload) => payload.events.getOrElse(Nil) ++ a
        )
        events.length shouldBe 50
        val aspects = payloads.foldLeft(List[AspectDefinition]())(
          (a, payload) => payload.aspectDefinitions.getOrElse(Nil) ++ a
        )
        aspects.length shouldBe payloads.length
        aspects.map(_.id).distinct.length shouldBe 1
        aspects.map(_.id).distinct.head shouldBe "A"
      }
    }
  }

  describe("dereference") {
    it("includes a record when a distribution is added to it") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "someLink": {
            |            "title": "A link to another record.",
            |            "type": "string",
            |            "links": [
            |                {
            |                    "href": "/api/v0/registry/records/{$}",
            |                    "rel": "item"
            |                }
            |            ]
            |        }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.clear()

        val datasetId = "dataset"
        val dataset = Record(datasetId, "dataset", Map())
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
        payloads.clear()

        val distributionId = "distribution"
        val distribution = Record(distributionId, "distribution", Map())
        // Generate and process event with ID of 4.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(4, TENANT_1)))

        // Generate and process event with ID of 5.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_2) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        // Generate and process event with ID of 6.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val recordWithLink = dataset.copy(
          aspects = Map("A" -> JsObject("someLink" -> JsString(distributionId)))
        )
        // Generate and process event with ID of 7.
        // Note that the following request will modify dataset of TENANT_2 to have an aspect that links to dataset
        // with ID of distributionId. If following the "someLink" aspect, no record with distributionId can be found.
        // This is because TENANT_2 did not have record with ID of distributionId. Only TENANT_1 has that record.
        // We need to have a mechanism to prevent from creating a record aspect that links to a "ghost" record.
        //
        // We could have let TENANT_1 make the request in this test case. Instead, we let TENANT_2 make the request
        // in order to highlight a potential "ghost" link problem.
        // See https://github.com/magda-io/magda/issues/2339.
        param.asAdmin(Put("/v0/records/dataset", recordWithLink)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(7, TENANT_2)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(datasetId, TENANT_2))
        )
      }
    }

    it(
      "includes a record when a distribution is added to it, excluding same ID distribution from other tenant."
    ) { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "someLink": {
            |            "title": "A link to another record.",
            |            "type": "string",
            |            "links": [
            |                {
            |                    "href": "/api/v0/registry/records/{$}",
            |                    "rel": "item"
            |                }
            |            ]
            |        }
            |    }
            |}
          """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2 - 7.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_2) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val datasetId = "dataset"
        val dataset = Record(datasetId, "dataset", Map())
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val distributionId = "distribution"
        val distribution = Record(distributionId, "distribution", Map())
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val recordWithLink = dataset.copy(
          aspects = Map("A" -> JsObject("someLink" -> JsString(distributionId)))
        )
        // Generate and process events with ID of 8, 9.
        param.asAdmin(Put("/v0/records/dataset", recordWithLink)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }
        param.asAdmin(Put("/v0/records/dataset", recordWithLink)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(
          List(
            ExpectedEventIdAndTenantId(8, TENANT_1),
            ExpectedEventIdAndTenantId(9, TENANT_2)
          ),
          payloadsSize = 2
        )
        assertRecordsInPayloads(
          List(
            ExpectedRecordIdAndTenantId(datasetId, TENANT_1),
            ExpectedRecordIdAndTenantId(datasetId, TENANT_2)
          )
        )
      }
    }

    it("includes a record when a linked record is modified") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "someLink": {
            |            "title": "A link to another record.",
            |            "type": "string",
            |            "links": [
            |                {
            |                    "href": "/api/v0/registry/records/{$}",
            |                    "rel": "item"
            |                }
            |            ]
            |        }
            |    }
            |}
          """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_2) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val distributionId = "distribution"
        val distribution = Record(distributionId, "distribution", Map())
        // Generate and process event with ID of 4.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        // Generate and process event with ID of 5.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val datasetId = "dataset"
        val dataset = Record(
          datasetId,
          "dataset",
          Map("A" -> JsObject("someLink" -> JsString(distributionId)))
        )
        // Generate and process events with IDs of 6, 7.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        // Generate and process events with IDs of 8, 9.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modifiedDistribution = distribution.copy(name = "new name")
        // Generate and process event with ID of 10.
        param.asAdmin(Put(s"/v0/records/$distributionId", modifiedDistribution)) ~> addTenantIdHeader(
          TENANT_2
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(10, TENANT_2)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(datasetId, TENANT_2))
        )
      }
    }

    it("includes a record when an array-linked record is modified") { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "distributions": {
            |           "title": "The distributions of this dataset.",
            |           "type": "array",
            |           "items": {
            |               "title": "A ID of a distribution of this dataset.",
            |               "type": "string",
            |               "links": [
            |                   {
            |                       "href": "/api/v0/registry/records/{$}",
            |                       "rel": "item"
            |                   }
            |               ]
            |           }
            |       }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val distributionId = "distribution"
        val distribution = Record(distributionId, "distribution", Map())
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val datasetId = "dataset"
        val dataset = Record(
          datasetId,
          "dataset",
          Map(
            "A" -> JsObject(
              "distributions" -> JsArray(JsString(distributionId))
            )
          )
        )
        // Generate and process events with IDs of 4, 5.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modifiedDistribution = distribution.copy(name = "new name")
        // Generate and process event with ID of 6.
        param.asAdmin(Put(s"/v0/records/$distributionId", modifiedDistribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(6, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(datasetId, TENANT_1))
        )
      }
    }

    it(
      "includes a record when one of its single-linked records' aspects is modified"
    ) { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "someLink": {
            |            "title": "A link to another record.",
            |            "type": "string",
            |            "links": [
            |                {
            |                    "href": "/api/v0/registry/records/{$}",
            |                    "rel": "item"
            |                }
            |            ]
            |        }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val b = AspectDefinition("B", "B", Some(JsObject()))
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val distributionId = "distribution"
        val distribution = Record(
          distributionId,
          "distribution",
          Map("B" -> JsObject("value" -> JsString("something")))
        )
        // Generate and process events with IDs of 4, 5.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val datasetId = "dataset"
        val dataset = Record(
          datasetId,
          "dataset",
          Map("A" -> JsObject("someLink" -> JsString(distributionId)))
        )
        // Generate and process events with IDs of 6, 7.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modifiedDistribution = distribution.copy(
          aspects = Map("B" -> JsObject("value" -> JsString("different")))
        )
        // Generate and process event with ID of 8.
        param.asAdmin(Put(s"/v0/records/$distributionId", modifiedDistribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(8, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(datasetId, TENANT_1))
        )
      }
    }

    it("includes a record when an array-linked records' aspects is modified") {
      param =>
        val webHook = defaultWebHook.copy(
          config = defaultWebHook.config.copy(aspects = Some(List("A")))
        )
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val jsonSchema =
            """
              |{
              |    "$schema": "http://json-schema.org/hyper-schema#",
              |    "title": "An aspect with a single link",
              |    "type": "object",
              |    "properties": {
              |        "distributions": {
              |           "title": "The distributions of this dataset.",
              |           "type": "array",
              |           "items": {
              |               "title": "A ID of a distribution of this dataset.",
              |               "type": "string",
              |               "links": [
              |                   {
              |                       "href": "/api/v0/registry/records/{$}",
              |                       "rel": "item"
              |                   }
              |               ]
              |           }
              |       }
              |    }
              |}
              """.stripMargin
          val a =
            AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
          // Generate and process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val b = AspectDefinition("B", "B", Some(JsObject()))
          // Generate and process event with ID of 3.
          param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val distributionId = "distribution"
          val distribution = Record(
            distributionId,
            "distribution",
            Map("B" -> JsObject("value" -> JsString("something")))
          )
          // Generate and process events with IDs of 4, 5.
          param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val datasetId = "dataset"
          val dataset = Record(
            datasetId,
            "dataset",
            Map(
              "A" -> JsObject(
                "distributions" -> JsArray(JsString(distributionId))
              )
            )
          )
          // Generate and process events with IDs of 6, 7.
          param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.clear()

          val modifiedDistribution = distribution.copy(
            aspects = Map("B" -> JsObject("value" -> JsString("different")))
          )
          // Generate and process event with ID of 8.
          param.asAdmin(
            Put(s"/v0/records/$distributionId", modifiedDistribution)
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(8, TENANT_1)))
          assertRecordsInPayloads(
            List(ExpectedRecordIdAndTenantId(datasetId, TENANT_1))
          )
        }
    }

    it(
      "with multiple linking aspects, only one has to link to a modified record"
    ) { param =>
      val webHook = defaultWebHook.copy(
        config = defaultWebHook.config.copy(aspects = Some(List("A", "B")))
      )
      testWebHook(param, Some(webHook)) { (payloads, _) =>
        val jsonSchema =
          """
            |{
            |    "$schema": "http://json-schema.org/hyper-schema#",
            |    "title": "An aspect with a single link",
            |    "type": "object",
            |    "properties": {
            |        "someLink": {
            |            "title": "A link to another record.",
            |            "type": "string",
            |            "links": [
            |                {
            |                    "href": "/api/v0/registry/records/{$}",
            |                    "rel": "item"
            |                }
            |            ]
            |        }
            |    }
            |}
              """.stripMargin
        val a =
          AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 2.
        param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val b =
          AspectDefinition("B", "B", Some(JsonParser(jsonSchema).asJsObject))
        // Generate and process event with ID of 3.
        param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val distributionId = "distribution"
        val distribution = Record(distributionId, "distribution", Map())
        // Generate and process events with IDs of 4, 5.
        param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        val datasetId = "dataset"
        val dataset = Record(
          datasetId,
          "dataset",
          Map(
            "A" -> JsObject("someLink" -> JsString(distributionId)),
            "B" -> JsObject()
          )
        )
        // Generate and process events with IDs of 6, 7.
        param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.clear()

        val modifiedDistribution = distribution.copy(name = "new name")
        // Generate and process event with ID of 8.
        param.asAdmin(Put(s"/v0/records/$distributionId", modifiedDistribution)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(8, TENANT_1)))
        assertRecordsInPayloads(
          List(ExpectedRecordIdAndTenantId(datasetId, TENANT_1))
        )
      }
    }

    it("includes all aspects of linked records, not just the requested aspects") {
      param =>
        val webHook = defaultWebHook.copy(
          config = defaultWebHook.config.copy(aspects = Some(List("A")))
        )
        testWebHook(param, Some(webHook)) { (payloads, _) =>
          val jsonSchema =
            """
              |{
              |    "$schema": "http://json-schema.org/hyper-schema#",
              |    "title": "An aspect with a single link",
              |    "type": "object",
              |    "properties": {
              |        "someLink": {
              |            "title": "A link to another record.",
              |            "type": "string",
              |            "links": [
              |                {
              |                    "href": "/api/v0/registry/records/{$}",
              |                    "rel": "item"
              |                }
              |            ]
              |        }
              |    }
              |}
              """.stripMargin
          val a =
            AspectDefinition("A", "A", Some(JsonParser(jsonSchema).asJsObject))
          // Generate and process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", a)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val b = AspectDefinition("B", "B", Some(JsObject()))
          // Generate and process event with ID of 3.
          param.asAdmin(Post("/v0/aspects", b)) ~> addTenantIdHeader(TENANT_1) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val distributionId = "distribution"
          val distribution = Record(
            distributionId,
            "distribution",
            Map("B" -> JsObject("foo" -> JsString("bar")))
          )
          // Generate and process events with IDs of 4, 5.
          param.asAdmin(Post("/v0/records", distribution)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          val datasetId = "dataset"
          val dataset = Record(
            datasetId,
            "dataset",
            Map("A" -> JsObject("someLink" -> JsString(distributionId)))
          )
          // Generate and process events with IDs of 6, 7.
          param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.clear()

          val modifiedDistribution = distribution.copy(name = "new name")
          // Generate and process event with ID of 8.
          param.asAdmin(
            Put(s"/v0/records/$distributionId", modifiedDistribution)
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(8, TENANT_1)))
          assertRecordsInPayloads(
            List(ExpectedRecordIdAndTenantId(datasetId, TENANT_1))
          )

          val embeddedDistribution = payloads.head.records.get.head
            .aspects("A")
            .fields("someLink")
            .asJsObject
          val bAspect = embeddedDistribution
            .fields("aspects")
            .asJsObject
            .fields("B")
            .asJsObject
          bAspect.fields("foo").asInstanceOf[JsString].value shouldBe "bar"
        }
    }
  }

  describe("resumes hooks that have previously failed with network errors") {
    describe("sync") {
      val dataset = Record("dataset", "dataset", Map())

      /**
        * This function will perform the following common tasks:
        * 1) Create a test hook processor, no events to process yet.
        * 2) Change the hook to an invalid url.
        * 3) Add a new dataset in the registry and the hook will fail in the event processing.
        * 4) Change the hook back to a valid url and make update hook request.
        * 5) Make resume web hook request and the hook will succeed in the event processing.
        *
        * Once all the common tasks are completed, the callback function "resumeHook" will start.
        * @param param fixture parameters
        * @param resumeHook callback function
        */
      def doTestSync(param: FixtureParam)(resumeHook: () => Any) {
        testWebHook(param, None) { (payloads, _) =>
          val url = param.asAdmin(Get("/v0/hooks/test")) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[WebHook].url
          }

          // Set the test hook to an invalid url to simulate some network errors, such as the
          // subscriber service goes offline. For example, an indexer pod is deleted.
          param.asAdmin(
            Put(
              "/v0/hooks/test",
              defaultWebHook.copy(url = "aerga://bargoiaergoi.aerg")
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          // Generate but fail to process event with ID of 2.
          param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          // As the hook url is invalid, the subscriber will not receive event with id of 2.
          payloads.length shouldEqual 0

          // Set the test hook back to a valid url to simulates the subscriber goes online again.
          // For example, a re-created indexer will register itself by making a put request
          // to update its web hook, which will not cause any event processing.
          param.asAdmin(Put("/v0/hooks/test", defaultWebHook.copy(url = url))) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldEqual 0

          // Simulate a subscriber making request to resume its web hook, which will cause some
          // event processing. That is, process event with ID of 2.
          val lastEventId = 1
          param.asAdmin(
            Post(
              "/v0/hooks/test/ack",
              WebHookAcknowledgement(succeeded = true, Some(lastEventId))
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[WebHookAcknowledgementResponse].lastEventIdReceived should be(
              lastEventId
            )
          }

          val expectedEventIds = List(2)
          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
          payloads.clear()

          resumeHook()
        }
      }

      it("when subscriber posts /ack with up-to-date last event id") { param =>
        doTestSync(param) { () =>
          // Make request to resume a subscriber's web hook, with lastEventId = 2, which will
          // not cause event processing.
          // This is to simulate when an indexer is re-created, its event processing is up-to-date.
          val lastEventId = 2
          param.asAdmin(
            Post(
              "/v0/hooks/" + defaultWebHook.id.get + "/ack",
              WebHookAcknowledgement(succeeded = true, Some(lastEventId))
            )
          ) ~> param.api(Full).routes ~> check {
            responseAs[Registry.WebHookAcknowledgementResponse].lastEventIdReceived shouldBe lastEventId
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0

          param.asAdmin(Get("/v0/hooks/" + defaultWebHook.id.get)) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            val hook = responseAs[WebHook]
            hook.lastEvent.get shouldBe 2
          }
        }
      }

      it("when actor is sent Process() (i.e. on registry startup)") { param =>
        doTestSync(param) { () =>
          param.webHookActor ! WebHookActor.Process(
            ignoreWaitingForResponse = true
          )
          Util.waitUntilAllDone()
          payloads.length shouldBe 0
        }
      }

      it("when new event is created") { param =>
        doTestSync(param) { () =>
          // Generate and process event with ID of 3.
          param.asAdmin(
            Put("/v0/records/" + dataset.id, dataset.copy(name = "blah"))
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))

          param.asAdmin(Get("/v0/hooks/" + defaultWebHook.id.get)) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            val hook = responseAs[WebHook]
            hook.lastEvent.get shouldBe 3
            payloads.last.lastEventId shouldBe 3
          }
        }
      }
    }

    describe("async") {
      val dataset = Record("dataset", "dataset", Map())

      def doTestAsync(param: FixtureParam)(resumeHook: () => Any) {
        testAsyncWebHook(param, Some(defaultWebHook)) { (payloads, _) =>
          param.asAdmin(Post("/v0/records", dataset)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[Record] shouldBe dataset.copy(tenantId = Some(TENANT_1))
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))

          param.asAdmin(Get("/v0/hooks/" + defaultWebHook.id.get)) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            val hook = responseAs[WebHook]
            hook.lastEvent.get shouldBe 1
            hook.isWaitingForResponse.get shouldBe true
            payloads.last.lastEventId shouldBe 2
          }

          payloads.clear()

          resumeHook()
        }
      }

      it("when subscriber posts /ack") { param =>
        doTestAsync(param) { () =>
          param.asAdmin(
            Post(
              "/v0/hooks/" + defaultWebHook.id.get + "/ack",
              WebHookAcknowledgement(succeeded = false)
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))

          param.asAdmin(Get("/v0/hooks/" + defaultWebHook.id.get)) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            val hook = responseAs[WebHook]

            // We haven't told the registry that we've successfully processed it, so the hook should still be at event 1
            hook.lastEvent.get shouldBe 1
            hook.isWaitingForResponse.get shouldBe true
          }
        }
      }

      it("when actor is sent Process() (i.e. on registry startup)") { param =>
        doTestAsync(param) { () =>
          param.webHookActor ! WebHookActor.Process(
            ignoreWaitingForResponse = true
          )
          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        }
      }

      it(
        "should not resume when new event is created, but should include both events when resumed"
      ) { param =>
        doTestAsync(param) { () =>
          param.asAdmin(
            Put("/v0/records/" + dataset.id, dataset.copy(name = "blah2"))
          ) ~> addTenantIdHeader(TENANT_1) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[Record].id shouldBe "dataset"
            responseAs[Record].name shouldBe "blah2"
            responseAs[Record].aspects shouldBe Map()
          }

          Util.waitUntilAllDone()
          // Because the hook is marked as waiting for response, the new event should not be sent.
          payloads.length shouldBe 0

          param.asAdmin(
            Post(
              "/v0/hooks/" + defaultWebHook.id.get + "/ack",
              WebHookAcknowledgement(succeeded = false)
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[WebHookAcknowledgementResponse].lastEventIdReceived shouldBe 1
          }

          // Because the subscriber post ack as failure, two events should be sent,
          // with the first event being re-sent.
          assertEventsInPayloads(
            List(
              ExpectedEventIdAndTenantId(2, TENANT_1),
              ExpectedEventIdAndTenantId(3, TENANT_1)
            )
          )
        }
      }
    }
  }

  private def assertEventsInPayloads(
      expectedEventIdAndTenantIds: Seq[ExpectedEventIdAndTenantId],
      payloadsSize: Int = 1
  ) = {
    Util.waitUntilAllDone(1000)
    payloads.length shouldBe payloadsSize
    val events = payloads.foldLeft[List[RegistryEvent]](Nil)(
      (a, payload) => a ++ payload.events.get
    )

    events.size shouldBe expectedEventIdAndTenantIds.size
    events
      .zip(expectedEventIdAndTenantIds)
      .map(pair => {
        val actual = pair._1
        val expected = pair._2
        actual.id.get shouldBe expected.eventId
        actual.tenantId shouldBe expected.tenantId
      })
  }

  private def assertRecordsInPayloads(
      expectedRecordIdAndTenantIds: Seq[ExpectedRecordIdAndTenantId]
  ) = {
    payloads.size shouldBe expectedRecordIdAndTenantIds.size
    val records = payloads.foldLeft[List[Record]](Nil)(
      (a, payload) => a ++ payload.records.get
    )
    records
      .zip(expectedRecordIdAndTenantIds)
      .map(pair => {
        val actual = pair._1
        val expected = pair._2
        actual.id shouldBe expected.recordId
        actual.tenantId shouldBe Some(expected.tenantId)
      })
  }

  describe("async web hooks") {
    it("delays further notifications until previous one is acknowledged") {
      param =>
        testAsyncWebHook(param, None) { (payloads, _) =>
          val aspectDefinition =
            AspectDefinition("testId", "testName", Some(JsObject()))
          param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 1
          payloads(0).events.get.length shouldBe 1
          payloads(0).records.get.length shouldBe 0
          payloads(0).aspectDefinitions.get.length shouldBe 1
          payloads(0).aspectDefinitions.get.head.id shouldBe "testId"
          payloads(0).deferredResponseUrl shouldBe Some(
            "http://localhost:6101/v0/hooks/test/ack"
          )
          payloads.clear()

          val aspectDefinition2 =
            AspectDefinition("testId2", "testName2", Some(JsObject()))
          param.asAdmin(Post("/v0/aspects", aspectDefinition2)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldBe 0
        }
    }

    it("retries an unsuccessful notification") { param =>
      testAsyncWebHook(param, None) { (payloads, _) =>
        val aspectDefinition =
          AspectDefinition("testId", "testName", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length shouldBe 1
        payloads(0).events.get.length shouldBe 1
        payloads(0).records.get.length shouldBe 0
        payloads(0).aspectDefinitions.get.length shouldBe 1
        payloads(0).aspectDefinitions.get.head.id shouldBe "testId"
        payloads.clear()

        param.asAdmin(
          Post(
            "/v0/hooks/test/ack",
            WebHookAcknowledgement(succeeded = false, None)
          )
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[WebHookAcknowledgementResponse].lastEventIdReceived should be < 2L
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.head.records.get.length shouldBe 0
        payloads.head.aspectDefinitions.get.length shouldBe 1
        payloads.head.aspectDefinitions.get.head.id shouldBe "testId"
      }
    }

    it("sends the next events after a successful notification") { param =>
      testAsyncWebHook(param, None) { (payloads, _) =>
        val aspectDefinition =
          AspectDefinition("testId", "testName", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
        payloads.head.records.get.length shouldBe 0
        payloads.head.aspectDefinitions.get.length shouldBe 1
        payloads.head.aspectDefinitions.get.head.id shouldBe "testId"
        val lastEventId = payloads.head.lastEventId
        payloads.clear()

        val aspectDefinition2 =
          AspectDefinition("testId2", "testName2", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", aspectDefinition2)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        param.asAdmin(
          Post(
            "/v0/hooks/test/ack",
            WebHookAcknowledgement(succeeded = true, Some(lastEventId))
          )
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[WebHookAcknowledgementResponse].lastEventIdReceived should be(
            lastEventId
          )
        }

        assertEventsInPayloads(List(ExpectedEventIdAndTenantId(3, TENANT_1)))
        payloads.head.records.get.length shouldBe 0
        payloads.head.aspectDefinitions.get.length shouldBe 1
        payloads.head.aspectDefinitions.get.head.id shouldBe "testId2"
      }
    }

  }

  describe("deactivation/reactivation") {
    describe("deactivates on webhook recipient failure") {
      it("sync - when recipient returns failure code") { param =>
        def response(): ToResponseMarshallable = {
          StatusCodes.InternalServerError
        }

        testWebHookWithResponse(param, Some(defaultWebHook), response) {
          (payloads, _) =>
            param.asAdmin(Get("/v0/hooks/test")) ~> param
              .api(Full)
              .routes ~> check {
              status shouldEqual StatusCodes.OK
              val hook = responseAs[WebHook]
              hook.active shouldEqual true
            }

            val aspectDefinition =
              AspectDefinition("testId", "testName", Some(JsObject()))
            param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            assertEventsInPayloads(
              List(ExpectedEventIdAndTenantId(2, TENANT_1))
            )
            payloads.clear()

            param.asAdmin(Get("/v0/hooks/test")) ~> param
              .api(Full)
              .routes ~> check {
              status shouldEqual StatusCodes.OK
              val hook = responseAs[WebHook]
              hook.active shouldEqual false
            }

            val aspectDefinition2 =
              AspectDefinition("testId2", "testName2", Some(JsObject()))
            param.asAdmin(Post("/v0/aspects", aspectDefinition2)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }
            payloads.length should be(0)
        }
      }

      it("async - deactivates when /ack called with active=false") { param =>
        testAsyncWebHook(param, None) { (payloads, _) =>
          val aspectDefinition =
            AspectDefinition("testId", "testName", Some(JsObject()))
          // Generate and process event with ID of 2.
          param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[Registry.AspectDefinition].id shouldBe "testId"
          }

          assertEventsInPayloads(List(ExpectedEventIdAndTenantId(2, TENANT_1)))
          val lastEventId = payloads(0).lastEventId
          payloads.clear()

          // Not to re-process event with ID of 2 as the hook is set to inactive.
          param.asAdmin(
            Post(
              "/v0/hooks/test/ack",
              WebHookAcknowledgement(
                succeeded = false,
                lastEventIdReceived = None,
                active = Some(false)
              )
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[WebHookAcknowledgementResponse].lastEventIdReceived should not be lastEventId
          }

          Util.waitUntilAllDone()
          payloads.length shouldEqual 0

          // Not to re-process event with ID of 2 as the hook is still inactive.
          param.asAdmin(
            Post(
              "/v0/hooks/test/ack",
              WebHookAcknowledgement(succeeded = false)
            )
          ) ~> param.api(Full).routes ~> check {
            status shouldEqual StatusCodes.OK
          }

          Util.waitUntilAllDone()
          payloads.length shouldEqual 0

          param.asAdmin(Get("/v0/hooks/test")) ~> param
            .api(Full)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            val hook = responseAs[WebHook]
            hook.active shouldEqual false
          }
        }
      }

      it("reactivates when /ack called with active=true") { param =>
        testAsyncWebHook(param, Some(defaultWebHook.copy(active = false))) {
          (payloads, _) =>
            val aspectDefinition =
              AspectDefinition("testId", "testName", Some(JsObject()))
            // Generate but not process event with ID of 2.
            param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            Util.waitUntilAllDone()
            payloads.length shouldEqual 0

            // Process event with ID of 2 as the hook becomes active.
            param.asAdmin(
              Post(
                "/v0/hooks/test/ack",
                WebHookAcknowledgement(
                  succeeded = false,
                  lastEventIdReceived = None,
                  active = Some(true)
                )
              )
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            assertEventsInPayloads(
              List(ExpectedEventIdAndTenantId(2, TENANT_1))
            )
            val lastEventId = payloads.head.lastEventId
            payloads.clear()

            val aspectDefinition2 =
              AspectDefinition("testId2", "testName2", Some(JsObject()))
            // Generate but not process event with ID of 3 as the hook is waiting for ack.
            param.asAdmin(Post("/v0/aspects", aspectDefinition2)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            Util.waitUntilAllDone()
            payloads.length shouldBe 0

            // Process event with ID of 3.
            param.asAdmin(
              Post(
                "/v0/hooks/test/ack",
                WebHookAcknowledgement(succeeded = true, Some(lastEventId))
              )
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            assertEventsInPayloads(
              List(ExpectedEventIdAndTenantId(3, TENANT_1))
            )
        }
      }

      it(
        "When recipient returns success code, registry should reset webHook lastRetryTime & retryCount"
      ) { param =>
        def response(): ToResponseMarshallable = {
          StatusCodes.OK
        }

        testWebHookWithResponse(param, Some(defaultWebHook), response) {
          (_, _) =>
            //--- retry will increase try count and set lastRetryTime
            DB localTx { session =>
              HookPersistence.retry(session, "test")
            }

            param.asAdmin(Get("/v0/hooks/test")) ~> param
              .api(Full)
              .routes ~> check {
              status shouldEqual StatusCodes.OK
              val hook = responseAs[WebHook]
              hook.active shouldEqual true
              hook.retryCount shouldEqual 1
              hook.lastRetryTime.isEmpty shouldEqual false
            }

            val aspectDefinition =
              AspectDefinition("testId", "testName", Some(JsObject()))
            // Generate and process event with ID of 2.
            param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
            }

            assertEventsInPayloads(
              List(ExpectedEventIdAndTenantId(2, TENANT_1))
            )

            param.asAdmin(Get("/v0/hooks/test")) ~> param
              .api(Full)
              .routes ~> check {
              status shouldEqual StatusCodes.OK
              val hook = responseAs[WebHook]
              hook.active shouldEqual true
              hook.retryCount shouldEqual 0
              hook.lastRetryTime.isEmpty shouldEqual true
            }
        }
      }

    }
  }

  describe("Retry inactive Webhooks") {

    it("Will restart inactive hook and start to process event immediately") {
      param =>
        // an inactive hook
        val hook = defaultWebHook.copy(
          url = "http://localhost:" + server.localAddress.getPort.toString + "/hook",
          active = false,
          enabled = true
        )

        val hookId = hook.id.get
        Util.getWebHookActor(hookId) shouldBe None

        param.asAdmin(Post("/v0/hooks", hook)) ~> param
          .api(Full)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone(1000)
        Util.getWebHookActor(hookId) shouldBe None

        def response(): ToResponseMarshallable = {
          StatusCodes.OK
        }

        this.currentResponse = Some(response)

        val aspectDefinition =
          AspectDefinition("testId", "testName", Some(JsObject()))
        // Generate but not process event with ID of 2 as the hook is inactive.
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Util.waitUntilAllDone()
        payloads.length should be(0)

        // Send message to trigger the retry.
        // Will process event with ID of 2.
        // This will take some time so we wait a little bit longer than usual.
        val actor = param.webHookActor
        actor ! WebHookActor.RetryInactiveHooks
        Util.waitUntilAllDone(1000)

        // Check the hook again to see if it's live now
        Util.getWebHookActor(hookId) should not be None

        // Should send one request to hook
        payloads.length should be(1)
        payloads.last.lastEventId shouldBe 2

    }

    it("Will not restart disabled inactive hook") { param =>
      val hook = defaultWebHook.copy(
        url = "http://localhost:" + server.localAddress.getPort.toString + "/hook",
        active = false,
        enabled = false
      )

      val hookId = hook.id.get

      Util.getWebHookActor(hookId) shouldBe None

      param.asAdmin(Post("/v0/hooks", hook)) ~> param
        .api(Full)
        .routes ~> check {
        status shouldEqual StatusCodes.OK
      }

      Util.waitUntilAllDone()
      Util.getWebHookActor(hookId) shouldBe None

      // --- send message to trigger the retry
      WebHookActor.RetryInactiveHooks
      Util.waitUntilAllDone()

      Util.getWebHookActor(hookId) shouldBe None

    }

  }

  private val defaultWebHook = WebHook(
    id = Some("test"),
    userId = None,
    name = "test",
    active = true,
    lastEvent = None,
    url = "",
    eventTypes = EventType.values.toSet,
    isWaitingForResponse = None,
    config = WebHookConfig(
      includeEvents = Some(true),
      includeRecords = Some(true),
      includeAspectDefinitions = Some(true),
      dereference = Some(true)
    )
  )

  var currentHttpStatusCode: StatusCode = StatusCodes.OK
  var currentResponse: Option[() => ToResponseMarshallable] = None
  val payloads: ArrayBuffer[WebHookPayload] = ArrayBuffer[WebHookPayload]()

  val route: Route = post {
    path("hook") {
      entity(as[WebHookPayload]) { payload =>
        payloads.append(payload)

        if (currentHttpStatusCode == StatusCodes.InternalServerError)
          complete(currentHttpStatusCode)
        else
          complete(currentResponse.get())
      } ~ complete(StatusCodes.BlockedByParentalControls)
    }
  }
  val server: Http.ServerBinding = createHookRoute(route)

  override def afterAll() {
    Await.result(server.unbind(), 30 seconds)
    Util.clearWebHookActorsCache()
  }

  private def testWebHookWithResponse(
      param: FixtureParam,
      webHook: Option[WebHook],
      response: () ⇒ ToResponseMarshallable
  )(testCallback: (ArrayBuffer[WebHookPayload], ActorRef) => Unit): Unit = {
    // Why this super-global approach instead of creating a new http server for each test? For some reason if you do it fast enough,
    // the akka http server from the old test can receive hooks for the new server, even after you've waited for it to unbind and bound
    // the new one on the current port (this is hard to reproduce but happens maybe 1/20th of the time.
    this.currentResponse = Some(response)
    val hook = webHook
      .getOrElse(defaultWebHook)
      .copy(
        url = "http://localhost:" + server.localAddress.getPort.toString + "/hook"
      )
    // Create a new web hook actor asynchronously.
    param.asAdmin(Post("/v0/hooks", hook)) ~> param.api(Full).routes ~> check {
      status shouldEqual StatusCodes.OK
    }

    if (hook.active && hook.enabled)
      Util.waitUntilWebHookActorIsInCache(hook.id.get)
    else
      Util.waitUntilAllDone()

    val actor = param.webHookActor

    try {
      testCallback(payloads, actor)
    } finally {
      payloads.clear()
    }
  }

  private def testWebHook(
      param: FixtureParam,
      webHook: Option[WebHook],
      succeeded: Boolean = true
  )(testCallback: (ArrayBuffer[WebHookPayload], ActorRef) => Unit): Unit = {
    if (succeeded) {
      currentHttpStatusCode = StatusCodes.OK
      testWebHookWithResponse(param, webHook, () => "got it")(testCallback)
    } else {
      currentHttpStatusCode = StatusCodes.InternalServerError
      testWebHookWithResponse(param, webHook, () => "failed")(testCallback)
    }
  }

  private def testAsyncWebHook(param: FixtureParam, webHook: Option[WebHook])(
      testCallback: (ArrayBuffer[WebHookPayload], ActorRef) => Unit
  ): Unit = {
    testWebHookWithResponse(param, webHook, () => WebHookResponse(true))(
      testCallback
    )
  }

  private def createHookRoute(route: Route): Http.ServerBinding = {
    val http = Http()

    val random = new Random()

    var serverBinding: Option[Http.ServerBinding] = None
    var tries = 0

    while (serverBinding.isEmpty && tries < 10) {
      val port = random.nextInt(1000)
      val bindingFuture = http.bindAndHandle(route, "localhost", 30000 + port)
      serverBinding = Await.ready(bindingFuture, 5 seconds).value.get.toOption

      tries += 1
    }

    if (serverBinding.isEmpty) {
      throw new RuntimeException(
        "Could not bind to a port in the 30000-31000 range after 10 tries."
      )
    }

    serverBinding.get
  }
}
