package au.csiro.data61.magda.opa

import akka.actor.ActorSystem
import akka.event.Logging
import akka.stream.ActorMaterializer
import au.csiro.data61.magda.test.MockServer
import au.csiro.data61.magda.test.util.TestActorSystem
import com.sksamuel.elastic4s.searches.queries.matches.MatchQuery
import com.sksamuel.elastic4s.searches.queries.term.TermQuery
import com.sksamuel.elastic4s.searches.queries.{BoolQuery, Query}
import com.typesafe.config.ConfigValueFactory
import org.mockserver.client.MockServerClient
import org.mockserver.model.{
  HttpRequest => MockRequest,
  HttpResponse => MockResponse
}
import org.scalatest.concurrent.ScalaFutures._
import org.scalatest.{FunSpec, Matchers}

import scala.concurrent.duration._

class DatasetRuleParsingSpec extends FunSpec with Matchers with MockServer {

  implicit val config = TestActorSystem.config
    .withValue(
      "opa.testSessionId",
      ConfigValueFactory.fromAnyRef("DatasetRuleParsingSpec")
    )
    .withValue(
      "opa.baseUrl",
      ConfigValueFactory
        .fromAnyRef(s"http://localhost:${mockServer.getLocalPort}/v0/opa/")
    )

  implicit val system = ActorSystem("DatasetRuleParsingSpec", config)
  implicit val logger = Logging(system, getClass)

  implicit val executor = system.dispatcher
  implicit val materializer = ActorMaterializer()
  implicit val patienceConfig = PatienceConfig(30.second)

  describe("Sample OPA response") {

    // --- set Opa response
    createExpections()

    it("Should be parsed with no any issues") {
      val opaQueryer =
        new au.csiro.data61.magda.search.elasticsearch.OpaQueryer()
      whenReady(opaQueryer.publishingStateQuery(Set(), Some(""))) { q =>
        opaQueryer.hasErrors shouldBe false

        val should = getShouldFromBoolQuery(q)
        should.size shouldBe 8
        getMinMatchFromBoolQuery(q).isEmpty shouldBe false
        getMinMatchFromBoolQuery(q).get shouldBe "1"
        getMustFromBoolQuery(q).size shouldBe 0
        getNotFromBoolQuery(q).size shouldBe 0

        // --- test unconditional permission for draft dataset
        getMustFromBoolQuery(should(0)).size shouldBe 1
        getMustFromBoolQuery(should(0))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getShouldFromBoolQuery(should(0)).size shouldBe 0
        getNotFromBoolQuery(should(0)).size shouldBe 0
        getMinMatchFromBoolQuery(should(0)) shouldBe None

        // --- test unconditional permission for published dataset
        getMustFromBoolQuery(should(1)).size shouldBe 1
        getMustFromBoolQuery(should(1))(0) shouldBe TermQuery(
          "publishingState",
          "published"
        )
        getShouldFromBoolQuery(should(1)).size shouldBe 0
        getNotFromBoolQuery(should(1)).size shouldBe 0
        getMinMatchFromBoolQuery(should(1)) shouldBe None

        // --- test draft dataset permission with ownership constraint
        getMustFromBoolQuery(should(2)).size shouldBe 2
        getMustFromBoolQuery(should(2))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(2))(1) shouldBe TermQuery(
          "accessControl.ownerId",
          "eeb0b93d-580e-4238-8322-8fbff88f9d47"
        )
        getShouldFromBoolQuery(should(2)).size shouldBe 0
        getNotFromBoolQuery(should(2)).size shouldBe 0
        getMinMatchFromBoolQuery(should(2)) shouldBe None

        // --- test draft dataset permission with organisation ownership constraint
        // --- TODO: can improve the parse by merge multiple TermQuery into one TermsQuery
        getMustFromBoolQuery(should(3)).size shouldBe 2
        getMustFromBoolQuery(should(3))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(3))(1) shouldBe TermQuery(
          "accessControl.orgUnitOwnerId",
          "OU01"
        )
        getShouldFromBoolQuery(should(3)).size shouldBe 0
        getNotFromBoolQuery(should(3)).size shouldBe 0
        getMinMatchFromBoolQuery(should(3)) shouldBe None

        getMustFromBoolQuery(should(4)).size shouldBe 2
        getMustFromBoolQuery(should(4))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(4))(1) shouldBe TermQuery(
          "accessControl.orgUnitOwnerId",
          "OU03"
        )
        getShouldFromBoolQuery(should(4)).size shouldBe 0
        getNotFromBoolQuery(should(4)).size shouldBe 0
        getMinMatchFromBoolQuery(should(4)) shouldBe None

