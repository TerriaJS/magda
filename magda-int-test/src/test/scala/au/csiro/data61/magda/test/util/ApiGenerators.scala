package au.csiro.data61.magda.test.util

import au.csiro.data61.magda.api.{FilterValue, Query, Specified, Unspecified}
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.spatial.RegionSource
import au.csiro.data61.magda.test.util.Generators._
import au.csiro.data61.magda.util.Regex._
import com.typesafe.config.Config
import org.scalacheck.Gen
import org.scalacheck.Gen.Choose._
import spray.json.{JsObject, _}

import scala.collection.mutable

object ApiGenerators {

  def queryTextGen(dataSets: List[DataSet]) = {
    val allDescWords =
      dataSets.flatMap(_.description.toSeq.flatMap(_.split(" ")))

    allDescWords match {
      case Nil => Gen.const("")
      case _ =>
        val safeDescWords = allDescWords.filterNot(
          x => Generators.luceneStopWords.contains(x.toLowerCase)
        )
        val result = (for {
          someDescWords <- listSizeBetween(1, 5, Gen.oneOf(safeDescWords))
          concated = someDescWords.mkString(" ")
        } yield concated).suchThat(validFilter)

        result
    }
  }

  def quoteTextGen(dataSets: List[DataSet]) = {
    val dataSetsWithDesc = dataSets.filter(_.description.isDefined)

    val wordsGen = dataSetsWithDesc match {
      case Nil => Gen.const(List[String]())
      case _ =>
        for {
          dataSet <- Gen.oneOf(dataSetsWithDesc)
          description = dataSet.description.get
          words = description.split(" ").toList
        } yield words
    }

    wordsGen.flatMap { words =>
      words match {
        case Nil => Gen.const("")
        case _ =>
          for {
            subWords <- Generators.subListGen(words)
          } yield subWords.mkString(" ")
      }
    }
  }
  def unspecifiedGen(implicit config: Config) = Gen.const(Unspecified())

  def filterValueGen[T](
      innerGen: Gen[T]
  )(implicit config: Config): Gen[FilterValue[T]] =
    Gen.frequency((3, innerGen.map(Specified.apply)), (1, unspecifiedGen))

  def set[T](gen: Gen[T]): Gen[Set[T]] = Gen.containerOf[Set, T](gen)

  def probablyEmptySet[T](gen: Gen[T]): Gen[Set[T]] =
    Gen.frequency((1, smallSet(gen)), (3, Gen.const(Set())))

  def specifiedPublisherQueryGen(dataSets: List[DataSet]) = {
    dataSets.flatMap(_.publisher.flatMap(_.name)) match {
      case Nil =>
        nonEmptyTextGen.suchThat(validFilter)
      case publishers =>
        val publisherPicker = Gen.oneOf(publishers)

        Gen
          .frequency(
            (5, publisherPicker),
            (3, publisherPicker.flatMap(partialStringGen)),
            (1, nonEmptyTextGen)
          )
          .suchThat(validFilter)
    }
  }

  def publisherQueryGen(
      dataSets: List[DataSet]
  )(implicit config: Config): Gen[FilterValue[String]] =
    filterValueGen(specifiedPublisherQueryGen(dataSets))

  def partialFormatGen(inputCache: mutable.Map[String, List[_]]) =
    formatGen(inputCache)
      .map(_._2)
      .flatMap(
        format =>
          Gen
            .choose(format.length / 2, format.length)
            .map(
              length => format.substring(Math.min(format.length - 1, length))
            )
      )

  def formatQueryGenInner(dataSets: List[DataSet]) = {
    dataSets.flatMap(_.distributions.flatMap(_.format)) match {
      case Nil =>
        nonEmptyTextGen.suchThat(validFilter)
      case formats =>
        val formatPicker = Gen.oneOf(formats)

        Gen
          .frequency(
            (5, formatPicker),
            (3, formatPicker.flatMap(partialStringGen)),
            (1, nonEmptyTextGen)
          )
          .suchThat(validFilter)
    }
  }

  def formatQueryGen(dataSets: List[DataSet])(implicit config: Config) =
    filterValueGen(formatQueryGenInner(dataSets))

  def partialStringGen(string: String): Gen[String] = {
    val split = string.split("[\\s-]+")

    for {
      start <- Gen.choose(0, split.length / 2)
      end <- Gen.choose(start + (split.length / 2), split.length)
      delimiter <- Gen.oneOf("-", " ")
    } yield
      split.slice(start, Math.max(split.length - 1, 1)).mkString(delimiter)
  }

  def validFilter(word: String): Boolean =
    !stopWordRegex.r.matchesAny(word) && // stop words tend to not match anything because of TFDIF
      word.exists(_.isLetterOrDigit) && // GOtta have at least one letter
      word.length > 1

  def innerRegionQueryGen(
      implicit config: Config,
      regions: List[(RegionSource, JsObject)]
  ): Gen[Region] =
    Gen
      .oneOf(regions)
      .map {
        case (regionSource, regionObject) =>
          Region(regionJsonToQueryRegion(regionSource, regionObject))
      }

  def regionQueryGen(
      implicit config: Config,
      regions: List[(RegionSource, JsObject)]
  ) = filterValueGen(innerRegionQueryGen)

