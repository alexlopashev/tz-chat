export function GET() {
  return Response.json({ status: "ok", scope: "web-shell", liveChat: false });
}
