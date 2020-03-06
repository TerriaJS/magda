package au.csiro.data61.magda.opa

import java.net.URL

import akka.pattern.gracefulStop
import akka.actor.{ActorRef, ActorSystem}
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.marshalling.ToEntityMarshaller
import akka.http.scaladsl.model.{HttpHeader, HttpResponse, StatusCodes}
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.testkit.{RouteTestTimeout, ScalatestRouteTest}
import au.csiro.data61.magda.Authentication
import au.csiro.data61.magda.client.{AuthApiClient, HttpFetcher, HttpFetcherImpl}
import au.csiro.data61.magda.model.Auth.AuthProtocols
import au.csiro.data61.magda.model.Registry.{AspectDefinition, MAGDA_TENANT_ID_HEADER, Record}
import au.csiro.data61.magda.registry._
import com.typesafe.config.Config
import org.scalamock.scalatest.MockFactory
import org.scalatest.{Matchers, Outcome, fixture}
import scalikejdbc._
import scalikejdbc.config.{DBs, EnvPrefix, TypesafeConfig, TypesafeConfigReader}
import spray.json.{JsObject, JsString, JsonParser}
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Serializer
import spray.json._

import scala.concurrent.{Await, Future}
import scala.concurrent.duration._
import scala.io.BufferedSource
import scala.io.Source.fromFile
import io.jsonwebtoken.SignatureAlgorithm
import java.{util => ju}

