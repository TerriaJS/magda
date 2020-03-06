package au.csiro.data61.magda.directives

import akka.actor.ActorSystem
import akka.event.Logging
import akka.http.scaladsl.model.headers
import akka.http.scaladsl.model.headers.HttpChallenge
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{AuthenticationFailedRejection, _}
import au.csiro.data61.magda.Authentication
import au.csiro.data61.magda.client.AuthApiClient
import com.typesafe.config.Config
import io.jsonwebtoken.{Jws, Claims}

import scala.util.control.NonFatal

object AuthDirectives {

  def skipAuthorization(implicit config: Config) =
    config.hasPath("authorization.skip") && config.getBoolean(
      "authorization.skip"
    )

  /** Gets the X-Magda-Session header out of the request, providing it as a string without doing any verification */
  def getJwt(): Directive1[Option[String]] = {
    extractRequest flatMap { request =>
      val sessionToken = request.headers.find {
        case headers.RawHeader(Authentication.headerName, value) => true
        case _                                                   => false
      }

      provide(sessionToken.map(_.value()))
    }
  }

  def requireUserId(
      implicit system: ActorSystem,
      config: Config
  ): Directive1[String] = {
    if (skipAuthorization) {
      provide("dummyUserId")
    } else {
      val log = Logging(system, getClass)
      extractRequest flatMap { request =>
        val sessionToken = request.headers.find {
          case headers.RawHeader(Authentication.headerName, value) => true
          case _                                                   => false
        }

        sessionToken match {
          case Some(header) =>
            try {
              val claims: Jws[Claims] =
                Authentication.parser(system.log).parseClaimsJws(header.value())
              val userId = claims.getBody().get("userId", classOf[String])

              provide(
                userId
              )
            } catch {
              case NonFatal(e) =>
                log.error(
                  e,
                  "Could not verify X-Magda-Session header in request"
                )
                reject(
                  AuthenticationFailedRejection(
                    AuthenticationFailedRejection.CredentialsRejected,
                    HttpChallenge("magda", None)
                  )
                )
            }
          case None =>
            log.info("Could not find X-Magda-Session header in request")
            reject(
              AuthenticationFailedRejection(
                AuthenticationFailedRejection.CredentialsMissing,
                HttpChallenge("magda", None)
              )
            )

        }
      }
    }
  }

  def requireIsAdmin(
      authApiClient: AuthApiClient
  )(implicit system: ActorSystem, config: Config): Directive1[String] = {
    if (skipAuthorization) {
      provide("dummyUserId")
    } else {
      implicit val ec = authApiClient.executor
      val log = Logging(system, getClass)

      requireUserId flatMap { userId =>
        log.debug("Authenticated as user with id {}", userId)
        extractActorSystem flatMap { actorSystem =>
          extractMaterializer flatMap { materializer =>
            extractExecutionContext flatMap { executionContext =>
              authorizeAsync(
                _ =>
                  authApiClient.getUserPublic(userId).map { user =>
                    log.debug("Retrieved user from auth api: {}", user)
                    user.isAdmin
                  }
              ) tflatMap { _ =>
                provide(userId)
              }
            }
          }
        }
      }
    }
  }

}
