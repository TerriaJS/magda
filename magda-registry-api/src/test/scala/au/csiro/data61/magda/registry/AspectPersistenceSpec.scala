package au.csiro.data61.magda.registry

import au.csiro.data61.magda.model.Registry.{
  AspectDefinition,
  MAGDA_ADMIN_PORTAL_ID,
  MAGDA_SYSTEM_ID
}
import scalikejdbc.DB
import spray.json.JsObject
import au.csiro.data61.magda.model.TenantId.SpecifiedTenantId
import au.csiro.data61.magda.model.TenantId.AllTenantsId

class AspectPersistenceSpec extends ApiSpec {
  it("Fetch aspects should be filtered by tenant id") { _ =>
    val aspectA = AspectDefinition(
      id = "aspect A",
      name = "aspect A name",
      jsonSchema = Some(JsObject())
    )
    val aspectB = AspectDefinition(
      id = "aspect B",
      name = "aspect B name",
      jsonSchema = Some(JsObject())
    )
    val aspects = List(aspectA, aspectB)
    val aspectIds = aspects.map(a => a.id)

    aspects.foreach(testAspect => {
      DB localTx { implicit session =>
        AspectPersistence
          .create(session, testAspect, SpecifiedTenantId(TENANT_1))
      }
    })

    val tenant1Results = DB readOnly { implicit session =>
      AspectPersistence.getByIds(
        session,
        aspectIds,
        SpecifiedTenantId(TENANT_1)
      )
    }
    tenant1Results shouldEqual aspects

    val allTenantsResults = DB readOnly { implicit session =>
      AspectPersistence.getByIds(
        session,
        aspectIds,
        AllTenantsId
      )
    }
    allTenantsResults shouldEqual aspects

    List(TENANT_2, MAGDA_ADMIN_PORTAL_ID).foreach(tenantId => {
      val result = DB readOnly { implicit session =>
        AspectPersistence
          .getByIds(session, aspectIds, SpecifiedTenantId(tenantId))
      }
      result shouldEqual Nil
    })
  }
}
