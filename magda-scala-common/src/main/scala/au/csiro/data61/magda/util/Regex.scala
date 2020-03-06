package au.csiro.data61.magda.util

import scala.util.matching.Regex

object Regex {

  class RichRegex(underlying: Regex) {
    def matches(s: String) = underlying.pattern.matcher(s).matches
    def matchesAny(s: String) = underlying.findFirstIn(s).isDefined
  }
  implicit def regexToRichRegex(r: Regex) = new RichRegex(r)
}
