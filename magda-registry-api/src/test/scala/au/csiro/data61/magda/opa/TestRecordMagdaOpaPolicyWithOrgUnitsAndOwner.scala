package au.csiro.data61.magda.opa

import org.scalatest.Ignore

class TestRecordMagdaOpaPolicyWithOrgUnitsAndOwner
    extends RecordOpaPolicyWithEsriGroupsOrMagdaOrgUnitsOnlySpec {
  override def testConfigSource: String =
    s"""
       |opa.recordPolicyId="object.registry.record.owner_orgunit"
    """.stripMargin

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-dataset-access-control-aspect-orgunits-and-owner.json"
    )
  }

}
