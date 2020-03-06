package au.csiro.data61.magda.registry

import au.csiro.data61.magda.model.Registry._
import scalikejdbc._
import spray.json._
import org.everit.json.schema.loader.SchemaLoader
import org.json.JSONObject
import com.typesafe.config.Config
import gnieh.diffson.sprayJson._
import au.csiro.data61.magda.model.TenantId._

class AspectValidator(config: Config, recordPersistence: RecordPersistence) {
  def DEFAULT_META_SCHEMA_URI = "https://json-schema.org/draft-07/schema#"

  def shouldValidate() = {
    // --- if not set default value is true
    if (!config.hasPath("validateJsonSchema")) false
    else config.getBoolean("validateJsonSchema")
  }

  def validate(aspectId: String, aspectData: JsObject, tenantId: TenantId)(
      implicit session: DBSession
  ) {
    if (shouldValidate()) {
      AspectPersistence.getById(session, aspectId, tenantId) match {
        case Some(aspectDef) => validateWithDefinition(aspectDef, aspectData)
        case None =>
          throw new Exception(
            s"Failed to validate aspect data: Cannot locate aspect definition for aspect id: ${aspectId}"
          )
      }
    }
  }

  def validateAspects(
      aspects: Map[String, JsObject],
      tenantId: TenantId
  )(implicit session: DBSession): Unit = {
    aspects.foreach(aspect => validate(aspect._1, aspect._2, tenantId))
  }

  def validateWithDefinition(
      aspectDef: AspectDefinition,
      aspectData: JsObject
  ): Unit = {
    if (!aspectDef.jsonSchema.isDefined) {
      // --- json schema not set means skipping validation
      return
    }
    val rawSchema = new JSONObject(aspectDef.jsonSchema.get.toString())
    rawSchema.optString("$schema").trim.toLowerCase match {
      case uri
          if uri.isEmpty || uri.contains("hyper-schema") || uri.contains(
            "//json-schema.org/schema"
          ) =>
        rawSchema.put("$schema", DEFAULT_META_SCHEMA_URI)
      case _ =>
    }
    val schema = SchemaLoader.load(rawSchema)
    schema.validate(new JSONObject(aspectData.toString))
  }

  def validateWithAspectPatch(
      aspectPatch: JsonPatch,
      recordId: String,
      aspectId: String,
      tenantId: TenantId
  )(implicit session: DBSession): Unit = {
    val originalAspect = (recordPersistence.getRecordAspectById(
      session,
      tenantId,
      recordId,
      aspectId
    ) match {
      case Some(aspect) => aspect
      case None         => JsObject()
    })
    val patchedAspect = aspectPatch(originalAspect).asJsObject
    validate(aspectId, patchedAspect, tenantId)(session)
  }

  def validateWithRecordPatch(
      recordPatch: JsonPatch,
      recordId: String,
      tenantId: TenantId
  )(implicit session: DBSession): Unit = {
    recordPersistence.processRecordPatchOperationsOnAspects(
      recordPatch,
      (aspectId: String, aspectData: JsObject) => {
        validate(aspectId, aspectData, tenantId)(session)
      },
      (aspectId: String, aspectPatch: JsonPatch) => {
        validateWithAspectPatch(aspectPatch, recordId, aspectId, tenantId)(
          session
        )
      },
      (aspectId: String) => Unit
    )
  }

}
