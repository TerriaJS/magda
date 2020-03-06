package au.csiro.data61.magda.api

import java.net.URL

import akka.event.Logging
import au.csiro.data61.magda.api.model.{Protocols, RegionSearchResult}
import au.csiro.data61.magda.search.elasticsearch._
import au.csiro.data61.magda.spatial.{RegionLoader, RegionSource}
import au.csiro.data61.magda.test.util.{MagdaElasticSugar, TestActorSystem}
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.ElasticClient
import com.typesafe.config.Config
import org.scalatest.{BeforeAndAfterAll, FunSpecLike, Matchers}
import spray.json._

import scala.concurrent.duration._
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.ContentTypes.`application/json`
import akka.http.scaladsl.model.StatusCodes.OK
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.testkit.ScalatestRouteTest
import akka.stream.scaladsl.Source
import au.csiro.data61.magda.model.Registry.{
  MAGDA_ADMIN_PORTAL_ID,
  MAGDA_TENANT_ID_HEADER
}

class RegionsApiSpec
    extends FunSpecLike
    with BeforeAndAfterAll
    with Matchers
    with Protocols
    with ScalatestRouteTest
    with MagdaElasticSugar {

  implicit val ec = system.dispatcher
  implicit val config = TestActorSystem.config

  val logger = Logging(system, getClass)
  implicit val clientProvider = new DefaultClientProvider

  val searchQueryer = new ElasticSearchQueryer(fakeIndices)
  val api = new SearchApi(searchQueryer)(config, logger)

  override def client(): ElasticClient = clientProvider.getClient().await

  object fakeIndices extends Indices {
    override def getIndex(config: Config, index: Indices.Index): String =
      index match {
        case Indices.DataSetsIndex =>
          throw new RuntimeException(
            "Why are we here this is the regions test?"
          )
        case Indices.PublishersIndex =>
          throw new RuntimeException(
            "Why are we here this is the regions test?"
          )
        case Indices.FormatsIndex =>
          throw new RuntimeException(
            "Why are we here this is the regions test?"
          )
        case Indices.RegionsIndex => "regions_test_regions_api_spec"
      }
  }

  def addTenantIdHeader: RawHeader = {
    RawHeader(MAGDA_TENANT_ID_HEADER, MAGDA_ADMIN_PORTAL_ID.toString)
  }

  override def beforeAll {
    super.beforeAll

    deleteIndex(fakeIndices.getIndex(config, Indices.RegionsIndex))

    refreshAll()

    client
      .execute(IndexDefinition.regions.definition(fakeIndices, config))
      .await

    val fakeRegionLoader = new RegionLoader {
      override def setupRegions(): Source[(RegionSource, JsObject), _] =
        Source.fromIterator(() => indexedRegions.toIterator)
    }

    logger.info("Setting up regions")
    IndexDefinition
      .setupRegions(client, fakeRegionLoader, fakeIndices)
      .await(60 seconds)
    refresh(fakeIndices.getIndex(config, Indices.RegionsIndex))
    logger.info("Finished setting up regions")
  }

  override def afterAll {
    super.afterAll

    deleteIndex(fakeIndices.getIndex(config, Indices.RegionsIndex))
  }

  it("should return same correct number of regions") {
    Get(s"/v0/regions") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual indexedRegions.length
    }
  }

  it("should return SA4 regions with `lv1Id` & `lv2Id` Fields") {
    Get(s"/v0/regions?type=SA4") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 2

      response.regions.exists { region =>
        region.lv1Id.isDefined &&
        region.lv2Id.isDefined &&
        !region.lv3Id.isDefined &&
        !region.lv4Id.isDefined &&
        !region.lv5Id.isDefined
      } shouldBe true

    }
  }

  it("should return SA3 regions with `lv1Id`, `lv2Id` & `lv3Id` Fields") {
    Get(s"/v0/regions?type=SA3") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 2

      response.regions.exists { region =>
        region.lv1Id.isDefined &&
        region.lv2Id.isDefined &&
        region.lv3Id.isDefined &&
        !region.lv4Id.isDefined &&
        !region.lv5Id.isDefined
      } shouldBe true

    }
  }

  it(
    "should return SA2 regions with `lv1Id`, `lv2Id`, `lv3Id` & `lv4Id` Fields"
  ) {
    Get(s"/v0/regions?type=SA2") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 2

      response.regions.exists { region =>
        region.lv1Id.isDefined &&
        region.lv2Id.isDefined &&
        region.lv3Id.isDefined &&
        region.lv4Id.isDefined &&
        !region.lv5Id.isDefined
      } shouldBe true

    }
  }

  it(
    "should return SA1 regions with `lv1Id`, `lv2Id`, `lv3Id`, `lv4Id` & `lv5Id` Fields"
  ) {
    Get(s"/v0/regions?type=SA1") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 2

      response.regions.exists { region =>
        region.lv1Id.isDefined &&
        region.lv2Id.isDefined &&
        region.lv3Id.isDefined &&
        region.lv4Id.isDefined &&
        region.lv5Id.isDefined
      } shouldBe true

    }
  }

  it("should only return Test SA4 2 regions when specify lv2 region Id 3") {
    Get(s"/v0/regions?type=SA4&lv2Id=3") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 1

      response.regions.head.lv2Id.get shouldEqual "3"
      response.regions.head.regionName.get shouldEqual "Test SA4 2"

    }
  }

  it(
    "should only return Test SA3 2 regions when specify lv2 region Id 3 & lv3Id 301"
  ) {
    Get(s"/v0/regions?type=SA3&lv2Id=3&lv3Id=301") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 1

      response.regions.head.lv2Id.get shouldEqual "3"
      response.regions.head.lv3Id.get shouldEqual "301"
      response.regions.head.regionName.get shouldEqual "Test SA3 2"

    }
  }

  it(
    "should only return Test SA2 2 regions when specify lv2 region Id 3 & lv3Id 301 & lv4Id 30101"
  ) {
    Get(s"/v0/regions?type=SA2&lv2Id=3&lv3Id=301&lv4Id=30101") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 1

      response.regions.head.lv2Id.get shouldEqual "3"
      response.regions.head.lv3Id.get shouldEqual "301"
      response.regions.head.lv4Id.get shouldEqual "30101"
      response.regions.head.regionName.get shouldEqual "Test SA2 2"

    }
  }

  it(
    "should only return Test SA1 2 regions when specify lv2 region Id 3 & lv3Id 301 & lv4Id 30101 & lv5Id 301011001"
  ) {
    Get(s"/v0/regions?type=SA1&lv2Id=3&lv3Id=301&lv4Id=30101&lv5Id=301011001") ~> addTenantIdHeader ~> api.routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[RegionSearchResult]

      response.hitCount shouldEqual 1

      response.regions.head.lv2Id.get shouldEqual "3"
      response.regions.head.lv3Id.get shouldEqual "301"
      response.regions.head.lv4Id.get shouldEqual "30101"
      response.regions.head.lv5Id.get shouldEqual "301011001"
      response.regions.head.regionName.get shouldEqual "Test SA1 2"

    }
  }

  val indexedRegions = List(
    (
      new RegionSource(
        "STE",
        new URL("http://example.com"),
        "STE_CODE11",
        "STE_NAME11",
        Some("STE_ABBREV"),
        false,
        false,
        10,
        lv1Id = Some("1")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "STE_NAME11": "Test STE 1",
        |    "STE_CODE11": "1",
        |    "STE_ABBREV": "TSTE1"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "STE",
        new URL("http://example.com"),
        "STE_CODE11",
        "STE_NAME11",
        Some("STE_ABBREV"),
        false,
        false,
        10,
        lv1Id = Some("1")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "STE_NAME11": "Test STE 2",
        |    "STE_CODE11": "3",
        |    "STE_ABBREV": "TSTE2"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA4",
        new URL("http://example.com"),
        "SA4_CODE11",
        "SA4_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA4_CODE11": "101",
        |    "SA4_NAME11": "Test SA4 1",
        |    "STE_CODE11": "1"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA4",
        new URL("http://example.com"),
        "SA4_CODE11",
        "SA4_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA4_CODE11": "301",
        |    "SA4_NAME11": "Test SA4 2",
        |    "STE_CODE11": "3"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA3",
        new URL("http://example.com"),
        "SA3_CODE11",
        "SA3_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA3_CODE11": "10101",
        |    "SA3_NAME11": "Test SA3 1",
        |    "SA4_CODE11": "101",
        |    "STE_CODE11": "1"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA3",
        new URL("http://example.com"),
        "SA3_CODE11",
        "SA3_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA3_CODE11": "30101",
        |    "SA3_NAME11": "Test SA3 2",
        |    "SA4_CODE11": "301",
        |    "STE_CODE11": "3"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA2",
        new URL("http://example.com"),
        "SA2_MAIN11",
        "SA2_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11"),
        lv4IdField = Some("SA3_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA2_MAIN11": "101011001",
        |    "SA3_CODE11": "10101",
        |    "SA2_NAME11": "Test SA2 1",
        |    "SA4_CODE11": "101",
        |    "STE_CODE11": "1"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA2",
        new URL("http://example.com"),
        "SA2_MAIN11",
        "SA2_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11"),
        lv4IdField = Some("SA3_CODE11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA2_MAIN11": "301011001",
        |    "SA3_CODE11": "30101",
        |    "SA2_NAME11": "Test SA2 2",
        |    "SA4_CODE11": "301",
        |    "STE_CODE11": "3"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA1",
        new URL("http://example.com"),
        "SA1_MAIN11",
        "SA1_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11"),
        lv4IdField = Some("SA3_CODE11"),
        lv5IdField = Some("SA2_MAIN11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA1_MAIN11": "10101100101",
        |    "SA2_MAIN11": "101011001",
        |    "SA3_CODE11": "10101",
        |    "SA1_NAME11": "Test SA1 1",
        |    "SA4_CODE11": "101",
        |    "STE_CODE11": "1"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    ),
    (
      new RegionSource(
        "SA1",
        new URL("http://example.com"),
        "SA1_MAIN11",
        "SA1_NAME11",
        None,
        false,
        false,
        10,
        lv1Id = Some("1"),
        lv2IdField = Some("STE_CODE11"),
        lv3IdField = Some("SA4_CODE11"),
        lv4IdField = Some("SA3_CODE11"),
        lv5IdField = Some("SA2_MAIN11")
      ),
      """
        |{
        |  "type": "Feature",
        |  "properties": {
        |    "SA1_MAIN11": "30101100101",
        |    "SA2_MAIN11": "301011001",
        |    "SA3_CODE11": "30101",
        |    "SA1_NAME11": "Test SA1 2",
        |    "SA4_CODE11": "301",
        |    "STE_CODE11": "3"
        |  },
        |  "geometry": {
        |    "type": "Polygon",
        |    "coordinates": [
        |      [
        |        [
        |          146.63,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -24.19
        |        ],
        |        [
        |          150.21,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -22.97
        |        ],
        |        [
        |          146.63,
        |          -24.19
        |        ]
        |      ]
        |    ]
        |  }
        |}
      """.stripMargin.parseJson.asJsObject
    )
  )

}
