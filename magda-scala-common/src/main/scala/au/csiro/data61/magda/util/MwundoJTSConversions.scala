package au.csiro.data61.magda.util

import org.locationtech.jts.geom.GeometryFactory
import org.locationtech.jts.geom.impl.CoordinateArraySequence
import org.locationtech.jts.geom.LinearRing
import org.locationtech.jts.geom._
import com.monsanto.labs.mwundo.{GeoJson}
import org.locationtech.spatial4j.context.jts.JtsSpatialContext
import au.csiro.data61.magda.spatial.JTSGeoFormat

object MwundoJTSConversions {
  implicit val gf = JtsSpatialContext.GEO.getShapeFactory.getGeometryFactory
  private def toGeoJsonCoord(c: Coordinate) = GeoJson.Coordinate(c.x, c.y)
  private def toRing(coords: Seq[GeoJson.Coordinate], gf: GeometryFactory) = {
    val uniqueCoords =
      coords.map(c => new Coordinate(c.x.toDouble, c.y.toDouble)).toArray
    new LinearRing(new CoordinateArraySequence(uniqueCoords), gf) // connect the ring back to the head
  }

  implicit object GeometryConverter extends JTSGeoFormat[GeoJson.Geometry] {

    def toJTSGeo(g: GeoJson.Geometry, gf: GeometryFactory): Geometry = {
      g match {
        case point: GeoJson.Point => PointConverter.toJTSGeo(point, gf)
        case multiPoint: GeoJson.MultiPoint =>
          MultiPointConverter.toJTSGeo(multiPoint, gf)
        case lineString: GeoJson.LineString =>
          LineStringConverter.toJTSGeo(lineString, gf)
        case multiLineString: GeoJson.MultiLineString =>
          MultiLineStringConverter.toJTSGeo(multiLineString, gf)
        case polygon: GeoJson.Polygon => PolygonConverter.toJTSGeo(polygon, gf)
        case multiPolygon: GeoJson.MultiPolygon =>
          MultiPolygonConverter.toJTSGeo(multiPolygon, gf)
      }
    }

    def fromJTSGeo(geo: Geometry): GeoJson.Geometry = {
      geo.getGeometryType match {
        case "Point"           => PointConverter.fromJTSGeo(geo)
        case "MultiPoint"      => MultiPointConverter.fromJTSGeo(geo)
        case "LineString"      => LineStringConverter.fromJTSGeo(geo)
        case "MultiLineString" => MultiLineStringConverter.fromJTSGeo(geo)
        case "Polygon"         => PolygonConverter.fromJTSGeo(geo)
        case "MultiPolygon"    => MultiPolygonConverter.fromJTSGeo(geo)
      }
    }
  }

  trait MwundoGeometryConvertible {
    def toJTSGeo(): Geometry
  }

  trait JTSGeometryConvertible {
    def fromJTSGeo(): GeoJson.Geometry
  }

  implicit def mwundoToJTS(input: GeoJson.Geometry): MwundoGeometryConvertible =
    new MwundoGeometryConvertible {
      override def toJTSGeo() = GeometryConverter.toJTSGeo(input, gf)
    }
  implicit def jtsToMwundo(input: Geometry): JTSGeometryConvertible =
    new JTSGeometryConvertible {
      override def fromJTSGeo() = GeometryConverter.fromJTSGeo(input)
    }

  implicit object PointConverter extends JTSGeoFormat[GeoJson.Point] {

    def toJTSGeo(g: GeoJson.Point, gf: GeometryFactory): Point = {
      gf.createPoint(
        new Coordinate(g.coordinates.x.toDouble, g.coordinates.y.toDouble)
      )
    }

    def fromJTSGeo(geo: Geometry): GeoJson.Point = {
      GeoJson.Point(toGeoJsonCoord(geo.getCoordinate))
    }
  }

