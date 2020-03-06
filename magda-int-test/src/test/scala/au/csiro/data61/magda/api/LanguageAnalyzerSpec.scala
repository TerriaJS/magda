package au.csiro.data61.magda.api

import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.StatusCodes.OK
import akka.http.scaladsl.server.Route
import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.search.SearchStrategy
import au.csiro.data61.magda.test.util.{Generators, MagdaMatchers}
import org.scalacheck.{Shrink, _}

import scala.util.Random

class LanguageAnalyzerSpec extends BaseSearchApiSpec {

  blockUntilNotRed()

  describe("should return the right dataset when searching for that dataset's") {
    describe("title") {
      testDataSetSearch(dataSet => dataSet.title.toSeq)
    }

    describe("description") {
      testDataSetSearch(dataSet => dataSet.description.toSeq, true)
    }

    describe("keywords") {
      testDataSetSearch(dataSet => dataSet.keywords)
    }

    describe("publisher name") {
      testDataSetSearch(
        dataSet => dataSet.publisher.toSeq.flatMap(_.name.toSeq)
      )
    }

    describe("distribution title") {
      testDataSetSearch(dataSet => {
        // --- only randomly pick one distribution to test as now it's AND operator in simple_string_query
        Random.shuffle(dataSet.distributions).take(1).map(_.title)
      })
    }

    describe("distribution description") {
      testDataSetSearch(dataSet => {
        Random
          .shuffle(dataSet.distributions)
          .take(1)
          .flatMap(_.description.toSeq)
      }, true)
    }

    describe("theme") {
      testDataSetSearch(dataSet => dataSet.themes, true)
    }

    def testDataSetSearch(
        rawTermExtractor: DataSet => Seq[String],
        useLightEnglishStemmer: Boolean = false
    ) = {
      def outerTermExtractor(dataSet: DataSet) =
        rawTermExtractor(dataSet)
          .filter(term => term.matches(".*[A-Za-z].*"))
          .filterNot(
            term =>
              Generators.luceneStopWords
                .exists(stopWord => term.equals(stopWord.toLowerCase))
          )

      def test(
          dataSet: DataSet,
          term: String,
          routes: Route,
          tuples: List[(DataSet, String)]
      ) = {
        Get(s"""/v0/datasets?query=${encodeForUrl(term)}&limit=10000""") ~> addSingleTenantIdHeader ~> routes ~> check {
          status shouldBe OK
          val result = responseAs[SearchResult]

          withClue(
            s"term: ${term} for ${outerTermExtractor(dataSet)} in ${result.dataSets
              .map(dataSet => dataSet.identifier + ": " + outerTermExtractor(dataSet))
              .mkString(", ")}"
          ) {
            result.strategy.get should equal(SearchStrategy.MatchAll)
            result.dataSets.size should be > 0
            result.dataSets.exists(_.identifier.equals(dataSet.identifier)) shouldBe true
          }
        }
      }

      testLanguageFieldSearch(
        outerTermExtractor,
        test,
        false,
        useLightEnglishStemmer
      )
    }
  }

  describe("should return the right publisher when searching by publisher name") {
    def termExtractor(dataSet: DataSet) =
      dataSet.publisher.toSeq.flatMap(_.name.toSeq)

    def test(
        dataSet: DataSet,
        publisherName: String,
        routes: Route,
        tuples: List[(DataSet, String)]
    ) = {
      Get(s"""/v0/facets/publisher/options?facetQuery=${encodeForUrl(
        publisherName
      )}&limit=10000""") ~> addSingleTenantIdHeader ~> routes ~> check {
        status shouldBe OK
        val result = responseAs[FacetSearchResult]

        val publisher = dataSet.publisher.get

        withClue(s"term: ${publisherName}, publisher: ${dataSet.publisher
          .map(_.name)} options ${result.options}") {
          result.options.exists { option =>
            option.value.equalsIgnoreCase(publisher.name.get)
            option.identifier.get.equals(publisher.identifier.get)
          } should be(true)
        }
      }
    }

    testLanguageFieldSearch(termExtractor, test, true)
  }

  describe("should return the right format when searching by format value") {
    def termExtractor(dataSet: DataSet) =
      dataSet.distributions
        .flatMap(_.format)
        .filterNot(x => x.equalsIgnoreCase("and") || x.equalsIgnoreCase("or"))

    def test(
        dataSet: DataSet,
        formatName: String,
        routes: Route,
        tuples: List[(DataSet, String)]
    ) = {
      Get(
        s"""/v0/facets/format/options?facetQuery=${encodeForUrl(formatName)}&limit=${tuples.size}"""
      ) ~> addSingleTenantIdHeader ~> routes ~> check {
        status shouldBe OK
        val result = responseAs[FacetSearchResult]
        val formats = termExtractor(dataSet)

        withClue(
          s"term: ${formatName} formats: ${formats} options ${result.options}"
        ) {
          result.options.exists(
            value =>
              formats.exists(format => value.value.equalsIgnoreCase(format))
          ) should be(true)
        }
      }
    }

    testLanguageFieldSearch(termExtractor, test, true)
  }

  def isAStopWord(term: String) =
    Generators.luceneStopWords.exists(
      stopWord => term.trim.equalsIgnoreCase(stopWord)
    )

  def getAllSlices(terms: Seq[String]) =
    for {
      start <- 0 to terms.length - 1
      len <- 1 to (terms.length - start)
      combinations = terms.drop(start).take(len)
    } yield combinations

  def testLanguageFieldSearch(
      outerTermExtractor: DataSet => Seq[String],
      test: (DataSet, String, Route, List[(DataSet, String)]) => Unit,
      keepOrder: Boolean = false,
      useLightEnglishStemmer: Boolean = false
  ) = {
    it("when searching for it directly") {
      def innerTermExtractor(dataSet: DataSet) =
        if (keepOrder) {
          outerTermExtractor(dataSet)
            .map(term => MagdaMatchers.tokenize(term).map(_.trim))
            .flatMap(getAllSlices)
            .map(_.mkString(" "))
        } else {
          outerTermExtractor(dataSet).flatMap(MagdaMatchers.tokenize)
        }

      doTest(innerTermExtractor, keepOrder)
    }

    it(s"regardless of pluralization/depluralization") {

      def innerTermExtractor(dataSet: DataSet) =
        if (keepOrder) {
          // If we're keeping order we want to create terms that are sub-slices of the terms created by outerTermExtractor
          outerTermExtractor(dataSet)
          // Split everything into individual words but don't mix the words from terms together
            .map(term => MagdaMatchers.tokenize(term).map(_.trim))
            // Generate all subslices from those terms
            .flatMap(getAllSlices)
            // Get rid of all the subslices that feature words we can't pluralize or unpluralize reliably
            .filterNot(
              terms =>
                terms.exists(
                  term =>
                    term.contains(".") ||
                      term.contains("'") ||
                      term.equalsIgnoreCase("s") ||
                      term.toLowerCase.endsWith("ss") ||
                      term.toLowerCase.endsWith("e") ||
                      term.toLowerCase.endsWith("ies") ||
                      term.toLowerCase.endsWith("es") ||
                      term.toLowerCase.endsWith("y") ||
                      isAStopWord(term)
                )
            )
            // Pluralize/depluralize individual words in each subslice where possible - if we can't
            // do it reliably then discard the entire subslice
            .map { terms =>
              val pluralized = terms.map {
                case term if term.last.toLower.equals('s') =>
                  val depluralized = term.take(term.length - 1)
                  if (MagdaMatchers.stemString(term, useLightEnglishStemmer) == depluralized) {
                    Some(depluralized)
                  } else None
                case term =>
                  val pluralized = term + "s"
                  if (MagdaMatchers.stemString(
                        pluralized,
                        useLightEnglishStemmer
                      ) == term) {
                    Some(pluralized)
                  } else None
              }

              if (pluralized.forall(_.isDefined)) pluralized.map(_.get)
              else Seq()
            }
            // Check we haven't introduced more stop words by pluralizing.
            .filterNot(terms => terms.exists(term => isAStopWord(term)))
            .map(_.mkString(" "))
        } else {
          // If we don't care about order then we just split all the terms into their individual words and
          // filter out ones that won't work
          outerTermExtractor(dataSet)
            .flatMap(MagdaMatchers.tokenize)
            .view
            .map(_.trim)
            .filterNot(_.contains("."))
            .filterNot(_.contains("'"))
            .filterNot(_.toLowerCase.endsWith("ss"))
            .filterNot(
              x => x.equalsIgnoreCase("and") || x.equalsIgnoreCase("or")
            )
            .filterNot(_.isEmpty)
            .filterNot(
              term =>
                term.toLowerCase.endsWith("e") ||
                  term.toLowerCase.endsWith("ies") ||
                  term.toLowerCase.endsWith("es") ||
                  term.toLowerCase.endsWith("y")
            ) // This plays havoc with pluralization because when you add "s" to it, ES chops off the "es at the end
            .filterNot(isAStopWord)
            .flatMap {
              case term if term.last.toLower.equals('s') =>
                val depluralized = term.take(term.length - 1)
                if (MagdaMatchers.stemString(term, useLightEnglishStemmer) == depluralized) {
                  Some(depluralized)
                } else None
              case term =>
                val pluralized = term + "s"
                if (MagdaMatchers.stemString(pluralized, useLightEnglishStemmer) == term) {
                  Some(pluralized)
                } else None
            }
            .filterNot(isAStopWord)
        }

      doTest(innerTermExtractor, keepOrder)
    }

    def doTest(
        innerTermExtractor: DataSet => Seq[String],
        keepOrder: Boolean
    ) = {
      def getIndividualTerms(terms: Seq[String]) =
        terms.map(MagdaMatchers.tokenize)

      /** Checks that there's at least one searchable term in this seq of strings */
      def checkForSearchableTerm =
        (list: Seq[String]) =>
          list.forall(_.length > 2) &&
            list.exists(
              term => !Seq("and", "or").contains(term.trim.toLowerCase)
            ) &&
            list.exists(!isAStopWord(_))

      val indexAndTermsGen = smallIndexGen.flatMap {
        case (indexName, dataSetsRaw, routes) ⇒
          val indexedDataSets =
            dataSetsRaw.filterNot(dataSet ⇒ innerTermExtractor(dataSet).isEmpty)

          val dataSetAndTermGens = indexedDataSets.flatMap { dataSet =>
            val rawTerms = getIndividualTerms(innerTermExtractor(dataSet))

            val termGen = if (keepOrder) {
              val validTerms = rawTerms.filter(checkForSearchableTerm)

              // Make sure there's _some_ sublist that can be successfully searched - if so try to generate one, otherwise return none
              if (!validTerms.isEmpty) {
                Some(Gen.oneOf(validTerms))
              } else None
            } else {
              val terms = rawTerms.flatten
                .filter(_.length > 2)
                .filterNot(
                  term => Seq("and", "or", "").contains(term.trim.toLowerCase)
                )
                .filterNot(isAStopWord)

              if (!terms.isEmpty) {
                Some(for {
                  noOfTerms <- Gen.choose(1, terms.length)
                  selectedTerms <- Gen
                    .pick(noOfTerms, terms) //Gen.pick shuffles the order
                } yield selectedTerms)
              } else None
            }

            termGen
              .map(gen => gen.map(list => (dataSet, list.mkString(" "))))
              .toSeq
          }

          val combinedDataSetAndTermGen =
            dataSetAndTermGens.foldRight(Gen.const(List[(DataSet, String)]()))(
              (soFar, current) =>
                for {
                  currentInner <- current
                  list <- soFar
                } yield currentInner :+ list
            )

          combinedDataSetAndTermGen.map((indexName, _, routes))
      }

      implicit def dataSetStringShrinker(
          implicit s: Shrink[DataSet],
          s1: Shrink[Seq[String]]
      ): Shrink[(DataSet, String)] = Shrink[(DataSet, String)] {
        case (dataSet, string) =>
          val seq = MagdaMatchers.tokenize(string)
          val x = for {
            start <- 0 to seq.length - 1
            len <- 1 to (seq.length - start)
            combinations = seq.drop(start).take(len)
            if !combinations.equals(seq)
          } yield combinations

          val shrunk = x.map(_.mkString(" "))

          shrunk.map((dataSet, _)).toStream
      }

      // Make sure a shrink for the indexAndTerms gen simply shrinks the list of datasets
      implicit def indexAndTermsShrinker(
          implicit s: Shrink[String],
          s1: Shrink[List[(DataSet, String)]],
          s2: Shrink[Route]
      ): Shrink[(String, List[(DataSet, String)], Route)] =
        Shrink[(String, List[(DataSet, String)], Route)] {
          case (indexName, terms, route) ⇒
            Shrink.shrink(terms).map { shrunkTerms ⇒
              val x = putDataSetsInIndex(shrunkTerms.map(_._1))
              logger
                .error("Shrinking " + terms.size + " to " + shrunkTerms.size)

              (x._1, shrunkTerms, x._3)
            }
        }

      forAll(indexAndTermsGen) {
        case (indexName, tuples, routes) =>
          whenever(!tuples.isEmpty) {
            tuples.foreach {
              case (dataSet, term) => test(dataSet, term, routes, tuples)
            }
          }
      }
    }
  }
}