abstract class ApiWithOpa
    extends fixture.FunSpec
    with ScalatestRouteTest
    with Matchers
    with Protocols
    with SprayJsonSupport
    with MockFactory
    with AuthProtocols {
  override def testConfigSource: String =
    super.testConfigSource + s"""
                                |opa.recordPolicyId="object.registry.record.esri_owner_groups"
    """.stripMargin

  implicit def default(implicit system: ActorSystem): RouteTestTimeout =
    RouteTestTimeout(300 seconds)

  override def beforeAll(): Unit = {
    super.beforeAll()
  }

  override def withFixture(test: OneArgTest): Outcome = {
    case class DBsWithEnvSpecificConfig(configToUse: Config)
        extends DBs
        with TypesafeConfigReader
        with TypesafeConfig
        with EnvPrefix {

      override val config: Config = configToUse
    }

    DBsWithEnvSpecificConfig(testConfig).setupAll()

    val actor = system.actorOf(
      WebHookActor.props("http://localhost:6101/v0/")(testConfig)
    )
    val authClient =
      new RegistryAuthApiClient()(testConfig, system, executor, materializer)
    val api = (role: Role) =>
      new Api(
        if (role == Full) Some(actor) else None,
        authClient,
        testConfig,
        system,
        executor,
        materializer
      )

    try {
      super.withFixture(
        test.toNoArgTest(FixtureParam(api, actor, authClient, testConfig))
      )
    } finally {
      Await.result(gracefulStop(actor, 30 seconds), 30 seconds)
    }
  }

  case class FixtureParam(
      api: Role => Api,
      webHookActor: ActorRef,
      authClient: AuthApiClient,
      config: Config
  )

  def addTenantIdHeader(tenantId: BigInt): RawHeader = {
    RawHeader(MAGDA_TENANT_ID_HEADER, tenantId.toString)
  }

  def addJwtToken(userId: String): RawHeader = {
    if (userId.equals(anonymous))
      return RawHeader("", "")

    val jwtToken = Authentication.signToken(
      Jwts
        .builder()
        .claim("userId", userId),
      system.log
    )

    RawHeader(
      Authentication.headerName,
      jwtToken
    )
  }

  val httpFetcher: HttpFetcher = new HttpFetcherImpl(new URL("http://localhost:6104"))

  def updateExtraInput(extraInput: JsObject) = {
    val myHeaders: Seq[HttpHeader] = Seq(addJwtToken(adminUser))
    httpFetcher.post(path = s"/v0/private/opa/extra/input", headers = myHeaders, payload = extraInput)
  }

  val TENANT_0: BigInt = 0

  /**
    *                          Relationship among users, organizations and records
    *
    *   (1) If using the hierarchical organization based policy, a user's access privilege is based on the user's
    *       ID and orgUnitId.
    *
    *   (2) If using esri groups-based policy, a user's access privilege is based on the user's ID and groups.
    *       The testing users are assigned to some groups in such a way that their access privileges will be the
    *       same as in case (1).
    *
    *
    *
    *                +----------+
    *                |  Dep. A  |
    *                | userId0  |
    *                | record-0 |
    *                +----+-----+
    *                     |
    *            +--------+---------+
    *            |                  |
    *       +----+-----+       +----+-----+
    *       | Branch A |       | Branch B |
    *       | userId1  |  ref  | userId2  |
    *   +-->| record-1 | <-----| record-2 |      ref
    *   |   |          | <-----| record-5 |----------------+
    *   |   +----------+       +----+-----+                |
    *   |                           |                      |
    *   |              +-------------------------+         |
    *   |              |            |            |         |
    *   |         +----+----+  +----+----+  +----+-----+   |     +----------+
    *   |         |Section A|  |Section B|  |Section C |   |     | (Public) |
    *   |         |         |  |         |  | userId3  |   |     |          |
    *   |         |         |  +---------+  |          | <-+     |          |  (Section C owns record-4 but does
    *   |         +---------+   [empty] <---| record-3 | <-------| record-4 |   not put access restriction on it.)
    *   |                               ref +----------+     ref +----------+
    *   |                                                              | ref
    *   +--------------------------------------------------------------+
    *
    */
  val adminUser = "00000000-0000-1000-9999-000000000000"
  val userId0 = "00000000-0000-1000-0000-000000000000"
  val userId1 = "00000000-0000-1000-0001-000000000000"
  val userId2 = "00000000-0000-1000-0002-000000000000"
  val userId3 = "00000000-0000-1000-0003-000000000000"
  val anonymous = "anonymous"

  val userIdsAndExpectedRecordIdIndexesWithoutLink = List(
    (adminUser, List(0, 1, 2, 3, 4, 5)),
    (userId0, List(0, 1, 2, 3, 4, 5)),
    (userId1, List(1, 4)),
    (userId2, List(2, 3, 4, 5)),
    (userId3, List(3, 4)),
    (anonymous, List(4))
  )

  val userIdsAndExpectedRecordIdIndexesWithSingleLink = List(
    (adminUser, List(2)),
    (userId0, List(2)),
    (userId1, List()),
    (userId2, List(2)),
    (userId3, List()),
    (anonymous, List())
  )

  val singleLinkRecordIdMap: Map[String, String] = Map("record-2" -> "record-1")

  val recordOrgNames = List(
    "Dep. A",
    "Branch A, Dep. A",
    "Branch B, Dep. A",
    "Section C, Branch B, Dep. A",
    "Section C, Branch B, Dep. A",
    "Branch B, Dep. A"
  )

  val accessControlId = "dataset-access-control"
  val esriAccessControlId = "esri-access-control"
  val organizationId = "organization"
  val withLinkId = "withLink"
  val linkName = "someLink"
  val withLinksId = "withLinks"
  val linksName = "someLinks"

  val dataPath =
    "magda-registry-api/src/test/resources/data/"

  var hasAspectDefinitions = false

  def createAspectDefinitions(
      param: FixtureParam
  ): AnyVal = {
    if (hasAspectDefinitions)
      return

    val accessControlSchemaSource: BufferedSource = fromFile(
      "magda-registry-aspects/dataset-access-control.schema.json"
    )

    val esriAccessControlSchemaSource: BufferedSource = fromFile(
      "magda-registry-aspects/esri-access-control.schema.json"
    )

    val orgAspectSchemaSource: BufferedSource = fromFile(
      dataPath + "organization-schema.json"
    )

    val withLinkAspectSchemaSource: BufferedSource = fromFile(
      dataPath + "with-link-schema.json"
    )

    val withLinksAspectSchemaSource: BufferedSource = fromFile(
      dataPath + "with-links-schema.json"
    )

    val accessControlSchema: String =
      try {
        accessControlSchemaSource.mkString
      } finally {
        accessControlSchemaSource.close()
      }

    val esriAccessControlSchema: String =
      try {
        esriAccessControlSchemaSource.mkString
      } finally {
        esriAccessControlSchemaSource.close()
      }

    val orgAspectSchema: String =
      try {
        orgAspectSchemaSource.mkString
      } finally {
        orgAspectSchemaSource.close()
      }

    val withLinkAspectSchema: String =
      try {
        withLinkAspectSchemaSource.mkString
      } finally {
        withLinkAspectSchemaSource.close()
      }

    val withLinksAspectSchema: String =
      try {
        withLinksAspectSchemaSource.mkString
      } finally {
        withLinksAspectSchemaSource.close()
      }

    val accessControlDef = AspectDefinition(
      accessControlId,
      "access control aspect",
      Some(JsonParser(accessControlSchema).asJsObject)
    )

    val esriAccessControlDef = AspectDefinition(
      esriAccessControlId,
      "access control aspect",
      Some(JsonParser(esriAccessControlSchema).asJsObject)
    )

    val orgAspectDef = AspectDefinition(
      organizationId,
      "organization aspect",
      Some(JsonParser(orgAspectSchema).asJsObject)
    )

    val withLinkAspectDef = AspectDefinition(
      withLinkId,
      "with link aspect",
      Some(JsonParser(withLinkAspectSchema).asJsObject)
    )

    val withLinksAspectDef = AspectDefinition(
      withLinksId,
      "with links aspect",
      Some(JsonParser(withLinksAspectSchema).asJsObject)
    )

    val aspectDefs = List(
      accessControlDef,
      esriAccessControlDef,
      orgAspectDef,
      withLinkAspectDef,
      withLinksAspectDef
    )

    aspectDefs.map(aspectDef => {
      Get(s"/v0/aspects/${aspectDef.id}") ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        adminUser
      ) ~> param.api(Full).routes ~> check {
        if (status == StatusCodes.NotFound) {
          Post(s"/v0/aspects", aspectDef) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
            adminUser
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
          }
        }
      }
    })

    hasAspectDefinitions = true
  }

  def getTestRecords(file: String): List[Record] = {

    /** File that has the base json for records (this doesn't vary from test to test) */
    val baseFile = dataPath + "records.json"
    val baseRecordsSource = fromFile(baseFile)

    /** File that has extra information around access control for records (this is test-specific) */
    val recordsAccessControlSource = fromFile(file)

    val baseRecordsJsonStr = try {
      baseRecordsSource.mkString
    } finally {
      baseRecordsSource.close()
    }

    val baseRecords = JsonParser(baseRecordsJsonStr).convertTo[List[Record]]

    val recordsAccessControlAspectJsonStr = try {
      recordsAccessControlSource.mkString
    } finally {
      recordsAccessControlSource.close()
    }

    val accessControlAspects = JsonParser(recordsAccessControlAspectJsonStr)
      .convertTo[List[JsObject]]

    val recordAccessControlMap = accessControlAspects
      .map(each => {
        each.fields("id") -> each
      })
      .toMap

    baseRecords.map(record => {
      val accessControlValues = recordAccessControlMap.get(JsString(record.id))

      val authControlReadPolicy =
        accessControlValues.flatMap(_.fields.get("authnReadPolicyId"))

      val recordWithPolicy = authControlReadPolicy match {
        case Some(JsString(policy)) =>
          record.copy(authnReadPolicyId = Some(policy))
        case _ => record
      }

      val accessControlAspects =
        accessControlValues.flatMap(_.fields.get("aspects")).map(_.asJsObject)

      accessControlAspects match {
        case Some(aspects) =>
          val key = accessControlAspects.get.fields.keys.toList.head
          val keys = recordWithPolicy.aspects.keys.toList
          val theAspectList = keys
            .map(k => k -> recordWithPolicy.aspects(k)) :+ key -> accessControlAspects.get
            .fields(key)
            .asJsObject

          recordWithPolicy.copy(aspects = theAspectList.toMap)
        case None => recordWithPolicy
      }
    })
  }

  var testRecords: List[Record] = Nil

  var hasRecords = false

  def createRecords(param: FixtureParam): AnyVal = {
    DB localTx { implicit session =>
      sql"Delete from recordaspects".update
        .apply()
      sql"Delete from records".update
        .apply()
    }

    testRecords.foreach(record => {
      Get(s"/v0/records/${record.id}") ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        adminUser
      ) ~> param.api(Full).routes ~> check {
        if (status == StatusCodes.NotFound) {
          Post(s"/v0/records", record) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
            adminUser
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
          }
        }
      }
    })
  }

  lazy val singleLinkRecordIdMapDereferenceIsFalse
      : Map[(String, String), String] =
    Map(
      (adminUser, "record-2") -> "record-1",
      (userId0, "record-2") -> "record-1",
      (userId2, "record-2") -> ""
    )

  lazy val singleLinkRecordIdMapDereferenceIsTrue
      : Map[(String, String), JsObject] =
    Map(
      (adminUser, "record-2") -> testRecords(1).toJson.asJsObject,
      (userId0, "record-2") -> testRecords(1).toJson.asJsObject,
      (userId2, "record-2") -> JsObject.empty
    )
}
