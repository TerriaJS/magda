package au.csiro.data61.magda.indexer.helpers

import java.util.concurrent.atomic.AtomicLong

import akka.NotUsed
import akka.actor.{ActorRef, ActorSystem, PoisonPill, Scheduler}
import akka.event.Logging
import akka.stream._
import akka.stream.scaladsl.{Keep, Sink, Source}
import akka.stream.stage.{GraphStage, GraphStageLogic, InHandler, OutHandler}
import au.csiro.data61.magda.model.misc.DataSet
import com.typesafe.config.Config
import org.reactivestreams.Publisher

import scala.concurrent.ExecutionContextExecutor

/**
  * This class creates a stream source of type Source[DataSet, NotUsed]. The source can be filled
  * with DataSet objects any time after the creation.
  *
  * The class can also controls the life cycle of the related stream when the argument
  * streamController is defined.
  *
  * @param bufferSize the maximal number of datasets to fill the stream source
  * @param streamController control the data registry crawling
  * @param system akka actor system
  * @param config akka config
  * @param materializer akka materializer
  */
class StreamSourceController(
    bufferSize: Int,
    streamController: StreamController
)(
    implicit
    val system: ActorSystem,
    implicit val config: Config,
    implicit val materializer: Materializer
) {

  val log = Logging(system, getClass)
  implicit val ec: ExecutionContextExecutor = system.dispatcher
  implicit val scheduler: Scheduler = system.scheduler

  private val GET_MORE_DATASETS: String = "Get more datasets"
  private val NO_MORE_DATASETS: String = "No more datasets"

  /**
    * It is used to count the total datasets that have been filled into the buffer so far.
    */
  private val dataSetCount = new AtomicLong(0)
  private val (ref, source) = createStreamSource()

  /**
    * A stage that acts upon control messages (either getting more datasets or completing the stream).
    *
    * @tparam Object a generic type for either DataSet or String types.
    */
  private final case class MessageChecker[Object]()
      extends GraphStage[FlowShape[Object, Object]] {
    override def initialAttributes: Attributes = Attributes.name("take")
    val in = Inlet[Object](Logging.simpleName(this) + ".in")
    val out = Outlet[Object](Logging.simpleName(this) + ".out")
    override val shape = FlowShape(in, out)

    override def createLogic(inheritedAttributes: Attributes): GraphStageLogic =
      new GraphStageLogic(shape) with InHandler with OutHandler {
        override def onPush(): Unit = {
          val message = grab(in)
          if (message == NO_MORE_DATASETS) {
            completeStage()
            ref ! PoisonPill
          } else if (message == GET_MORE_DATASETS) {
            if (streamController != None.orNull)
              streamController.next(bufferSize / 2)

            pull(in)
          } else
            push(out, message)
        }

        override def onPull(): Unit = {
          pull(in)
        }

        setHandlers(in, out, this)
      }

    override def toString: String = "MessageChecker"
  }

  private def createStreamSource(): (ActorRef, Source[DataSet, NotUsed]) = {
    // The additional 2 slot in the buffer are for control messages: either GET_MORE_DATASETS
    // or NO_MORE_DATASETS or both GET_MORE_DATASETS and NO_MORE_DATASETS.
    val (ref: ActorRef, publisher: Publisher[DataSet]) =
      Source
        .actorRef[DataSet](bufferSize = bufferSize + 2, OverflowStrategy.fail)
        .toMat(Sink.asPublisher(true))(Keep.both)
        .run()

    val source: Source[DataSet, NotUsed] = Source.fromPublisher(publisher)
    val source2: Source[DataSet, NotUsed] = source.via(MessageChecker.apply())
    (ref, source2)
  }

  /**
    * Fill the source with given datasets
    *
    * @param dataSets a batch of datasets to fill the source.
    * @param hasNext indicating if there are more datasets available
    * @param isFirst indicating if this is the first batch of datasets
    */
  def fillSource(
      dataSets: Seq[DataSet],
      hasNext: Boolean,
      isFirst: Boolean
  ): Unit = {
    if (isFirst) {
      dataSets foreach (dataSet => {
        ref ! dataSet
        if (dataSetCount.incrementAndGet() == bufferSize / 2 && hasNext)
          ref ! GET_MORE_DATASETS
      })
    } else {
      dataSets foreach (dataSet => {
        ref ! dataSet
        if (dataSetCount.incrementAndGet() % (bufferSize / 2) == 0 && hasNext)
          ref ! GET_MORE_DATASETS
      })
    }

    if (!hasNext)
      ref ! NO_MORE_DATASETS
  }

  /**
    * @return Source actor reference and stream source itself
    */
  def refAndSource: (ActorRef, Source[DataSet, NotUsed]) = {
    (ref, source)
  }
}
