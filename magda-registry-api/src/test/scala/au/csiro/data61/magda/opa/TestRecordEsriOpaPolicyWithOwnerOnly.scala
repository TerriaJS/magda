package au.csiro.data61.magda.opa

import akka.http.scaladsl.model.headers.RawHeader
import au.csiro.data61.magda.Authentication
import spray.json._
import io.jsonwebtoken.Jwts;
import au.csiro.data61.magda.Authentication

class TestRecordEsriOpaPolicyWithOwnerOnly
    extends RecordOpaPolicyWithOwnerOnlySpec {
  override def testConfigSource: String =
    s"""
       |opa.recordPolicyId="object.registry.record.esri_owner_groups"
    """.stripMargin

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-esri-access-control-aspect-owner-only.json"
    )
  }

  override def addJwtToken(userId: String): RawHeader = {
    if (userId.equals(adminUser) || userId.equals(anonymous)) {
      super.addJwtToken(userId)

    } else {
      val sessionClaims =
        if (userId.equals("00000000-0000-1000-0000-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriUser" -> JsString("user0")
            )
          )
        else if (userId.equals("00000000-0000-1000-0001-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriUser" -> JsString("user1")
            )
          )
        else if (userId.equals("00000000-0000-1000-0002-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriUser" -> JsString("user2")
            )
          )
        else if (userId.equals("00000000-0000-1000-0003-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriUser" -> JsString("user3")
            )
          )
        else
          throw new Exception("Could not find jwt for user " + userId)

      val jwtToken =
        Authentication.signToken(
          Jwts
            .builder()
            .claim("userId", userId)
            .claim(
              "session",
              sessionClaims
            ),
          system.log
        )

      RawHeader(
        Authentication.headerName,
        jwtToken
      )
    }

  }

}
