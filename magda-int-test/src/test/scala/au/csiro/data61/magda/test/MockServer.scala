package au.csiro.data61.magda.test

import akka.event.Logging
import org.mockserver.integration.ClientAndServer
import org.scalatest._
import au.csiro.data61.magda.test.util.TestActorSystem

trait MockServer { this: Suite =>

  // --- muted detailed logs from MockServer
  java.lang.System.setProperty("mockserver.logLevel", "WARN")
  val mockServer = ClientAndServer.startClientAndServer()
  Logging(TestActorSystem.actorSystem, getClass)
    .info(s"Mock Server started at ${mockServer.getLocalPort}......")

}
