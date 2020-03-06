package au.csiro.data61.magda.registry

import io.swagger.annotations.{ApiModel, ApiModelProperty}
import au.csiro.data61.magda.model.Registry._

import scala.annotation.meta.field

@ApiModel(description = "A page of records.")
case class RecordsPage[T <: RecordType](
    @(ApiModelProperty @field)(
      value = "Whether there are more records available.",
      required = true
    ) hasMore: Boolean,
    @(ApiModelProperty @field)(
      value = "A token to be used to get the next page of records.",
      required = true
    ) nextPageToken: Option[String],
    @(ApiModelProperty @field)(
      value = "The records in this page.",
      required = true
    ) records: List[T]
)
