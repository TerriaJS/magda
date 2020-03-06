package au.csiro.data61.magda.registry

import akka.http.scaladsl.model.StatusCodes
import au.csiro.data61.magda.model.Registry._
import gnieh.diffson._
import gnieh.diffson.sprayJson._
import scalikejdbc._
import spray.json._

class AspectsServiceMultiTenantSpec extends ApiSpec {

  describe("with role Full") {
    readOnlyTests(Full)
    writeTests(Full)
  }

  describe("with role ReadOnly") {
    readOnlyTests(ReadOnly)
  }

  routesShouldBeNonExistentWithRole(
    ReadOnly,
    List(
      ("POST", Post.apply, "/v0/aspects"),
      ("PUT", Put.apply, "/v0/aspects/1"),
      ("PATCH", Patch.apply, "/v0/aspects/1")
    )
  )

  def readOnlyTests(role: Role) {
    describe("GET") {
      it("starts with no aspects defined") { param =>
        Get("/v0/aspects") ~> addTenantIdHeader(TENANT_1) ~> param
          .api(role)
          .routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[List[AspectDefinition]].length shouldEqual 0
        }
      }

      it("returns 404 if the given ID does not exist") { param =>
        Get("/v0/aspects/foo") ~> addTenantIdHeader(TENANT_1) ~> param
          .api(role)
          .routes ~> check {
          status shouldEqual StatusCodes.NotFound
          responseAs[ApiError].message should include("exist")
        }
      }
    }
  }

  def writeTests(role: Role) {
    describe("POST") {
      it("can add a new aspect definition") { param =>
        val aspectDefinition =
          AspectDefinition("testId", "testName", Some(JsObject()))
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[AspectDefinition] shouldEqual aspectDefinition
        }

        Get("/v0/aspects") ~> addTenantIdHeader(TENANT_1) ~>
          param
            .api(role)
            .routes ~> check {
          status shouldEqual StatusCodes.OK

          val aspectDefinitions = responseAs[List[AspectDefinition]]
          aspectDefinitions.length shouldEqual 1
          aspectDefinitions.head shouldEqual aspectDefinition
        }

        Get("/v0/aspects") ~> addTenantIdHeader(TENANT_2) ~> param
          .api(role)
          .routes ~> check {
          status shouldEqual StatusCodes.OK

          val aspectDefinitions = responseAs[List[AspectDefinition]]
          aspectDefinitions.length shouldEqual 0
        }
      }

      it("supports invalid URL characters in ID") { param =>
        val aspectDefinition = AspectDefinition("in valid", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[AspectDefinition] shouldEqual aspectDefinition

          Get("/v0/aspects/in%20valid") ~> addTenantIdHeader(TENANT_1) ~> param
            .api(role)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual aspectDefinition
          }
        }
      }

      it("returns 400 if an aspect definition with the given ID already exists") {
        param =>
          val aspectDefinition = AspectDefinition("testId", "testName", None)
          param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual aspectDefinition

            param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(role).routes ~> check {
              status shouldEqual StatusCodes.BadRequest
              responseAs[ApiError].message should include("already exists")
            }
          }
      }

      checkMustBeAdmin(role) {
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        Post("/v0/aspects", aspectDefinition) ~> addTenantIdHeader(TENANT_1)
      }
    }

    describe("PUT") {
      it("can add a new aspect definition") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Put("/v0/aspects/testId", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[AspectDefinition] shouldEqual aspectDefinition

          Get("/v0/aspects") ~> addTenantIdHeader(TENANT_1) ~> param
            .api(role)
            .routes ~> check {
            status shouldEqual StatusCodes.OK

            val aspectDefinitions = responseAs[List[AspectDefinition]]
            aspectDefinitions.length shouldEqual 1
            aspectDefinitions.head shouldEqual aspectDefinition
          }
        }
      }

      it("can update an existing aspect definition") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val newDefinition = aspectDefinition.copy(name = "newName")
          param.asAdmin(Put("/v0/aspects/testId", newDefinition)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual newDefinition
          }
        }
      }

      it("cannot change the ID of an existing aspect definition") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Put("/v0/aspects/testId", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[AspectDefinition] shouldEqual aspectDefinition

          val updated = aspectDefinition.copy(id = "foo")
          param.asAdmin(Put("/v0/aspects/testId", updated)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.BadRequest
            responseAs[ApiError].message should include("ID")
          }
        }
      }

      it("supports invalid URL characters in ID") { param =>
        val aspectDefinition = AspectDefinition("in valid", "testName", None)
        param.asAdmin(Put("/v0/aspects/in%20valid", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          status shouldEqual StatusCodes.OK
          responseAs[AspectDefinition] shouldEqual aspectDefinition

          Get("/v0/aspects/in%20valid") ~> addTenantIdHeader(TENANT_1) ~> param
            .api(role)
            .routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual aspectDefinition
          }
        }
      }

      it("can add a schema") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val updated = aspectDefinition.copy(jsonSchema = Some(JsObject()))
          param.asAdmin(Put("/v0/aspects/testId", updated)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual updated
          }
        }
      }

      it("can modify a schema") { param =>
        val aspectDefinition = AspectDefinition(
          "testId",
          "testName",
          Some(JsObject("foo" -> JsString("bar")))
        )
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val updated = aspectDefinition.copy(
            jsonSchema = Some(JsObject("foo" -> JsString("baz")))
          )
          param.asAdmin(Put("/v0/aspects/testId", updated)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual updated
          }
        }
      }

      checkMustBeAdmin(role) {
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        Put("/v0/aspects/testId", aspectDefinition)
      }
    }

    describe("PATCH") {
      it("returns an error when the aspect definition does not exist") {
        param =>
          val patch = JsonPatch()
          param.asAdmin(Patch("/v0/aspects/doesnotexist", patch)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.BadRequest
            responseAs[ApiError].message should include("exists")
            responseAs[ApiError].message should include("ID")
          }
      }

      it("can modify an aspect's name") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val patch = JsonPatch(Replace(Pointer.root / "name", JsString("foo")))
          param.asAdmin(Patch("/v0/aspects/testId", patch)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual AspectDefinition(
              "testId",
              "foo",
              None
            )
          }
        }
      }

      it("cannot modify an aspect's ID") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val patch = JsonPatch(Replace(Pointer.root / "id", JsString("foo")))
          param.asAdmin(Patch("/v0/aspects/testId", patch)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.BadRequest
            responseAs[ApiError].message should include("ID")
          }
        }
      }

      it("can add a schema") { param =>
        val aspectDefinition = AspectDefinition("testId", "testName", None)
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val patch = JsonPatch(Add(Pointer.root / "jsonSchema", JsObject()))
          param.asAdmin(Patch("/v0/aspects/testId", patch)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual AspectDefinition(
              "testId",
              "testName",
              Some(JsObject())
            )
          }
        }
      }

      it("can modify a schema") { param =>
        val aspectDefinition = AspectDefinition(
          "testId",
          "testName",
          Some(JsObject("foo" -> JsString("bar")))
        )
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          val patch = JsonPatch(
            Replace(Pointer.root / "jsonSchema" / "foo", JsString("baz"))
          )
          param.asAdmin(Patch("/v0/aspects/testId", patch)) ~> addTenantIdHeader(
            TENANT_1
          ) ~> param.api(role).routes ~> check {
            status shouldEqual StatusCodes.OK
            responseAs[AspectDefinition] shouldEqual AspectDefinition(
              "testId",
              "testName",
              Some(JsObject("foo" -> JsString("baz")))
            )
          }
        }
      }

      def getLastAspectEventId(
          implicit session: DBSession,
          aspectId: String
      ): Option[Long] = {
        sql"""SELECT e.eventId
          FROM events e
          LEFT JOIN aspects a ON a.lastUpdate = e.eventId
          WHERE a.aspectId=$aspectId
          ORDER BY e.eventId DESC
          LIMIT 1""".map(rs => rs.long("eventId")).headOption().apply()
      }

      it("Only create event if patch makes difference") { param =>
        val aspectDefinition = AspectDefinition(
          "testId",
          "testName",
          Some(JsObject("foo" -> JsString("bar")))
        )
        param.asAdmin(Post("/v0/aspects", aspectDefinition)) ~> addTenantIdHeader(
          TENANT_1
        ) ~> param.api(role).routes ~> check {
          DB readOnly { implicit session =>
            val lastEventIdBeforePatch: Option[Long] =
              getLastAspectEventId(session, "testId")
            lastEventIdBeforePatch should not be None
            val patch =
              JsonPatch( //--- useless Patch change to baz and then change it back
                Replace(Pointer.root / "jsonSchema" / "foo", JsString("baz")),
                Replace(Pointer.root / "jsonSchema" / "foo", JsString("bar"))
              )
            param.asAdmin(Patch("/v0/aspects/testId", patch)) ~> addTenantIdHeader(
              TENANT_1
            ) ~> param.api(role).routes ~> check {
              status shouldEqual StatusCodes.OK
              val lastEventIdAfterPatch: Option[Long] =
                getLastAspectEventId(session, "testId")
              lastEventIdAfterPatch shouldEqual lastEventIdBeforePatch
              responseAs[AspectDefinition] shouldEqual AspectDefinition(
                "testId",
                "testName",
                Some(JsObject("foo" -> JsString("bar")))
              )
            }
          }
        }
      }

      checkMustBeAdmin(role) {
        val patch = JsonPatch(Replace(Pointer.root / "name", JsString("foo")))
        Patch("/v0/aspects/testId", patch) ~> addTenantIdHeader(TENANT_1)
      }
    }
  }
}
