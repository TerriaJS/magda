package au.csiro.data61.magda.registry

/**
  * Case class to provide a consistent JSON object when communicating errors back to API Clients
  */
case class ApiError(message: String) {}
