package au.csiro.data61.magda

import akka.event.LoggingAdapter
import io.jsonwebtoken.{JwtBuilder, Jwts}
import io.jsonwebtoken.io.Serializer
import io.jsonwebtoken.security.Keys
import spray.json._

import scala.collection.JavaConverters._
import scala.util.Random

object Authentication {
  val headerName = "X-Magda-Session"

  private var defaultSecret: Option[String] = None

  def secret(implicit logger: LoggingAdapter) =
    Option(System.getenv("JWT_SECRET"))
      .orElse(Option(System.getenv("npm_package_config_jwtSecret"))) match {
      case Some(secret) => secret
      case None =>
        defaultSecret match {
          case Some(default) => default
          case None =>
            logger.warning(
              "Could not find a secret for JWT, generating a new one at random. This is fine for tests but bad elsewhere - use the JWT_SECRET env variable to set one"
            )
            defaultSecret = Some(Random.alphanumeric.take(256).mkString)
            defaultSecret.get
        }
    }

  def parser(implicit logger: LoggingAdapter) =
    Jwts
      .parser()
      .setSigningKey(
        key(logger)
      )

  def signToken(jwtBuilder: JwtBuilder, logger: LoggingAdapter) = {
    jwtBuilder
      .serializeToJsonWith(jwtJsonSerializer)
      .signWith(
        key(logger)
      )
      .compact()
  }

  def key(logger: LoggingAdapter) =
    Keys.hmacShaKeyFor(Authentication.secret(logger).getBytes("utf-8"))

  private val jwtJsonSerializer = new Serializer[java.util.Map[String, _]] {

    def serialize(jMap: java.util.Map[String, _]): Array[Byte] = {
      val map = jMap.asScala.toMap

      val jsValueIfied: Map[String, JsValue] = map.map {
        case ((key: String, value: String))  => (key, JsString(value))
        case ((key: String, value: JsValue)) => (key, value)
        case other => {
          throw new Exception("Failed to jsonify " + other.toString())
        }
      }

      JsObject.apply(jsValueIfied).compactPrint.getBytes()
    }
  }
}
