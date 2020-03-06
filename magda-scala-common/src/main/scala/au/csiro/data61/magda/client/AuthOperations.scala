package au.csiro.data61.magda.client

object AuthOperations {
  case class OperationType private (id: String)

  val create = OperationType("create")
  val read = OperationType("read")
  val update = OperationType("update")
  val delete = OperationType("delete")
}
