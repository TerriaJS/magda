package au.csiro.data61.magda.util

import java.net.URL

/**
  * Created by gil308 on 12/10/2016.
  */
object Http {

  def getPort(url: URL) =
    portAsOption(url.getPort)
      .orElse(portAsOption(url.getDefaultPort))
      .getOrElse(80)

  def portAsOption(port: Int): Option[Int] =
    if (port == -1) None else Some(port)
}
