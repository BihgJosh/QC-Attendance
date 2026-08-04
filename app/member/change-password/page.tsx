import { redirect } from "next/navigation";
import { MemberAuthShell } from "@/components/member/auth-shell";
import { ChangePasswordForm } from "@/components/member/change-password-form";
import { readMemberSession } from "@/lib/member-auth";

export default async function ChangeMemberPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await readMemberSession({ allowPasswordChange: true });
  if (!session) redirect("/member/login");
  if (!session.mustChangePassword) redirect("/");
  const requested = (await searchParams).next;
  const nextPath = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return <MemberAuthShell eyebrow="First sign-in" title="Make this account yours" copy={`Create a private password for ${session.email}. The temporary password will stop working as soon as you save.`}><ChangePasswordForm nextPath={nextPath} /></MemberAuthShell>;
}
