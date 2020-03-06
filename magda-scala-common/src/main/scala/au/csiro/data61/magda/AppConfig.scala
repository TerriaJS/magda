package au.csiro.data61.magda

import com.typesafe.config.ConfigFactory
import com.typesafe.config.ConfigParseOptions
import com.typesafe.config.ConfigResolveOptions

object AppConfig {

  /** The global config, potentially including env-custom settings for libraries like akka */
  def conf() = {
    ConfigFactory
      .load()
      .withFallback(ConfigFactory.parseResources("common.conf"))
  }
}
