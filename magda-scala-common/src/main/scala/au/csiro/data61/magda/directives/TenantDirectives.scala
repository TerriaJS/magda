package au.csiro.data61.magda.directives

import akka.http.scaladsl.server.Directives.{extractRequest, provide, reject}
import akka.http.scaladsl.server.{
  Directive1,
  MissingHeaderRejection,
  ValidationRejection
}
import au.csiro.data61.magda.model.Registry.{
  MAGDA_ADMIN_PORTAL_ID,
  MAGDA_TENANT_ID_HEADER,
  MAGDA_SYSTEM_ID
}
import au.csiro.data61.magda.model.TenantId._

object TenantDirectives {

  /**
    * Requires some kind of tenant id header - "-1" to indicate ALL tenant ids is valid.
    */
  def requiresTenantId: Directive1[TenantId] = {
    extractRequest flatMap { request =>
      val tenantIdToken = request.headers.find(
        header => header.lowercaseName() == MAGDA_TENANT_ID_HEADER.toLowerCase()
      )

      tenantIdToken match {
        case Some(header) if header.value == MAGDA_SYSTEM_ID.toString =>
          provide(AllTenantsId)
        case Some(header) => provide(SpecifiedTenantId(BigInt(header.value())))
        case None =>
          val msg = s"Could not find $MAGDA_TENANT_ID_HEADER header in request"
          reject(MissingHeaderRejection(msg))
      }
    }
  }

  /**
    * Requires a real tenant id to be specified - "-1" to indicate all tenant ids is NOT valid.
    */
  def requiresSpecifiedTenantId: Directive1[SpecifiedTenantId] = {
    requiresTenantId flatMap {
      case SpecifiedTenantId(tenantId) =>
        provide(SpecifiedTenantId(tenantId))
      case AllTenantsId =>
        val msg =
          s"A specific tenant id header (i.e. NOT ${MAGDA_SYSTEM_ID}) is required"
        reject(ValidationRejection(msg))
    }
  }

  /**
    * Only the default or admin tenant id (0) is allowed
    */
  def requiresAdminTenantId: Directive1[TenantId] = {
    requiresTenantId flatMap {
      case SpecifiedTenantId(MAGDA_ADMIN_PORTAL_ID) =>
        provide(SpecifiedTenantId(MAGDA_ADMIN_PORTAL_ID))
      case otherValue =>
        val msg =
          s"The operation is not allowed because $otherValue is not a magda admin ID."
        reject(ValidationRejection(msg))
    }
  }
}
