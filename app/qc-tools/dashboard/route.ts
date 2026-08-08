export function GET(request: Request) {
  return Response.redirect(new URL("/service-tools?tool=manager#workflow", request.url), 307);
}
