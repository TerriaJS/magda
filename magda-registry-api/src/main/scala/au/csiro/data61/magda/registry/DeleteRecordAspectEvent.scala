package au.csiro.data61.magda.registry

case class DeleteRecordAspectEvent(
    recordId: String,
    tenantId: BigInt,
    aspectId: String
) extends RecordEvent

object DeleteRecordAspectEvent {
  val Id = 8 // from EventTypes table
}
