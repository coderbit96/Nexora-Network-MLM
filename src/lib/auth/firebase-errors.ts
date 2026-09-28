"use client";

export function firebaseErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for that email address.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/invalid-action-code": "This password reset link is invalid or expired.",
    "auth/expired-action-code": "This password reset link has expired. Request a new one.",
  };
  return messages[code] ?? "We could not complete that request. Please try again.";
}

export async function responseErrorMessage(response: Response) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? "We could not complete that request. Please try again.";
  } catch { return "We could not complete that request. Please try again."; }
}
