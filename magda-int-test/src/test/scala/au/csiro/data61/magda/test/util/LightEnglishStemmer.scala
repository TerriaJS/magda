package au.csiro.data61.magda.test.util

import java.io.Reader
import java.io.StringReader

import org.apache.lucene.analysis.Analyzer
import org.apache.lucene.analysis.TokenStream
import org.apache.lucene.analysis.en.KStemFilter
import org.apache.lucene.analysis.en.KStemFilterFactory
import org.apache.lucene.analysis.standard.StandardTokenizer
import org.apache.lucene.analysis.core.KeywordTokenizer
import org.apache.lucene.analysis.core.KeywordTokenizerFactory
import org.apache.lucene.analysis.tokenattributes.CharTermAttribute
import org.apache.lucene.util.Version
import org.apache.lucene.analysis.Analyzer.TokenStreamComponents
import org.apache.lucene.analysis.charfilter.HTMLStripCharFilter
import org.apache.lucene.analysis.custom.CustomAnalyzer

class LightEnglishStemmer {

  def stem(string: String): String = {

    val KStemmAna = CustomAnalyzer.builder
      .withTokenizer(classOf[KeywordTokenizerFactory])
      .addTokenFilter(classOf[KStemFilterFactory])
      .build
    val reader: Reader = new StringReader(string)
    val stream: TokenStream = KStemmAna.tokenStream("", reader)
    val term: CharTermAttribute =
      stream.getAttribute(classOf[CharTermAttribute])

    stream.reset()
    var output: String = "";
    while (stream.incrementToken) {
      output = output + term.toString
    }
    stream.end()
    stream.close()

    return output
  }

}
