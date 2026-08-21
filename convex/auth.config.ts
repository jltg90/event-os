/**
 * Proveedores de identidad aceptados por este deployment.
 *
 * Convex valida el JWT que llega en la cabecera `Authorization: Bearer` contra
 * esta lista y, si cuadra, rellena `ctx.auth.getUserIdentity()`.  Nosotros ya no
 * verificamos firmas a mano (antes se hacia HMAC contra WIX_APP_SECRET).
 *
 * Variables de entorno necesarias en el deployment:
 *   CLERK_JWT_ISSUER_DOMAIN = https://<algo>.clerk.accounts.dev   (o tu dominio)
 *
 * `applicationID` DEBE coincidir con el claim `aud` del token.  La plantilla JWT
 * de Clerk tiene que llamarse exactamente `convex` (el preset de Clerk ya pone
 * aud=convex).  Omitir applicationID seria inseguro: un token emitido para otro
 * servicio podria usarse aqui.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
