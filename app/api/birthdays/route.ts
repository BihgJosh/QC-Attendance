import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getUpcomingBirthdays } from "@/lib/member-birthdays";
import { getMemberEmails, isMemberEmail, MemberSheetError } from "@/lib/member-sheet";
import { isPrivilegedAdminEmail } from "@/lib/roles";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    if (!isPrivilegedAdminEmail(session.email) && !isMemberEmail(session.email, await getMemberEmails())) {
      return NextResponse.json({ error: "This account is no longer on the QC team list." }, { status: 403 });
    }
    return NextResponse.json({ birthdays: await getUpcomingBirthdays() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[birthdays] Birthday notice lookup failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Birthday notices are temporarily unavailable." }, { status: error instanceof MemberSheetError ? 503 : 500 });
  }
}
