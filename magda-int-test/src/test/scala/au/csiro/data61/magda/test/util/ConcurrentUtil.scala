package au.csiro.data61.magda.test.util

import scala.concurrent.Await
import scala.concurrent.duration._
import scala.concurrent.Future

object ConcurrentUtil {

  implicit class RichFuture[T](future: Future[T]) {

    def await(implicit duration: Duration = 10.seconds): T =
      Await.result(future, duration)
  }
}
