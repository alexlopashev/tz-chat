export function GET() {
  return Response.json({
    status: "ok",
    scope: "web",
    chatEnabled: true,
    integrations: "not-probed",
  });
}
