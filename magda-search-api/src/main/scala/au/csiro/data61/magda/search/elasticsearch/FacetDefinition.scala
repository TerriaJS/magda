package au.csiro.data61.magda.search.elasticsearch

import au.csiro.data61.magda.api.Query
import spray.json._
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchImplicits._
import au.csiro.data61.magda.util.DateParser
import au.csiro.data61.magda.util.DateParser._
import com.sksamuel.elastic4s.searches.aggs.{
  Aggregation => AggregationDefinition,
  TermsOrder
}
import com.sksamuel.elastic4s.searches.queries.{Query => QueryDefinition}
import com.sksamuel.elastic4s.http.ElasticDsl._
import org.elasticsearch.search.aggregations.Aggregation
import au.csiro.data61.magda.search.elasticsearch.Queries._
import org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation
import org.elasticsearch.search.aggregations.bucket.nested.InternalReverseNested

import collection.JavaConverters._
import scalaz.Memo
import com.typesafe.config.Config
import au.csiro.data61.magda.api.FilterValue
import au.csiro.data61.magda.api.FilterValue._
import au.csiro.data61.magda.api.Specified
import au.csiro.data61.magda.api.Unspecified
import au.csiro.data61.magda.search.SearchStrategy
import org.elasticsearch.search.sort.SortOrder
import org.elasticsearch.search.aggregations.InternalAggregation
import org.elasticsearch.search.aggregations.metrics.tophits.InternalTopHits
import com.sksamuel.elastic4s.http.search.{Aggregations, HasAggregations}

/**
  * Contains ES-specific functionality for a Magda FacetType, which is needed to map all our clever magdaey logic
  * over to elasticsearch which doesn't necessarily simply support it.
  */
trait FacetDefinition {
  def facetType: FacetType

  /**
    *  The elastic4s aggregation definition for this facet, given a max bucket size
    *  We need to generate terms aggs in the following two groups:
    *  - terms agg `include` all input facet options
    *  - terms agg `exclude` all input facet options
    *  This will guarantee that user selected options will always be aggregated
    */
  def aggregationDefinition(
      query: Query,
      limit: Int
  ): Seq[AggregationDefinition]

  /**
    * Determines whether the passed query has any relevance to this facet - e.g. a query is only relevant to Year if it
    * has some kind of date parameters specified.
    */
  def isRelevantToQuery(query: Query): Boolean

  /**
    * Returns a QueryDefinition for only the part of the query that's relevant for this facet... e.g. for Year it creates
    * a query that looks for anything with a date within the Query's date parameters.
    */
  def filterAggregationQuery(query: Query): QueryDefinition

  /**
    *  Optional filter for the buckets that are returned from aggregation. This is useful for facets that are based on
    *  1:M relationships, as even filtering on the value of a facet tends to return a lot of nonsense results.
    *
    *  E.g. if I query for datasets with format "PDF" then I could still get "ZIP"  at the top of the resulting format
    *    aggregation, as long as every dataset with format "PDF" also has format "ZIP". So I can use this to filter out
    *    any aggregation results that aren't close to "PDF".
    */
  def isFilterOptionRelevant(query: Query)(filterOption: FacetOption): Boolean =
    true

  /**
    * Given an aggregation resolved from ElasticSearch, extract the actual individual FacetOptions. This has to be specified
    * per-facet because some facets use nested aggregations, so we need code to reach into the right sub-aggregation.
    */
  def extractFacetOptions(
      aggregation: Option[HasAggregations]
  ): Seq[FacetOption] = aggregationsToFacetOptions(aggregation)

  /**
    * Returns a query with the details relevant to this facet removed - useful for showing what options there *would* be
    * for this aggregation if it wasn't being filtered.
    */
  def removeFromQuery(query: Query): Query

  /**
    * Builds a Query for datasets with facets that match the supplied string. E.g. for publisher "Ballarat Council", this
    * creates a query that matches datasets with publisher "Ballarat Council"
    */
  def facetSearchQuery(textQuery: FilterValue[String]): Query

  /**
    * Creates an ES query that will match datasets where the value for this facet matches the exact string passed.
    */
  def exactMatchQuery(query: FilterValue[String]): QueryDefinition

  /**
    * Creates zero or more es queries that will match datasets with the exact match of this facet. E.g. if a Query has
    * publishers "Ballarat Council" and "City of ySdney" (sic), then it will return two Tuples with "Ballarat Council" and
    * "City of ySdney" and their corresponding query definitions. When run against elastic search, the first query will
    * return datasets that have the *exact* publisher value "Ballarat Council" but won't return anything for "City of ySdney"
    * because it's spelled wrong.
    */
  def exactMatchQueries(
      query: Query
  ): Set[(FilterValue[String], QueryDefinition)]

