package au.csiro.data61.magda.registry

import scala.collection.JavaConversions._

import org.flywaydb.core.Flyway
import org.scalamock.scalatest.MockFactory
import org.scalatest.Matchers
import org.scalatest.fixture.FunSpec
import org.slf4j.LoggerFactory

import com.typesafe.config.Config
import io.jsonwebtoken.Jwts;

import akka.actor.ActorRef
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import akka.http.scaladsl.marshalling.Marshal
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.server.AuthenticationFailedRejection
import akka.http.scaladsl.server.AuthorizationFailedRejection
import akka.http.scaladsl.server.MethodRejection
import akka.http.scaladsl.testkit.ScalatestRouteTest
import akka.http.scaladsl.model._
import au.csiro.data61.magda.Authentication
import au.csiro.data61.magda.client.AuthApiClient
import au.csiro.data61.magda.client.HttpFetcher
import au.csiro.data61.magda.model.Auth.AuthProtocols
import au.csiro.data61.magda.model.Auth.User
import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import scalikejdbc._
import scalikejdbc.config.DBs
import scalikejdbc.config.EnvPrefix
import scalikejdbc.config.TypesafeConfig
import scalikejdbc.config.TypesafeConfigReader
import scala.concurrent.Await
import scala.concurrent.duration._
import akka.pattern.gracefulStop
import au.csiro.data61.magda.model.Registry._
import io.jsonwebtoken.SignatureAlgorithm
import java.{util => ju}
import akka.http.scaladsl.marshalling.ToEntityMarshaller

