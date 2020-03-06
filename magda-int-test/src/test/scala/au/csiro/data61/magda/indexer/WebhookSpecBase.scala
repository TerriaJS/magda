package au.csiro.data61.magda.indexer

import java.time.temporal.ChronoUnit
import java.util.UUID

import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.HttpMethods.POST
import akka.http.scaladsl.model.StatusCodes.{Accepted, OK}
import au.csiro.data61.magda.api.SearchApi
import au.csiro.data61.magda.api.model.{SearchResult, Protocols => ApiProtocols}
import au.csiro.data61.magda.indexer.external.registry.WebhookApi
import au.csiro.data61.magda.indexer.search.SearchIndexer
import au.csiro.data61.magda.indexer.search.elasticsearch.ElasticSearchIndexer
import au.csiro.data61.magda.model.Registry.{Record, _}

import au.csiro.data61.magda.model.Temporal.{ApiDate, PeriodOfTime}
import au.csiro.data61.magda.model.misc.{Protocols => ModelProtocols, _}
import au.csiro.data61.magda.search.SearchQueryer
import au.csiro.data61.magda.search.elasticsearch.{
  ElasticSearchQueryer,
  Indices
}
import au.csiro.data61.magda.test.api.BaseApiSpec
import au.csiro.data61.magda.test.opa.ResponseDatasetAllowAll
import au.csiro.data61.magda.test.util.Generators
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.typesafe.config.{Config, ConfigFactory}
import org.scalacheck.Gen
import spray.json.{JsNull, JsObject, _}

import scala.concurrent.duration._

