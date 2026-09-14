import { redirect } from "next/navigation";
import { Dashboard } from "@/components/admin/dashboard";
import { getAuthenticatedAdminRole } from "@/lib/auth";
import { readMemberSession } from "@/lib/member-auth";

export default async function AdminDashboardPage() {
  const role = await getAuthenticatedAdminRole();
  if (!role) {
    if (await readMemberSession()) redirect("/");
    redirect("/member/login?next=/admin/dashboard");
  }

  return (
    <div className="min-h-screen relative">
      <Dashboard role={role} />
    </div>
  );
}
