package au.csiro.data61.magda.test.api

import java.net.URL
import java.util.Properties

import akka.actor.ActorSystem
import akka.event.Logging
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.testkit.{RouteTestTimeout, ScalatestRouteTest}
import akka.stream.scaladsl.Source
import au.csiro.data61.magda.model.Registry.{
  MAGDA_ADMIN_PORTAL_ID,
  MAGDA_TENANT_ID_HEADER
}
import au.csiro.data61.magda.search.elasticsearch._
import au.csiro.data61.magda.spatial.{RegionLoader, RegionSource}
import au.csiro.data61.magda.test.MockServer
import au.csiro.data61.magda.test.util.{
  Generators,
  MagdaElasticSugar,
  MagdaGeneratorTest,
  TestActorSystem
}
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.cluster.ClusterHealthResponse
import com.sksamuel.elastic4s.http.{
  ElasticClient,
  RequestFailure,
  RequestSuccess
}
import com.typesafe.config.{Config, ConfigFactory, ConfigValueFactory}
import org.elasticsearch.cluster.health.ClusterHealthStatus
import org.scalatest.{BeforeAndAfterAll, BeforeAndAfterEach, FunSpec, Matchers}
import spray.json.JsObject

import scala.collection.mutable
import scala.concurrent.Future
import scala.concurrent.duration.DurationInt

trait BaseApiSpec
    extends FunSpec
    with Matchers
    with ScalatestRouteTest
    with MagdaElasticSugar
    with BeforeAndAfterEach
    with BeforeAndAfterAll
    with MagdaGeneratorTest
    with MockServer {
  implicit def default(implicit system: ActorSystem) =
    RouteTestTimeout(300 seconds)

  def buildConfig =
    TestActorSystem.config
      .withValue(
        "opa.testSessionId",
        ConfigValueFactory.fromAnyRef("general-search-api-tests")
      )
      .withValue(
        "opa.baseUrl",
        ConfigValueFactory
          .fromAnyRef(s"http://localhost:${mockServer.getLocalPort}/v0/opa/")
      )
  override def createActorSystem(): ActorSystem =
    ActorSystem("BaseApiSpec", config)

  val logger = system.log
  implicit val indexedRegions: List[(RegionSource, JsObject)] =
    BaseApiSpec.indexedRegions

  implicit val config: Config = buildConfig

  val clientProvider = new DefaultClientProvider

  val tenant1: BigInt = 1
  val tenant2: BigInt = 2

  def addTenantIdHeader(tenantId: BigInt): RawHeader = {
    RawHeader(MAGDA_TENANT_ID_HEADER, tenantId.toString)
  }

  def addSingleTenantIdHeader: RawHeader = {
    addTenantIdHeader(MAGDA_ADMIN_PORTAL_ID)
  }

  override def client(): ElasticClient = clientProvider.getClient().await

  override def beforeAll() {

    blockUntilNotRed()

    if (doesIndexExists(DefaultIndices.getIndex(config, Indices.RegionsIndex))) {
      deleteIndex(DefaultIndices.getIndex(config, Indices.RegionsIndex))
    }

    client
      .execute(
        IndexDefinition.regions.definition(DefaultIndices, config)
      )
      .await(90 seconds)

    val fakeRegionLoader = new RegionLoader {
      override def setupRegions(): Source[(RegionSource, JsObject), _] =
        Source.fromIterator(() => BaseApiSpec.indexedRegions.toIterator)
    }

    logger.info("Setting up regions")
    IndexDefinition
      .setupRegions(client, fakeRegionLoader, DefaultIndices)
      .await(60 seconds)
    logger.info("Finished setting up regions")

    System.gc()
  }

  override def afterAll() {
    System.gc()
  }

  implicit object MockClientProvider extends ClientProvider {
    override def getClient(): Future[ElasticClient] = Future(client)
  }

  def blockUntilNotRed(): Unit = {
    blockUntil("Expected cluster to have NOT RED status") { () =>
      client
        .execute {
          clusterHealth()
        }
        .await(90 seconds) match {
        case r: RequestSuccess[ClusterHealthResponse] =>
          r.result.status != ClusterHealthStatus.RED
        case f: RequestFailure => false
      }
    }
  }

  def blockUntilNotYellow(): Unit = {
    blockUntil("Expected cluster to have green status") { () =>
      client
        .execute {
          clusterHealth()
        }
        .await(90 seconds) match {
        case r: RequestSuccess[ClusterHealthResponse] =>
          r.result.status != ClusterHealthStatus.RED && r.result.status != ClusterHealthStatus.YELLOW
        case f: RequestFailure => false
      }
    }
  }

  override def blockUntil(explain: String)(predicate: () ⇒ Boolean): Unit = {
    var backoff = 0
    var done = false

    while (backoff <= 20 && !done) {
      backoff = backoff + 1
      try {
        done = predicate()

        if (!done) {
          logger.debug(s"Waiting another {}ms for {}", 500 * backoff, explain)
          Thread.sleep(500 * (backoff))
        } else {
          logger.debug(s"{} is true, proceeding.", explain)
        }
      } catch {
        case e: Throwable ⇒
          logger.error("", e)
          throw e
      }
    }

    if (!done) {
      fail(s"Failed waiting on: $explain")
    }
  }

  def configWith(newProps: Map[String, String]): Config = {
    ConfigFactory.parseProperties(
      newProps.foldRight(new Properties()) {
        (current: (String, String), properties: Properties) ⇒
          properties.setProperty(current._1, current._2)
          properties
      }
    )
  }

  case class FakeIndices(rawIndexName: String) extends Indices {
    override def getIndex(config: Config, index: Indices.Index): String =
      index match {
        case Indices.DataSetsIndex   => s"dataset-idx-${rawIndexName}"
        case Indices.PublishersIndex => s"publisher-idx-${rawIndexName}"
        case Indices.FormatsIndex    => s"format-idx-${rawIndexName}"
        case _                       => DefaultIndices.getIndex(config, index)
      }
  }
}

