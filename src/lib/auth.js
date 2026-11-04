import { getCurrentUser } from "./session.js";

// Every watch route starts with this. Returns { user } or { error }.
export async function requireVerifiedUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: Response.json({ error: "Not logged in." }, { status: 401 }) };
  }
  if (!user.verifiedAt) {
    return { error: Response.json({ error: "Verify your email first." }, { status: 403 }) };
  }
  return { user };
}