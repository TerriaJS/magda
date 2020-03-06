package au.csiro.data61.magda.registry

import akka.actor.ActorSystem
import au.csiro.data61.magda.AppConfig
import com.typesafe.config.ConfigFactory
import java.io.File
import ch.qos.logback.classic.Level
import au.csiro.data61.magda.registry.Api

/**
  * Command line interface for the registry.
  */
object CommandLine {

  val config = ConfigFactory.parseString(s"""
    akka.loglevel = "ERROR"
  """).resolve().withFallback(AppConfig.conf())
  implicit val system = ActorSystem("blah", config)

  val root = org.slf4j.LoggerFactory
    .getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME)
    .asInstanceOf[ch.qos.logback.classic.Logger]
  root.setLevel(Level.ERROR);

  /**
    * Generates a swagger.json file and writes it to the path specified in the first command line arg.
    *
    * Execute from the command line with sbt "registryApi/runMain au.csiro.data61.magda.registry.CommandLine ./swagger.json"
    */
  def main(args: Array[String]) = {
    val docService =
      new SwaggerDocService("localhost", 9001, "/api/v0/registry/", system)
    val swaggerJson = docService.generateSwaggerJson
    val jsonPatchJson = docService.getJsonPatchSchema
    system.terminate()

    val swaggerFile = new File(args(0), "swagger.json")
    writeStringToFile(swaggerFile, swaggerJson)

    val jsonPatchFile = new File(args(0), "json-patch.json")
    writeStringToFile(jsonPatchFile, jsonPatchJson)
  }

  def writeStringToFile(file: File, content: String) = {
    if (file.exists()) {
      file.delete()
    }

    val parent = file.getParentFile()
    if ((!parent.exists() && !parent.mkdirs()) || !file.createNewFile()) {
      // if (dir doesn't exist and wasn't just created) or (the file doesn't exist and was just created)
      throw new IllegalStateException("Couldn't create file: " + file);
    }

    printToFile(file) { p =>
      p.println(content)
    }
  }

  def printToFile(f: java.io.File)(op: java.io.PrintWriter => Unit) {
    val p = new java.io.PrintWriter(f)
    try {
      op(p)
    } finally {
      p.close()
    }
  }
}
