package au.csiro.data61.magda.search.elasticsearch

import com.sksamuel.elastic4s.http.search.Aggregations

object AggUtils {

  def toAgg(data: Any): Option[Aggregations] = data match {
    case d: Map[_, _] => Some(Aggregations(d.asInstanceOf[Map[String, Any]]))
    case _            => None
  }
}
