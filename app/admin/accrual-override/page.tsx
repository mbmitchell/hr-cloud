import { redirect } from "next/navigation";

export default async function AccrualOverridePage() {
  redirect("/admin/policy");
}