object BaseApiSpec {

  val testStates = {
    import spray.json._
    List(
      (
        new RegionSource(
          "ithinkthisisregiontype",
          new URL("http://example.com"),
          "STE_CODE11",
          "STE_NAME11",
          Some("STE_ABBREV"),
          false,
          false,
          10
        ),
        """
      {"type":"Feature","properties":{"STE_NAME11":"Queensland","STE_CODE11":"3","STE_ABBREV":"QLD"},"geometry":{"type":"Polygon","coordinates":[[[142.4,-10.7],[141.5,-13.6],[141.6,-15.1],[140.8,-17.5],[139.9,-17.7],[139,-17.3],[137.9,-16.4],[137.9,-26],[140.9,-26],[141,-29],[148.9,-28.9],[150,-28.6],[150.8,-28.7],[151.3,-29.1],[151.9,-28.9],[152,-28.6],[152.5,-28.4],[153.4,-28.2],[152.9,-27.4],[153,-26],[152.4,-24.9],[150.9,-23.6],[150.5,-22.4],[149.5,-22.3],[149.1,-21],[147.4,-19.5],[146.2,-18.9],[145.8,-17.3],[145.2,-16.3],[145.3,-15],[144.4,-14.2],[143.6,-14.3],[143.4,-12.7],[142.4,-10.7]]]}}
      """.parseJson.asJsObject
      ),
      (
        new RegionSource(
          "ithinkthisisregiontype",
          new URL("http://example.com"),
          "STE_CODE11",
          "STE_NAME11",
          Some("STE_ABBREV"),
          false,
          false,
          10
        ),
        """
      {"type":"Feature","properties":{"STE_NAME11":"South Australia","STE_CODE11":"4","STE_ABBREV":"SA"},"geometry":{"type":"Polygon","coordinates":[[[128.9,-26],[129.1,-31.5],[132.5,-31.9],[135.6,-34.8],[138.5,-34.9],[140.9,-38],[141,-26],[128.9,-26]]]}}
      """.parseJson.asJsObject
      ),
      (
        new RegionSource(
          "ithinkthisisanotherregiontype",
          new URL("http://example.com"),
          "SA2_MAIN11",
          "SA2_NAME11",
          None,
          false,
          false,
          10
        ),
        """
      {"type":"Feature","properties":{"FID":540,"SA2_MAIN11":"201011001","SA2_5DIG11":"21001","SA2_NAME11":"Alfredton","SA3_CODE11":"20101","SA3_NAME11":"Ballarat","SA4_CODE11":"201","SA4_NAME11":"Ballarat","GCC_CODE11":"2RVIC","GCC_NAME11":"Rest of Vic.","STE_CODE11":"2","STE_NAME11":"Victoria","ALBERS_SQM":52711225.847435},"geometry":{"type":"Polygon","coordinates":[[[143.817818144,-37.561006440000035],[143.8174912,-37.562841825000035],[143.817114528,-37.56476397499996],[143.816975616,-37.56545293350001],[143.816948672,-37.565650938999966],[143.81670928,-37.56676987449998],[143.81621244800002,-37.568618339],[143.81617312,-37.568888217000016],[143.815870752,-37.570438887000016],[143.810498528,-37.569811496499995],[143.810401952,-37.56989781750003],[143.801001568,-37.56878966750002],[143.794272224,-37.56800291799998],[143.782986976,-37.56668795650002],[143.78281488,-37.56667104749999],[143.755571456,-37.5634804635],[143.74801100800002,-37.5626090025],[143.73819801599998,-37.5614719925],[143.715638016,-37.558854002],[143.707238272,-37.5578780345],[143.693674208,-37.558222023499994],[143.692926464,-37.558273952999976],[143.69230656,-37.55840471099999],[143.685929152,-37.56013037250001],[143.684946016,-37.55153592],[143.68694112,-37.54070703750004],[143.68699801600002,-37.540466001],[143.68885488,-37.530731078999985],[143.689259168,-37.53078300850002],[143.69004828799999,-37.52635401600002],[143.690823008,-37.521999356500004],[143.69083488,-37.5219110745],[143.69194512,-37.522036985500016],[143.69195952,-37.52194742699999],[143.692952032,-37.51634997449996],[143.692966816,-37.51626095249998],[143.703651008,-37.5175800025],[143.70397299200002,-37.517608992000014],[143.704450016,-37.518707004000014],[143.704666016,-37.51910800999998],[143.704768,-37.519353005500015],[143.704820992,-37.5189870015],[143.70557507200002,-37.51501366400002],[143.706168,-37.511888995499994],[143.70626,-37.511441998500004],[143.70935926400003,-37.51284871999997],[143.70985798400002,-37.5130749935],[143.715044992,-37.51460300099995],[143.728322016,-37.518475994500015],[143.729532992,-37.51882799399999],[143.73140924799998,-37.51962502950001],[143.74158192,-37.52394096850001],[143.74465801600002,-37.507245995],[143.74483699200002,-37.507330003499995],[143.746982016,-37.508430994000044],[143.759412,-37.51404400499998],[143.759624992,-37.514161997999985],[143.7617,-37.51511099250001],[143.76919952,-37.51849577100002],[143.781447328,-37.52402830699999],[143.80286499200002,-37.53370299300002],[143.802104992,-37.53777700750001],[143.800909152,-37.53990286099999],[143.80261561600003,-37.54010911749999],[143.812338016,-37.54136502699992],[143.811262016,-37.5421579925],[143.811060992,-37.5423429925],[143.810756992,-37.542681006],[143.810520992,-37.543014006000014],[143.810268992,-37.543485996499996],[143.810144992,-37.5438130025],[143.810040992,-37.544208995],[143.809943008,-37.5446970065],[143.809838656,-37.545272337999975],[143.809593088,-37.54661784300003],[143.813309856,-37.547066209],[143.813226304,-37.547505991000016],[143.8145608,-37.547667588500026],[143.813904992,-37.55110200249999],[143.813536224,-37.55309907750001],[143.813491584,-37.553411764500034],[143.8148696,-37.554021765],[143.81643856,-37.554715737],[143.818957568,-37.55583173100005],[143.8188504,-37.55595936250002],[143.818637728,-37.556353819499975],[143.818567872,-37.556499433],[143.81853328,-37.556804942000014],[143.818488768,-37.55714697000003],[143.81827164800004,-37.558160566499986],[143.818181344,-37.55900559099999],[143.817871488,-37.56066189599998],[143.817818144,-37.561006440000035]]]}}
      """.parseJson.asJsObject
      )
    )

  }

  val indexedRegions = Generators
    .indexedRegionsGen(mutable.HashMap.empty)
    .retryUntil(_ => true)
    .sample
    .get ++ testStates
}
