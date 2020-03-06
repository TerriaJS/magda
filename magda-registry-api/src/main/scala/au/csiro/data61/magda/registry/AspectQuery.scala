package au.csiro.data61.magda.registry

import java.net.URLDecoder
import scalikejdbc._

sealed trait AspectQuery {
  val aspectId: String
  val path: List[String]
}

case class AspectQueryExists(val aspectId: String, val path: List[String])
    extends AspectQuery

case class AspectQueryWithValue(
    val aspectId: String,
    val path: List[String],
    value: AspectQueryValue,
    sqlComparator: SQLSyntax = SQLSyntax.createUnsafely("=")
) extends AspectQuery

sealed trait AspectQueryValue {
  val value: Any
  val postgresType: SQLSyntax
}
case class AspectQueryString(string: String) extends AspectQueryValue {
  val value = string
  val postgresType = SQLSyntax.createUnsafely("TEXT")
}
case class AspectQueryBoolean(boolean: Boolean) extends AspectQueryValue {
  val value = boolean
  val postgresType = SQLSyntax.createUnsafely("BOOL")
}
case class AspectQueryBigDecimal(bigDecimal: BigDecimal)
    extends AspectQueryValue {
  val value = bigDecimal
  val postgresType = SQLSyntax.createUnsafely("NUMERIC")
}

object AspectQuery {

  def parse(string: String): AspectQuery = {
    val Array(path, value) =
      string.split(":").map(URLDecoder.decode(_, "utf-8"))
    val pathParts = path.split("\\.").toList

    if (value.isEmpty) {
      throw new Exception("Value for aspect query is not present.")
    }

    if (pathParts.length < 2) {
      throw new Exception("Path for aspect query was empty")
    }

    AspectQueryWithValue(
      pathParts.head,
      pathParts.tail,
      AspectQueryString(value)
    )
  }
}
