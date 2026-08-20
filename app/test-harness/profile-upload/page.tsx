import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProfilePage } from "@/components/member/profile-page";

export const dynamic = "force-dynamic";

export default async function ProfileUploadTestPage() {
  const host = (await headers()).get("host") || "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) notFound();
  return <ProfilePage />;
}
