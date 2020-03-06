package au.csiro.data61.magda.opa

import akka.http.scaladsl.model.StatusCodes
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.registry._
import spray.json._

abstract class RecordEsriOpaPolicyWithInvalidAccessControlAspectSpec
    extends ApiWithOpa {
  override val userIdsAndExpectedRecordIdIndexesWithoutLink = List(
    (adminUser, List(0, 1, 2, 3, 4, 5)),
    (userId0, Nil),
    (userId1, Nil),
    (userId2, Nil),
    (userId3, Nil),
    (anonymous, Nil)
  )

  override val userIdsAndExpectedRecordIdIndexesWithSingleLink = List(
    (adminUser, List(2)),
    (userId0, Nil),
    (userId1, Nil),
    (userId2, Nil),
    (userId3, Nil),
    (anonymous, Nil)
  )

  def prepareData(param: FixtureParam): Unit ={
    createAspectDefinitions(param)
    createRecords(param)
    import spray.json._
    val expiration = JsObject("id"-> JsString("nsw-portal"), "data" -> JsObject("last crawl expiration" -> JsString("not expired")))
    updateExtraInput(expiration)
  }

  describe("should authorize non-link aspect query") {
    it(
      "on specified record (as path param)"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2
          var foundRecordsCounter = 0

          testRecords.zipWithIndex.map {
            case (record, recordIndex) =>
              val recordId = record.id

              Get(s"/v0/records/$recordId/aspects/$organizationId") ~> addTenantIdHeader(
                TENANT_0
              ) ~> addJwtToken(userId) ~> param
                .api(Full)
                .routes ~> check {
                val theResponse = responseAs[Option[JsObject]]
                if (expectedRecordIndexes.contains(recordIndex)) {
                  status shouldBe StatusCodes.OK
                  foundRecordsCounter = foundRecordsCounter + 1
                  theResponse.get.fields("name") shouldBe JsString(
                    recordOrgNames(recordIndex)
                  )
                } else {
                  status shouldBe StatusCodes.NotFound
                  theResponse.get.fields("message") shouldBe JsString(
                    "No record or aspect exists with the given IDs."
                  )
                }
              }
          }

          foundRecordsCounter shouldBe expectedRecordIndexes.length
        }
      )
    }

    it(
      "on specified record (as query param)"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2
          var foundRecordsCounter = 0

          testRecords.zipWithIndex.map {
            case (record, index) =>
              val recordId = record.id

              Get(s"/v0/records/$recordId?aspect=$organizationId") ~> addTenantIdHeader(
                TENANT_0
              ) ~> addJwtToken(userId) ~> param
                .api(Full)
                .routes ~> check {
                if (expectedRecordIndexes.contains(index)) {
                  foundRecordsCounter = foundRecordsCounter + 1
                  val record = responseAs[Option[Record]]
                  status shouldBe StatusCodes.OK
                  record.get.id shouldBe "record-" + index
                  record.get
                    .aspects(organizationId)
                    .fields("name") shouldBe JsString(
                    recordOrgNames(index)
                  )
                } else {
                  status shouldBe StatusCodes.NotFound
                }
              }
          }

          foundRecordsCounter shouldBe expectedRecordIndexes.length
        }
      )
    }

    it(
      "on all records"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records?aspect=$organizationId") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val records = responseAs[RecordsPage[Record]].records
            records.length shouldBe expectedRecordIndexes.length
            val results: List[(Record, Int)] =
              records.zip(expectedRecordIndexes)
            results.map(res => {
              val record = res._1
              val index = res._2
              record.id shouldBe "record-" + index
              record
                .aspects(organizationId)
                .fields("name") shouldEqual JsString(
                recordOrgNames(index)
              )
            })
          }
        }
      )
    }

    it(
      "on all records without specifying any aspects"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records") ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val records = responseAs[RecordsPage[Record]].records
            records.length shouldBe expectedRecordIndexes.length
            val results: List[(Record, Int)] =
              records.zip(expectedRecordIndexes)
            results.map(res => {
              val record = res._1
              val index = res._2
              record.id shouldBe "record-" + index
              record.aspects shouldBe Map()
            })
          }
        }
      )
    }

    it(
      "on all records with limit"
    ) { param =>
      prepareData(param)
      val limit = 3

      Get(s"/v0/records?aspect=$organizationId&limit=$limit") ~> addTenantIdHeader(
        TENANT_0
      ) ~> addJwtToken(
        userId0
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.OK
        val records = responseAs[RecordsPage[Record]].records
        records.length shouldBe 0
      }
    }

  }

  describe("should authorize page tokens query") {
    it(
      "and return different page tokens for different users (with-links aspect)"
    ) { param =>
      prepareData(param)
      val pageSize = 2

      /**
        *  How the expectedPageTokenOffsetMap is built
        *
        *  If the test records are inserted into a clean table (when sequence starts at 0),
        *  this map represents the expected page token offsets for each users when page size
        *  is set to 2.
        *
        *  The formula for token offset calculation is
        *
        *            token offset = record sequence - first token = s - f
        *
        *  During test and development, records might be inserted and deleted frequently,
        *  resulting in non-zero-sequence-based page tokens. The expected page tokens can be
        *  calculated by the following formula
        *
        *             page tokens = first token + token offset = f + offset
        *
        *
        *
        *   sequence (s)        |  0          1         2         3          4         5
        *   --------------------+---------------------------------------------------------------
        *   adminUser           |                                [record-3  record-4] [record-5]
        *   first token (f = 3) |
        *   token offset(s - f) |                                0          1
        *   tokens (f + offset) |                                0          4
        *   --------------------+---------------------------------------------------------------
        */
      val expectedPageTokenOffsetMap = Map(
        adminUser -> List(0, 1), // authorized to record-3, record-4, record-5
        userId0 -> List(0),
        userId1 -> List(0),
        userId2 -> List(0),
        userId3 -> List(0),
        anonymous -> List(0)
      )

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1

          var firstRecordToken = 0
          Get(s"/v0/records?aspect=$withLinksId&limit=1") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            val page = responseAs[RecordsPage[Record]]
            if (page.hasMore)
              firstRecordToken = page.nextPageToken.map(Integer.parseInt).get
          }

          Get(s"/v0/records/pagetokens?aspect=$withLinksId&limit=$pageSize") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val actualPageTokens = responseAs[List[String]]

            val expectedPageTokens = expectedPageTokenOffsetMap(userId).map(
              offset => if (offset == 0) 0 else firstRecordToken + offset
            )

            actualPageTokens
              .map(Integer.parseInt) shouldEqual expectedPageTokens
          }

        }
      )
    }

    it(
      "and return different page tokens for different users (non-link aspect)"
    ) { param =>
      prepareData(param)
      val pageSize = 3

      /**
        *  How the expectedPageTokenOffsetMap is built
        *
        *  If the test records are inserted into a clean table (when sequence starts at 0),
        *  this map represents the expected page token offsets for each users when page size
        *  is set to 3.
        *
        *  The formula for token offset calculation is
        *
        *            token offset = record sequence - first token = s - f
        *
        *  During test and development, records might be inserted and deleted frequently,
        *  resulting in non-zero-sequence-based page tokens. The expected page tokens can be
        *  calculated by the following formula (always starts with token 0)
        *
        *             page tokens = first token + token offset = f + offset
        *
        *
        *   sequence (s)        | 0          1         2          3          4         5
        *   --------------------+---------------------------------------------------------------
        *   adminUser           | [record-0  record-1  record-2]  [record-3  record-4  record-5]
        *   first token (f = 0) |
        *   token offset        |  0                   2                               5
        *   tokens (f + offset) |  0                   2                               5
        *   --------------------+---------------------------------------------------------------
        */
      val expectedPageTokenOffsetMap = Map(
        adminUser -> List(0, 2, 5), // authorized to all 6 records
        userId0 -> List(0),
        userId1 -> List(0),
        userId2 -> List(0),
        userId3 -> List(0),
        anonymous -> List(0)
      )

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1

          var firstRecordToken = 0
          Get(s"/v0/records?aspect=$organizationId&limit=1") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            val page = responseAs[RecordsPage[Record]]
            if (page.hasMore)
              firstRecordToken = page.nextPageToken.map(Integer.parseInt).get
          }

          Get(s"/v0/records/pagetokens?aspect=$organizationId&limit=$pageSize") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val actualPageTokens = responseAs[List[String]]

            val expectedPageTokens = expectedPageTokenOffsetMap(userId).map(
              offset => if (offset == 0) 0 else firstRecordToken + offset
            )

            actualPageTokens
              .map(Integer.parseInt) shouldEqual expectedPageTokens
          }

        }
      )
    }

  }

  describe("should NOT authorize query by aspect value") {
    def encode(rawQueriedValue: String) = {
      java.net.URLEncoder.encode(rawQueriedValue, "UTF-8")
    }

    val valueKey = "name"
    val queriedValue = encode(recordOrgNames(3)) // org names of record-3 and record-4

    it("and NOT return record-3 and record-4 to userId0") { param =>
      Get(
        s"/v0/records?aspectQuery=$organizationId.$valueKey:$queriedValue&aspect=$organizationId"
      ) ~>
        addTenantIdHeader(TENANT_0) ~> addJwtToken(userId0) ~> param
        .api(Full)
        .routes ~> check {
        status shouldEqual StatusCodes.OK
        val page = responseAs[RecordsPage[Record]]
        page.records.length shouldBe 0
      }
    }

    it("and NOT return record-4 to anonymous user") { param =>
      Get(
        s"/v0/records?aspectQuery=$organizationId.$valueKey:$queriedValue&aspect=$organizationId"
      ) ~>
        addTenantIdHeader(TENANT_0) ~> addJwtToken(anonymous) ~> param
        .api(Full)
        .routes ~> check {
        status shouldEqual StatusCodes.OK
        val page = responseAs[RecordsPage[Record]]
        page.records.length shouldBe 0
      }
    }

  }

  describe("should authorize meta query") {
    it(
      "of summary on all records"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records/summary") ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val records = responseAs[RecordsPage[RecordSummary]].records
            records.length shouldBe expectedRecordIndexes.length
            val results: List[(RecordSummary, Int)] =
              records.zip(expectedRecordIndexes)
            results.map(res => {
              val record = res._1
              val index = res._2
              record.id shouldBe "record-" + index
              record.aspects.toSet shouldBe testRecords(index).aspects.keys.toSet
            })
          }
        }
      )
    }

    it(
      "of summary on specified record"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2
          var foundRecordsCounter = 0

          testRecords.zipWithIndex.map {
            case (record, recordIndex) =>
              val recordId = record.id

              Get(s"/v0/records/summary/$recordId") ~> addTenantIdHeader(
                TENANT_0
              ) ~> addJwtToken(userId) ~> param
                .api(Full)
                .routes ~> check {
                if (expectedRecordIndexes.contains(recordIndex)) {
                  status shouldBe StatusCodes.OK
                  foundRecordsCounter = foundRecordsCounter + 1
                  val recordSummary = responseAs[RecordSummary]
                  recordSummary.id shouldBe recordId
                  recordSummary.aspects.toSet shouldBe testRecords(recordIndex).aspects.keys.toSet
                } else {
                  status shouldBe StatusCodes.NotFound
                }
              }
          }

          foundRecordsCounter shouldBe expectedRecordIndexes.length
        }
      )
    }

    it(
      "of count on all records"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithoutLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records/count") ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val countResponse = responseAs[CountResponse]
            countResponse.count shouldBe expectedRecordIndexes.length
          }
        }
      )

    }

  }

  describe("should NOT authorize single link aspect query") {
    it(
      "and NOT return link to authorized user (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-2"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinkId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId0
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and NOT return link to authorized user (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-2"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinkId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId0
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return link to unauthorized user (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordIndex = 2
      val referencingRecordId = "record-" + referencingRecordIndex

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinkId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }

      Get(
        s"/v0/records/$referencingRecordId?aspect=$organizationId&aspect=$withLinkId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return link to unauthorized user (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordIndex = 2
      val referencingRecordId = "record-" + referencingRecordIndex

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinkId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }

      Get(
        s"/v0/records/$referencingRecordId?aspect=$organizationId&aspect=$withLinkId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }

    }

    it(
      "for all users on all records (dereference=false)"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithSingleLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records?aspect=$withLinkId") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val records = responseAs[RecordsPage[Record]].records
            records.length shouldBe expectedRecordIndexes.length
            val results: List[(Record, Int)] =
              records.zip(expectedRecordIndexes)
            results.map(res => {
              val record = res._1
              val index = res._2
              record.id shouldBe "record-" + index
              record.aspects(withLinkId).fields(linkName) shouldEqual JsString(
                singleLinkRecordIdMapDereferenceIsFalse((userId, record.id))
              )
            })
          }
        }
      )
    }

    it(
      "for all users on all records (dereference=true)"
    ) { param =>
      prepareData(param)

      userIdsAndExpectedRecordIdIndexesWithSingleLink.map(
        userIdAndExpectedRecordIndexes => {
          val userId = userIdAndExpectedRecordIndexes._1
          val expectedRecordIndexes = userIdAndExpectedRecordIndexes._2

          Get(s"/v0/records?aspect=$withLinkId&dereference=true") ~> addTenantIdHeader(
            TENANT_0
          ) ~> addJwtToken(
            userId
          ) ~> param.api(Full).routes ~> check {
            status shouldBe StatusCodes.OK
            val records = responseAs[RecordsPage[Record]].records
            records.length shouldBe expectedRecordIndexes.length
            val results: List[(Record, Int)] =
              records.zip(expectedRecordIndexes)
            results.map(res => {
              val record = res._1
              val index = res._2
              record.id shouldBe "record-" + index
              record.aspects(withLinkId).fields(linkName) shouldEqual
                singleLinkRecordIdMapDereferenceIsTrue((userId, record.id))
            })
          }
        }
      )
    }
  }

  describe("should NOT authorize array links aspect query") {
    it(
      "and not return record-5 with both record-1 and record-3 to userId0 (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-5"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId0
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and NOT return record-5 with both record-1 and record-3 to userId0 (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-5"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId0
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return record-5 with record-3 but not record-1 to userId2 (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-5"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return record-5 with record-3 but not record-1 to userId2 (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-5" // with links to record-1 and record-3

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return any links referenced by record-4 to anonymous user (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-4" // with links to record-1 and record-3
      val withLinksAspectId = "withLinks"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksAspectId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        anonymous
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return any links referenced by record-4 to anonymous user (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-4" // with links to record-1 and record-3
      val withLinksAspectId = "withLinks"

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksAspectId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        anonymous
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return record-3 with empty links to userId2 (dereference=false)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-3" // with links to nothing

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=false"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }

    it(
      "and not return record-3 with empty links to userId2 (dereference=true)"
    ) { param =>
      prepareData(param)

      val referencingRecordId = "record-3" // with links to nothing

      Get(
        s"/v0/records/$referencingRecordId?aspect=$withLinksId&dereference=true"
      ) ~> addTenantIdHeader(TENANT_0) ~> addJwtToken(
        userId2
      ) ~> param.api(Full).routes ~> check {
        status shouldBe StatusCodes.NotFound
      }
    }
  }

}
