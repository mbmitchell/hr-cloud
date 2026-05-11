"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

function getAuthErrorMessage(authError: string | null) {
  if (!authError) {
    return "";
  }

  if (authError === "AccessDenied") {
    return "Your Microsoft 365 account is not linked to an employee record in this HR system.";
  }

  if (authError === "OAuthCallbackError") {
    return "Microsoft sign-in expired or was already used. Close extra sign-in tabs and try again.";
  }

  if (authError === "CallbackRouteError") {
    return "We could not finish creating your sign-in session. Please try again.";
  }

  if (authError === "SessionRequired") {
    return "Please sign in to continue.";
  }

  return "Unable to sign in.";
}

export default function LoginForm({
  allowDevAuth,
  allowMicrosoft365Auth,
}: {
  allowDevAuth: boolean;
  allowMicrosoft365Auth: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setMessage("Invalid login.");
      return;
    }

    window.location.href = "/";
  }

  async function handleMicrosoftSignIn() {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    await signIn("microsoft-entra-id", {
      callbackUrl: "/",
    });
  }

  const errorMessage = message || getAuthErrorMessage(authError);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 sm:p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow sm:p-6">
        <h1 className="mb-4 text-2xl font-bold">Sign In</h1>

        <div className="space-y-4">
          {allowMicrosoft365Auth && (
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign in with Microsoft 365"}
            </button>
          )}

          {allowDevAuth && (
            <>
              {allowMicrosoft365Auth && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>Manual / Break-Glass</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border px-3 py-2.5 text-base"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded border px-3 py-2.5 text-base"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {loading ? "Signing In..." : "Sign In with Dev Credentials"}
                </button>
              </form>

              <div className="text-xs text-slate-500">
                Dev login is a temporary break-glass option. It uses an employee
                email and the shared dev password from your environment, and can be
                further restricted with an email allowlist during rollout.
              </div>
            </>
          )}

          {!allowMicrosoft365Auth && !allowDevAuth && (
            <div className="text-sm text-slate-600">
              Sign-in is not configured. Set Microsoft Entra ID or dev auth environment variables.
            </div>
          )}

          {errorMessage && <div className="text-sm leading-6 text-red-600">{errorMessage}</div>}
        </div>
      </div>
    </div>
  );
}
