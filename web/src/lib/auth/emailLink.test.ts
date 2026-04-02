import { describe, expect, it } from "vitest";
import { getEmailLinkParams, resolvePostPasswordRoute } from "@/lib/auth/emailLink";

describe("getEmailLinkParams", () => {
  it("reads token_hash flows from query params", () => {
    const url = new URL(
      "http://127.0.0.1:3100/accept-invite?token_hash=abc123&type=invite"
    );

    expect(getEmailLinkParams(url)).toMatchObject({
      tokenHash: "abc123",
      type: "invite",
      accessToken: null,
      refreshToken: null,
    });
  });

  it("reads access and refresh tokens from URL hash", () => {
    const url = new URL(
      "http://127.0.0.1:3100/accept-invite#access_token=at&refresh_token=rt&type=invite"
    );

    expect(getEmailLinkParams(url)).toMatchObject({
      accessToken: "at",
      refreshToken: "rt",
      type: "invite",
    });
  });

  it("preserves auth errors from the callback URL", () => {
    const url = new URL(
      "http://127.0.0.1:3100/reset-password?error=access_denied&error_description=expired"
    );

    expect(getEmailLinkParams(url)).toMatchObject({
      error: "access_denied",
      errorDescription: "expired",
    });
  });
});

describe("resolvePostPasswordRoute", () => {
  it("routes athletes to their space", () => {
    expect(resolvePostPasswordRoute("athlete")).toBe("/mon-espace");
  });

  it("routes coaches and admins to dashboard", () => {
    expect(resolvePostPasswordRoute("coach")).toBe("/dashboard");
    expect(resolvePostPasswordRoute("admin")).toBe("/dashboard");
  });
});
