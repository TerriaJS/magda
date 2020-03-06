package au.csiro.data61.magda.model

import java.time._

import au.csiro.data61.magda.util.DateParser._
import spray.json._

object Temporal {

  object Periodicity {
    val asNeeded: Periodicity = new Periodicity(text = Some("As Needed"))

    def fromString(string: String) = Periodicity(text = Some(string))
  }

  case class Periodicity private (
      text: Option[String] = None,
      duration: Option[java.time.Duration] = None
  )

  case class PeriodOfTime(
      start: Option[ApiDate] = None,
      end: Option[ApiDate] = None
  )

  object PeriodOfTime {
    val splitters = List("\\s*to\\s*", "\\s*-\\s*")

    def trySplit(raw: String, modified: Option[OffsetDateTime])(
        implicit defaultOffset: ZoneOffset
    ): Option[PeriodOfTime] =
      splitters.view
        .map(raw.split(_))
        .filter(_.length == 2)
        .map(
          array =>
            PeriodOfTime(
              ApiDate.parse(array(0), modified, false),
              (ApiDate.parse(array(1), modified, true))
            )
        )
        .filter(
          x => x.start.map(_.date).isDefined || x.end.map(_.date).isDefined
        )
        .sortWith { (leftPeriod, rightPeriod) =>
          // Create a list of tuples where _1 is the text option and _2 is the parsed date option
          val options: List[Option[_]] = List(leftPeriod, rightPeriod)
            .flatMap(period => List(period.start, period.end))
            .map(option => option.map(_.date))

          options match {
            // The circumstances in which left is better are if it has a date and right doesn't
            case List(Some(_), Some(_), _, _)    => true
            case List(Some(_), None, None, None) => true
            case List(None, Some(_), None, None) => true
            case _                               => false
          }
        }
        .headOption

    def parse(
        start: Option[String],
        end: Option[String],
        modified: Option[OffsetDateTime]
    )(implicit defaultOffset: ZoneOffset): Option[PeriodOfTime] = {
      val startDate = start.flatMap(ApiDate.parse(_, modified, false))
      val endDate = end.flatMap(ApiDate.parse(_, modified, true))
      lazy val defaultPeriod = Some(new PeriodOfTime(startDate, endDate))

      (
        startDate.map(_.text),
        endDate.map(_.text),
        startDate.flatMap(_.date),
        endDate.flatMap(_.date)
      ) match {
        // Unparsable text in both start and end - this might mean that there's split values in both (e.g. start=1999-2000, end=2010-2011).
        // In this case we split each and take the earlier value for start and later value for end.
        case (Some(start), Some(end), None, None) =>
          Some(
            new PeriodOfTime(
              start = trySplit(start, modified).flatMap(_.start),
              end = trySplit(end, modified).flatMap(_.end)
            )
          )
        // We didn't get any dates, so maybe one of the text fields conflates both, e.g. "2015-2016"
        case (Some(start), None, _, None) =>
          trySplit(start, modified) orElse defaultPeriod
        case (None, Some(end), None, _) =>
          trySplit(end, modified) orElse defaultPeriod
        // No values for anything
        case (None, None, None, None) => None
        // We already managed to parse a date, so leave this alone
        case _ => defaultPeriod
      }
    }
  }

  case class ApiDate(
      date: Option[OffsetDateTime] = None,
      text: String
  )

  object ApiDate {

    def parse(
        raw: String,
        modifiedOption: Option[OffsetDateTime],
        atEnd: Boolean
    )(implicit defaultOffset: ZoneOffset): Option[ApiDate] =
      parseDate(raw, atEnd) match {
        case DateTimeResult(instant) => Some(ApiDate(Some(instant), raw))
        case ConstantResult(constant) =>
          constant match {
            case Now =>
              modifiedOption match {
                case Some(modified) => Some(ApiDate(Some(modified), raw))
                case None           => Some(ApiDate(None, raw))
              }
          }
        case ParseFailure => None
      }
  }

  trait Protocols extends DefaultJsonProtocol {

    implicit object DateTimeFormat extends JsonFormat[OffsetDateTime] {
      override def write(dateTime: OffsetDateTime): JsString =
        JsString.apply(dateTime.toString())

      override def read(json: JsValue): OffsetDateTime =
        OffsetDateTime.parse(json.convertTo[String])
    }

    implicit val apiDate = jsonFormat2(ApiDate.apply)
    implicit val periodOfTimeFormat = jsonFormat2(PeriodOfTime.apply)

    implicit object DurationFormat extends JsonFormat[Duration] {
      override def write(duration: Duration): JsNumber =
        JsNumber(duration.toMillis())

      override def read(json: JsValue): Duration =
        Duration.ofMillis(json.convertTo[Long])
    }

    implicit val periodicityFormat = jsonFormat2(Periodicity.apply)
  }

}
