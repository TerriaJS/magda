package au.csiro.data61.magda.search

import au.csiro.data61.magda.api.Query
import au.csiro.data61.magda.api.model.{
  RegionSearchResult,
  SearchResult,
  OrganisationsSearchResult,
  AutoCompleteQueryResult
}
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.model.TenantId._

import scala.concurrent.Future

trait SearchQueryer {

  def search(
      jwtToken: Option[String],
      query: Query,
      start: Long,
      limit: Int,
      facetSize: Int,
      tenantId: TenantId
  ): Future[SearchResult]

  def autoCompleteQuery(
      jwtToken: Option[String],
      field: String,
      inputString: Option[String],
      size: Option[Int],
      tenantId: TenantId
  ): Future[AutoCompleteQueryResult]

  def searchFacets(
      jwtToken: Option[String],
      facetType: FacetType,
      facetQuery: Option[String],
      generalQuery: Query,
      start: Int,
      limit: Int,
      tenantId: TenantId
  ): Future[FacetSearchResult]

  def searchRegions(
      query: Option[String],
      regionType: Option[String],
      lv1Id: Option[String],
      lv2Id: Option[String],
      lv3Id: Option[String],
      lv4Id: Option[String],
      lv5Id: Option[String],
      start: Long,
      limit: Int,
      tenantId: TenantId
  ): Future[RegionSearchResult]

  def searchOrganisations(
      query: Option[String],
      start: Int,
      limit: Int,
      tenantId: TenantId
  ): Future[OrganisationsSearchResult]
}

sealed trait SearchStrategy {
  val name: String
}

object SearchStrategy {

  def parse(name: String): SearchStrategy = name match {
    case MatchPart.name => MatchPart
    case MatchAll.name  => MatchAll
  }
  case object MatchPart extends SearchStrategy {
    override val name = "match-part"
  }
  case object MatchAll extends SearchStrategy {
    override val name = "match-all"
  }
}
