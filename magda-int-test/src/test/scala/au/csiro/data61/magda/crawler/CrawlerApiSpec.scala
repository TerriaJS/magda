package au.csiro.data61.magda.crawler

import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.{ElasticDsl, RequestSuccess}
import au.csiro.data61.magda.test.api.BaseApiSpec
import au.csiro.data61.magda.indexer.crawler.CrawlerApi
import au.csiro.data61.magda.test.util.Generators
import org.scalacheck.Gen

import scala.concurrent.Future
import au.csiro.data61.magda.model.misc.DataSet
import au.csiro.data61.magda.indexer.search.elasticsearch.ElasticSearchIndexer
import akka.http.scaladsl.model.StatusCodes.{Accepted, OK}
import au.csiro.data61.magda.search.elasticsearch.DefaultIndices

import scala.concurrent.duration._
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchQueryer
import au.csiro.data61.magda.api.SearchApi
import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.api.model.Protocols
import au.csiro.data61.magda.api.BaseSearchApiSpec
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import org.scalacheck.Shrink
import akka.http.scaladsl.server.Route
import java.util.UUID

import au.csiro.data61.magda.model.misc.Agent
import au.csiro.data61.magda.search.elasticsearch.Indices
import com.typesafe.config.ConfigFactory
import au.csiro.data61.magda.indexer.crawler.Crawler
import au.csiro.data61.magda.client.RegistryExternalInterface
import au.csiro.data61.magda.indexer.crawler.RegistryCrawler
import au.csiro.data61.magda.client.HttpFetcher
import au.csiro.data61.magda.search.elasticsearch.Exceptions.ESGenericException
import au.csiro.data61.magda.test.opa.ResponseDatasetAllowAll
import au.csiro.data61.magda.test.util.MagdaMatchers
import com.sksamuel.elastic4s.http.search.SearchResponse

