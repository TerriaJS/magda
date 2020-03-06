package au.csiro.data61.magda.model

object TenantId {
  sealed trait TenantId {
    def specifiedOrThrow(): BigInt
    def isAllTenants(): Boolean
  }
  case object AllTenantsId extends TenantId {
    override def specifiedOrThrow(): BigInt =
      throw new Exception("Used specifiedOrThrow on unspecified tenant id")

    override def isAllTenants(): Boolean = true
  }
  case class SpecifiedTenantId(tenantId: BigInt) extends TenantId {
    override def specifiedOrThrow(): BigInt = tenantId;

    override def toString: String = {
      tenantId.toString
    }

    override def isAllTenants(): Boolean = false

  }
}
