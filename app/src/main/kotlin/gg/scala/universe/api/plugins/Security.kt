package gg.scala.universe.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.bearer

fun Application.configureSecurity() {
    install(Authentication) {
        bearer("public") {
            realm = "Access to public endpoints"
            authenticate { tokenCredential ->
                // Public realm: accept any token or none; principal is just the token string
                return@authenticate tokenCredential.token
            }
        }
    }
}
