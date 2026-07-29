import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { addAdminAccess, listAdminAccess, removeAdminAccess } from "@/lib/member-store";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ admins: await listAdminAccess() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Could not load admin access." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body && typeof body === "object" ? (body as { email?: unknown }).email : "");
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    return NextResponse.json(await addAdminAccess(email));
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json({ error: (error as Error).message || "Could not add admin access." }, { status });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body && typeof body === "object" ? (body as { email?: unknown }).email : "");
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    return NextResponse.json(await removeAdminAccess(email));
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json({ error: (error as Error).message || "Could not remove admin access." }, { status });
  }
}
