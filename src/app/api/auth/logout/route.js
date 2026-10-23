import { destroySession } from "@/lib/session";
import { isSameOrigin } from "@/lib/origin";

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  await destroySession();
  return Response.json({ ok: true });
}