class CrawlerApiSpec
    extends BaseApiSpec
    with Protocols
    with ResponseDatasetAllowAll {

  override def buildConfig =
    ConfigFactory
      .parseString("indexer.requestThrottleMs=1")
      .withFallback(super.buildConfig)
  implicit val ec = system.dispatcher

  blockUntilNotRed()

  it("should correctly store new datasets when reindexed") {
    // When shrinking, shrink the datasets only and put them in a new index.
    implicit def shrinker2(
        implicit s: Shrink[List[DataSet]]
    ): Shrink[(List[DataSet], List[DataSet])] =
      Shrink[(List[DataSet], List[DataSet])] {
        case (beforeDataSets, afterDataSets) ⇒
          logger.warning("Shrinking")
          Shrink
            .shrink(beforeDataSets)
            .flatMap(
              shrunkBefore =>
                Shrink
                  .shrink(afterDataSets)
                  .map(shrunkAfter => (shrunkBefore, shrunkAfter))
            )
            .map {
              case (beforeDataSets, afterDataSets) =>
                (beforeDataSets, afterDataSets)
            }
      }

    val cachedListCache: scala.collection.mutable.Map[String, List[_]] =
      scala.collection.mutable.HashMap.empty

    // Gen these as a tuple so that they're shrunk together instead of separately
    val gen = for {
      dataSetsInitial <- Generators.listSizeBetween(
        0,
        20,
        Generators.dataSetGen(cachedListCache)
      )
      dataSetsRemaining <- Gen.someOf(dataSetsInitial)
      dataSetsNew <- Generators.listSizeBetween(
        0,
        20,
        Generators.dataSetGen(cachedListCache)
      )
      dataSetsAfter = dataSetsRemaining.toList ++ dataSetsNew
      source = (dataSetsInitial, dataSetsAfter)
    } yield source

    forAll(gen) {
      case (source) =>
        val indexId = UUID.randomUUID().toString
        val indices = new FakeIndices(indexId.toString)
        val indexNames = List(
          indices.getIndex(config, Indices.DataSetsIndex),
          indices.getIndex(config, Indices.PublishersIndex),
          indices.getIndex(config, Indices.FormatsIndex)
        )

        doTest(indices, indexNames, source, true)
        doTest(indices, indexNames, source, false)

        indexNames.foreach { idxName =>
          deleteIndex(idxName)
        }
    }

    def doTest(
        indices: Indices,
        indexNames: List[String],
        source: (List[DataSet], List[DataSet]),
        firstIndex: Boolean
    ) = {
      val filteredSource = source match {
        case (initialDataSets, afterDataSets) =>
          (if (firstIndex) initialDataSets else afterDataSets)
      }

      val externalInterface = filteredSource match {
        case dataSets =>
          new RegistryExternalInterface() {
            override def getDataSetsToken(
                pageToken: String,
                number: Int
            ): scala.concurrent.Future[(Option[String], List[DataSet])] = {
              if (pageToken.toInt < dataSets.length) {
                val start = pageToken.toInt
                val end = start + Math.min(
                  number,
                  dataSets.length - pageToken.toInt
                )
                val theDataSets = dataSets.slice(start, end)
                val tokenOption =
                  if (theDataSets.size < number ||
                      start >= dataSets.size ||
                      theDataSets.size == number && end == dataSets.size)
                    None
                  else
                    Some((pageToken.toInt + number).toString)

                Future(tokenOption, theDataSets)
              } else {
                Future(None, Nil)
              }
            }
            override def getDataSetsReturnToken(
                start: Long = 0,
                number: Int = 10
            ): Future[(Option[String], List[DataSet])] = {
              val theDataSets =
                dataSets.slice(start.toInt, start.toInt + number)
              val tokenOption =
                if (theDataSets.size <= number || theDataSets.size == dataSets.size || dataSets.isEmpty)
                  None
                else
                  Some((start.toInt + number).toString)

              Future(tokenOption, theDataSets)
            }
          }
      }
      val indexer = new ElasticSearchIndexer(MockClientProvider, indices)
      val crawler = new RegistryCrawler(externalInterface, indexer)
      val crawlerApi = new CrawlerApi(crawler, indexer)
      val searchQueryer = new ElasticSearchQueryer(indices)
      val api = new SearchApi(searchQueryer)(config, logger)

      val routes = crawlerApi.routes

      crawler.crawl().await(30 seconds)
      indexer.ready.await(30 seconds)

      // Combine all the datasets but keep what interface they come from
      val allDataSets = filteredSource

      indexNames.foreach { idxName =>
        refresh(idxName)
      }

      try {
        blockUntilExactCount(allDataSets.size, indexNames(0))
      } catch {
        case (e: Throwable) =>
          val sizeQuery = search(indexNames(0)).size(10000)
          val result = client.execute(sizeQuery).await(60 seconds) match {
            case r: RequestSuccess[SearchResponse] =>
              logger.error(
                "Did not have the right dataset count - this looks like it's a kraken, but it's actually more likely to be an elusive failure in the crawler"
              )
              logger.error(
                s"Desired dataset count was ${allDataSets.size}, actual dataset count was ${r.result.totalHits}" +
                  s", firstIndex = ${source._1.size}, afterCount = ${source._2.size}"
              )
              logger.error(s"Returned results: ${r.result.hits}")
              logger.error(s"First index: ${source._1.map(_.normalToString)}")
              logger.error(s"Second index: ${source._2.map(_.normalToString)}")
            case ESGenericException(e) => throw e
          }

          throw e
      }

      Get(s"/v0/datasets?query=*&limit=${allDataSets.size}") ~> addSingleTenantIdHeader ~> api.routes ~> check {
        status shouldBe OK
        val response = responseAs[SearchResult]

        response.dataSets.size should equal(allDataSets.size)

        val bothDataSets = response.dataSets
          .map(
            resDataSet =>
              (resDataSet, allDataSets.find { inputDataSet =>
                resDataSet.identifier == inputDataSet.identifier
              })
          )
          .map {
            case (resDataSet, Some((inputDataSet))) =>
              (resDataSet, inputDataSet)
            case (resDataSet, _) =>
              withClue(
                s"${resDataSet.identifier} indexed at ${resDataSet.indexed} could not be found in ${allDataSets
                  .map(_.identifier)}"
              ) {
                fail
              }
          }

        bothDataSets.foreach {
          case (resDataSet, inputDataSet) =>
            // Everything except publisher and catalog should be the same between input/output
            MagdaMatchers.dataSetEqual(resDataSet, inputDataSet)

            resDataSet.publisher should equal(inputDataSet.publisher)
        }
      }
    }
  }
}
