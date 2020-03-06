package au.csiro.data61.magda.registry

import java.util

import akka.actor.{ActorRef, Kill}
import akka.stream.Supervision.Stop
import au.csiro.data61.magda.registry.WebHookActor.{
  processCount,
  webHookActors,
  webHooks
}

object Util {

  def blockUntil(explain: String, minWaitTimeMs: Int = 100)(
      predicate: () => Boolean
  ): Unit = {

    var backoff = 1
    var done = false

    while (backoff <= 16 && !done) {
//      println(s"** backoff = $backoff")
      if (backoff > 0) Thread.sleep(minWaitTimeMs * backoff)
      backoff = backoff + 1
      try {
        done = predicate()
      } catch {
        case e: Throwable =>
//          println("problem while testing predicate")
          e.printStackTrace()
      }
    }

    require(done, s"Failed waiting on: $explain")
  }

  def waitUntilWebHookActorIsInCache(id: String): Unit = {
    blockUntil("The hook processor is in cache.") { () =>
      getWebHookActor(id).nonEmpty
    }
  }

  def waitUntilWebHookActorIsNotInCache(id: String): Unit = {
    blockUntil("The hook processor is not in cache.") { () =>
      getWebHookActor(id).isEmpty
    }
  }

  /**
    * As many tasks are executed asynchronously and FunSpec (except for AsyncFunSpec) does not
    * support async test. This function provide a workaround. However it has some limitation:
    * If the default minimal wait time is too short, a racing condition may occur for some long
    * processing tasks, causing some test cases to fail. In those failure cases, call this function
    * with a large argument, e.g. 1000. A small default wait time will make overall test fast.
    *
    * @param minWaitTimeMs Minimal wait time in milliseconds.
    */
  def waitUntilAllDone(minWaitTimeMs: Int = 100): Unit = {
    blockUntil("Hooks finish all processing.", minWaitTimeMs) { () =>
      isProcessDone
    }
  }

  def isProcessDone: Boolean = {
//    println(s"** processCount = ${processCount.get()} ")
    processCount.get() == 0
  }

  def getWebHookActor(id: String): Option[ActorRef] = {
    webHookActors.getOrDefault(id, None)
  }

  def clearWebHookActorsCache(): Unit = {
    // Shut down all web hook actors
    val keys: util.Enumeration[String] = webHookActors.keys()
    while (keys.hasMoreElements) {
      val k = keys.nextElement()
      webHookActors.get(k).get ! Kill
    }

    webHookActors.clear()
    webHooks.clear()
    processCount.set(0)
  }
}
