package au.csiro.data61.magda.spatial

import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.{ElasticClient, ElasticDsl, RequestSuccess}
import au.csiro.data61.magda.search.elasticsearch.{
  DefaultClientProvider,
  IndexDefinition,
  Indices
}
import java.nio.file.FileSystems
import java.nio.file.Files

import scala.collection.JavaConversions._
import scala.concurrent.duration._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.FunSpecLike
import org.scalatest.Matchers
import org.scalatest.matchers.BeMatcher
import org.scalatest.matchers.MatchResult
import com.monsanto.labs.mwundo.GeoJson._
import com.typesafe.config.{Config, ConfigFactory, ConfigValueFactory}
import org.locationtech.jts.geom.Envelope
import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.Source
import akka.testkit.TestKit
import au.csiro.data61.magda.AppConfig
import au.csiro.data61.magda.model.misc.Protocols._
import au.csiro.data61.magda.test.util.Generators
import au.csiro.data61.magda.test.util.MagdaGeneratorTest
import au.csiro.data61.magda.util.MwundoJTSConversions._
import spray.json._
import akka.stream.scaladsl.Sink
import org.locationtech.spatial4j.context.jts.JtsSpatialContext
import org.locationtech.spatial4j.shape.jts.JtsGeometry

import scala.util.Try
import au.csiro.data61.magda.model.misc.Region
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchImplicits.RegionHitAs
import au.csiro.data61.magda.search.elasticsearch.Exceptions.ESGenericException
import org.scalactic.anyvals.PosInt
import au.csiro.data61.magda.test.util.TestActorSystem
import au.csiro.data61.magda.test.util.MagdaElasticSugar
import com.sksamuel.elastic4s.http.get.GetResponse

