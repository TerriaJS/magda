package au.csiro.data61.magda.api

import au.csiro.data61.magda.util.DateParser._

import scala.util.matching.Regex
import java.time.OffsetDateTime

import au.csiro.data61.magda.model.misc.QueryRegion
import au.csiro.data61.magda.spatial.RegionSources
import java.time.ZoneOffset
import com.typesafe.config.Config
import au.csiro.data61.magda.model.misc.Region

sealed trait FilterValue[+T] {
  def map[A](a: T => A): FilterValue[A]
}
case class Specified[T](t: T) extends FilterValue[T] {
  override def map[A](a: T => A): FilterValue[A] = Specified(a(t))
  override def toString = t.toString
}
case class Unspecified()(implicit config: Config) extends FilterValue[Nothing] {
  override def map[A](a: Nothing => A): FilterValue[Nothing] = this
  override def toString = config.getString("strings.unspecifiedWord")
}

object FilterValue {
  implicit def filterValueToOption[T](filterValue: FilterValue[T]): Option[T] =
    filterValue match {
      case Specified(inner) => Some(inner)
      case Unspecified()    => None
    }
}
case class Query(
    freeText: Option[String] = None,
    publishers: Set[FilterValue[String]] = Set(),
    dateFrom: Option[FilterValue[OffsetDateTime]] = None,
    dateTo: Option[FilterValue[OffsetDateTime]] = None,
    regions: Set[FilterValue[Region]] = Set(),
    boostRegions: Set[Region] = Set(),
    formats: Set[FilterValue[String]] = Set(),
    publishingState: Set[FilterValue[String]] = Set()
)

object Query {
  val quoteRegex = """"(.*)""".r

  def fromQueryParams(
      freeText: Option[String],
      publishers: Iterable[String],
      dateFrom: Option[String],
      dateTo: Option[String],
      regions: Iterable[String],
      formats: Iterable[String],
      publishingState: Iterable[String]
  )(implicit config: Config): Query = {
    Query(
      freeText = if (freeText.isEmpty) Some("*") else freeText,
      publishers =
        publishers.map(x => filterValueFromString(Some(x))).flatten.toSet,
      dateFrom = dateFilterValueFromString(dateFrom),
      dateTo = dateFilterValueFromString(dateTo),
      regions = regions.map(regionValueFromString).flatten.toSet,
      boostRegions = Set(),
      formats = formats.map(x => filterValueFromString(Some(x))).flatten.toSet,
      publishingState =
        publishingState.map(x => filterValueFromString(Some(x))).flatten.toSet
    )
  }

  private def regionValueFromString(
      input: String
  )(implicit config: Config): Option[FilterValue[Region]] = {
    filterValueFromString(Some(input)).map(
      _.map(
        string =>
          string.toLowerCase.split(":") match {
            case Array(regionType, regionId) =>
              Some(Region(QueryRegion(regionType, regionId)))
            case _ => None
          }
      )
    ) match {
      case Some(Specified(Some(x))) => Some(Specified(x))
      case Some(Specified(None))    => None
      case Some(Unspecified())      => Some(Unspecified())
      case None                     => None
    }
  }

  private def dateFilterValueFromString(
      input: Option[String]
  )(implicit config: Config): Option[FilterValue[OffsetDateTime]] = {
    implicit val defaultOffset =
      ZoneOffset.of(config.getString("time.defaultOffset"))

    filterValueFromString(input)
      .map(
        _.map(
          dateString =>
            parseDate(dateString, false) match {
              case DateTimeResult(instant) => Some(instant)
              case ConstantResult(constant) =>
                constant match {
                  case Now => Some(OffsetDateTime.now())
                }
              case _ => None
            }
        ) match {
          case Specified(Some(value)) => Some(Specified(value))
          case Specified(None)        => None
          case Unspecified()          => Some(Unspecified())
        }
      )
      .flatten
  }

  private def filterValueFromString(
      inputOption: Option[String]
  )(implicit config: Config): Option[FilterValue[String]] =
    inputOption.flatMap(
      input =>
        if (input.trim.isEmpty)
          None
        else if (input.equalsIgnoreCase(
                   config.getString("strings.unspecifiedWord")
                 ))
          Some(Unspecified())
        else
          Some(Specified(input))
    )
}