  def regionJsonToQueryRegion(
      regionSource: RegionSource,
      regionObject: JsObject
  ): QueryRegion =
    QueryRegion(
      regionType = regionSource.name,
      regionId = regionObject
        .fields("properties")
        .asJsObject
        .fields(regionSource.idProperty)
        .asInstanceOf[JsString]
        .value
    )

  def dateFromGen(implicit config: Config) =
    filterValueGen(
      periodOfTimeGen
        .map(_.start.flatMap(_.date))
        .suchThat(_.isDefined)
        .map(_.get)
    )

  def dateToGen(implicit config: Config) =
    filterValueGen(
      periodOfTimeGen
        .map(_.end.flatMap(_.date))
        .suchThat(_.isDefined)
        .map(_.get)
    )

  def queryIsSmallEnough(query: Query) = {
    def textCount(input: String) = input.split("[\\s\\.-]").size
    def createCount(iterable: Iterable[Int]) =
      if (iterable.isEmpty) 0 else iterable.reduce(_ + _)
    def iterableTextCount(input: Iterable[String]) =
      createCount(input.map(textCount))
    def iterableTextCountFv(input: Iterable[FilterValue[String]]) = {
      createCount(input.map(_.map(textCount).getOrElse(0)))
    }

    val freeTextCount = iterableTextCount(query.freeText)
    val publisherCount = iterableTextCountFv(query.publishers)
    val dateFromCount = query.dateFrom.map(_ => 1).getOrElse(0)
    val dateToCount = query.dateTo.map(_ => 1).getOrElse(0)
    val formatsCount = iterableTextCountFv(query.formats)
    val regionsCount = query.regions.size

    (freeTextCount + publisherCount + dateFromCount + dateToCount + formatsCount + regionsCount) < 500
  }

  def queryGen(
      dataSets: List[DataSet]
  )(implicit config: Config, regions: List[(RegionSource, JsObject)]) =
    (for {
      freeText <- noneBiasedOption(queryTextGen(dataSets))
      quotes <- probablyEmptySet(quoteTextGen(dataSets))
      publishers <- probablyEmptySet(publisherQueryGen(dataSets))
      dateFrom <- Generators.noneBiasedOption(dateToGen)
      dateTo <- Generators.noneBiasedOption(dateFromGen)
      formats <- probablyEmptySet(formatQueryGen(dataSets))
      regions <- probablyEmptySet(regionQueryGen)
    } yield
      Query(
        freeText = (freeText.toSeq ++ quotes.map(""""""" + _ + """"""")) match {
          case Nil => None
          case seq => Some(seq.mkString(" "))
        },
        publishers = publishers,
        dateFrom = dateFrom,
        dateTo = dateTo,
        formats = formats,
        regions = regions
      )).suchThat(query => queryIsSmallEnough(query) && query != Query())

  def exactQueryGen(
      dataSets: List[DataSet]
  )(implicit config: Config, regions: List[(RegionSource, JsObject)]) =
    queryGen(dataSets)

  def unspecificQueryGen(
      dataSets: List[DataSet]
  )(implicit config: Config, regions: List[(RegionSource, JsObject)]) =
    (for {
      freeText <- queryTextGen(dataSets)
    } yield Query(freeText = Some(freeText)))
      .suchThat(queryIsSmallEnough)

  def encodeForUrl(query: String) = java.net.URLEncoder.encode(query, "UTF-8")

  def textQueryGen(
      queryGen: Gen[Query]
  )(implicit config: Config): Gen[(String, Query)] = queryGen.flatMap { query =>
    val publishers = query.publishers.filter(containsNoStopWord)
    val formats = query.formats.filter(containsNoStopWord)

    val facetList =
      publishers.map(
        publisher => s"publisher=${encodeForUrl(publisher.toString)}"
      ) ++
        query.dateFrom
          .map(dateFrom => s"dateFrom=${encodeForUrl(dateFrom.toString)}")
          .toSeq ++
        query.dateTo
          .map(dateTo => s"dateTo=${encodeForUrl(dateTo.toString)}")
          .toSeq ++
        formats.map(format => s"format=${encodeForUrl(format.toString)}") ++
        query.regions.map(
          region =>
            s"region=${encodeForUrl(region.map(_.queryRegion).toString)}"
        )

    val allList = Set(s"query=${encodeForUrl(query.freeText.getOrElse(""))}") ++ facetList

    val textQuery = for {
      randomList <- Gen.pick(allList.size, allList)
      rawQuery = randomList.mkString("&")
      randomCaseQuery <- randomCaseGen(rawQuery)
      query = randomCaseQuery
        .replaceAll("(?i)query=", "query=")
        .replaceAll("(?i)publisher=", "publisher=")
        .replaceAll("(?i)dateFrom=", "dateFrom=")
        .replaceAll("(?i)dateTo=", "dateTo=")
        .replaceAll("(?i)format=", "format=")
        .replaceAll("(?i)region=", "region=")
    } yield query

    textQuery.flatMap(
      (_, query.copy(publishers = publishers, formats = formats))
    )
  }

  def containsNoStopWord(word: FilterValue[String]): Boolean = {
    !luceneStopWords.exists(
      stopWord =>
        word
          .map(_.toLowerCase.contains(" " + stopWord.toLowerCase + " "))
          .getOrElse(false)
    )
  }
}
