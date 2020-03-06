package au.csiro.data61.magda.registry

import akka.http.scaladsl.model.StatusCodes
import akka.util.Timeout
import au.csiro.data61.magda.model.Registry.{EventType, WebHook, WebHookConfig}
import org.scalatest.BeforeAndAfterEach
import spray.json.RootJsonFormat

import scala.concurrent.duration._

class WebHookActorSpec extends ApiSpec with BeforeAndAfterEach {
  implicit val timeout: Timeout = Timeout(5 seconds)
  private val hookId = "abc"

  override def afterEach(): Unit = {
    Util.clearWebHookActorsCache()
  }

  it("initially no processor exists") { _ =>
    Util.getWebHookActor(hookId) shouldBe None
  }

  it("creates a processor for newly-created web hooks") { param =>
    Util.getWebHookActor("abc") shouldBe None

    val hook = WebHook(
      id = Some(hookId),
      userId = None,
      name = "abc",
      active = true,
      lastEvent = None,
      url = "http://example.com/foo",
      eventTypes = Set(EventType.CreateRecord),
      isWaitingForResponse = None,
      config = WebHookConfig(
        optionalAspects = Some(List("aspect")),
        includeEvents = Some(true),
        includeRecords = Some(true),
        includeAspectDefinitions = Some(true),
        dereference = Some(true)
      )
    )

    param.asAdmin(Post("/v0/hooks", hook)) ~> param.api(Full).routes ~> check {
      status shouldEqual StatusCodes.OK
      responseAs[WebHook].enabled shouldBe true
    }

    // Because of asynchronous processing, it takes some time for the newly created hook
    // to appear in the cache.
    Util.waitUntilWebHookActorIsInCache(hookId)
    Util.getWebHookActor(hookId) should not be None
  }

  it("Will not creates a processor for newly-created disabled web hooks") {
    param =>
      Util.getWebHookActor(hookId) shouldBe None

      val hook = WebHook(
        id = Some(hookId),
        userId = None,
        name = "abc",
        active = true,
        lastEvent = None,
        url = "http://example.com/foo",
        eventTypes = Set(EventType.CreateRecord),
        isWaitingForResponse = None,
        config = WebHookConfig(
          optionalAspects = Some(List("aspect")),
          includeEvents = Some(true),
          includeRecords = Some(true),
          includeAspectDefinitions = Some(true),
          dereference = Some(true)
        ),
        enabled = false
      )

      param.asAdmin(Post("/v0/hooks", hook)) ~> param
        .api(Full)
        .routes ~> check {
        status shouldEqual StatusCodes.OK
        responseAs[WebHook].enabled shouldBe false
      }

      // Wait for longer time than usual to ensure the hook's processor is not created.
      Util.waitUntilAllDone(2000)
      Util.getWebHookActor(hookId) shouldBe None
  }

  it("removes the processor for removed web hooks") { param =>
    Util.getWebHookActor(hookId) shouldBe None

    val hook = WebHook(
      id = Some(hookId),
      userId = None,
      name = "abc",
      active = true,
      lastEvent = None,
      url = "http://example.com/foo",
      eventTypes = Set(EventType.CreateRecord),
      isWaitingForResponse = None,
      config = WebHookConfig(
        optionalAspects = Some(List("aspect")),
        includeEvents = Some(true),
        includeRecords = Some(true),
        includeAspectDefinitions = Some(true),
        dereference = Some(true)
      )
    )

    param.asAdmin(Post("/v0/hooks", hook)) ~> param.api(Full).routes ~> check {
      status shouldEqual StatusCodes.OK
      responseAs[WebHook].enabled shouldBe true
    }

    Util.waitUntilWebHookActorIsInCache(hookId)
    Util.getWebHookActor(hookId) should not be None

    Util.waitUntilAllDone(minWaitTimeMs = 2000)

    case class DeleteProcessor(deleted: Boolean)
    implicit val DeleteProcessorFormat: RootJsonFormat[DeleteProcessor] =
      jsonFormat1(DeleteProcessor.apply)
    param.asAdmin(Delete(s"/v0/hooks/$hookId")) ~> param
      .api(Full)
      .routes ~> check {
      status shouldEqual StatusCodes.OK
      responseAs[DeleteProcessor].deleted shouldBe true
    }

    Util.waitUntilWebHookActorIsNotInCache(hookId)

    // For debugging only.
    // When a processor needs to be deleted, it will receive a PoisonPill message from its parent,
    // WebHookActor, that will print a debug message similar to "*** WebHookActor will terminate
    // actor 42554220." in the log. Once the processor is terminated, the system will send a
    // Terminated message to WebHookActor and the WebHookActor will print a debug message similar to
    // "*** Actor 42554220 has been terminated." in the log.
    // The line below will ensure the above debug message is shown in the log for this test.
    Util.waitUntilAllDone(minWaitTimeMs = 2000)

    Util.getWebHookActor(hookId) shouldBe None
  }
}
