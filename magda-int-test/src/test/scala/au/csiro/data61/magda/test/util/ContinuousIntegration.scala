package au.csiro.data61.magda.test.util

object ContinuousIntegration {
  lazy val isCi =
    Option(System.getenv("CI")).map(_.equals("true")).getOrElse(false)
}
