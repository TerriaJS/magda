package au.csiro.data61.magda.search.elasticsearch

import scala.collection.JavaConversions._
import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.IndexesAndTypes
import com.typesafe.config.Config
import com.typesafe.config.ConfigObject
import au.csiro.data61.magda.model.misc._

trait Indices {

  def indexVersions(config: Config) =
    config.getConfig("elasticSearch.indices").root().map {
      case (name: String, config: ConfigObject) =>
        name -> config.toConfig.getInt("version")
    }

  def getIndex(config: Config, index: Indices.Index): String = {
    (index.name + indexVersions(config)(index.name))
  }

  def getType(`type`: Indices.IndexType) = `type`.name

  def typeForFacet(facetType: FacetType) = facetType match {
    case Format    => Indices.FormatsIndexType
    case Publisher => Indices.PublisherIndexType
  }

  def indexForFacet(facetType: FacetType)(implicit config: Config) =
    facetType match {
      case Format    => getIndex(config, Indices.FormatsIndex)
      case Publisher => getIndex(config, Indices.PublishersIndex)
    }

}

object DefaultIndices extends Indices {}

object Indices {
  sealed trait Index {
    def name: String
  }
  case object DataSetsIndex extends Index {
    override def name = "datasets"
  }
  case object RegionsIndex extends Index {
    override def name = "regions"
  }
  case object PublishersIndex extends Index {
    override def name = "publishers"
  }
  case object FormatsIndex extends Index {
    override def name = "formats"
  }

  sealed trait IndexType {
    def name: String
  }

  case object DataSetsIndexType extends IndexType {
    override def name() = "datasets"
  }
  case object RegionsIndexType extends IndexType {
    override def name() = "regions"
  }
  case object FormatsIndexType extends IndexType {
    override def name() = "formats"
  }
  case object PublisherIndexType extends IndexType {
    override def name() = "publishers"
  }
}
