package au.csiro.data61.magda.search.elasticsearch

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model._
import akka.http.scaladsl.model.headers.RawHeader
import akka.stream.Materializer
import au.csiro.data61.magda.api.{FilterValue, Specified, Unspecified}
import com.sksamuel.elastic4s.http.ElasticDsl.boolQuery
import com.sksamuel.elastic4s.searches.queries.matches.{
  MatchAllQuery,
  MatchNoneQuery
}
import com.sksamuel.elastic4s.searches.queries.matches.MatchQuery
import com.sksamuel.elastic4s.searches.queries.term.TermQuery
import com.sksamuel.elastic4s.searches.queries.{
  ExistsQuery,
  RangeQuery,
  Query => QueryDefinition
}
import com.typesafe.config.Config
import akka.util.ByteString
import scala.concurrent.duration._
import spray.json._

import scala.concurrent.{ExecutionContext, Future}

case class RegoRefPart(refString: String, refType: String) {
  def isVar: Boolean = refType == "var"
}

object RegoRefPart {

  def unapply(json: JsValue): Option[RegoRefPart] = json match {
    case JsObject(data) =>
      val refTypeOption = data.get("type").flatMap {
        case JsString(refType) => Some(refType)
        case _                 => None
      }
      val refValueOption = data.get("value").flatMap {
        case JsString(refValue) => Some(refValue)
        case _                  => None
      }
      if (refTypeOption.isEmpty || refValueOption.isEmpty) None
      else Some(RegoRefPart(refValueOption.get, refTypeOption.get))
    case _ => None
  }
}

case class RegoRef(refParts: Seq[RegoRefPart]) {

  private val RegoOperators = Map(
    "eq" -> "=",
    "equal" -> "=",
    "neq" -> "!=",
    "lt" -> "<",
    "gt" -> ">",
    "lte" -> "<=",
    "gte" -> ">="
  )

  def fullRefString: String = {
    var isFirstPart = true
    val refStrParts = refParts.map { part =>
      var partStr = ""
      if (isFirstPart) {
        partStr = part.refString
      } else {
        if (part.refType == "var") {
          // --- it's a collection lookup
          // --- var name doesn't matter
          partStr = "[_]"
        } else {
          partStr = part.refString
        }
      }

      if (isFirstPart) {
        isFirstPart = false
      }
      partStr
    }
    // --- a.[_].[_] should be a[_][_]
    refStrParts.mkString(".").replace(".[", "[")
  }

  // --- strip the possible [_]
  def refString: String = {
    fullRefString.replaceFirst("\\[_\\]$", "")
  }

  def isOperator: Boolean = {
    RegoOperators.get(fullRefString) match {
      case Some(opt: String) => true
      case _                 => false
    }
  }

  // --- the first var type won't count as collection lookup
  def hasCollectionLookup: Boolean = {
    if (refParts.size <= 1) false
    else refParts.indexWhere(_.isVar, 1) != -1
  }

  // -- simple collection only contains 1 level lookup
  // -- we don't need Nested Query to handle it
  def isSimpleCollectionLookup: Boolean = {
    if (refParts.size <= 1) false
    else refParts.indexWhere(_.isVar, 1) == refParts.size - 1
  }

  def asOperator: Option[String] = {
    RegoOperators.get(fullRefString) match {
      case Some(opt: String) => Some(opt)
      case _                 => None
    }
  }

}

object RegoRef {

  def unapply(refJson: JsValue): Option[RegoRef] = refJson match {
    case JsObject(ref) =>
      ref.get("type") match {
        case Some(JsString("ref")) =>
          ref.get("value") match {
            case Some(JsArray(values)) =>
              val RegoRefArray = values.flatMap {
                case RegoRefPart(part) => Some(part)
                case _                 => None
              }.toArray
              Some(RegoRef(RegoRefArray))
            case _ => None
          }
        case _ => None
      }
    case _ => None
  }

}

