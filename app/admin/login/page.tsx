import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { readMemberSession } from "@/lib/member-auth";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/dashboard");
  }
  if (await readMemberSession()) redirect("/");
  redirect("/member/login?next=/admin/dashboard");
}
