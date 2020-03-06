package au.csiro.data61.magda.registry

import akka.event.LoggingAdapter
import akka.http.scaladsl.model.StatusCodes
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.TenantId._
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

class WithDefaultPolicyRecordsServiceAuthSpec
    extends BaseRecordsServiceAuthSpec {
  override def testConfigSource =
    s"""
       |db.default.url = "${databaseUrl}?currentSchema=test"
       |authorization.skip = false
       |authorization.skipOpaQuery = false
       |opa.recordPolicyId = "default.policy"
    """.stripMargin

  describe("with default policy set") {
    describe("GET") {
      describe("for a single record") {
        describe("with no policy set on the record") {
          it(
            "allows access to an aspect-less record if default policy resolves to unconditionally allow access"
          ) { param =>
            val recordId = "foo"
            addRecord(param, Record(recordId, "foo", Map()))
            expectOpaQueryForPolicy(param, "default.policy.read", """{
            "result": {
                "queries": []
            }
          }""")

            Get(s"/v0/records/foo") ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.OK
              val resRecord = responseAs[Record]

              resRecord.id shouldBe "foo"
              resRecord.authnReadPolicyId shouldBe None
            }
          }

          it(
            "disallows access to an aspect-less record if default policy resolves to unconditionally disallow access"
          ) { param =>
            val recordId = "foo"

            addRecord(param, Record(recordId, "foo", Map()))
            expectOpaQueryForPolicy(param, "default.policy.read", """{
            "result": {}
          }""")

            Get(s"/v0/records/foo") ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(Full).routes ~> check {
              status shouldEqual StatusCodes.NotFound
            }
          }

          describe("based on the value in an aspect") {
            it(
              "allows access to an record if policy resolves true"
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
                  )
                )
              )

              expectOpaQueryForPolicy(
                param,
                "default.policy.read",
                policyResponseForStringExampleAspect
              )

              Get(s"/v0/records/foo") ~> addTenantIdHeader(
                TENANT_1
              ) ~> param.api(Full).routes ~> check {
                status shouldEqual StatusCodes.OK
              }
            }

            it(
              "denies access to an record if policy resolves false"
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
                  )
                )
              )
              expectOpaQueryForPolicy(
                param,
                "default.policy.read",
                policyResponseForStringExampleAspect
              )

              Get(s"/v0/records/foo") ~> addTenantIdHeader(
                TENANT_1
              ) ~> param.api(Full).routes ~> check {
                status shouldEqual StatusCodes.NotFound
              }
            }

            it(
              "denies access to an record if required aspect is not present"
            ) { param =>
              addExampleAspectDef(param)
              val recordId = "foo"
              addRecord(
                param,
                Record(
                  recordId,
                  "foo",
                  Map()
                )
              )
              expectOpaQueryForPolicy(
                param,
                "default.policy.read",
                policyResponseForStringExampleAspect
              )

              Get(s"/v0/records/foo") ~> addTenantIdHeader(
                TENANT_1
              ) ~> param.api(Full).routes ~> check {
                status shouldEqual StatusCodes.NotFound
              }
            }
          }
        }

        commonTests()
      }
    }
  }
}
