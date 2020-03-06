package au.csiro.data61.magda.search.elasticsearch.Exceptions

import com.sksamuel.elastic4s.http.RequestFailure

final case class ESException(
    failure: RequestFailure,
    private val message: String = ""
) extends RuntimeException(message)

object RepositoryMissingException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "repository_missing_exception" =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
      case _ => None
    }
  }
}

object InvalidSnapshotNameException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "invalid_snapshot_name_exception" =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
      case _ => None
    }
  }
}

object IndexNotFoundException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "index_not_found_exception" =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
      case _ => None
    }
  }
}

object IndexCloseException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "index_closed_exception" =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
      case _ => None
    }
  }
}

object IllegalArgumentException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "illegal_argument_exception" =>
        Some(new ESException(failure, failure.error.reason))
      case _ => None
    }
  }
}

object ResourceAlreadyExistsException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case "resource_already_exists_exception" =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
      case _ => None
    }
  }
}

object ESGenericException {

  def unapply(failure: RequestFailure): Option[RuntimeException] = {
    failure.error.`type` match {
      case _ =>
        Some(
          new ESException(
            failure,
            s"""${failure.error.`type`}: ${failure.error.reason}"""
          )
        )
    }
  }
}
