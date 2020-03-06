package au.csiro.data61.magda.spatial
import au.csiro.data61.magda.model.misc.Location
import org.scalatest.{Assertion, FlatSpec, FunSpec, Matchers}
import org.slf4j.LoggerFactory

import scala.util.{Failure, Success, Try}

class GeoJsonValidationTest extends FunSpec with Matchers {

  val logger = LoggerFactory.getLogger(getClass)

  describe("GeoJson Data Validation") {
    it("should detect invalidation data with invalid Longitude") {
      val geoJson =
        "{\"type\": \"Polygon\", \"coordinates\": [[[20106.11903, -31.85658], [152.11903, -28.53715], [147.39402, -28.53715], [147.39402, -31.85658], [152.11903, -31.85658]]]}"
      Try(Location(geoJson)) match {
        case Failure(e) =>
          logger.info("Detected invalid GeoJson data: {}", e.toString)
          succeed
        case Success(v) =>
          val g = v.geoJson
          fail("Failed to detect invalid geoJson Data")
      }
    }

    it("should detect invalidation data with invalid latitude") {
      val geoJson =
        "{\"type\": \"Polygon\", \"coordinates\": [[[152.11903, -91.85658], [152.11903, -28.53715], [147.39402, -28.53715], [147.39402, -31.85658], [152.11903, -31.85658]]]}"
      Try(Location(geoJson)) match {
        case Failure(e) =>
          logger.info("Detected invalid GeoJson data: {}", e.toString)
          succeed
        case Success(v) =>
          val g = v.geoJson
          fail("Failed to detect invalid geoJson Data")
      }
    }

    it("should return `Location` if it comes with valid coordinates") {
      val geoJson =
        "{\"type\": \"Polygon\", \"coordinates\": [[[152.11903, -31.85658], [152.11903, -28.53715], [147.39402, -28.53715], [147.39402, -31.85658], [152.11903, -31.85658]]]}"
      Try(Location(geoJson)) match {
        case Failure(e) =>
          logger.info("Detected invalid GeoJson data: {}", e.toString)
          succeed
        case Success(v) =>
          v.geoJson.isEmpty should be(false)
      }
    }

  }
}
