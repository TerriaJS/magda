package au.csiro.data61.magda.spatial
//package com.monsanto.labs.mwundo

import org.locationtech.jts.geom.MultiPolygon
import org.locationtech.jts.geom.impl.CoordinateArraySequence
import org.locationtech.jts.geom._
import com.monsanto.labs.mwundo.{GeoJson}

/**
  * Created by Ryan Richt on 10/26/15
  */

trait JTSGeoFormat[G] {
  def toJTSGeo(g: G, gf: GeometryFactory): Geometry
  def fromJTSGeo(geo: Geometry): G
}

object JTSGeoFormat {

  implicit def SeqConverter[G: JTSGeoFormat] = new JTSGeoFormat[Seq[G]] {

    val gConverter = implicitly[JTSGeoFormat[G]]

    def toJTSGeo(g: Seq[G], gf: GeometryFactory): Geometry =
      new GeometryCollection(
        g.map(innerG => gConverter.toJTSGeo(innerG, gf)).toArray,
        gf
      )

    def fromJTSGeo(geo: Geometry): Seq[G] = {
      val coll = geo.asInstanceOf[GeometryCollection]
      val geos = Seq.tabulate(coll.getNumGeometries)(coll.getGeometryN)
      geos.map(gConverter.fromJTSGeo)
    }
  }

  implicit object MultiPolygonConverter
      extends JTSGeoFormat[GeoJson.MultiPolygon] {

    private def toRing(coords: Seq[GeoJson.Coordinate], gf: GeometryFactory) = {
      val uniqueCoords =
        coords.map(c => new Coordinate(c.x.toDouble, c.y.toDouble)).toArray
      new LinearRing(
        new CoordinateArraySequence(uniqueCoords :+ uniqueCoords.head),
        gf
      ) // connect the ring back to the head
    }

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

    private def toGeoJsonCoord(c: Coordinate) = GeoJson.Coordinate(c.x, c.y)

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
