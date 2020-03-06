package au.csiro.data61.magda.opa

import org.scalatest.Ignore

class TestRecordEsriOpaPolicyWithEmptyAccessControlAspect
    extends RecordEsriOpaPolicyWithInvalidAccessControlAspectSpec
    with GroupsJwtForRecordEsriOpaPolicyTest {

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-esri-access-control-aspect-empty.json"
    )
  }

}
