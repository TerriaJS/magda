package au.csiro.data61.magda.test.util

import java.nio.file.Paths

import scala.concurrent.duration._
import java.nio.file.Path
import java.util.UUID

import org.scalatest.Suite
import com.sksamuel.elastic4s.http.index.admin.RefreshIndexResponse
import com.sksamuel.elastic4s.Indexes
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.Files
import java.nio.file.Files.copy

import au.csiro.data61.magda.test.util.testkit.SharedElasticSugar
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.ElasticClient
import au.csiro.data61.magda.search.elasticsearch.ClientProvider

trait MagdaElasticSugar extends SharedElasticSugar {
  this: Suite =>

  override def refresh(indexes: Indexes): RefreshIndexResponse = {
    client
      .execute {
        refreshIndex(indexes)
      }
      .await(60 seconds)
      .result
  }
}