  /**
    * Reduce a list of facets to fit under the limit
    */
  def truncateFacets(
      query: Query,
      matched: Seq[FacetOption],
      exactMatch: Seq[FacetOption],
      unmatched: Seq[FacetOption],
      limit: Int
  ): Seq[FacetOption] = {
    val combined = (exactMatch ++ matched ++ unmatched)
    val lookup = combined.groupBy(_.value)

    // It's possible that some of the options will overlap, so make sure we're only showing the first occurence of each.
    combined
      .map(_.value)
      .distinct
      .map(lookup.get(_).get.head)
      .take(limit)
  }

  def autocompleteQuery(textQuery: String): QueryDefinition

  //--- Get api requested facet options and convert them to string
  def getInputFacetOptions(query: Query): List[String]

  /**
    * There is a bug in elastic4s that:
    * if `include` or `exclude` field of `terms agg` is a Seq with only 1 element, a string instead of an array of string will be generated in JSON request
    * This will cause an `x_content_parse_exception` as `include` & `exclude` must be both array or string
    * This function will duplicate the only element in a Seq if its size is 1
    * Luckily elasticsearch will ignore any duplicate items in `include` or `exclude`
    */
  def fixArrayBug(items: Seq[String]): Seq[String] =
    if (items.size == 1) items ++ items else items
}

object FacetDefinition {

  def facetDefForType(
      facetType: FacetType
  )(implicit config: Config): FacetDefinition = facetType match {
    case Format    => new FormatFacetDefinition
    case Publisher => new PublisherFacetDefinition
  }
}

class PublisherFacetDefinition(implicit val config: Config)
    extends FacetDefinition {
  def facetType = Publisher

  override def aggregationDefinition(
      query: Query,
      limit: Int
  ): Seq[AggregationDefinition] = {

    val inputOptions = getInputFacetOptions(query)

    var otherOptionsAgg = termsAggregation("terms-other-options")
      .size(limit)
      .field("publisher.name.keyword")
      .showTermDocCountError(true)
      .subAggregations(topHitsAggregation("topHits").size(1))

    if (inputOptions.size > 0) {
      // --- this if block cannot be combined with the one below
      // --- otherwise `aggs` only get a outdated copy
      otherOptionsAgg = otherOptionsAgg.exclude(fixArrayBug(inputOptions))
    }

    var aggs = List(otherOptionsAgg)

    if (inputOptions.size > 0) {
      aggs = termsAggregation("terms-selected-options")
        .size(inputOptions.size)
        .include(fixArrayBug(inputOptions))
        .field("publisher.name.keyword")
        .showTermDocCountError(true)
        .subAggregations(topHitsAggregation("topHits").size(1)) :: aggs
    }

    aggs
  }

  def aggToFacetOptions(agg: Option[Aggregations]) = {
    agg.toSeq
      .flatMap(_.dataAsMap.get("buckets").toSeq.toSeq)
      .flatMap(_.asInstanceOf[Seq[Map[String, Any]]].map { m =>
        val agg = Aggregations(m)
        new FacetOption(
          identifier = if (agg.contains("topHits")) {
            agg
              .tophits("topHits")
              .hits
              .headOption
              .flatMap(_.to[DataSet].publisher.flatMap(_.identifier))
          } else {
            None
          },
          value = agg.data("key").toString,
          hitCount = agg.data("doc_count").toString.toLong,
          countErrorUpperBound = agg.data
            .get("doc_count_error_upper_bound")
            .getOrElse("0")
            .toString
            .toLong
        )
      })
  }

  override def extractFacetOptions(
      aggregation: Option[HasAggregations]
  ): Seq[FacetOption] = aggregation match {
    case None => Nil
    case Some(agg) =>
      val selectedOptions = aggToFacetOptions(
        agg.dataAsMap.get("terms-selected-options").flatMap(AggUtils.toAgg(_))
      ).map(
        _.copy(
          matched = true
        )
      )
      val otherOptions = aggToFacetOptions(
        agg.dataAsMap.get("terms-other-options").flatMap(AggUtils.toAgg(_))
      )

      selectedOptions ++ otherOptions
  }

  def isRelevantToQuery(query: Query): Boolean = !query.publishers.isEmpty

  override def filterAggregationQuery(query: Query): QueryDefinition =
    should(query.publishers.map(publisherQuery(SearchStrategy.MatchPart)))
      .minimumShouldMatch(1)

  override def removeFromQuery(query: Query): Query =
    query.copy(publishers = Set())

  override def facetSearchQuery(textQuery: FilterValue[String]): Query =
    Query(publishers = Set(textQuery))

  override def exactMatchQuery(query: FilterValue[String]): QueryDefinition =
    exactPublisherQuery(query)

  override def exactMatchQueries(
      query: Query
  ): Set[(FilterValue[String], QueryDefinition)] =
    query.publishers.map(publisher => (publisher, exactMatchQuery(publisher)))

  override def autocompleteQuery(textQuery: String) =
    matchQuery("publisher.name.english", textQuery)

  def getInputFacetOptions(query: Query): List[String] =
    query.publishers.toList.flatMap {
      case Specified(v) => Some(v.toString)
      case _            => None
    }
}

