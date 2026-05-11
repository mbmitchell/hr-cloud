import { auth } from "../../auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { isDevAuthEnabled } from "../../lib/auth/dev-auth-flags";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.email) {
    redirect("/");
  }

  return (
    <LoginForm
      allowDevAuth={isDevAuthEnabled()}
      allowMicrosoft365Auth={Boolean(
        process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
          process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
          process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
      )}
    />
  );
}
