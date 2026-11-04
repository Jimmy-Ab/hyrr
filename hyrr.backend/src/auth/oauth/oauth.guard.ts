import { ExecutionContext, Injectable, mixin, Type } from "@nestjs/common"
import { AuthGuard, IAuthGuard } from "@nestjs/passport"
import { encodeOAuthState, resolveRedirect, resolveRole } from "./oauth-state"

/**
 * Passport guard for OAuth start + callback routes.
 * - Start: carries `role` + allow-listed `redirect` through a signed `state` param.
 * - Callback: never throws — failures surface as `{ error }` so the controller can redirect.
 */
export function OAuthGuard(provider: "google" | "github" | "linkedin"): Type<IAuthGuard> {
  @Injectable()
  class ProviderOAuthGuard extends AuthGuard(provider) {
    getAuthenticateOptions(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest()
      const isCallback = !!(req.query?.code || req.query?.error)
      if (isCallback) return { session: false }
      return {
        session: false,
        state: encodeOAuthState({
          role: resolveRole(req.query?.role),
          redirect: resolveRedirect(req.query?.redirect),
        }),
      }
    }

    handleRequest(err: any, user: any) {
      if (err || !user) return { error: "oauth_failed" }
      return user
    }
  }
  return mixin(ProviderOAuthGuard)
}
