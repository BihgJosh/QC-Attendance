import { NextResponse } from "next/server";
export function GET(request: Request) { return NextResponse.redirect(new URL("/service-tools?tool=emergency#workflow", request.url)); }
