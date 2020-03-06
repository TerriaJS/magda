package au.csiro.data61.magda.registry

import gnieh.diffson.sprayJson._

case class PatchAspectDefinitionEvent(
    aspectId: String,
    patch: JsonPatch,
    tenantId: BigInt
)

object PatchAspectDefinitionEvent {
  val Id = 4 // from EventTypes table
}
