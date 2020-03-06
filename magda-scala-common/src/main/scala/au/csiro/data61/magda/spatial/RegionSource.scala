package au.csiro.data61.magda.spatial

import java.net.URL

import au.csiro.data61.magda.AppConfig
import com.typesafe.config.{Config, ConfigObject}

import scala.collection.JavaConversions._

case class RegionSource(
    name: String,
    url: URL,
    idProperty: String,
    nameProperty: String,
    shortNameProperty: Option[String],
    includeIdInName: Boolean,
    disabled: Boolean,
    order: Int,
    simplifyToleranceRatio: Double = 0.01,
    requireSimplify: Boolean = true,
    // --- `lvxIdField` config field allow to specify the property field that the id value can be retrieved from
    lv1IdField: Option[String] = None,
    lv2IdField: Option[String] = None,
    lv3IdField: Option[String] = None,
    lv4IdField: Option[String] = None,
    lv5IdField: Option[String] = None,
    // --- `lvxId` config field allow to specify the id value directly
    lv1Id: Option[String] = None,
    lv2Id: Option[String] = None,
    lv3Id: Option[String] = None,
    lv4Id: Option[String] = None,
    lv5Id: Option[String] = None
)

object RegionSource {

  def generateRegionId(regionType: String, id: String) =
    s"${regionType}/$id".toLowerCase
}

class RegionSources(config: Config) {
  val sources = loadFromConfig(config)

  private lazy val lookup =
    sources.groupBy(_.name.toLowerCase).mapValues(_.head)

  def forName(name: String): Option[RegionSource] = lookup.get(name.toLowerCase)

  private def getOptionalStringConfig(
      fieldName: String,
      regionSourceConfig: Config
  ): Option[String] = {
    if (regionSourceConfig.hasPath(fieldName))
      Some(regionSourceConfig.getString(fieldName))
    else None
  }

  private def loadFromConfig(config: Config): Seq[RegionSource] = {
    config
      .root()
      .map {
        case (name: String, config: ConfigObject) =>
          val regionSourceConfig = config.toConfig()
          RegionSource(
            name = name,
            url = new URL(regionSourceConfig.getString("url")),
            idProperty = regionSourceConfig.getString("idField"),
            nameProperty = regionSourceConfig.getString("nameField"),
            shortNameProperty =
              getOptionalStringConfig("shortNameField", regionSourceConfig),
            includeIdInName =
              if (regionSourceConfig.hasPath("includeIdInName"))
                regionSourceConfig.getBoolean("includeIdInName")
              else false,
            disabled = regionSourceConfig
              .hasPath("disabled") && regionSourceConfig.getBoolean("disabled"),
            order = regionSourceConfig.getInt("order"),
            simplifyToleranceRatio =
              if (regionSourceConfig.hasPath("simplifyToleranceRatio"))
                regionSourceConfig.getDouble("simplifyToleranceRatio")
              else 0.01,
            requireSimplify =
              if (regionSourceConfig.hasPath("requireSimplify"))
                regionSourceConfig.getBoolean("requireSimplify")
              else true,
            lv1IdField =
              getOptionalStringConfig("lv1IdField", regionSourceConfig),
            lv2IdField =
              getOptionalStringConfig("lv2IdField", regionSourceConfig),
            lv3IdField =
              getOptionalStringConfig("lv3IdField", regionSourceConfig),
            lv4IdField =
              getOptionalStringConfig("lv4IdField", regionSourceConfig),
            lv5IdField =
              getOptionalStringConfig("lv5IdField", regionSourceConfig),
            lv1Id = getOptionalStringConfig("lv1Id", regionSourceConfig),
            lv2Id = getOptionalStringConfig("lv2Id", regionSourceConfig),
            lv3Id = getOptionalStringConfig("lv3Id", regionSourceConfig),
            lv4Id = getOptionalStringConfig("lv4Id", regionSourceConfig),
            lv5Id = getOptionalStringConfig("lv5Id", regionSourceConfig)
          )
      }
      .toSeq
      .filterNot(_.disabled)
  }
}