        getMustFromBoolQuery(should(5)).size shouldBe 2
        getMustFromBoolQuery(should(5))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(5))(1) shouldBe TermQuery(
          "accessControl.orgUnitOwnerId",
          "OU04"
        )
        getShouldFromBoolQuery(should(5)).size shouldBe 0
        getNotFromBoolQuery(should(5)).size shouldBe 0
        getMinMatchFromBoolQuery(should(5)) shouldBe None

        // --- test draft dataset permission with pre-authorisation constraint
        // --- Elastic field support Array structure natively
        // --- dataset.accessControl.preAuthorisedPermissionIds needs to be a keyword field
        getMustFromBoolQuery(should(6)).size shouldBe 2
        getMustFromBoolQuery(should(6))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(6))(1) shouldBe MatchQuery(
          "accessControl.preAuthorisedPermissionIds",
          "57cbbfad-5755-4b19-989e-7d76ae37ee70"
        )
        getShouldFromBoolQuery(should(6)).size shouldBe 0
        getNotFromBoolQuery(should(6)).size shouldBe 0
        getMinMatchFromBoolQuery(should(6)) shouldBe None

        getMustFromBoolQuery(should(7)).size shouldBe 2
        getMustFromBoolQuery(should(7))(0) shouldBe TermQuery(
          "publishingState",
          "draft"
        )
        getMustFromBoolQuery(should(7))(1) shouldBe MatchQuery(
          "accessControl.preAuthorisedPermissionIds",
          "79d71b9e-ea5c-4e07-bb5b-4e86704f9883"
        )
        getShouldFromBoolQuery(should(7)).size shouldBe 0
        getNotFromBoolQuery(should(7)).size shouldBe 0
        getMinMatchFromBoolQuery(should(7)) shouldBe None

      }
    }
  }

  def destructBoolQuery(
      q: Query
  ): Tuple4[Seq[Query], Seq[Query], Seq[Query], Option[String]] = q match {
    case BoolQuery(
        adjustPureNegative: Option[Boolean],
        boost: Option[Double],
        minimumShouldMatch: Option[String],
        queryName: Option[String],
        filters: Seq[Query],
        must: Seq[Query],
        not: Seq[Query],
        should: Seq[Query]
        ) =>
      (must, should, not, minimumShouldMatch)
    case _ => throw new Error("Failed to match BoolQuery")
  }

  def getShouldFromBoolQuery(q: Query): Seq[Query] = {
    destructBoolQuery(q)._2
  }

  def getMustFromBoolQuery(q: Query): Seq[Query] = {
    destructBoolQuery(q)._1
  }

  def getNotFromBoolQuery(q: Query): Seq[Query] = {
    destructBoolQuery(q)._3
  }

  def getMinMatchFromBoolQuery(q: Query): Option[String] = {
    destructBoolQuery(q)._4
  }

  def createExpections(): Unit = {

    new MockServerClient("localhost", mockServer.getLocalPort)
      .when(
        MockRequest
          .request()
          .withHeader("content-type", "application/json")
          .withHeader("x-test-session-id", "DatasetRuleParsingSpec")
          .withPath("/v0/opa/compile")
      )
      .respond(
        MockResponse
          .response()
          .withStatusCode(200)
          //--- always allow response
          .withBody(
            """{
              |  "result": {
              |    "queries": [
              |      [
              |        {
              |          "index": 0,
              |          "terms": {
              |            "type": "ref",
              |            "value": [
              |              {
              |                "type": "var",
              |                "value": "data"
              |              },
              |              {
              |                "type": "string",
              |                "value": "partial"
              |              },
              |              {
              |                "type": "string",
              |                "value": "object"
              |              },
              |              {
              |                "type": "string",
              |                "value": "dataset"
              |              },
              |              {
              |                "type": "string",
              |                "value": "allow"
              |              }
              |            ]
              |          }
              |        }
              |      ]
              |    ],
              |    "support": [
              |      {
              |        "package": {
              |          "path": [
              |            {
              |              "type": "var",
              |              "value": "data"
              |            },
              |            {
              |              "type": "string",
              |              "value": "partial"
              |            },
              |            {
              |              "type": "string",
              |              "value": "object"
              |            },
              |            {
              |              "type": "string",
              |              "value": "dataset"
              |            }
              |          ]
              |        },
              |        "rules": [
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "published"
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "eeb0b93d-580e-4238-8322-8fbff88f9d47"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "ownerId"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "OU01"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "orgUnitOwnerId"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "OU03"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "orgUnitOwnerId"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "OU04"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "orgUnitOwnerId"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "57cbbfad-5755-4b19-989e-7d76ae37ee70"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "preAuthorisedPermissionIds"
              |                      },
              |                      {
              |                        "type": "var",
              |                        "value": "$11"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": true
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "publishingState"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "draft"
              |                  }
              |                ]
              |              },
              |              {
              |                "index": 1,
              |                "terms": [
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "eq"
              |                      }
              |                    ]
              |                  },
              |                  {
              |                    "type": "string",
              |                    "value": "79d71b9e-ea5c-4e07-bb5b-4e86704f9883"
              |                  },
              |                  {
              |                    "type": "ref",
              |                    "value": [
              |                      {
              |                        "type": "var",
              |                        "value": "input"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "object"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "dataset"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "accessControl"
              |                      },
              |                      {
              |                        "type": "string",
              |                        "value": "preAuthorisedPermissionIds"
              |                      },
              |                      {
              |                        "type": "var",
              |                        "value": "$11"
              |                      }
              |                    ]
              |                  }
              |                ]
              |              }
              |            ]
              |          },
              |          {
              |            "default": true,
              |            "head": {
              |              "name": "allow",
              |              "value": {
              |                "type": "boolean",
              |                "value": false
              |              }
              |            },
              |            "body": [
              |              {
              |                "index": 0,
              |                "terms": {
              |                  "type": "boolean",
              |                  "value": true
              |                }
              |              }
              |            ]
              |          }
              |        ]
              |      }
              |    ]
              |  }
              |}""".stripMargin
          )
      )
  }

}
