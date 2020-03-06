package au.csiro.data61.magda.opa

import org.scalatest.Ignore

class TestRecordEsriPolicyWithGroupsOnly
    extends RecordOpaPolicyWithEsriGroupsOrMagdaOrgUnitsOnlySpec
    with GroupsJwtForRecordEsriOpaPolicyTest {

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-esri-access-control-aspect-groups-only.json"
    )
  }

}
