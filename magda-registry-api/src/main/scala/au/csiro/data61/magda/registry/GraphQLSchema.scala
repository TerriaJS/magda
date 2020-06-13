package au.csiro.data61.magda.registry

import sangria.execution.deferred.{Fetcher, HasId}
import sangria.schema._
import spray.json._
import enumeratum._

import scala.concurrent.Future

/**
 * Defines a GraphQL schema for the current project
 */
object GraphQLSchema {

  val source = """{
    "aspects": [
      {
        "name": "dataset_distributions",
        "schema": {
          "$schema": "http://json-schema.org/hyper-schema#",
          "title": "The distributions of a dataset",
          "description": "Specifies the list of distributions of a dataset.",
          "type": "object",
          "properties": {
            "distributions": {
              "title": "The distributions of this dataset.",
              "type": "array",
              "items": {
                "title": "A URI of a distribution of this dataset.",
                "type": "string",
                "links": [
                  {
                    "href": "/api/v0/registry/records/{$}",
                    "rel": "item"
                  }
                ]
              }
            }
          }
        }
      },
      {
        "name": "source_link_status",
        "schema": {
          "$schema": "http://json-schema.org/schema#",
          "title": "Aspect describing source link status of a distribution (active or broken)",
          "type": "object",
          "properties": {
            "status": {
              "type": "string",
              "enum": [
                "active",
                "broken"
              ]
            },
            "httpStatusCode": {
              "type": "integer"
            },
            "errorDetails": {
              "type": "string"
            }
          }
        }
      }
    ]
  }"""

  sealed abstract class JsonSchemaType(override val entryName: String) extends EnumEntry
  object JsonSchemaType extends Enum[JsonSchemaType] {
    val values = findValues
    case object String extends JsonSchemaType("string")
    case object Integer extends JsonSchemaType("integer")
    case object Array extends JsonSchemaType("array")
    case object Object extends JsonSchemaType("object")
  }

  // case class SchemaClass(properties: Option[Map[String, PropType]])
  // case class Aspect(name: String, schema: SchemaClass)
  // case class Aspects(aspects: List[Aspect])

// Decode aspect schema directly into ObjectType
// List[JsValue] -> Map[String (aspect name), ObjectType (aspect def)]
// Aspect =


  case class RecordProjectorAttributes(attributes: List[String], aspects: List[String], includeAspectsList: Boolean)

  def extractAttributesAndAspects(prj: Vector[ProjectedName]): RecordProjectorAttributes = {
    val prjName = prj.find(_.name == "records").get
    RecordProjectorAttributes(
      Nil,
      prjName.children.find(_.name == "aspects").map(_.children.map(_.name).toList).getOrElse(Nil),
      prjName.children.exists(_.name == "aspectsList")
    )
  }


  def isRecordLink(link: JsObject): Boolean = {
    link.getFields("href", "rel") match {
      case Seq(JsString(href), JsString(rel)) => href == "/api/v0/registry/records/{$}" && rel == "item"
      case _ => false
    }
  }

  object AspectJsonProtocol extends DefaultJsonProtocol {
    def makeResolver(name: String, outputType: OutputType[_]): (Context[GraphQLDataFetcher, JsObject] => Action[GraphQLDataFetcher, _]) = {
      // Fetch correct field of parent JsObject and treat it according to the field type

      // Could do error handling similar to:
      // def nonMatchingJson(expectedType: String, x: JsValue) = {
      //   "Aspect JSON did not match" + expectedType + ". Expected string, but got: " + x
      // }
      //   case StringType => _.value.fields.get(name).map({
      //     case JsString(s) => Right(s)
      //     case x => Left(nonMatchingJson("string", x))
      //   })

      outputType match {
        case StringType => _.value.fields.get(name).map(_.convertTo[String])
        case IntType => _.value.fields.get(name).map(_.convertTo[Int])
        case ListType(_) => _.value.fields.get(name).map(_.convertTo[List[JsValue]])
        case ObjectType(_,_,_,_,_,_) => _.value.fields.get(name).map(_.asJsObject)
        case RecordType => Projector((ctx: Context[GraphQLDataFetcher, JsObject], prj) => ctx.value.fields.get(name).map(id => {
          val projectorAttrs = extractAttributesAndAspects(prj)
          ctx.ctx.getRecord(id.convertTo[String], projectorAttrs.aspects)
        }))
        case _ => (_ => None)
      }
    }

    def constructField(name: String, outType: OutputType[Any]): Field[GraphQLDataFetcher, JsObject] = {
      Field(name, OptionType(outType), resolve = makeResolver(name, outType))
    }

