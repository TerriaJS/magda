package au.csiro.data61.magda.api.model

import au.csiro.data61.magda.model.misc.{DataSet, Facet, Region, Agent}
import au.csiro.data61.magda.model.Temporal
import au.csiro.data61.magda.model.Temporal.PeriodOfTime
import au.csiro.data61.magda.model.misc
import au.csiro.data61.magda.search.SearchStrategy
import spray.json.{DefaultJsonProtocol, JsString, JsValue, JsonFormat}
import au.csiro.data61.magda.api.{Query, FilterValue, Specified, Unspecified}
import au.csiro.data61.magda.model.misc.{QueryRegion}

import java.time.OffsetDateTime
import com.typesafe.config.Config

case class SearchResult(
    query: Query,
    hitCount: Long,
    facets: Option[Seq[Facet]] = None,
    temporal: Option[PeriodOfTime] = None,
    dataSets: List[DataSet],
    errorMessage: Option[String] = None,
    strategy: Option[SearchStrategy] = None
)

case class RegionSearchResult(
    query: Option[String],
    hitCount: Long,
    regions: List[Region]
)

case class AutoCompleteQueryResult(
    inputString: String,
    suggestions: Seq[String],
    errorMessage: Option[String] = None
)

case class OrganisationsSearchResult(
    query: Option[String],
    hitCount: Long,
    organisations: List[Agent],
    errorMessage: Option[String] = None
)

trait Protocols
    extends DefaultJsonProtocol
    with Temporal.Protocols
    with misc.Protocols {
  implicit object SearchStrategyFormat extends JsonFormat[SearchStrategy] {
    override def write(strat: SearchStrategy): JsString =
      JsString.apply(strat.name)

    override def read(json: JsValue): SearchStrategy =
      SearchStrategy.parse(json.convertTo[String])
  }

  class FilterValueFormat[T](
      implicit t: JsonFormat[T],
      implicit val config: Config
  ) extends JsonFormat[FilterValue[T]] {
    override def write(filterValue: FilterValue[T]): JsValue =
      filterValue match {
        case Specified(inner) => t.write(inner)
        case Unspecified()    => JsString(filterValue.toString)
      }

    override def read(json: JsValue): FilterValue[T] = json match {
      case JsString(string) =>
        if (string.toLowerCase.equals(Unspecified().toString.toLowerCase()))
          Unspecified()
        else Specified(t.read(json))
      case other => Specified(t.read(other))
    }
  }
  implicit def stringFilterValueFormat(implicit config: Config) =
    new FilterValueFormat[String]
  implicit def offsetDateFilterValueFormat(implicit config: Config) =
    new FilterValueFormat[OffsetDateTime]
  implicit def queryRegionFilterValueFormat(implicit config: Config) =
    new FilterValueFormat[Region]()(apiRegionFormat, config)
  implicit def queryFormat(implicit config: Config) = {
    implicit val regionFormat = apiRegionFormat
    jsonFormat8(Query.apply)
  }
  implicit def searchResultFormat(implicit config: Config) =
    jsonFormat7(SearchResult.apply)
  implicit val regionSearchResultFormat = {
    implicit val regionFormat = apiRegionFormat
    jsonFormat3(RegionSearchResult.apply)
  }
  implicit val OrganisationsSearchResultFormat = {
    jsonFormat4(OrganisationsSearchResult.apply)
  }
  implicit val AutoCompleteQueryResultFormat = jsonFormat3(
    AutoCompleteQueryResult.apply
  )
}

object Protocols extends Protocols {}
