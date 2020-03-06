package au.csiro.data61.magda.indexer

import akka.actor.ActorSystem
import akka.http.scaladsl.server.Directives._
import au.csiro.data61.magda.api.BaseMagdaApi
import au.csiro.data61.magda.indexer.crawler.{Crawler, CrawlerApi}
import au.csiro.data61.magda.indexer.external.registry.WebhookApi
import au.csiro.data61.magda.indexer.search.SearchIndexer
import com.typesafe.config.Config

class IndexerApi(crawler: Crawler, indexer: SearchIndexer)(
    implicit system: ActorSystem,
    config: Config
) extends BaseMagdaApi {
  implicit val ec = system.dispatcher
  override def getLogger = system.log

  val crawlerRoutes = new CrawlerApi(crawler, indexer).routes
  val hookRoutes = new WebhookApi(indexer).routes

  /**
    * @apiDefine GenericError
    * @apiError (Error 500) {String} Response "Failure"
    */

  val routes =
    magdaRoute {
      pathPrefix("v0") {
        pathPrefix("reindex") {
          crawlerRoutes
        } ~ path("registry-hook") {
          hookRoutes
        }
      }
    }
}
