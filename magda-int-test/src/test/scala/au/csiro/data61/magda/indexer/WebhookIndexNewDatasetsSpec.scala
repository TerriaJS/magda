package au.csiro.data61.magda.indexer

import java.time.temporal.ChronoUnit

import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.model.Temporal.{PeriodOfTime, Periodicity}
import au.csiro.data61.magda.model.misc._
import spray.json._
import au.csiro.data61.magda.model.Registry._

class WebhookIndexNewDatasetsSpec extends WebhookSpecBase {

  describe("when webhook received") {
    it("should index new datasets") {
      loadDatasetsThroughEvents() {
        (allDataSets: List[DataSet], response: SearchResult) =>
          val cleanedInputDataSets = allDataSets.map(
            dataSet =>
              dataSet.copy(
                // The registry only looks for the duration text so copy the actual duration into the text
                accrualPeriodicity = dataSet.accrualPeriodicity
                  .flatMap(_.duration)
                  .map(
                    duration =>
                      Periodicity(
                        text =
                          Some(duration.get(ChronoUnit.SECONDS) * 1000 + " ms")
                      )
                  ),
                publisher = dataSet.publisher.map(
                  publisher =>
                    Agent(
                      identifier = publisher.identifier,
                      aggKeywords =
                        if (publisher.jurisdiction.isEmpty)
                          Some(
                            publisher.name
                              .getOrElse(publisher.identifier.get)
                              .toLowerCase
                          )
                        else
                          publisher.jurisdiction
                            .map(
                              publisher.name
                                .getOrElse(publisher.identifier.get) + ":" + _
                            )
                            .map(_.toLowerCase),
                      name = publisher.name,
                      acronym = getAcronymFromPublisherName(publisher.name),
                      imageUrl = publisher.imageUrl
                    )
                ),
                source = dataSet.source,
                quality = 0,
                distributions = dataSet.distributions.map(
                  distribution =>
                    distribution.copy(
                      // Distribution only takes into account the name
                      license = distribution.license
                        .flatMap(_.name)
                        .map(name => License(Some(name))),
                      // Code derives media type from the format rather than reading it directly.
                      mediaType = None
                    )
                ),
                // Contact points only look for name at the moment
                contactPoint = dataSet.contactPoint
                  .flatMap(_.name)
                  .map(name => Agent(Some(name))),
                // Registry doesn't know how to do spatial extent yet, so just keep the text and produce text from geoJson
                spatial = convertSpatialDataUsingGeoJsonField(dataSet.spatial),
                temporal = dataSet.temporal match {
                  // The registry -> dataset converter rightly does this conversion.
                  case Some(PeriodOfTime(None, None)) => None

                  // The converter also filters out spatial extends that are a blank string, so we need to do that.
                  case Some(PeriodOfTime(from, to)) =>
                    PeriodOfTime(filterDate(from), filterDate(to)) match {
                      case PeriodOfTime(None, None) => None
                      case other                    => Some(other)
                    }
                  case other => other
                }
              )
          )

          val cleanedOutputDataSets = response.dataSets.map(
            dataSet =>
              dataSet.copy(
                // We don't care about this.
                indexed = None,
                quality = 0,
                score = None,
                spatial = convertSpatialDataUsingGeoJsonField(dataSet.spatial),
                distributions = dataSet.distributions.map(
                  distribution =>
                    distribution.copy(
                      // This will be derived from the format so might not match the input
                      mediaType = None
                    )
                )
              )
          )

          withClue(
            cleanedOutputDataSets.toJson.prettyPrint + "\n should equal \n" + cleanedInputDataSets.toJson.prettyPrint
          ) {
            cleanedOutputDataSets.toSet should equal(cleanedInputDataSets.toSet)

            val matched = cleanedOutputDataSets.map(
              input =>
                input -> cleanedInputDataSets
                  .find(_.identifier == input.identifier)
                  .get
            )
            val eps = 1e-3
            matched.foreach {
              case (input, output) =>
                input.quality should be(output.quality +- eps)
            }
          }
      }
    }
  }
}