class FormatFacetDefinition(implicit val config: Config)
    extends FacetDefinition {
  override def facetType = Format

  override def aggregationDefinition(
      query: Query,
      limit: Int
  ): Seq[AggregationDefinition] =
    nestedAggregation("nested-distributions", "distributions").subAggregations {
      val inputOptions = getInputFacetOptions(query)

      val otherOptionsAgg = termsAggregation("terms-other-options")
        .size(limit)
        .field("distributions.format.keyword_lowercase")
        .showTermDocCountError(true)
        .exclude(fixArrayBug("" :: inputOptions))
        .subAggregations {
          reverseNestedAggregation("reverse")
        }
        .order(TermsOrder("reverse", false))

      var aggs = List(otherOptionsAgg)

      if (inputOptions.size > 0) {

        aggs = termsAggregation("terms-selected-options")
          .size(inputOptions.size)
          .include(fixArrayBug(inputOptions))
          .exclude(fixArrayBug(Seq("")))
          .field("distributions.format.keyword_lowercase")
          .showTermDocCountError(true)
          .subAggregations {
            reverseNestedAggregation("reverse")
          }
          .order(TermsOrder("reverse", false)) :: aggs
      }

      aggs
    } :: Nil

  def aggToFacetOptions(agg: Option[Aggregations]) = {
    agg.toSeq
      .flatMap(_.dataAsMap.get("buckets").toSeq.toSeq)
      .flatMap(_.asInstanceOf[Seq[Map[String, Any]]].map { m =>
        val agg = Aggregations(m)
        new FacetOption(
          identifier = None,
          value = agg.data("key").toString,
          hitCount =
            Aggregations(agg.data("reverse").asInstanceOf[Map[String, Any]])
              .data("doc_count")
              .toString
              .toLong,
          countErrorUpperBound = agg.data
            .get("doc_count_error_upper_bound")
            .getOrElse("0")
            .toString
            .toLong
        )
      })
  }

  override def extractFacetOptions(
      aggregation: Option[HasAggregations]
  ): Seq[FacetOption] = aggregation match {
    case None => Nil
    case Some(agg) =>
      val nestedAgg =
        agg.dataAsMap.get("nested-distributions").flatMap(AggUtils.toAgg(_))
      val selectedOptions = aggToFacetOptions(
        nestedAgg.flatMap(
          _.dataAsMap.get("terms-selected-options").flatMap(AggUtils.toAgg(_))
        )
      ).map(
        _.copy(
          matched = true
        )
      )
      val otherOptions = aggToFacetOptions(
        nestedAgg.flatMap(
          _.dataAsMap.get("terms-other-options").flatMap(AggUtils.toAgg(_))
        )
      )

      selectedOptions ++ otherOptions
  }

  override def isRelevantToQuery(query: Query): Boolean = !query.formats.isEmpty

  override def filterAggregationQuery(query: Query): QueryDefinition =
    should(query.formats.map(formatQuery(SearchStrategy.MatchAll)(_)))
      .minimumShouldMatch(1)

  override def isFilterOptionRelevant(
      query: Query
  )(filterOption: FacetOption): Boolean = query.formats.exists {
    case Specified(format) =>
      WeightedLevenshteinMetric(10, 0.1, 1)
        .compare(format.toLowerCase, filterOption.value.toLowerCase) match {
        case Some(distance) => distance < 1.5
        case None           => false
      }
    case Unspecified() => false
  }

  override def removeFromQuery(query: Query): Query =
    query.copy(formats = Set())
  override def facetSearchQuery(textQuery: FilterValue[String]) =
    Query(formats = Set(textQuery))

  override def exactMatchQuery(query: FilterValue[String]): QueryDefinition =
    Queries.formatQuery(SearchStrategy.MatchAll)(query)

  override def exactMatchQueries(
      query: Query
  ): Set[(FilterValue[String], QueryDefinition)] =
    query.formats.map(format => (format, exactMatchQuery(format)))

  override def autocompleteQuery(textQuery: String) =
    nestedQuery("distributions").query(
      matchQuery("distributions.format.english", textQuery)
    )

  def getInputFacetOptions(query: Query): List[String] =
    query.formats.toList.flatMap {
      case Specified(v) => Some(v.toString)
      case _            => None
    }
}
