package au.csiro.data61.magda.registry

import akka.event.LoggingAdapter
import akka.http.scaladsl.model.StatusCodes
import gnieh.diffson._
import gnieh.diffson.sprayJson._
import scalikejdbc.DBSession
import spray.json._
import akka.http.scaladsl.marshalling.Marshal

import scala.util.Success
import akka.http.scaladsl.model.HttpHeader
import akka.http.scaladsl.model.HttpResponse
import scala.concurrent.Future
import akka.http.scaladsl.model.HttpEntity
import akka.http.scaladsl.model.ResponseEntity
import akka.http.scaladsl.model.ContentTypes
import akka.http.scaladsl.marshalling.ToEntityMarshaller
import au.csiro.data61.magda.model.Registry._
import akka.http.scaladsl.model.StatusCode

abstract class BaseRecordsServiceAuthSpec extends ApiSpec {

  def commonTests() = {

    describe("with a policy set on the record") {
      it(
        "allows access to an aspect-less record if default policy resolves to unconditionally allow access"
      ) { param =>
        val recordId = "foo"
        addRecord(
          param,
          Record(
            recordId,
            "foo",
            Map(),
            authnReadPolicyId = Some("not.default.policyid")
          )
        )
        expectOpaQueryForPolicy(
          param,
          "not.default.policyid.read",
          """{
            "result": {
                "queries": []
            }
          }"""
        )

        Get(s"/v0/records/foo") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
          val resRecord = responseAs[Record]

          resRecord.id shouldBe "foo"
          resRecord.authnReadPolicyId shouldBe Some("not.default.policyid")
        }
      }

      it(
        "disallows access to an aspect-less record if default policy resolves to unconditionally disallow access"
      ) { param =>
        val recordId = "foo"

        addRecord(
          param,
          Record(
            recordId,
            "foo",
            Map(),
            authnReadPolicyId = Some("not.default.policyid")
          )
        )
        expectOpaQueryForPolicy(param, "not.default.policyid.read", """{
            "result": {}
          }""")

        Get(s"/v0/records/foo") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.NotFound
        }
      }

