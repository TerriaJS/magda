package au.csiro.data61.magda.opa

abstract class RecordEsriOpaPolicyWithExpirationMissingSpec extends RecordEsriOpaPolicyWithInvalidAccessControlAspectSpec {
  override def prepareData(param: FixtureParam): Unit ={
    createAspectDefinitions(param)
    createRecords(param)
    import spray.json._
    val expired = JsObject("id"-> JsString("nsw-portal"), "data" -> JsObject("something else" -> JsNumber(0)))
    updateExtraInput(expired)
  }
}