import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import PTORequestClient from "./PTORequestClient";
import { getCurrentUser } from "../../../lib/auth/current-user";

export default async function PTORequestPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <PTORequestClient />;
}