  implicit object MultiPointConverter extends JTSGeoFormat[GeoJson.MultiPoint] {

    def toJTSGeo(g: GeoJson.MultiPoint, gf: GeometryFactory): MultiPoint = {
      gf.createMultiPoint(
        g.coordinates
          .map(c => new Coordinate(c.x.toDouble, c.y.toDouble))
          .toArray
      )
    }

    def fromJTSGeo(geo: Geometry): GeoJson.MultiPoint = {
      GeoJson.MultiPoint(geo.getCoordinates.map(toGeoJsonCoord).toSeq)
    }
  }

  implicit object LineStringConverter extends JTSGeoFormat[GeoJson.LineString] {

    def toJTSGeo(g: GeoJson.LineString, gf: GeometryFactory): LineString = {
      gf.createLineString(
        g.coordinates
          .map(c => new Coordinate(c.x.toDouble, c.y.toDouble))
          .toArray
      )
    }

    def fromJTSGeo(geo: Geometry): GeoJson.LineString = {
      GeoJson.LineString(geo.getCoordinates.map(toGeoJsonCoord).toSeq)
    }
  }

  implicit object MultiLineStringConverter
      extends JTSGeoFormat[GeoJson.MultiLineString] {

    def toJTSGeo(
        g: GeoJson.MultiLineString,
        gf: GeometryFactory
    ): MultiLineString = {
      gf.createMultiLineString(
        g.coordinates
          .map(
            jtsCoord =>
              gf.createLineString(
                jtsCoord
                  .map(c => new Coordinate(c.x.toDouble, c.y.toDouble))
                  .toArray
              )
          )
          .toArray
      )
    }

    def fromJTSGeo(geo: Geometry): GeoJson.MultiLineString = {
      val p = geo.asInstanceOf[MultiLineString]

      val x = for {
        i <- 0 to p.getNumGeometries - 1
      } yield p.getGeometryN(i).getCoordinates.map(toGeoJsonCoord).toSeq

      GeoJson.MultiLineString(x)
    }
  }

  implicit object PolygonConverter extends JTSGeoFormat[GeoJson.Polygon] {
    override def toJTSGeo(g: GeoJson.Polygon, gf: GeometryFactory): Polygon = {
      val outerHull = g.coordinates.head
      val interiorHoles = g.coordinates.tail
      gf.createPolygon(
        toRing(outerHull, gf),
        interiorHoles.map(h => toRing(h, gf)).toArray
      )
    }

    override def fromJTSGeo(geo: Geometry): GeoJson.Polygon = {

      //      val polys = Seq.tabulate(geo.getNumGeometries)(i => geo.getGeometryN(i).asInstanceOf[Polygon])
      val p = geo.asInstanceOf[Polygon]
      val all =
        Seq(p.getExteriorRing.getCoordinates.map(toGeoJsonCoord).toSeq) ++
          Seq.tabulate(p.getNumInteriorRing)(
            i => p.getInteriorRingN(i).getCoordinates.map(toGeoJsonCoord).toSeq
          )

      GeoJson.Polygon(all)
    }
  }

  implicit object MultiPolygonConverter
      extends JTSGeoFormat[GeoJson.MultiPolygon] {

    def toJTSGeo(g: GeoJson.MultiPolygon, gf: GeometryFactory) =
      gf.createMultiPolygon(
        g.coordinates.map { polyCoordLists =>
          val outerHull = polyCoordLists.head
          val interiorHoles = polyCoordLists.tail
          gf.createPolygon(
            toRing(outerHull, gf),
            interiorHoles.map(h => toRing(h, gf)).toArray
          )
        }.toArray
      )

    def fromJTSGeo(geo: Geometry): GeoJson.MultiPolygon = {

      val polys = Seq.tabulate(geo.getNumGeometries)(
        i => geo.getGeometryN(i).asInstanceOf[Polygon]
      )
      val all = polys.map(
        p =>
          Seq(p.getExteriorRing.getCoordinates.map(toGeoJsonCoord).toSeq) ++
            Seq.tabulate(p.getNumInteriorRing)(
              i =>
                p.getInteriorRingN(i).getCoordinates.map(toGeoJsonCoord).toSeq
            )
      )

      GeoJson.MultiPolygon(all)
    }
  }
}
