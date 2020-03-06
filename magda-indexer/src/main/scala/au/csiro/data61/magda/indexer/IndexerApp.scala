package au.csiro.data61.magda.indexer

import akka.actor.Actor
import akka.actor.ActorLogging
import akka.actor.ActorSystem
import akka.actor.DeadLetter
import akka.actor.Props
import akka.event.Logging
import akka.stream.ActorMaterializer
import au.csiro.data61.magda.AppConfig
import au.csiro.data61.magda.indexer.search.SearchIndexer
import au.csiro.data61.magda.search.elasticsearch.DefaultClientProvider
import au.csiro.data61.magda.search.elasticsearch.DefaultIndices
import akka.http.scaladsl.Http

import au.csiro.data61.magda.indexer.external.registry.RegisterWebhook.{
  initWebhook,
  ShouldCrawl,
  ShouldNotCrawl
}
import au.csiro.data61.magda.indexer.crawler.RegistryCrawler
import au.csiro.data61.magda.client.RegistryExternalInterface
import scala.concurrent.Future
import au.csiro.data61.magda.search.elasticsearch.IndexDefinition
import au.csiro.data61.magda.search.elasticsearch.Indices

object IndexerApp extends App {
  implicit val config = AppConfig.conf()
  implicit val system = ActorSystem("indexer", config)
  implicit val executor = system.dispatcher
  implicit val materializer = ActorMaterializer()

  val logger = Logging(system, getClass)

  logger.info("Starting Indexer")
  logger.info("Log level is {}", config.getString("akka.loglevel"))

  val listener = system.actorOf(Props(classOf[Listener]))
  system.eventStream.subscribe(listener, classOf[DeadLetter])

  logger.debug("Starting Crawler")

  val registryInterface = new RegistryExternalInterface()
  val indexer = SearchIndexer(new DefaultClientProvider, DefaultIndices)
  val crawler = new RegistryCrawler(registryInterface, indexer)

  val api = new IndexerApi(crawler, indexer)

  logger.info(
    s"Listening on ${config.getString("http.interface")}:${config.getInt("http.port")}"
  )
  Http().bindAndHandle(
    api.routes,
    config.getString("http.interface"),
    config.getInt("http.port")
  )

  {
    if (config.getBoolean("registry.registerForWebhooks")) {
      initWebhook(registryInterface)
    } else {
      Future(ShouldCrawl)
    }
  } flatMap {
    case ShouldCrawl => Future(ShouldCrawl)
    case ShouldNotCrawl => {
      logger.info("Checking to see if datasets index is empty")
      indexer
        .isEmpty(Indices.DataSetsIndex)
        .map(
          isEmpty =>
            if (isEmpty) {
              logger.info("Datasets index is empty, recrawling")
              ShouldCrawl
            } else {
              logger.info("Datasets index is NOT empty. No need to recrawl.")
              ShouldNotCrawl
            }
        )
    }
  } map {
    case ShouldCrawl => {
      crawler.crawl()
    }
    case _ => // this means we were able to resume a webhook, so all good now :)
  } recover {
    case e: Throwable =>
      logger.error(e, "Error while initializing")

      // This is a super massive problem - might as well just crash to make it super-obvious and to
      // use K8S' restart logic
      logger.error(
        "Failure to register webhook or perform initial crawl is an unrecoverable and drastic error, crashing"
      )
      System.exit(1)
  }
}

class Listener extends Actor with ActorLogging {

  def receive = {
    case d: DeadLetter => log.debug(d.message.toString())
  }
}
