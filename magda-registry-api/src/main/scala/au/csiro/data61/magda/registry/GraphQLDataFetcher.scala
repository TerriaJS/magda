package au.csiro.data61.magda.registry

import scalikejdbc.DB
import spray.json._

class GraphQLDataFetcher {
  def getRecord(id: String, aspects: List[String]) : Option[GraphQLSchema.Record] = {
    DB readOnly { session => {
      RecordPersistence.getByIdWithAspects(session, id, Nil, aspects).map(r => GraphQLSchema.Record(id = r.id, name = r.name, Nil, r.aspects))

    }}
  }
  // , paths: Vector[Vector[String]]
  def getRecordsPage(pageToken: Option[String], aspects: List[String]) : GraphQLSchema.RecordsPageGraphQL = {
    DB readOnly { session => {
      val page = RecordPersistence.getAllWithAspects(session, Nil, aspects, pageToken)
      GraphQLSchema.RecordsPageGraphQL(
        records = page.records.map(r => GraphQLSchema.Record(id=r.id, name=r.name, aspectsList=Nil, aspects = r.aspects)),
        nextPageToken = page.nextPageToken.get
      )
    }}
  }
}
