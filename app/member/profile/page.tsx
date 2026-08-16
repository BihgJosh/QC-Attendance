import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfilePage } from "@/components/member/profile-page";
import { readMemberSession } from "@/lib/member-auth";

export const metadata: Metadata = {
  title: "My Profile | Quality Control Unit",
  description: "Update your QC member profile and verified contact details.",
};

export default async function MemberProfilePage() {
  const session = await readMemberSession();
  if (!session) redirect("/member/login?next=/member/profile");
  return <ProfilePage />;
}