abstract class ApiSpec
    extends FunSpec
    with ScalatestRouteTest
    with Matchers
    with Protocols
    with SprayJsonSupport
    with MockFactory
    with AuthProtocols {
  override def beforeAll(): Unit = {
    Util.clearWebHookActorsCache()
  }

  val databaseUrl = Option(System.getenv("POSTGRES_URL"))
    .getOrElse("jdbc:postgresql://localhost:5432/postgres")

  def addTenantIdHeader(tenantId: BigInt): RawHeader = {
    RawHeader(MAGDA_TENANT_ID_HEADER, tenantId.toString)
  }

  def addAdminPortalIdHeader: RawHeader = {
    addTenantIdHeader(MAGDA_ADMIN_PORTAL_ID)
  }

  def addSystemTenantHeader: RawHeader = {
    addTenantIdHeader(MAGDA_SYSTEM_ID)
  }

  // Any positive numbers
  val TENANT_1: BigInt = 1
  val TENANT_2: BigInt = 2
  val DOMAIN_NAME_1: String = "test1"
  val DOMAIN_NAME_2: String = "test2"

  // Stop Flyway from producing so much spam that Travis terminates the process.
  LoggerFactory
    .getLogger("org.flywaydb")
    .asInstanceOf[Logger]
    .setLevel(Level.WARN)

  val flyway = new Flyway()
  flyway.setDataSource(databaseUrl, "postgres", "")
  flyway.setSchemas("test")
  flyway.setLocations("classpath:/sql")
  flyway.setPlaceholders(
    Map("clientUserName" -> "client", "clientPassword" -> "password")
  )

  override def testConfigSource =
    s"""
       |db.default.url = "${databaseUrl}?currentSchema=test"
       |authorization.skip = false
       |authorization.skipOpaQuery = true
       |akka.loglevel = debug
       |authApi.baseUrl = "http://localhost:6104"
       |webhooks.actorTickRate=0
       |webhooks.eventPageSize=10
       |akka.test.timefactor=20.0
       |trimBySourceTagTimeoutThreshold=500
    """.stripMargin

  override def withFixture(test: OneArgTest) = {
    val authHttpFetcher = mock[HttpFetcher]

    //    webHookActorProbe.expectMsg(1 millis, WebHookActor.Process(true))

    val authClient =
      new RegistryAuthApiClient(
        authHttpFetcher
      )(
        testConfig,
        system,
        executor,
        materializer
      )

    case class DBsWithEnvSpecificConfig(configToUse: Config)
        extends DBs
        with TypesafeConfigReader
        with TypesafeConfig
        with EnvPrefix {

      override val config = configToUse
    }

    DBsWithEnvSpecificConfig(testConfig).setupAll()

    DB localTx { implicit session =>
      sql"DROP SCHEMA IF EXISTS test CASCADE".update.apply()
      sql"CREATE SCHEMA test".update.apply()
    }

    flyway.migrate()

    val actor = system.actorOf(
      WebHookActor.props("http://localhost:6101/v0/")(testConfig)
    )
    val api = (role: Role) =>
      new Api(
        if (role == Full) Some(actor) else None,
        authClient,
        testConfig,
        system,
        executor,
        materializer
      )

    def asNonAdmin(req: HttpRequest): HttpRequest = {
      expectAdminCheck(authHttpFetcher, false)
      asUser(req)
    }

    def asAdmin(req: HttpRequest): HttpRequest = {
      expectAdminCheck(authHttpFetcher, true)
      asUser(req)
    }

    try {
      super.withFixture(
        test.toNoArgTest(
          FixtureParam(
            api,
            actor,
            asAdmin,
            asNonAdmin,
            authHttpFetcher,
            authClient
          )
        )
      )
    } finally {
      //      Await.result(system.terminate(), 30 seconds)
      Await.result(gracefulStop(actor, 30 seconds), 30 seconds)
    }
  }

  def asUser(req: HttpRequest): HttpRequest = {
    val jws = Authentication.signToken(
      Jwts
        .builder()
        .claim("userId", "1"),
      system.log
    )
    req.withHeaders(new RawHeader("X-Magda-Session", jws))
  }

  def expectAdminCheck(httpFetcher: HttpFetcher, isAdmin: Boolean) {
    val resFuture = Marshal(User(isAdmin))
      .to[ResponseEntity]
      .map(user => HttpResponse(status = 200, entity = user))

    (httpFetcher.get _).expects("/v0/public/users/1", *).returns(resFuture)
  }

  def checkMustBeAdmin(role: Role)(fn: => HttpRequest) {
    describe("should only work when logged in as admin") {
      it("rejects with credentials missing if not signed in") { param =>
        fn ~> param.api(role).routes ~> check {
          expectCredentialsMissingRejection()
        }
      }

      it("rejects with credentials rejected if credentials are bad") { param =>
        fn.withHeaders(RawHeader("X-Magda-Session", "aergiajreog")) ~> param
          .api(role)
          .routes ~> check {
          expectCredentialsRejectedRejection()
        }
      }

      it("rejects with AuthorizationFailedRejection if not admin") { param =>
        param.asNonAdmin(fn) ~> param.api(role).routes ~> check {
          expectUnauthorizedRejection()
        }
      }
    }

    def expectCredentialsMissingRejection() = {
      rejection match {
        case AuthenticationFailedRejection(
            AuthenticationFailedRejection.CredentialsMissing,
            _
            )  => // success
        case _ => fail()
      }
    }

    def expectCredentialsRejectedRejection() = {
      rejection match {
        case AuthenticationFailedRejection(
            AuthenticationFailedRejection.CredentialsRejected,
            _
            )  => // success
        case _ => fail(s"Rejection was $rejection")
      }
    }

    def expectUnauthorizedRejection() = {
      rejection shouldEqual AuthorizationFailedRejection
    }
  }

  def routesShouldBeNonExistentWithRole(
      role: Role,
      routes: List[(String, String => HttpRequest, String)]
  ) {
    describe(s"routes should not be accessible with role ${role.toString}") {
      routes.foreach {
        case (methodName, methodFn, route) =>
          it(s"${methodName} ${route}") { param =>
            methodFn(route) ~> param.api(role).routes ~> check {
              rejection match {
                case MethodRejection(_) => // success
                case _                  => fail()
              }
            }
          }
      }
    }
  }

  case class FixtureParam(
      api: Role => Api,
      webHookActor: ActorRef,
      asAdmin: HttpRequest => HttpRequest,
      asNonAdmin: HttpRequest => HttpRequest,
      authFetcher: HttpFetcher,
      authClient: RegistryAuthApiClient
  )

}
