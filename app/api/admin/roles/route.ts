import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listRoleManagerData, removeRole, removeServiceAssignment, upsertRole, upsertServiceAssignment, type AppRole } from "@/lib/member-store";
import { listTeamMembers, TeamDataError } from "@/lib/team-data-store";

async function authorized() { return isAdminAuthenticated(); }

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const data = await listRoleManagerData();
    try {
      return NextResponse.json({ ...data, members: await listTeamMembers() });
    } catch (error) {
      if (!(error instanceof TeamDataError)) throw error;
      return NextResponse.json({ ...data, members: [], warning: error.message });
    }
  }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = String(body.kind || "");
    const result = kind === "role"
      ? await upsertRole({ email: String(body.email || ""), role: String(body.role || "") as AppRole, department: String(body.department || "") })
      : kind === "assignment"
        ? await upsertServiceAssignment({ id: body.id ? String(body.id) : undefined, serviceDate: String(body.serviceDate || ""), service: String(body.service || ""), managerEmail: String(body.managerEmail || ""), accessStartsAt: String(body.accessStartsAt || ""), accessEndsAt: String(body.accessEndsAt || "") })
        : null;
    if (!result) return NextResponse.json({ error: "Invalid role manager action." }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: (error as { status?: number }).status || 500 }); }
}

export async function DELETE(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = body.kind === "assignment" ? await removeServiceAssignment(String(body.id || "")) : await removeRole(String(body.email || ""));
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: (error as { status?: number }).status || 500 }); }
}
