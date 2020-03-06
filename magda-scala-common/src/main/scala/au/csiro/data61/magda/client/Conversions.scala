package au.csiro.data61.magda.client

import java.time.{OffsetDateTime, ZoneOffset}

import akka.event.LoggingAdapter
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.Temporal.{ApiDate, PeriodOfTime, Periodicity}
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.util.DateParser
import spray.json._
import spray.json.lenses.JsonLenses._

import scala.util.{Failure, Success, Try}

object Conversions {

  def convertRegistryDataSet(
      hit: Record,
      logger: Option[LoggingAdapter] = None
  )(implicit defaultOffset: ZoneOffset): DataSet = {
    val dcatStrings = hit.aspects.getOrElse("dcat-dataset-strings", JsObject())
    val source = hit.aspects.getOrElse("source", JsObject())
    val temporalCoverage =
      hit.aspects.getOrElse("temporal-coverage", JsObject())
    val distributions = hit.aspects.getOrElse(
      "dataset-distributions",
      JsObject("distributions" -> JsArray())
    )
    val publisher: Option[Record] = Try {
      hit.aspects
        .getOrElse("dataset-publisher", JsObject())
        .extract[JsObject]('publisher.?)
        .map((dataSet: JsObject) => {
          val theDataSet =
            JsObject(
              dataSet.fields + ("tenantId" -> JsNumber(hit.tenantId.get))
            )
          val record = theDataSet.convertTo[Record]
          record
        })
    } match {
      case Success(publisher) => publisher
      case Failure(e) =>
        if (logger.isDefined) {
          logger.get.error(
            s"Failed to parse dataset-publisher: ${e.getMessage}"
          )
        }
        None
    }

    val accessControl = hit.aspects.get("dataset-access-control") match {
      case Some(JsObject(accessControlData)) =>
        Some(
          AccessControl(
            ownerId = accessControlData.get("ownerId") match {
              case Some(JsString(ownerId)) => Some(ownerId)
              case _                       => None
            },
            orgUnitOwnerId = accessControlData.get("orgUnitOwnerId") match {
              case Some(JsString(orgUnitOwnerId)) => Some(orgUnitOwnerId)
              case _                              => None
            },
            preAuthorisedPermissionIds =
              accessControlData.get("preAuthorisedPermissionIds") match {
                case Some(JsArray(preAuthorisedPermissionIds)) =>
                  Some(preAuthorisedPermissionIds.toArray.flatMap {
                    case JsString(permissionId) => Some(permissionId)
                    case _                      => None
                  })
                case _ => None
              }
          )
        )
      case _ => None
    }
    val provenanceOpt = hit.aspects.get("provenance")

    val qualityAspectOpt = hit.aspects.get("dataset-quality-rating")

    var hasQuality: Boolean = false

    val quality: Double = qualityAspectOpt match {
      case Some(qualityAspect) if !qualityAspect.fields.isEmpty =>
        hasQuality = true
        val ratings = qualityAspect.fields.map {
          case (key, value) =>
            value.convertTo[QualityRatingAspect]
        }
        val totalWeighting = ratings.map(_.weighting).reduce(_ + _)

        val score = if (totalWeighting > 0) {
          ratings
            .map(rating => (rating.score) * (rating.weighting / totalWeighting))
            .reduce(_ + _)
        } else 0d

        // Make sure no quality score is set to zero, otherwise it results in relevance being * by 0 which makes
        // results come back in a random order
        if (score > 0) score else 0.01
      case _ => 1d
    }

    // --- intervals could be an empty array
    // --- put in a Try to avoid exceptions
    val coverageStart = ApiDate(
      tryParseDate(
        Try[Option[String]] {
          temporalCoverage.extract[String]('intervals.? / element(0) / 'start.?)
        } match {
          case Success(Some(v)) => Some(v)
          case _                => None
        }
      ),
      dcatStrings.extract[String]('temporal.? / 'start.?).getOrElse("")
    )

    val coverageEnd = ApiDate(
      tryParseDate(
        Try[Option[String]] {
          temporalCoverage.extract[String]('intervals.? / element(0) / 'end.?)
        } match {
          case Success(Some(v)) => Some(v)
          case _                => None
        }
      ),
      dcatStrings.extract[String]('temporal.? / 'end.?).getOrElse("")
    )

    val temporal = (coverageStart, coverageEnd) match {
      case (ApiDate(None, ""), ApiDate(None, "")) => None
      case (ApiDate(None, ""), end)               => Some(PeriodOfTime(None, Some(end)))
      case (start, ApiDate(None, ""))             => Some(PeriodOfTime(Some(start), None))
      case (start, end)                           => Some(PeriodOfTime(Some(start), Some(end)))
    }

    val spatialData = (Try {
      hit.aspects.get("spatial-coverage") match {
        case Some(JsObject(spatialCoverage)) =>
          spatialCoverage.get("bbox") match {
            case Some(bbox: JsArray) =>
              if (bbox.elements.size != 4) {
                None
              } else {
                Some(
                  // --- see magda-registry-aspects/spatial-coverage.schema.json
                  // --- Bounding box in order minlon (west), minlat (south), maxlon (east), maxlat (north)
                  BoundingBox(
                    bbox.elements(3).convertTo[Double],
                    bbox.elements(2).convertTo[Double],
                    bbox.elements(1).convertTo[Double],
                    bbox.elements(0).convertTo[Double]
                  )
                ).map(Location(_))
              }
            case _ => None
          }
        case _ => None
      }
    } match {
      case Success(location) => location
      case Failure(e) =>
        if (logger.isDefined) {
          logger.get.error(
            s"Failed to convert bounding box to spatial data for dataset ${hit.id}: ${e.getMessage}"
          )
        }
        None
    }) match {
      case Some(location) => Some(location)
      case None =>
        Try(dcatStrings.extract[String]('spatial.?).map(Location(_))) match {
          case Success(location) => location
          case Failure(e) =>
            if (logger.isDefined) {
              logger.get.error(
                s"Failed to parse spatial data for dataset ${hit.id}: ${e.getMessage}"
              )
            }
            None
        }
    }

    val publishing = hit.aspects.getOrElse("publishing", JsObject())

    val accessNotes = Try {
      hit.aspects.get("access") match {
        case Some(JsObject(access)) =>
          Some(
            DataSetAccessNotes(
              notes = access.get("notes") match {
                case Some(JsString(notes)) => Some(notes)
                case _                     => None
              },
              location = access.get("location") match {
                case Some(JsString(location)) => Some(location)
                case _                        => None
              }
            )
          )
        case _ => None
      }
    } match {
      case Success(notes) => notes
      case Failure(e) =>
        if (logger.isDefined) {
          logger.get.error(
            s"Failed to convert dataset access notes aspect for dataset ${hit.id}: ${e.getMessage}"
          )
        }
        None
    }

    DataSet(
      identifier = hit.id,
      tenantId = hit.tenantId.get,
      title = dcatStrings.extract[String]('title.?),
      catalog = source.extract[String]('name.?),
      description = getNullableStringField(dcatStrings, "description"),
      issued = tryParseDate(dcatStrings.extract[String]('issued.?)),
      modified = tryParseDate(dcatStrings.extract[String]('modified.?)),
      languages = dcatStrings.extract[String]('languages.? / *).toSet,
      publisher = publisher.map(convertPublisher),
      accrualPeriodicity = dcatStrings
        .extract[String]('accrualPeriodicity.?)
        .map(Periodicity.fromString(_)),
      accrualPeriodicityRecurrenceRule =
        dcatStrings.extract[String]('accrualPeriodicityRecurrenceRule.?),
      spatial = spatialData, // TODO: move this to the CKAN Connector
      temporal = temporal,
      themes = dcatStrings.extract[String]('themes.? / *),
      keywords = dcatStrings.extract[String]('keywords.? / *),
      contactPoint =
        dcatStrings.extract[String]('contactPoint.?).map(cp => Agent(Some(cp))),
      distributions = distributions
        .extract[JsObject]('distributions.? / *)
        .map(convertDistribution(_, hit)),
      landingPage = dcatStrings.extract[String]('landingPage.?),
      quality = quality,
      hasQuality = hasQuality,
      score = None,
      source = hit.aspects.get("source").map(_.convertTo[DataSouce]),
      provenance = provenanceOpt
        .map(_.convertTo[Provenance]),
      publishingState = Some(
        publishing.extract[String]('state.?).getOrElse("published")
      ), // assume not set means published
      accessControl = accessControl,
      accessNotes = accessNotes
    )
  }

  private def convertDistribution(distribution: JsObject, hit: Record)(
      implicit defaultOffset: ZoneOffset
  ): Distribution = {
    val theDistribution = JsObject(
      distribution.fields + ("tenantId" -> JsNumber(hit.tenantId.get))
    )
    val distributionRecord: Record =
      theDistribution.convertTo[Record]
    val dcatStrings = distributionRecord.aspects
      .getOrElse("dcat-distribution-strings", JsObject())
    val datasetFormatAspect =
      distributionRecord.aspects.getOrElse("dataset-format", JsObject())

    val mediaTypeString = dcatStrings.extract[String]('mediaType.?)
    val formatString = dcatStrings.extract[String]('format.?)
    val urlString = dcatStrings.extract[String]('downloadURL.?)
    val descriptionString = dcatStrings.extract[String]('description.?)
    val betterFormatString = datasetFormatAspect.extract[String]('format.?)

    Distribution(
      identifier = Some(distributionRecord.id),
      title = dcatStrings
        .extract[String]('title.?)
        .getOrElse(distributionRecord.name),
      description = descriptionString,
      issued = tryParseDate(dcatStrings.extract[String]('issued.?)),
      modified = tryParseDate(dcatStrings.extract[String]('modified.?)),
      license = dcatStrings
        .extract[String]('license.?)
        .map(name => License(Some(name))),
      rights = dcatStrings.extract[String]('rights.?),
      accessURL = dcatStrings.extract[String]('accessURL.?),
      downloadURL = urlString,
      byteSize = dcatStrings
        .extract[Int]('byteSize.?)
        .flatMap(bs => Try(bs.toInt).toOption),
      mediaType = Distribution.parseMediaType(mediaTypeString, None, None),
      format = betterFormatString match {
        case Some(format) => Some(format)
        case None         => formatString
      },
      source =
        distributionRecord.aspects.get("source").map(_.convertTo[DataSouce])
    )
  }

  private def tryParseDate(
      dateString: Option[String]
  )(implicit defaultOffset: ZoneOffset): Option[OffsetDateTime] = {
    val YEAR_100 = OffsetDateTime.of(100, 1, 1, 0, 0, 0, 0, defaultOffset)
    val YEAR_1000 = OffsetDateTime.of(1000, 1, 1, 0, 0, 0, 0, defaultOffset)

    dateString
      .flatMap(s => DateParser.parseDateDefault(s, false))
      .map {
        //FIXME: Remove this hackiness when we get a proper temporal minion
        case date if date.isBefore(YEAR_100) =>
          date.withYear(date.getYear + 2000)
        case date if date.isBefore(YEAR_1000) =>
          date.withYear(Integer.parseInt(date.getYear.toString() + "0"))
        case date => date
      }
  }
}
