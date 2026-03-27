import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import PTORequestClient from "./PTORequestClient";

export default async function PTORequestPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <PTORequestClient />;
}