package au.csiro.data61.magda.spatial

import java.io.File
import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.client.RequestBuilding
import akka.stream.Materializer
import akka.stream.scaladsl.FileIO
import akka.stream.scaladsl.JsonFraming
import akka.stream.scaladsl.Source
import spray.json.JsObject
import spray.json._
import scala.concurrent.Future
import com.typesafe.config.Config

trait RegionLoader {
  def setupRegions(): Source[(RegionSource, JsObject), _]
}

object RegionLoader {

  def apply(
      regionSources: List[RegionSource]
  )(implicit config: Config, system: ActorSystem, materializer: Materializer) =
    new FileRegionLoader(regionSources)
}

class FileRegionLoader(regionSources: List[RegionSource])(
    implicit val config: Config,
    implicit val system: ActorSystem,
    implicit val materializer: Materializer
) extends RegionLoader {
  implicit val ec = system.dispatcher
  val pool = Http().superPool[Int]()

  def loadABSRegions(regionSource: RegionSource): Future[File] = {
    val file = new File(
      s"${config.getString("regionLoading.cachePath")}/${regionSource.name}.json"
    )

    if (file.exists()) {
      system.log.info(
        "Found shapes for region {} at {}, loading from there",
        regionSource.name,
        file.getPath
      )
      Future(file)
    } else {
      system.log.info(
        "Could not find shapes for {} at {}, loading from {} and caching to {} instead",
        regionSource.name,
        file.getPath,
        regionSource.url,
        file.getPath
      )
      file.getParentFile.mkdirs()
      file.createNewFile()

      val request = RequestBuilding.Get(regionSource.url.toString)

      system.log.info("Indexing regions from {}", regionSource.url)

      Source
        .single((request, 0))
        .via(pool)
        .flatMapConcat {
          case (response, _) =>
            response.get.entity.withoutSizeLimit().dataBytes
        }
        .runWith(FileIO.toPath(file.toPath()))
        .recover {
          case e: Throwable =>
            system.log.info(
              "Encountered error {} while downloading shapes for {}, deleting {}",
              e.getMessage,
              regionSource.name,
              file.getPath
            )
            file.delete()
            throw e
        }
        .map(_ => file)
    }
  }

  override def setupRegions(): Source[(RegionSource, JsObject), _] = {
    Source(regionSources)
      .mapAsync(4)(
        regionSource => loadABSRegions(regionSource).map((_, regionSource))
      )
      .flatMapConcat {
        case (file, regionSource) =>
          val splitFlow = JsonFraming.objectScanner(Int.MaxValue)

          FileIO
            .fromPath(file.toPath(), 262144)
            .via(splitFlow)
            .map(byteString => byteString.decodeString("UTF-8"))
            .map(string => string.parseJson)
            .map(jsValue => (regionSource, jsValue.asJsObject))
      }
  }
}