    def constructSchemaDefinition(path: String, schema: JsObject): Option[OutputType[_]] = {
      schema.getFields("type", "links") match {
        case Seq(_, JsArray(links)) => if (links.exists(x => isRecordLink(x.asJsObject))) Some(RecordType) else None
        case Seq(JsString("string"), _) => Some(StringType)
        case Seq(JsString("integer"), _) => Some(IntType)
        case Seq(JsString("array"), _) => schema.fields.get("items").map(_.asJsObject).flatMap(x => constructSchemaDefinition(path + "_items", x)).map(x => ListType(x))
        case Seq(JsString("object"), _) => schema.fields.get("properties").map(_.asJsObject.convertTo[Map[String, JsValue]].toList.flatMap({
          case (name, schema) => constructSchemaDefinition(path + "_" + name, schema.asJsObject).map(outType => constructField(name, outType))
        })).map(x => ObjectType(path, fields[GraphQLDataFetcher, JsObject](x:_*)))
        case _ => None
      }
      // schema.fields.get("type").flatMap(x => JsonSchemaType.withNameInsensitiveOption(x.convertTo[String].toUpperCase)).flatMap({
      //   case JsonSchemaType.String => Some(StringType)
      //   case JsonSchemaType.Integer => Some(IntType)
      //   case JsonSchemaType.Array => schema.fields.get("items").map(_.asJsObject).flatMap(x => constructSchemaDefinition(path + "_items", x)).map(x => ListType(x))
      //   case JsonSchemaType.Object => schema.fields.get("properties").map(_.asJsObject.convertTo[Map[String, JsValue]].toList.flatMap({
      //     case (name, schema) => constructSchemaDefinition(path + "_" + name, schema.asJsObject).map(outType => constructField(name, outType))
      //   })).map(x => ObjectType(path, fields[GraphQLDataFetcher, JsObject](x:_*)))
      //   case _ => None

      // })
    }
    // implicit val aspectFormat = jsonFormat(Aspect, "name", "schema")
    // implicit val aspectsFormat = jsonFormat(Aspects, "aspects")
  }

  import AspectJsonProtocol._

  val a: List[OutputType[_]] = List(StringType, IntType, ListType(StringType), RecordType)


  case class Record(id: String, name: String, aspectsList: List[String], aspects: Map[String, JsObject])
  // might want to change aspects to a Map[String, JsValue sometime]

  lazy val RecordType = ObjectType(
    "Record",
    () => fields[GraphQLDataFetcher, Record](
      Field("id", StringType, resolve = _.value.id),
      Field("name", StringType, resolve = _.value.name),
      Field("aspectsList", ListType(StringType), resolve = _.value.aspectsList),
      Field("aspects", Aspects, resolve = _.value.aspects, tags = ProjectionExclude :: Nil)
    )
  )

  case class RecordsPageGraphQL(records: List[Record], nextPageToken: String)

  val RecordsPageGraphQLType = ObjectType("RecordsPage", fields[GraphQLDataFetcher,RecordsPageGraphQL](
    Field("records", ListType(RecordType), resolve = _.value.records),
    Field("nextPageToken", StringType, resolve = _.value.nextPageToken)
  ))



  val PageTokenArg = Argument("pageToken", OptionInputType(StringType))
  val RequiredAspectsArg = Argument("requiredAspects", ListInputType(StringType))
  val Query = ObjectType(
    "Query", fields[GraphQLDataFetcher, Unit](
      Field("allRecords", RecordsPageGraphQLType,
        arguments = List(PageTokenArg, RequiredAspectsArg),
        resolve = Projector((ctx,prj) => {
          val extractedAspects = extractAttributesAndAspects(prj)
          ctx.ctx.getRecordsPage(ctx.arg(PageTokenArg), extractedAspects.aspects)
        })
      )
    )
  )

  val aspectFields = source.parseJson.asJsObject.fields.get("aspects").get.convertTo[List[JsValue]].flatMap(aspect => aspect.asJsObject.getFields("name", "schema") match {
    case Seq(JsString(name), schema) => {
      val cleanedName = name.replaceAll("^([0-9])|[^A-Za-z0-9_]", "_$1") // Replace leading digit with _digit and any other characters with _
      constructSchemaDefinition("aspects_" + cleanedName, schema.asJsObject).map(outType => Field("Aspect_" + cleanedName, OptionType(outType), resolve = (ctx: Context[GraphQLDataFetcher, Map[String, JsObject]]) => ctx.value.get(cleanedName)))
    }
  })
  val Aspects = ObjectType(
    "Aspects",
    fields[GraphQLDataFetcher, Map[String, JsObject]](aspectFields:_*)
  )

  val MagdaSchema = Schema(Query)
}
