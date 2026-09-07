import { redirect } from "next/navigation";
import { Dashboard } from "@/components/admin/dashboard";
import { isAdminAuthenticated } from "@/lib/auth";
import { readMemberSession } from "@/lib/member-auth";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    if (await readMemberSession()) redirect("/");
    redirect("/member/login?next=/admin/dashboard");
  }

  return (
    <div className="min-h-screen relative">
      <Dashboard />
    </div>
  );
}
