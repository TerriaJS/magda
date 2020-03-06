package au.csiro.data61.magda.test.opa

import akka.event.Logging
import au.csiro.data61.magda.test.util.TestActorSystem
import org.mockserver.client.MockServerClient
import org.mockserver.integration.ClientAndServer
import org.scalatest._
import org.mockserver.model.{HttpRequest, HttpResponse}

trait ResponseDatasetAllowAll extends BeforeAndAfterAll { this: Suite =>

  val mockServer: ClientAndServer

  override def beforeAll() {
    super.beforeAll()
    val logger = Logging(TestActorSystem.actorSystem, getClass)
    logger.info("Setting up mock server ResponseDatasetAllowAll...")
    createExpections()
  }

  private def createExpections(): Unit = {

    new MockServerClient("localhost", mockServer.getLocalPort)
      .when(
        HttpRequest
          .request()
          .withHeader("content-type", "application/json")
          .withHeader("x-test-session-id", "general-search-api-tests")
          .withPath("/v0/opa/compile")
      )
      .respond(
        HttpResponse
          .response()
          .withStatusCode(200)
          //--- always allow response
          .withBody("""{
                      |    "result": {
                      |        "queries": [
                      |            [
                      |                {
                      |                    "index": 0,
                      |                    "terms": {
                      |                        "type": "ref",
                      |                        "value": [
                      |                            {
                      |                                "type": "var",
                      |                                "value": "data"
                      |                            },
                      |                            {
                      |                                "type": "string",
                      |                                "value": "partial"
                      |                            },
                      |                            {
                      |                                "type": "string",
                      |                                "value": "object"
                      |                            },
                      |                            {
                      |                                "type": "string",
                      |                                "value": "dataset"
                      |                            },
                      |                            {
                      |                                "type": "string",
                      |                                "value": "allow"
                      |                            }
                      |                        ]
                      |                    }
                      |                }
                      |            ]
                      |        ],
                      |        "support": [
                      |            {
                      |                "package": {
                      |                    "path": [
                      |                        {
                      |                            "type": "var",
                      |                            "value": "data"
                      |                        },
                      |                        {
                      |                            "type": "string",
                      |                            "value": "partial"
                      |                        },
                      |                        {
                      |                            "type": "string",
                      |                            "value": "object"
                      |                        },
                      |                        {
                      |                            "type": "string",
                      |                            "value": "dataset"
                      |                        }
                      |                    ]
                      |                },
                      |                "rules": [
                      |                    {
                      |                        "default": true,
                      |                        "head": {
                      |                            "name": "allow",
                      |                            "value": {
                      |                                "type": "boolean",
                      |                                "value": true
                      |                            }
                      |                        },
                      |                        "body": [
                      |                            {
                      |                                "index": 0,
                      |                                "terms": {
                      |                                    "type": "boolean",
                      |                                    "value": true
                      |                                }
                      |                            }
                      |                        ]
                      |                    }
                      |                ]
                      |            }
                      |        ]
                      |    }
                      |}""".stripMargin)
      )
  }

}
