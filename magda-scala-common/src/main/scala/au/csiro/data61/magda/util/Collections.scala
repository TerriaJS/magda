package au.csiro.data61.magda.util

import scala.util.Try
import scala.util.Success
import scala.util.Failure
import akka.event.LoggingAdapter

object Collections {

  // TODO: Make this work for all traversibles... somehow.
  def mapCatching[I, O](
      seq: List[I],
      fn: I => O,
      onError: (Throwable, I) => Any
  ): List[O] = {
    seq.map { item =>
      try {
        Seq(fn(item))
      } catch {
        case e: Throwable =>
          onError(e, item)
          Nil
      }
    } flatten
  }
}

object SetExtractor {
  def unapplySeq[T](s: Set[T]): Option[Seq[T]] = Some(s.toSeq)
}
