package au.csiro.data61.magda.api

import au.csiro.data61.magda.test.util.Generators
import org.scalatest.{BeforeAndAfterAll}

import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.ContentTypes.`application/json`
import akka.http.scaladsl.model.StatusCodes.{OK, InternalServerError}
import au.csiro.data61.magda.model.misc.{DataSetAccessNotes}
import au.csiro.data61.magda.api.model.AutoCompleteQueryResult
import org.scalacheck.Gen

import scala.collection.mutable

class AutoCompleteApiSpec extends BaseSearchApiSpec with BeforeAndAfterAll {

  override def afterAll {
    super.afterAll
    cleanUpIndexes()
  }

  def createDatasetWithItems(items: Seq[String]) = {
    val inputCache: mutable.Map[String, List[_]] = mutable.HashMap.empty
    val dataSets = Gen
      .listOfN(items.size, Generators.dataSetGen(inputCache))
      .retryUntil(_ => true)
      .sample
      .get
      .zip(items)
      .map {
        case (dataset, location) =>
          dataset.copy(
            accessNotes = Some(
              DataSetAccessNotes(
                location = Some(location)
              )
            )
          )
      }
    putDataSetsInIndex(dataSets) match {
      case (_, _, routes) => routes
    }
  }

  val notes = List(
    "/shareDriveA/c/d/e",
    "/shareDriveB/c/f/h",
    "/shareDriveB/c/a/h",
    "Contact testEmail@email.com for access",
    "Contact testEmail2@email.com for access",
    "Access database name `ABC` and table `bde`",
    "/shareDriveC/d/e/f",
    "/shareDriveC/d/e/f",
    "/shareDriveC/e/f/d",
    "/shareDriveB/testDriveC/a/h",
    "/shareDriveB/testDriveD/x/y"
  )

  val routes = createDatasetWithItems(notes)

  it("Should respond with empty list without error if input is not supplied") {

    Get(s"/v0/autoComplete?field=accessNotes.location") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (0)
      response.errorMessage shouldBe None
    }
  }

  it("Should respond with first 3 items + last 5 item for input `/shareDrive`") {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=/shareDrive") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (7) // --- no duplication will be included
      response.suggestions.contains(notes(0)) shouldBe true
      response.suggestions.contains(notes(1)) shouldBe true
      response.suggestions.contains(notes(2)) shouldBe true
      response.suggestions.contains(notes(7)) shouldBe true
      response.suggestions.contains(notes(8)) shouldBe true
      response.suggestions.contains(notes(9)) shouldBe true
      response.suggestions.contains(notes(10)) shouldBe true
    }
  }

  it("Should respond with Item 2 & 3 + last 2 items for `/shareDriveB`") {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=/shareDriveB") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (4)
      response.suggestions.contains(notes(1)) shouldBe true
      response.suggestions.contains(notes(2)) shouldBe true
      response.suggestions.contains(notes(9)) shouldBe true
      response.suggestions.contains(notes(10)) shouldBe true
    }
  }

  it(
    "Should respond with Item 2 & 3 + last 2 items for input `/shareDriveb (Lowercase b)`"
  ) {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=/shareDriveB") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (4)
      response.suggestions.contains(notes(1)) shouldBe true
      response.suggestions.contains(notes(2)) shouldBe true
      response.suggestions.contains(notes(9)) shouldBe true
      response.suggestions.contains(notes(10)) shouldBe true
    }
  }

  it("Should respond with Item 4 & 5 for input `contact teste`") {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=contact%20teste") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (2)
      response.suggestions.contains(notes(3)) shouldBe true
      response.suggestions.contains(notes(4)) shouldBe true
    }
  }

  it("Should respond with Error for invalid field name: xxxx") {

    Get(s"/v0/autoComplete?field=xxxx&input=xxxx") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe InternalServerError
    }
  }

  it(
    "Should respond with `/shareDriveC/d/e/f` (without duplication) & `/shareDriveC/e/f/d` for input `/shareDriveC`"
  ) {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=/shareDriveC") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (2) // --- should be no duplication. Thus, 2 rather than 3
      response.suggestions.contains(notes(6)) shouldBe true
      response.suggestions.contains(notes(8)) shouldBe true
    }
  }

  it("Should respond with Item 10 & 11 for input `testDrive`") {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=testDrive") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (2)
      response.suggestions.contains(notes(9)) shouldBe true
      response.suggestions.contains(notes(10)) shouldBe true
    }
  }

  it("Should respond with Item 11 for input `testDriveD`") {

    Get(s"/v0/autoComplete?field=accessNotes.location&input=testDriveD") ~> addSingleTenantIdHeader ~> routes ~> check {
      status shouldBe OK
      contentType shouldBe `application/json`
      val response = responseAs[AutoCompleteQueryResult]
      response.suggestions.size shouldEqual (1)
      response.suggestions.contains(notes(10)) shouldBe true
    }
  }

}
