package au.csiro.data61.magda.opa

import org.scalatest.Ignore

class TestRecordEsriOpaPolicyWithExpirationMissing
    extends RecordEsriOpaPolicyWithExpirationMissingSpec
    with GroupsJwtForRecordEsriOpaPolicyTest {

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-esri-access-control-aspect-missing-expiration.json"
    )
  }

}
