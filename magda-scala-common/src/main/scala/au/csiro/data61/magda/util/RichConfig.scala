package au.csiro.data61.magda.util

import com.typesafe.config.Config

object RichConfig {
  implicit class RichConfig(val underlying: Config) extends AnyVal {

    def getOptionalString(path: String): Option[String] =
      if (underlying.hasPath(path)) {
        Some(underlying.getString(path))
      } else {
        None
      }
  }
}
