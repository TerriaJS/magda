package au.csiro.data61.magda.model

import spray.json.DefaultJsonProtocol

object Auth {
  case class User(isAdmin: Boolean)

  trait AuthProtocols extends DefaultJsonProtocol {
    implicit val userFormat = jsonFormat1(User)
  }
}
