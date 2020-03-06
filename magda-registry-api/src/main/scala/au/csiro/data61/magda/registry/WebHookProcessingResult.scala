package au.csiro.data61.magda.registry

import akka.http.scaladsl.model.StatusCode

case class WebHookProcessingResult(
    previousLastEvent: Long,
    newLastEvent: Long,
    deferredResponse: Boolean,
    statusCode: Option[StatusCode]
)