class RegionLoadingTest
    extends TestKit(TestActorSystem.actorSystem)
    with FunSpecLike
    with BeforeAndAfterAll
    with Matchers
    with MagdaGeneratorTest
    with MagdaElasticSugar {
  implicit val ec = system.dispatcher

  implicit val materializer = ActorMaterializer()
  implicit override val generatorDrivenConfig: PropertyCheckConfiguration =
    PropertyCheckConfiguration(
      workers = PosInt(1),
      sizeRange = PosInt(20),
      minSuccessful = PosInt(10)
    ) // This is a super heavy test so do 10 only, one-at-a-time

  implicit val config = TestActorSystem.config

  val clientProvider = new DefaultClientProvider

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
        case Indices.RegionsIndex => "regions"
      }
  }

  override def beforeAll {
    super.beforeAll

    client
      .execute(IndexDefinition.regions.definition(fakeIndices, config))
      .await
  }

  override def afterAll {
    super.afterAll

    deleteIndex(fakeIndices.getIndex(config, Indices.RegionsIndex))
  }

  it("should load scalacheck-generated regions reasonably accurately") {
    val dir = Files.createTempDirectory(
      FileSystems.getDefault().getPath(System.getProperty("java.io.tmpdir")),
      "magda-test"
    )
    implicit val config = ConfigFactory
      .parseMap(
        Map(
          "regionLoading.cachePath" -> dir.getFileName.toFile().toString()
        )
      )
      .withFallback(AppConfig.conf())

    forAll(
      Generators.nonEmptyListOf(
        Generators.regionGen(
          Generators.geometryGen(
            5,
            Generators.coordGen(Generators.longGen(), Generators.latGen())
          )
        )
      )
    ) { regions =>
      whenever(!regions.isEmpty) {
        val regionLoader = new RegionLoader {
          def setupRegions() = Source.fromIterator(() => regions.iterator)
        }

        checkRegionLoading(regionLoader, regions)
      }
    }
  }

  ignore("should load real regions reasonably accurately") {
    def getCurrentDirectory = new java.io.File("./../regions")
    implicit val config = ConfigFactory
      .parseMap(
        Map(
          "regionLoading.cachePath" -> getCurrentDirectory.toString()
        )
      )
      .withFallback(AppConfig.conf())

    val regionSourceConfig = config.getConfig("regionSources")
    val regionSources = new RegionSources(regionSourceConfig)

    val regionLoader =
      RegionLoader(regionSources.sources.filter(_.name.equals("LGA")).toList)

    val regions = regionLoader
      .setupRegions()
      .runWith(Sink.fold(List[(RegionSource, JsObject)]()) {
        case (agg, current) => current :: agg
      })
      .await(120 seconds)
      .filter(!_._2.fields("geometry").equals(JsNull))
      .filter(!_._2.fields("geometry").isInstanceOf[JsObject])
      .filter(
        region =>
          Try {
            val jts = region._2.fields("geometry").convertTo[Geometry].toJTSGeo
            new JtsGeometry(jts, JtsSpatialContext.GEO, false, false).validate()
            val env = jts.getEnvelopeInternal
            env.getMinX > -180 && env.getMaxX < 180
          }.getOrElse(false)
      )

    checkRegionLoading(regionLoader, regions)
  }

  /**
    * Checks that all regions have been indexed correctly, and that their simplified representation is reasonably (within 1%) close to the real thing.
    */
  def checkRegionLoading(
      regionLoader: RegionLoader,
      regions: Seq[(RegionSource, JsObject)]
  )(implicit config: Config) = {
    IndexDefinition
      .setupRegions(client, regionLoader, fakeIndices)
      .await(120 seconds)
    val indexName = fakeIndices.getIndex(config, Indices.RegionsIndex)
    val indexType = fakeIndices.getType(Indices.RegionsIndexType)

    refresh(indexName)

    blockUntilExactCount(regions.size, indexName)

    regions.foreach { region =>
      val regionId = region._1.name.toLowerCase + "/" + region._2
        .fields("properties")
        .asJsObject
        .fields(region._1.idProperty)
        .asInstanceOf[JsString]
        .value
      val inputGeometry = region._2.fields("geometry").convertTo[Geometry]
      val inputGeometryJts = inputGeometry.toJTSGeo

      val result = client
        .execute(
          get(regionId).from(
            fakeIndices.getIndex(config, Indices.RegionsIndex) / fakeIndices
              .getType(Indices.RegionsIndexType)
          )
        )
        .await(60 seconds)

      withClue("region " + regionId) {
        result match {
          case ESGenericException(e) => throw e
          case r: RequestSuccess[GetResponse] =>
            r.result.exists should be(true)
            val indexedGeometry = r.result.sourceAsString.parseJson.asJsObject
              .fields("geometry")
              .convertTo[Geometry]
            val indexedGeometryJts = indexedGeometry.toJTSGeo

            def holeCount(geometry: Geometry): Int = geometry match {
              case polygon: Polygon => polygon.coordinates.tail.size
              case MultiPolygon(polygons) =>
                polygons.map(_.tail.size).reduce(_ + _)
              case _ => 0
            }

            // Hole elimination means that areas can be wildly different even if the outside of the shape is the same.
            if (holeCount(indexedGeometry) == holeCount(inputGeometry)) {
              withinFraction(
                indexedGeometryJts.getArea,
                inputGeometryJts.getArea,
                inputGeometryJts.getArea,
                0.1
              )
            }

            val inputRectangle = inputGeometryJts.getEnvelopeInternal
            val indexedRectangle = indexedGeometryJts.getEnvelopeInternal

            def recToSeq(rect: Envelope) =
              Seq(rect.getMinX, rect.getMaxY, rect.getMaxX, rect.getMinY)

            recToSeq(inputRectangle).zip(recToSeq(indexedRectangle)).foreach {
              case (inputDim, indexedDim) =>
                withinFraction(
                  indexedDim,
                  inputDim,
                  inputGeometryJts.getLength,
                  0.1
                )
            }
        }

      }
    }

    client
      .execute(deleteByQuery(indexName, indexType, matchAllQuery()))
      .await match {
      case ESGenericException(e) => throw e
      case _                     =>
    }

    refresh(indexName)

  }

  def withinFraction(
      left: Double,
      right: Double,
      comparison: Double,
      fraction: Double
  ) = (
    if (comparison == 0) {
      left should equal(right)
    } else {
      left should be(right +- Math.max(Math.abs(comparison * fraction), 0.01))
    }
  )
}