trait WebhookSpecBase
    extends BaseApiSpec
    with ModelProtocols
    with ApiProtocols
    with ResponseDatasetAllowAll {
  override def buildConfig: Config =
    ConfigFactory
      .parseString("indexer.requestThrottleMs=1")
      .withFallback(super.buildConfig)

  val cachedListCache: scala.collection.mutable.Map[String, List[_]] =
    scala.collection.mutable.HashMap.empty

  /**
    * Cleanses the Location in such a way that it's the same for both input data and output data. In particular
    * it stops the tests failing because input polygons have bogus multiple-decimal-point coordinates (1.2.3 vs 1.23).
    */
  def convertSpatialDataUsingGeoJsonField(
      spatialData: Option[Location]
  ): Option[Location] = {
    spatialData match {
      case Some(Location(Some(text), _)) =>
        val convertedGeoJsonString = Location.apply(text) match {
          case Location(_, Some(geoJson)) => geoJson.toJson.toString
          case _                          => text
        }

        Some(Location(Some(convertedGeoJsonString), None))
      case Some(Location(_, Some(geoJson))) =>
        Some(Location(Some(geoJson.toJson.toString), None))
      case _ => None
    }
  }

  val dataSetsGen
      : Gen[List[(DataSet, List[(String, Double, Double, Double)])]] =
    Generators
      .listSizeBetween(0, 20, Generators.dataSetGen(cachedListCache))
      .flatMap { dataSets =>
        val qualityFacetGen: Gen[(String, Double, Double, Double)] = for {
          skewPrimary <- Generators.twoDigitDoubleGen
          weightingPrimary <- Generators.twoDigitDoubleGen
          skewOtherWay <- Generators.twoDigitDoubleGen
          name <- Gen.alphaNumStr
        } yield (name, skewPrimary, weightingPrimary, skewOtherWay)

        val qualityGen =
          Gen.listOfN(dataSets.size, Gen.nonEmptyListOf(qualityFacetGen))

        qualityGen.map(x => dataSets.zip(x))
      }

  case class TestIndex(
      indexId: String,
      indices: Indices,
      indexer: SearchIndexer,
      webhookApi: WebhookApi,
      searchQueryer: SearchQueryer,
      searchApi: SearchApi,
      indexNames: List[String]
  )

  def buildIndex(): TestIndex = {
    val indexId = UUID.randomUUID().toString

    val indices = FakeIndices(indexId.toString)
    val indexer = new ElasticSearchIndexer(MockClientProvider, indices)
    val webhookApi = new WebhookApi(indexer)
    val searchQueryer = new ElasticSearchQueryer(indices)
    val searchApi = new SearchApi(searchQueryer)(config, logger)

    val indexNames = List(
      indices.getIndex(config, Indices.DataSetsIndex),
      indices.getIndex(config, Indices.PublishersIndex),
      indices.getIndex(config, Indices.FormatsIndex)
    )

    indexer.ready.await(120 seconds)

    indexNames.foreach { idxName =>
      blockUntilIndexExists(idxName)
    }

    TestIndex(
      indexNames.head,
      indices,
      indexer,
      webhookApi,
      searchQueryer,
      searchApi,
      indexNames
    )
  }

  def loadDatasetsThroughEvents()(fn: (List[DataSet], SearchResult) => Unit) {
    val dataSetsBatchesGen = Generators.listSizeBetween(0, 3, dataSetsGen)

    forAll(dataSetsBatchesGen) { dataSetsBatches =>
      val builtIndex = buildIndex()
      val routes = builtIndex.webhookApi.routes

      val payloads = dataSetsBatches.map(
        dataSets =>
          WebHookPayload(
            action = "records.changed",
            lastEventId = 104856,
            events = None, // Not needed yet - soon?
            records = Some(dataSets.map(dataSetToRecord)),
            aspectDefinitions = None,
            deferredResponseUrl = None
          )
      )

      val posts = payloads.map { payload =>
        new RequestBuilder(POST).apply("/", payload)
      }

      val responses = posts.map { post =>
        post ~> addSingleTenantIdHeader ~> routes ~> check {
          status shouldBe Accepted
        }
      }
      val allDataSets = dataSetsBatches.flatten.map(_._1)

      builtIndex.indexNames.foreach { idxName =>
        refresh(idxName)
      }

      blockUntilExactCount(allDataSets.size, builtIndex.indexId)

      Get(s"/v0/datasets?query=*&limit=${allDataSets.size}") ~> addSingleTenantIdHeader ~> builtIndex.searchApi.routes ~> check {
        status shouldBe OK
        val response = responseAs[SearchResult]

        fn(allDataSets, response)
      }

      builtIndex.indexNames.foreach { idxName =>
        deleteIndex(idxName)
      }
    }
  }

  def filterDate(input: Option[ApiDate]): Option[ApiDate] = input.flatMap {
    case ApiDate(None, "") => None
    case other             => Some(other)
  }

  def dataSetToRecord(
      input: (DataSet, List[(String, Double, Double, Double)])
  ): Record = input match {
    case (dataSet, quality) =>
      def removeNulls(jsObject: JsObject) =
        JsObject(jsObject.fields.filter {
          case (_, value) =>
            value match {
              case JsNull => false
              case JsObject(fields)
                  if fields.filterNot(_._2 == JsNull).isEmpty =>
                false
              case _ => true
            }
        })
      def modifyJson(
          jsObject: JsObject,
          values: Map[String, JsValue]
      ): JsObject = removeNulls(JsObject(jsObject.fields ++ values))

      val record = Record(
        id = dataSet.identifier,
        name = dataSet.title.getOrElse("No Title"),
        tenantId = Some(MAGDA_ADMIN_PORTAL_ID),
        aspects = {
          val aspects: Map[String, JsObject] = Map(
            "dcat-dataset-strings" -> modifyJson(
              dataSet
                .copy(
                  distributions = Seq(),
                  publisher = None,
                  accrualPeriodicity = None
                )
                .toJson
                .asJsObject,
              Map(
                "accrualPeriodicity" -> dataSet.accrualPeriodicity
                  .flatMap(_.duration)
                  .map(
                    duration => duration.get(ChronoUnit.SECONDS) * 1000 + " ms"
                  )
                  .toJson,
                "contactPoint" -> dataSet.contactPoint
                  .flatMap(_.name)
                  .map(_.toJson)
                  .getOrElse(JsNull),
                "temporal" -> dataSet.temporal
                  .map {
                    case PeriodOfTime(None, None) => JsNull
                    case PeriodOfTime(start, end) =>
                      removeNulls(
                        JsObject(
                          "start" -> start.map(_.text).toJson,
                          "end" -> end.map(_.text).toJson
                        )
                      )
                  }
                  .getOrElse(JsNull),
                "spatial" -> dataSet.spatial.map(_.text).toJson
              )
            ),
            "dataset-distributions" -> JsObject(
              "distributions" -> dataSet.distributions
                .map(
                  dist =>
                    JsObject(
                      "id" -> dist.identifier.toJson,
                      "name" -> dist.title.toJson,
                      "aspects" -> JsObject(
                        "dcat-distribution-strings" ->
                          modifyJson(
                            dist.toJson.asJsObject,
                            Map(
                              "license" -> dist.license
                                .flatMap(_.name)
                                .map(_.toJson)
                                .getOrElse(JsNull)
                            )
                          )
                      )
                    )
                )
                .toJson
            ),
            "source" -> dataSet.source.toJson,
            "provenance" -> dataSet.provenance.toJson,
            "dataset-publisher" -> dataSet.publisher
              .map(
                publisher =>
                  JsObject(
                    "publisher" -> JsObject(
                      "id" -> publisher.identifier.toJson,
                      "name" -> publisher.name.toJson,
                      "aspects" -> JsObject(
                        "organization-details" -> removeNulls(
                          JsObject(
                            "title" -> publisher.name.toJson,
                            "imageUrl" -> publisher.imageUrl.toJson
                          )
                        )
                      )
                    )
                  )
              )
              .toJson,
            "dataset-quality-rating" -> {
              if (!dataSet.hasQuality) {
                JsObject()
              } else if (dataSet.quality == 1) {
                JsObject()
              } else if (dataSet.quality == 0.1) {
                JsObject(
                  "x" -> JsObject("score" -> 0.toJson, "weighting" -> 1.toJson)
                )
              } else if (quality.isEmpty) {
                JsObject(
                  "x" -> JsObject(
                    "score" -> dataSet.quality.toJson,
                    "weighting" -> 1.toJson
                  )
                )
              } else {
                quality
                  .flatMap {
                    case (
                        name,
                        skewPrimaryRaw,
                        weightingPrimaryRaw,
                        skewOtherWayRaw
                        ) =>
                      def sanitize(number: Double) = Math.max(0.01, number)

                      val skewPrimary = sanitize(skewPrimaryRaw)
                      val weightingPrimary = sanitize(weightingPrimaryRaw)
                      val skewOtherWay = sanitize(skewOtherWayRaw)

                      val weightingOtherWay = (skewPrimary * weightingPrimary) / skewOtherWay
                      List(
                        name -> JsObject(
                          "score" -> (dataSet.quality + skewPrimary).toJson,
                          "weighting" -> weightingPrimary.toJson
                        ),
                        s"$name-alternate" -> JsObject(
                          "score" -> (dataSet.quality - skewOtherWay).toJson,
                          "weighting" -> weightingOtherWay.toJson
                        )
                      )
                  }
                  .toMap
                  .toJson
                  .asJsObject
              }
            }
          ).filter { case (_, value) => value.isInstanceOf[JsObject] }
            .asInstanceOf[Map[String, JsObject]]

          val temporal = dataSet.temporal
            .map(
              temporal =>
                (temporal.start.flatMap(_.date), temporal.end.flatMap(_.date))
            )
            .flatMap {
              case (None, None) => None
              case (from, to) =>
                Some(
                  JsObject(
                    "intervals" -> Seq(
                      removeNulls(
                        JsObject(
                          "start" -> from.toJson,
                          "end" -> to.toJson
                        )
                      )
                    ).toJson
                  )
                )
            }
            .map(_.toJson.asJsObject)

          temporal match {
            case Some(innerTemporal) =>
              aspects + (("temporal-coverage", innerTemporal))
            case None => aspects
          }
        }
      )

      record.copy(tenantId = Some(MAGDA_ADMIN_PORTAL_ID))
  }
}
