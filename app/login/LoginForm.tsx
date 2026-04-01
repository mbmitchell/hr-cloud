"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

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
    setLoading(true);
    setMessage("");
    await signIn("microsoft-entra-id", {
      callbackUrl: "/",
    });
  }

  const errorMessage =
    message ||
    (authError === "AccessDenied"
      ? "Your Microsoft 365 account is not linked to an employee record in this HR system."
      : authError
        ? "Unable to sign in."
        : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white rounded shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Sign In</h1>

        <div className="space-y-4">
          {allowMicrosoft365Auth && (
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50 w-full"
            >
              {loading ? "Signing In..." : "Sign in with Microsoft 365"}
            </button>
          )}

          {allowDevAuth && (
            <>
              {allowMicrosoft365Auth && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>Development Only</span>
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
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 disabled:opacity-50 w-full"
                >
                  {loading ? "Signing In..." : "Sign In with Dev Credentials"}
                </button>
              </form>

              <div className="text-xs text-slate-500">
                Dev login uses an employee email and the shared dev password from your
                environment. During rollout, you can further restrict access with an
                email allowlist.
              </div>
            </>
          )}

          {!allowMicrosoft365Auth && !allowDevAuth && (
            <div className="text-sm text-slate-600">
              Sign-in is not configured. Set Microsoft Entra ID or dev auth environment variables.
            </div>
          )}

          {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}
        </div>
      </div>
    </div>
  );
}
