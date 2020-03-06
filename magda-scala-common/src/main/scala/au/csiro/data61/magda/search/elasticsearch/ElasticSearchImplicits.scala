package au.csiro.data61.magda.search.elasticsearch

import au.csiro.data61.magda.model.misc.{
  Agent,
  BoundingBox,
  DataSet,
  FacetOption,
  QueryRegion,
  Region
}
import au.csiro.data61.magda.model.misc.Protocols
import spray.json._
import scala.util.Try

import collection.JavaConverters._
import com.sksamuel.elastic4s.{AggReader, Hit, HitReader, Indexable}
import com.sksamuel.elastic4s.http.search.{Aggregations, HasAggregations}

object ElasticSearchImplicits extends Protocols {

  implicit object SprayJsonIndexable extends Indexable[JsValue] {
    override def json(t: JsValue): String = t.toString(CompactPrinter)
  }

  implicit object SprayJsonHitAs extends HitReader[JsValue] {
    override def read(hit: Hit): Try[JsValue] =
      Try(hit.sourceAsString.parseJson)
  }

  implicit object DataSetHitAs extends HitReader[DataSet] {
    override def read(hit: Hit): Try[DataSet] = {
      Try(
        hit.sourceAsString.parseJson
          .convertTo[DataSet]
          .copy(score = Some(hit.score))
      )
    }
  }

  implicit object DataSetHitAggAs extends AggReader[DataSet] {
    override def read(json: String): Try[DataSet] = {
      Try(json.parseJson.convertTo[DataSet])
    }
  }

  implicit object RegionHitAs extends HitReader[Region] {
    override def read(hit: Hit): Try[Region] = {
      Try(hit.to[JsValue].asJsObject.convertTo[Region](esRegionFormat))
    }
  }

  def aggregationsToFacetOptions(
      aggregation: Option[HasAggregations]
  ): Seq[FacetOption] = aggregation match {
    case None => Nil
    case Some(agg) =>
      val buckets = if (agg.contains("buckets")) {
        agg.dataAsMap.get("buckets")
      } else {
        agg.dataAsMap
          .get("nested")
          .flatMap(_.asInstanceOf[Map[String, Any]].get("buckets"))
      }

      buckets.toSeq.flatMap(
        _.asInstanceOf[Seq[Map[String, Any]]]
          .map(
            m =>
              new FacetOption(
                identifier = None,
                value = m("key").toString,
                hitCount = m("doc_count").toString.toLong
              )
          )
      )
  }
}
