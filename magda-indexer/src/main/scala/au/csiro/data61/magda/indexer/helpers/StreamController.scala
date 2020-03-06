package au.csiro.data61.magda.indexer.helpers

import java.util.concurrent.atomic.AtomicLong

import akka.NotUsed
import akka.actor.{ActorRef, ActorSystem, PoisonPill, Scheduler}
import akka.event.Logging
import akka.stream.Materializer
import akka.stream.scaladsl.Source
import au.csiro.data61.magda.model.misc.DataSet
import au.csiro.data61.magda.util.ErrorHandling
import com.typesafe.config.Config
import au.csiro.data61.magda.client.RegistryInterface

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContextExecutor, Future}

/**
  * This class controls the life cycle of dataset stream.
  *
  * @param interface interface to registry
  * @param bufferSize stream source buffer size
  * @param system implicit akka actor system
  * @param config implicit akka config
  * @param materializer implicit akka materializer
  */
class StreamController(interface: RegistryInterface, bufferSize: Int)(
    implicit val system: ActorSystem,
    implicit val config: Config,
    implicit val materializer: Materializer
) {

  implicit val ec: ExecutionContextExecutor = system.dispatcher
  implicit val scheduler: Scheduler = system.scheduler

  val log = Logging(system, getClass)

  private val ssc = new StreamSourceController(bufferSize, this)
  private val (actorRef, source) = ssc.refAndSource
  private val crawledCount = new AtomicLong(0)
  private var tokenOptionF: Future[Option[String]] = Future { None }

  private def getDataSets(
      nextFuture: () => Future[(Option[String], List[DataSet])]
  ): Future[(Option[String], List[DataSet])] = {

    val onRetry = (retryCount: Int, e: Throwable) =>
      log.error(
        e,
        "Failed while fetching from registry, retries left: {}",
        retryCount + 1
      )

    val safeFuture: Future[(Option[String], List[DataSet])] =
      ErrorHandling
        .retry(nextFuture, 30.seconds, 30, onRetry)
        .recover {
          case e: Throwable =>
            log.error(
              e,
              "Failed completely while fetching from registry. " +
                "This means we can't go any further!!"
            )
            (None, Nil)
        }

    safeFuture
  }

  private def fillStreamSource(
      nextFuture: () => Future[(Option[String], List[DataSet])],
      isFirst: Boolean = false
  ): Future[Option[String]] = {

    getDataSets(nextFuture)
      .map(results => {
        val tokenOption = results._1
        val dataSets = results._2
        crawledCount.addAndGet(dataSets.size)
        log.info("Total crawled {} datasets from registry", crawledCount.get())
        val hasNext = tokenOption.nonEmpty && dataSets.nonEmpty
        ssc.fillSource(dataSets, hasNext, isFirst)
        tokenOption
      })
  }

  /**
    * The returned source is used to construct a dataset stream.
    *
    * @return the stream source
    */
  def getSource: Source[DataSet, NotUsed] = {
    source
  }

  /**
    * Get the first batch datasets from registry and fill the stream source.
    *
    * @return future optional token. If nonempty, indicate more datasets are available.
    */
  def start(): Future[Option[String]] = {
    val firstPageF = () =>
      interface.getDataSetsReturnToken(start = 0, size = bufferSize)
    tokenOptionF = fillStreamSource(firstPageF, isFirst = true)
    tokenOptionF
  }

  /**
    * Get the next batch datasets from registry and fill the stream source.
    *
    * @param nextSize the max size of the batch
    * @return future optional token. If nonempty, indicate more datasets are available.
    */
  def next(nextSize: Int): Future[Option[String]] = {
    tokenOptionF.flatMap(tokenOption => {
      if (tokenOption.isEmpty) {
        Future.successful(None)
      } else {
        val nextPageF =
          () => interface.getDataSetsToken(tokenOption.get, bufferSize / 2)
        tokenOptionF = fillStreamSource(nextPageF)
        tokenOptionF
      }
    })
  }
}