case class RegoValue(valueType: String, value: JsValue) {

  def asNumber: Option[Number] = value match {
    case JsNumber(v) => Some(v)
    case _           => None
  }

  def asString: Option[String] = value match {
    case JsNumber(v) => Some(v.toString())
    case JsString(v) => Some(v)
    case JsTrue      => Some("true")
    case JsFalse     => Some("false")
    case _           => None
  }

  def asBoolean: Option[Boolean] = value match {
    case JsBoolean(v) => Some(v)
    case _            => None
  }

}

object RegoValue {

  def unapply(refJson: JsValue): Option[RegoValue] = refJson match {
    case JsObject(ref) =>
      ref.get("type") match {
        case Some(JsString(typeString)) if typeString != "ref" =>
          ref.get("value") match {
            case Some(v: JsNumber)  => Some(RegoValue(typeString, v))
            case Some(v: JsString)  => Some(RegoValue(typeString, v))
            case Some(v: JsBoolean) => Some(RegoValue(typeString, v))
            case _                  => None
          }
        case _ => None
      }
    case _ => None
  }

}

/**
  *
  * @param unknownDataRefs: the dataset refs that set to `unknown` for OPA's partial evaluation
  * @param config
  * @param system
  * @param ec
  * @param materializer
  */
class OpaQueryer(var unknownDataRefs: Seq[String] = Seq("input.object.dataset"))(
    implicit val config: Config,
    implicit val system: ActorSystem,
    implicit val ec: ExecutionContext,
    implicit val materializer: Materializer
) {

  private val http = Http(system)
  private val logger = system.log
  private val opaUrl: String = config.getConfig("opa").getString("baseUrl")
  private val testSessionId: Option[String] =
    if (config.hasPath("opa.testSessionId")) {
      Some(config.getString("opa.testSessionId"))
    } else {
      None
    }

  var hasErrors = false
  var errors: List[String] = List()

  unknownDataRefs = unknownDataRefs
    .map(_.trim)
    .filter(_.length > 0)
    .sortWith(_.length > _.length)

  private def reportErrorWithMatchNoneQuery(message: String) = {
    hasErrors = true
    errors = message :: errors
    logger.warning(message)
    MatchNoneQuery()
  }

  private def resetErrors() = {
    errors = List()
    hasErrors = false
  }

  private def ruleToQueryDef(ruleJson: JsValue): QueryDefinition = {
    ruleJson match {
      case JsObject(rule) =>
        val isDefault: Boolean = rule
          .get("default")
          .flatMap {
            case JsBoolean(v) => Some(v)
            case _            => None
          }
          .getOrElse(false)

        val defaultValue: Option[JsValue] = rule.get("head").flatMap {
          case JsObject(head) =>
            head.get("value").flatMap(_.asJsObject.fields.get("value"))
          case _ => None
        }

        if (isDefault) {
          //--- it's a default rule; rule body can be ignored
          defaultValue match {
            case Some(JsTrue) => MatchAllQuery()
            case _            => MatchNoneQuery()
          }
        } else {
          val ruleExps = rule
            .get("body")
            .toSeq
            .flatMap(_.asInstanceOf[JsArray].elements.map(_.asJsObject))
          val ruleExpQueries = ruleExps.map(ruleExpressionToQueryDef(_))
          if (ruleExpQueries.isEmpty) {
            MatchNoneQuery()
          } else {
            if (ruleExpQueries.size == 0) MatchNoneQuery()
            else boolQuery().must(ruleExpQueries)
          }
        }
      case _ =>
        reportErrorWithMatchNoneQuery(s"Rule should be JsObject: ${ruleJson}")
    }
  }

  private def translateDataRefString(refString: String): String = {
    unknownDataRefs.find { prefix =>
      s"^${prefix}".r.findFirstIn(refString) match {
        case None => false
        case _    => true
      }
    } match {
      case Some(prefix: String) => refString.replaceFirst(s"^${prefix}\\.", "")
      case _                    => refString
    }
  }

  private def createEsQueryForThreeTermsExpression(
      datasetRef: RegoRef,
      operator: String,
      value: RegoValue
  ): QueryDefinition = {

    val actualDataRefString = translateDataRefString(datasetRef.refString)

    if (datasetRef.hasCollectionLookup) {
      if (datasetRef.isSimpleCollectionLookup) {
        value.asString match {
          case Some(valueStr: String) =>
            MatchQuery(actualDataRefString, valueStr)
          case _ =>
            reportErrorWithMatchNoneQuery(
              s"Invalid value type for simple Opa collection lookup: ${value}"
            )
        }
      } else {
        reportErrorWithMatchNoneQuery(
          s"Non-simple Opa collection lookup is not supported: ${datasetRef.fullRefString}"
        )
      }
    } else {

      if (operator == "=" || operator == "!=") {
        value.asString.map(TermQuery(actualDataRefString, _)).map { q =>
          if (operator == "!=") boolQuery().not(q)
          else q
        } match {
          case Some(q) => q
          case _ =>
            reportErrorWithMatchNoneQuery(
              s"Invalid value type or operator for Opa expression: ${datasetRef.refString} operator: ${operator} value: ${value}"
            )
        }
      } else if (operator == ">" || operator == "<" || operator == ">=" || operator == "<=") {
        value.asString.flatMap { v =>
          val q = RangeQuery(actualDataRefString)
          operator match {
            case ">"  => Some(q.gt(v))
            case "<"  => Some(q.lt(v))
            case ">=" => Some(q.gte(v))
            case "<=" => Some(q.lte(v))
            case _    => None
          }
        } match {
          case Some(q) => q
          case _ =>
            reportErrorWithMatchNoneQuery(
              s"Invalid value type or operator for Opa expression: ${datasetRef.refString} operator: ${operator} value: ${value}"
            )
        }
      } else {
        reportErrorWithMatchNoneQuery(
          s"Invalid value type or operator for Opa expression: ${datasetRef.refString} operator: ${operator} value: ${value}"
        )
      }
    }

  }

  private def ruleExpressionToQueryDef(expJson: JsValue): QueryDefinition = {

    expJson match {
      case JsObject(exp) =>
        val terms = exp
          .get("terms")
          .toArray
          .flatMap(_.asInstanceOf[JsArray].elements.map(_.asJsObject))
        if (terms.size == 1) {
          // --- expression like data.abc with no operator
          // --- should use exist Query for this
          terms.head match {
            case RegoRef(r) =>
              if (!r.isOperator && !r.hasCollectionLookup) {
                ExistsQuery(r.fullRefString)
              } else {
                reportErrorWithMatchNoneQuery(
                  s"Invalid single Opa term, ref: ${r.fullRefString}"
                )
              }
            case _ => {
              reportErrorWithMatchNoneQuery(
                s"Invalid single Opa term: ${terms.head}"
              )
            }
          }
        } else if (terms.size == 3) {
          var operator: Option[String] = None
          var datasetRef: Option[RegoRef] = None
          var value: Option[RegoValue] = None

          terms.foreach { term =>
            term match {
              case RegoRef(ref) =>
                if (ref.isOperator) operator = ref.asOperator
                else datasetRef = Some(ref)
              case RegoValue(v) => value = Some(v)
              case _ =>
                reportErrorWithMatchNoneQuery(s"Invalid opa term: ${term}")
            }
          }
          if (datasetRef.isEmpty || operator.isEmpty || value.isEmpty) {
            reportErrorWithMatchNoneQuery(
              s"Invalid opa expression (can't locate datasetRef, operator or value): ${expJson}"
            )
          } else {
            createEsQueryForThreeTermsExpression(
              datasetRef.get,
              operator.get,
              value.get
            )
          }
        } else {
          // --- we only support 1 or 3 terms expression
          // --- 2 terms expression are very rare (or unlikely) to produce in rego
          reportErrorWithMatchNoneQuery(
            s"Invalid ${terms.size} Opa terms expression: ${expJson}"
          )
        }
      case _ =>
        reportErrorWithMatchNoneQuery(
          s"Rule expression should be JsObject: ${expJson}"
        )
    }
  }

  private def mergeNonMatchQuries(
      queries: Seq[QueryDefinition]
  ): Seq[QueryDefinition] = {
    val reducedQueries = if (queries.size > 1 && queries.exists {
                               case MatchNoneQuery(x) => true
                               case _                 => false
                             }) {

      /**
        * If contains more than one query & at least one is MatchNoneQuery
        * Will filter out MatchNoneQuery as it does nothing
        */
      queries.filter {
        case MatchNoneQuery(x) => false
        case _                 => true
      }
    } else {
      queries
    }

    if (reducedQueries.size == 0) Seq(MatchNoneQuery())
    else reducedQueries
  }

  private def parseOpaResponse(
      res: HttpResponse
  ): Future[Seq[QueryDefinition]] = {
    if (res.status.intValue() != 200) {
      res.entity.dataBytes.runFold(ByteString(""))(_ ++ _).flatMap { body =>
        logger.error(s"OPA failed to process the request: {}", body.utf8String)
        Future.failed(
          new Error(
            s"Failed to retrieve access control decision from OPA: ${body.utf8String}"
          )
        )
      }
    } else {

      res.entity.toStrict(10.seconds).map { entity =>
        val json = entity.data.utf8String.parseJson
        val ruleQuries = json.asJsObject.fields
          .get("result")
          .flatMap(_.asJsObject.fields.get("support"))
          .flatMap(_.asInstanceOf[JsArray].elements.headOption)
          .flatMap(_.asJsObject.fields.get("rules"))
          .toSeq
          .flatMap(_.asInstanceOf[JsArray].elements)
          .map(ruleToQueryDef(_))

        mergeNonMatchQuries(ruleQuries)
      }
    }
  }

  private def unknownDataRefsJson =
    JsArray(unknownDataRefs.map(JsString(_)).toVector)

  def publishingStateQuery(
      publishingStateValue: Set[FilterValue[String]],
      jwtToken: Option[String]
  ): Future[QueryDefinition] = {

    resetErrors()

    var filteredValue = publishingStateValue
      .map(value => {
        value match {
          case Specified(inner) => inner
          case Unspecified()    => ""
        }
      })
      .filter(_ != "")
      .toSeq

    // --- if "*" means all possible publishingState, should ignore all other options
    if (filteredValue.exists(_ == "*")) filteredValue = List("*")

    filteredValue = if (!filteredValue.isEmpty) filteredValue else List("*")

    val opaRequestFutures = filteredValue.map { datasetType =>
      val requestData: String = s"""{
                                   |  "query": "data.object.dataset.allow",
                                   |  "input": {
                                   |    "operationUri": "object/dataset/${datasetType}/read"
                                   |  },
                                   |  "unknowns": ${unknownDataRefsJson
                                     .toString()}
                                   |}""".stripMargin

      var headers = List(RawHeader("X-Magda-Session", jwtToken.getOrElse("")))
      if (!testSessionId.isEmpty) {
        // --- only used for testing so that MockServer can server different tests in parallel
        headers = RawHeader("x-test-session-id", testSessionId.get) :: headers
      }

      val httpRequest = HttpRequest(
        uri = s"${opaUrl}compile",
        method = HttpMethods.POST,
        entity = HttpEntity(ContentTypes.`application/json`, requestData),
        headers = headers
      )

      Http().singleRequest(httpRequest).flatMap(parseOpaResponse(_))
    }

    Future.sequence(opaRequestFutures).map { queries =>
      val combinedQuery = mergeNonMatchQuries(queries.flatten)

      boolQuery().should(combinedQuery).minimumShouldMatch(1)
    }
  }

}
