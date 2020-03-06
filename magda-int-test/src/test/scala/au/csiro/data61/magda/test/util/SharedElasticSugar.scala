package au.csiro.data61.magda.test.util.testkit

import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.ElasticDsl
import com.sksamuel.elastic4s.http.ElasticClient
import com.sksamuel.elastic4s.http.index.admin.RefreshIndexResponse
import com.sksamuel.elastic4s.{IndexAndTypes, Indexes}
import org.elasticsearch.ResourceAlreadyExistsException
import org.elasticsearch.transport.RemoteTransportException
import org.slf4j.{Logger, LoggerFactory}

trait SharedElasticSugar extends HttpElasticSugar

/**
  * Provides helper methods for things like refreshing an index, and blocking until an
  * index has a certain count of documents. These methods are very useful when writing
  * tests to allow for blocking, imperative coding
  */
trait HttpElasticSugar {

  private val esLogger: Logger = LoggerFactory getLogger getClass.getName

  //val client = getNode.client(false)
  def client(): ElasticClient
  def http = client

  // refresh all indexes
  def refreshAll(): RefreshIndexResponse = refresh(Indexes.All)

  // refreshes all specified indexes
  def refresh(indexes: Indexes): RefreshIndexResponse =
    http
      .execute {
        refreshIndex(indexes)
      }
      .await
      .result

  def blockUntilGreen(): Unit =
    blockUntil("Expected cluster to have green status") { () =>
      http
        .execute {
          clusterHealth()
        }
        .await
        .result
        .status
        .toUpperCase == "GREEN"
    }

  def blockUntil(explain: String)(predicate: () => Boolean): Unit = {

    var backoff = 0
    var done = false

    while (backoff <= 16 && !done) {
      if (backoff > 0) Thread.sleep(200 * backoff)
      backoff = backoff + 1
      try {
        done = predicate()
      } catch {
        case e: Throwable =>
          esLogger.warn("problem while testing predicate", e)
      }
    }

    require(done, s"Failed waiting on: $explain")
  }

  def ensureIndexExists(index: String): Unit =
    try {
      http.execute {
        createIndex(index)
      }.await
    } catch {
      case _: ResourceAlreadyExistsException => // Ok, ignore.
      case _: RemoteTransportException       => // Ok, ignore.
    }

  def doesIndexExists(name: String): Boolean =
    http
      .execute {
        indexExists(name)
      }
      .await
      .result
      .isExists

  def deleteIndex(name: String): Unit =
    if (doesIndexExists(name)) {
      http.execute {
        ElasticDsl.deleteIndex(name)
      }.await
    }

  def truncateIndex(index: String): Unit = {
    deleteIndex(index)
    ensureIndexExists(index)
    blockUntilEmpty(index)
  }

  def blockUntilDocumentExists(id: String, index: String): Unit =
    blockUntil(s"Expected to find document $id") { () =>
      val resp = http.execute {
        get(id).from(index)
      }.await
      resp.isSuccess && resp.result.exists
    }

  def blockUntilCount(expected: Long, index: String): Unit =
    blockUntil(s"Expected count of $expected") { () =>
      val result = http.execute {
        search(index).matchAllQuery().size(0)
      }.await
      expected <= result.result.totalHits
    }

  def blockUntilExactCount(expected: Long, index: String): Unit =
    blockUntil(s"Expected count of $expected") { () =>
      expected == http
        .execute {
          search(index).size(0)
        }
        .await
        .result
        .totalHits
    }

  def blockUntilEmpty(index: String): Unit =
    blockUntil(s"Expected empty index $index") { () =>
      http
        .execute {
          search(Indexes(index)).size(0)
        }
        .await
        .result
        .totalHits == 0
    }

  def blockUntilIndexExists(index: String): Unit =
    blockUntil(s"Expected exists index $index") { () ⇒
      doesIndexExists(index)
    }

  def blockUntilIndexNotExists(index: String): Unit =
    blockUntil(s"Expected not exists index $index") { () ⇒
      !doesIndexExists(index)
    }

}
