package au.csiro.data61.magda.search.elasticsearch

import com.sksamuel.elastic4s.analyzers._
import com.sksamuel.elastic4s.json.XContentBuilder

case class SynonymTokenFilter(
    name: String,
    path: Option[String] = None,
    synonyms: Set[String] = Set.empty,
    ignoreCase: Option[Boolean] = None,
    format: Option[String] = None,
    expand: Option[Boolean] = None,
    tokenizer: Option[Tokenizer] = None
) extends TokenFilterDefinition {

  require(
    path.isDefined || synonyms.nonEmpty,
    "synonym requires either `synonyms` or `synonyms_path` to be configured"
  )

  val filterType = "synonym"

  override def build(source: XContentBuilder): Unit = {
    if (synonyms.isEmpty) path.foreach(source.field("synonyms_path", _))
    if (synonyms.nonEmpty) source.array("synonyms", synonyms.toArray)
    format.foreach(source.field("format", _))
    ignoreCase.foreach(source.field("ignore_case", _))
    expand.foreach(source.field("expand", _))
    tokenizer.foreach(t => source.field("tokenizer", t.name))
  }

  def path(path: String): SynonymTokenFilter = copy(path = Some(path))

  def synonyms(synonyms: Iterable[String]): SynonymTokenFilter =
    copy(synonyms = synonyms.toSet)

  def tokenizer(tokenizer: Tokenizer): SynonymTokenFilter =
    copy(tokenizer = Some(tokenizer))
  def format(format: String): SynonymTokenFilter = copy(format = Some(format))

  def ignoreCase(ignoreCase: Boolean): SynonymTokenFilter =
    copy(ignoreCase = Some(ignoreCase))
  def expand(expand: Boolean): SynonymTokenFilter = copy(expand = Some(expand))
}
