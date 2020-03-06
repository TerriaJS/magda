package au.csiro.data61.magda.spatial

import au.csiro.data61.magda.model.GeoJsonFormats._
import com.mapbox.geojson._
import com.monsanto.labs.mwundo.GeoJson
import spray.json._

object GeoJsonValidator {

  def validate(geoJson: GeoJson.Typed): GeoJson = geoJson match {
    case geoJson: GeoJson.Point =>
      validateCoordinate(geoJson.coordinates)
      Point.fromJson(geoJson.toJson.toString)
    case geoJson: GeoJson.MultiPoint =>
      validateCoordinates(geoJson.coordinates)
      MultiPoint.fromJson(geoJson.toJson.toString)
    case geoJson: GeoJson.LineString =>
      validateCoordinates(geoJson.coordinates)
      LineString.fromJson(geoJson.toJson.toString)
    case geoJson: GeoJson.MultiLineString =>
      validateCoordinatesCollection(geoJson.coordinates)
      MultiLineString.fromJson(geoJson.toJson.toString)
    case geoJson: GeoJson.Polygon =>
      validateCoordinatesCollection(geoJson.coordinates)
      Polygon.fromJson(geoJson.toJson.toString)
    case geoJson: GeoJson.MultiPolygon =>
      validateCoordinatesCollections(geoJson.coordinates)
      MultiPolygon.fromJson(geoJson.toJson.toString)
    case _ =>
      throw new Exception(
        s"Invalid GeoJson object: ${geoJson.getClass.toString}"
      )
  }

  /**
    * In GeoJSON and WKT, and therefore Elasticsearch, the correct coordinate order is longitude, latitude (X, Y) within coordinate arrays.
    * This differs from many Geospatial APIs (e.g., Google Maps) that generally use the colloquial latitude, longitude (Y, X).
    * A Longitude (x) can be -180 to +180 & A latitude (y) can only be in the range of -90 to +90.
    */
  def validateCoordinate(c: GeoJson.Coordinate): Boolean = {
    if (c.x.abs > 180.toDouble)
      throw new Exception(
        s"Invalid Longitude (x) range: ${c.x}. Should be within -180 to +180"
      )
    if (c.y.abs > 90.toDouble)
      throw new Exception(
        s"Invalid latitude (y) range: ${c.y}. Should be within -90 to +90"
      )
    true
  }

  def validateCoordinates(cs: Seq[GeoJson.Coordinate]): Boolean = !cs.exists {
    c: GeoJson.Coordinate =>
      !validateCoordinate(c)
  }

  def validateCoordinatesCollection(
      col: Seq[Seq[GeoJson.Coordinate]]
  ): Boolean = !col.exists { cs: Seq[GeoJson.Coordinate] =>
    !validateCoordinates(cs)
  }

  def validateCoordinatesCollections(
      cols: Seq[Seq[Seq[GeoJson.Coordinate]]]
  ): Boolean = !cols.exists { col: Seq[Seq[GeoJson.Coordinate]] =>
    !validateCoordinatesCollection(col)
  }

}
