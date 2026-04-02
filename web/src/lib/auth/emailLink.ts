import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/roles";

export type SupportedEmailLinkType = "invite" | "recovery";

export interface EmailLinkParams {
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
}

export interface EmailLinkResult {
  ok: boolean;
  error?: string;
  type?: SupportedEmailLinkType;
}

function readParam(params: URLSearchParams, key: string) {
  return params.get(key);
}

export function getEmailLinkParams(url: URL = new URL(window.location.href)): EmailLinkParams {
  const search = url.searchParams;
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  return {
    accessToken: readParam(search, "access_token") ?? readParam(hash, "access_token"),
    refreshToken: readParam(search, "refresh_token") ?? readParam(hash, "refresh_token"),
    tokenHash: readParam(search, "token_hash") ?? readParam(hash, "token_hash"),
    code: readParam(search, "code") ?? readParam(hash, "code"),
    type: readParam(search, "type") ?? readParam(hash, "type"),
    error: readParam(search, "error") ?? readParam(hash, "error"),
    errorDescription:
      readParam(search, "error_description") ?? readParam(hash, "error_description"),
  };
}

function cleanAuthUrl(url: URL) {
  window.history.replaceState({}, document.title, url.pathname);
}

function isSupportedType(value: string | null): value is SupportedEmailLinkType {
  return value === "invite" || value === "recovery";
}

export async function establishSessionFromEmailLink(
  supabase: SupabaseClient,
  expectedType: SupportedEmailLinkType,
  url: URL = new URL(window.location.href)
): Promise<EmailLinkResult> {
  const params = getEmailLinkParams(url);

  if (params.errorDescription || params.error) {
    cleanAuthUrl(url);
    return {
      ok: false,
      error: params.errorDescription ?? params.error ?? "Lien invalide.",
    };
  }

  if (params.type && params.type !== expectedType) {
    cleanAuthUrl(url);
    return {
      ok: false,
      error:
        expectedType === "invite"
          ? "Ce lien n'est pas une invitation valide."
          : "Ce lien n'est pas un lien de reinitialisation valide.",
    };
  }

  try {
    if (params.accessToken && params.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });

      cleanAuthUrl(url);
      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, type: expectedType };
    }

    if (params.tokenHash) {
      const verifyType = isSupportedType(params.type) ? params.type : expectedType;
      const { error } = await supabase.auth.verifyOtp({
        token_hash: params.tokenHash,
        type: verifyType,
      });

      cleanAuthUrl(url);
      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, type: verifyType };
    }

    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);

      cleanAuthUrl(url);
      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, type: expectedType };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      return { ok: true, type: expectedType };
    }

    return {
      ok: false,
      error:
        expectedType === "invite"
          ? "Lien d'invitation invalide ou expire."
          : "Lien de reinitialisation invalide ou expire.",
    };
  } catch (error) {
    cleanAuthUrl(url);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de valider ce lien.",
    };
  }
}

export function resolvePostPasswordRoute(role: AppRole): string {
  return role === "athlete" ? "/mon-espace" : "/dashboard";
}
