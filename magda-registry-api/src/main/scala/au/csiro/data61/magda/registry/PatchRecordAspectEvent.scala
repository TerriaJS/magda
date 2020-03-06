package au.csiro.data61.magda.registry

import gnieh.diffson.sprayJson._

case class PatchRecordAspectEvent(
    recordId: String,
    tenantId: BigInt,
    aspectId: String,
    patch: JsonPatch
) extends RecordEvent

object PatchRecordAspectEvent {
  val Id = 5 // from EventTypes table
}
