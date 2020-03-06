package au.csiro.data61.magda.client

import scala.concurrent.ExecutionContext
import scala.concurrent.Future
import scala.util.Try
import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.client.RequestBuilding
import akka.http.scaladsl.marshalling.ToEntityMarshaller
import akka.http.scaladsl.model.HttpRequest
import akka.http.scaladsl.model.HttpResponse
import akka.stream.Materializer
import akka.stream.scaladsl.Flow
import akka.stream.scaladsl.Sink
import akka.stream.scaladsl.Source
import au.csiro.data61.magda.util.Http.getPort
import java.net.URL
import akka.http.scaladsl.model.HttpHeader

trait HttpFetcher {
  def get(path: String, headers: Seq[HttpHeader] = Seq()): Future[HttpResponse]

  def post[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse]

  def put[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse]
}

class HttpFetcherImpl(baseUrl: URL)(
    implicit val system: ActorSystem,
    val materializer: Materializer,
    val ec: ExecutionContext
) extends HttpFetcher {
  lazy val connectionFlow
      : Flow[(HttpRequest, Int), (Try[HttpResponse], Int), _] = {
    val host = baseUrl.getHost
    val port = getPort(baseUrl)

    baseUrl.getProtocol match {
      case "http"  => Http().cachedHostConnectionPool[Int](host, port)
      case "https" => Http().cachedHostConnectionPoolHttps[Int](host, port)
    }
  }

  def get(
      path: String,
      headers: Seq[HttpHeader] = Seq()
  ): Future[HttpResponse] = {
    val url = s"${baseUrl.getPath}${path}"
    system.log.debug("Making GET request to {}{}", baseUrl.getHost, url)
    val request = RequestBuilding
      .Get(url)
      .withHeaders(scala.collection.immutable.Seq.concat(headers))
    Source.single((request, 0)).via(connectionFlow).runWith(Sink.head).map {
      case (response, _) => response.get
    }
  }

  def post[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse] = {
    val url = s"${baseUrl.getPath}${path}"
    system.log.debug(
      "Making POST request to {}{} with {}",
      baseUrl.getHost,
      url,
      payload
    )
    val request = RequestBuilding
      .Post(url, payload)
      .withHeaders(scala.collection.immutable.Seq.concat(headers))
    Source.single((request, 0)).via(connectionFlow).runWith(Sink.head).map {
      case (response, _) => response.get
    }
  }

  def put[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse] = {
    val url = s"${baseUrl.getPath}${path}"
    system.log.debug(
      "Making PUT request to {}{} with {}",
      baseUrl.getHost,
      url,
      payload
    )
    val request = RequestBuilding
      .Put(url, payload)
      .withHeaders(scala.collection.immutable.Seq.concat(headers))
    Source.single((request, 0)).via(connectionFlow).runWith(Sink.head).map {
      case (response, _) => response.get
    }
  }

  def delete[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse] = {
    val url = s"${baseUrl.getPath}${path}"
    system.log.debug(
      "Making DELETE request to {}{} with {}",
      baseUrl.getHost,
      url,
      payload
    )
    val request = RequestBuilding
      .Delete(url, payload)
      .withHeaders(scala.collection.immutable.Seq.concat(headers))
    Source.single((request, 0)).via(connectionFlow).runWith(Sink.head).map {
      case (response, _) => response.get
    }
  }

  def head[T](path: String, payload: T, headers: Seq[HttpHeader] = Seq())(
      implicit m: ToEntityMarshaller[T]
  ): Future[HttpResponse] = {
    val url = s"${baseUrl.getPath}${path}"
    system.log.debug(
      "Making HEAD request to {}{} with {}",
      baseUrl.getHost,
      url,
      payload
    )
    val request = RequestBuilding
      .Head(url, payload)
      .withHeaders(scala.collection.immutable.Seq.concat(headers))
    Source.single((request, 0)).via(connectionFlow).runWith(Sink.head).map {
      case (response, _) => response.get
    }
  }
}

object HttpFetcher {

  def apply(baseUrl: URL)(
      implicit system: ActorSystem,
      materializer: Materializer,
      ec: ExecutionContext
  ) = new HttpFetcherImpl(baseUrl)
}
