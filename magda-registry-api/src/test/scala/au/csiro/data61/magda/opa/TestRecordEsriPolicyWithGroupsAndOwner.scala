package au.csiro.data61.magda.opa

import akka.http.scaladsl.model.headers.RawHeader
import au.csiro.data61.magda.Authentication
import org.scalatest.Ignore
import spray.json._
import io.jsonwebtoken.Jwts;

class TestRecordEsriPolicyWithGroupsAndOwner
    extends RecordOpaPolicyWithEsriGroupsOrMagdaOrgUnitsOnlySpec {

  override def beforeAll(): Unit = {
    super.beforeAll()
    testRecords = getTestRecords(
      dataPath + "add-esri-access-control-aspect-groups-and-owner.json"
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
              "esriGroups" -> JsArray(
                JsString("Dep. A"),
                JsString("Branch A, Dep. A"),
                JsString("Branch B, Dep. A"),
                JsString("Section C, Branch B, Dep. A")
              ),
              "esriUser" -> JsString("user0")
            )
          )
        else if (userId.equals("00000000-0000-1000-0001-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriGroups" -> JsArray(
                JsString("Branch A, Dep. A")
              ),
              "esriUser" -> JsString("user1")
            )
          )
        else if (userId.equals("00000000-0000-1000-0002-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriGroups" -> JsArray(
                // JsString("Branch A, Dep. A"),
                JsString("Section C, Branch B, Dep. A")
              ),
              "esriUser" -> JsString("user2")
            )
          )
        else if (userId.equals("00000000-0000-1000-0003-000000000000"))
          JsObject(
            "session" -> JsObject(
              "esriGroups" -> JsArray(
                JsString("Section C, Branch B, Dep. A")
              ),
              "esriUser" -> JsString("user3")
            )
          )

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