      it(
        "allows access to an record if specific policy resolves to allow"
      ) { param =>
        addExampleAspectDef(param)
        val recordId = "foo"
        addRecord(
          param,
          Record(
            recordId,
            "foo",
            Map(
              "stringExample" -> JsObject(
                "nested" -> JsObject("public" -> JsString("true"))
              )
            ),
            authnReadPolicyId = Some("not.default.policyid")
          )
        )

        expectOpaQueryForPolicy(
          param,
          "not.default.policyid.read",
          policyResponseForStringExampleAspect
        )

        Get(s"/v0/records/foo") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }
      }

      it(
        "does not allow access to an record if specific policy resolves to refuse"
      ) { param =>
        addExampleAspectDef(param)
        val recordId = "foo"
        addRecord(
          param,
          Record(
            recordId,
            "foo",
            Map(
              "stringExample" -> JsObject(
                "nested" -> JsObject("public" -> JsString("false"))
              )
            ),
            authnReadPolicyId = Some("not.default.policyid")
          )
        )

        expectOpaQueryForPolicy(
          param,
          "not.default.policyid.read",
          policyResponseForStringExampleAspect
        )

        Get(s"/v0/records/foo") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.NotFound
        }
      }
    }

    describe("policies successfully allow and deny for") {
      it("a string-based policy") { param =>
        doPolicyTest(
          param,
          "stringExample",
          addStringExampleRecords,
          policyResponseForStringExampleAspect
        )
      }

      it("a boolean-based policy") { param =>
        doPolicyTest(
          param,
          "booleanExample",
          addBooleanExampleRecords,
          policyResponseForBooleanExampleAspect
        )
      }

      it("a numeric-based policy") { param =>
        doPolicyTest(
          param,
          "numericExample",
          addNumericExampleRecords,
          policyResponseForNumericExampleAspect
        )
      }

      it("a policy that tests for the existence of an aspect") { param =>
        doPolicyTest(
          param,
          "aspectExistenceExample",
          addAspectExistenceExampleRecords,
          policyResponseForAspectExistenceExampleAspect
        )
      }

      it("a policy that tests for the existence of a field within an aspect") {
        param =>
          doPolicyTest(
            param,
            "existenceExample",
            addExistenceExampleRecords,
            policyResponseForExistenceExampleAspect
          )
      }

      def doPolicyTest(
          param: FixtureParam,
          exampleId: String,
          addRecords: FixtureParam => Unit,
          policyResponse: String
      ) = {
        val PascalCaseId = exampleId.charAt(0).toUpper + exampleId.substring(1)
        val camelCaseId = exampleId.charAt(0).toLower + exampleId.substring(1)

        addAspectDef(param, camelCaseId)
        addRecords(param)

        expectOpaQueryForPolicy(
          param,
          s"$camelCaseId.policy.read",
          policyResponse
        ).twice()

        Get(s"/v0/records/allow$PascalCaseId") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.OK
        }

        Get(s"/v0/records/deny$PascalCaseId") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.NotFound
        }
      }
    }

    it("if OPA responds with an error, registry should respond with an error") {
      param =>
        addExampleAspectDef(param)
        val recordId = "foo"
        addRecord(
          param,
          Record(
            recordId,
            "foo",
            Map(
              "stringExample" -> JsObject(
                "nested" -> JsObject("public" -> JsString("true"))
              )
            ),
            authnReadPolicyId = Some("not.default.policyid")
          )
        )

        expectOpaQueryForPolicy(
          param,
          "not.default.policyid.read",
          "ERROR: Not found",
          StatusCodes.InternalServerError
        )

        Get(s"/v0/records/foo") ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(Full).routes ~> check {
          status shouldEqual StatusCodes.InternalServerError
        }

    }
  }

  def addExampleAspectDef(param: FixtureParam) =
    addAspectDef(param, "stringExample")

  def addAspectDef(param: FixtureParam, id: String) =
    param.asAdmin(
      Post(
        "/v0/aspects",
        AspectDefinition(
          id,
          id,
          None
        )
      )
    ) ~> addTenantIdHeader(
      TENANT_1
    ) ~> param
      .api(Full)
      .routes ~> check {
      status shouldEqual StatusCodes.OK
    }

  def expectOpaQueryForPolicy(
      param: FixtureParam,
      policyId: String,
      response: String,
      statusCode: StatusCode = StatusCodes.OK
  ) =
    (param.authFetcher
      .post(
        _: String,
        _: HttpEntity.Strict,
        _: List[HttpHeader]
      )(
        _: ToEntityMarshaller[HttpEntity.Strict]
      ))
      .expects(
        "/v0/opa/compile",
        HttpEntity(
          ContentTypes.`application/json`,
          s"""{
             |  "query": "data.$policyId",
             |  "unknowns": ["input.object"]
             |}""".stripMargin
        ),
        *,
        *
      )
      .returning(
        Marshal(response)
          .to[ResponseEntity]
          .map(
            HttpResponse(
              statusCode,
              Nil,
              _
            )
          )
      )

  def addRecord(param: FixtureParam, record: Record) {
    param.asAdmin(Post("/v0/records", record)) ~> addTenantIdHeader(
      TENANT_1
    ) ~> param.api(Full).routes ~> check {
      if (status !== StatusCodes.OK) {
        println(response.entity.toString())
      }
      status shouldEqual StatusCodes.OK
    }
  }

  def addStringExampleRecords(param: FixtureParam) {
    addRecord(
      param,
      Record(
        "allowStringExample",
        "allowStringExample",
        Map(
          "stringExample" -> JsObject(
            "nested" -> JsObject("public" -> JsString("true"))
          )
        ),
        authnReadPolicyId = Some("stringExample.policy")
      )
    )
    addRecord(
      param,
      Record(
        "denyStringExample",
        "denyStringExample",
        Map(
          "stringExample" -> JsObject(
            "nested" -> JsObject("public" -> JsString("false"))
          )
        ),
        authnReadPolicyId = Some("stringExample.policy")
      )
    )
  }

  def addNumericExampleRecords(param: FixtureParam) {
    addRecord(
      param,
      Record(
        "allowNumericExample",
        "allowNumericExample",
        Map(
          "numericExample" -> JsObject(
            "number" ->
              JsNumber(-1)
          )
        ),
        authnReadPolicyId = Some("numericExample.policy")
      )
    )
    addRecord(
      param,
      Record(
        "denyNumericExample",
        "denyNumericExample",
        Map(
          "numericExample" -> JsObject(
            "number" ->
              JsNumber(2)
          )
        ),
        authnReadPolicyId = Some("numericExample.policy")
      )
    )
  }

  def addBooleanExampleRecords(param: FixtureParam) {
    addRecord(
      param,
      Record(
        "allowBooleanExample",
        "allowBooleanExample",
        Map(
          "booleanExample" -> JsObject(
            "boolean" ->
              JsTrue
          )
        ),
        authnReadPolicyId = Some("booleanExample.policy")
      )
    )
    addRecord(
      param,
      Record(
        "denyBooleanExample",
        "denyBooleanExample",
        Map(
          "booleanExample" -> JsObject(
            "boolean" ->
              JsFalse
          )
        ),
        authnReadPolicyId = Some("booleanExample.policy")
      )
    )
  }

  def addAspectExistenceExampleRecords(param: FixtureParam) {
    addRecord(
      param,
      Record(
        "allowAspectExistenceExample",
        "allowAspectExistenceExample",
        Map(
          "aspectExistenceExample" -> JsObject(
            )
        ),
        authnReadPolicyId = Some("aspectExistenceExample.policy")
      )
    )
    addRecord(
      param,
      Record(
        "denyAspectExistenceExample",
        "denyAspectExistenceExample",
        Map(
          ),
        authnReadPolicyId = Some("aspectExistenceExample.policy")
      )
    )
  }

  def addExistenceExampleRecords(param: FixtureParam) {
    addRecord(
      param,
      Record(
        "allowExistenceExample",
        "allowExistenceExample",
        Map(
          "existenceExample" -> JsObject(
            "value" -> JsObject()
          )
        ),
        authnReadPolicyId = Some("existenceExample.policy")
      )
    )
    addRecord(
      param,
      Record(
        "denyExistenceExample",
        "denyExistenceExample",
        Map(
          "existenceExample" -> JsObject()
        ),
        authnReadPolicyId = Some("existenceExample.policy")
      )
    )
  }

  val policyResponseForStringExampleAspect = """
      {
        "result": {
          "queries": [
            [
              {
                "index": 0,
                "terms": [
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "eq"
                      }
                    ]
                  },
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "input"
                      },
                      {
                        "type": "string",
                        "value": "object"
                      },
                      {
                        "type": "string",
                        "value": "registry"
                      },
                      {
                        "type": "string",
                        "value": "record"
                      },
                      {
                        "type": "string",
                        "value": "stringExample"
                      },
                      {
                        "type": "string",
                        "value": "nested"
                      },
                      {
                        "type": "string",
                        "value": "public"
                      }
                    ]
                  },
                  {
                    "type": "string",
                    "value": "true"
                  }
                ]
              }
            ]
          ]
        }
      }
  """

  val policyResponseForNumericExampleAspect = """
      {
        "result": {
          "queries": [
            [
              {
                "index": 0,
                "terms": [
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "lt"
                      }
                    ]
                  },
                  {
                    "type": "number",
                    "value": 0
                  },
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "input"
                      },
                      {
                        "type": "string",
                        "value": "object"
                      },
                      {
                        "type": "string",
                        "value": "registry"
                      },
                      {
                        "type": "string",
                        "value": "record"
                      },
                      {
                        "type": "string",
                        "value": "numericExample"
                      },
                      {
                        "type": "string",
                        "value": "number"
                      }
                    ]
                  }
                ]
              }
            ]
          ]
        }
      }
  """

  val policyResponseForBooleanExampleAspect = """
      {
        "result": {
          "queries": [
            [
              {
                "index": 0,
                "terms": [
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "eq"
                      }
                    ]
                  },
                  {
                    "type": "boolean",
                    "value": true
                  },
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "input"
                      },
                      {
                        "type": "string",
                        "value": "object"
                      },
                      {
                        "type": "string",
                        "value": "registry"
                      },
                      {
                        "type": "string",
                        "value": "record"
                      },
                      {
                        "type": "string",
                        "value": "booleanExample"
                      },
                      {
                        "type": "string",
                        "value": "boolean"
                      }
                    ]
                  }
                ]
              }
            ]
          ]
        }
      }
  """

  val policyResponseForAspectExistenceExampleAspect =
    """
      {
        "result": {
          "queries": [
            [
              {
                "index": 0,
                "terms": [
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "input"
                      },
                      {
                        "type": "string",
                        "value": "object"
                      },
                      {
                        "type": "string",
                        "value": "registry"
                      },
                      {
                        "type": "string",
                        "value": "record"
                      },
                      {
                        "type": "string",
                        "value": "aspectExistenceExample"
                      }
                    ]
                  }
                ]
              }
            ]
          ]
        }
      }
  """

  val policyResponseForExistenceExampleAspect = """
      {
        "result": {
          "queries": [
            [
              {
                "index": 0,
                "terms": [
                  {
                    "type": "ref",
                    "value": [
                      {
                        "type": "var",
                        "value": "input"
                      },
                      {
                        "type": "string",
                        "value": "object"
                      },
                      {
                        "type": "string",
                        "value": "registry"
                      },
                      {
                        "type": "string",
                        "value": "record"
                      },
                      {
                        "type": "string",
                        "value": "existenceExample"
                      },
                      {
                        "type": "string",
                        "value": "value"
                      }
                    ]
                  }
                ]
              }
            ]
          ]
        }
      }
  """

}
