package au.csiro.data61.magda.search.elasticsearch.Readers

import com.sksamuel.elastic4s.AggReader
import com.sksamuel.elastic4s.json.JacksonSupport
import au.csiro.data61.magda.model.misc.DataSet
import scala.util.Try

object DatasetReaders {

  implicit object AggReader extends AggReader[DataSet] {

    def read(json: String) = {
      Try(JacksonSupport.mapper.readValue[DataSet](json))
    }

  }

}
