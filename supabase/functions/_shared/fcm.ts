import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface PushPayload { title: string; body: string; data?: Record<string, string>; }

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Mints a short-lived OAuth access token from the service account (JWT bearer flow).
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("FCM token mint failed: " + JSON.stringify(json));
  return json.access_token as string;
}

// Sends `payload` to every native device token of `userId`. Deletes dead tokens.
export async function sendFcmToUser(
  supabase: SupabaseClient, userId: string, payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")!);
  const { data: tokens } = await supabase
    .from("device_tokens").select("token").eq("user_id", userId);
  if (!tokens?.length) return { sent: 0, removed: 0 };

  const accessToken = await getAccessToken(sa);
  let sent = 0, removed = 0;
  for (const { token } of tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        apns: { payload: { aps: { sound: "default" } } },
      } }),
    });
    if (res.ok) { sent++; continue; }
    const err = await res.json().catch(() => ({}));
    const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
    if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
      await supabase.from("device_tokens").delete().eq("token", token); removed++;
    } else {
      console.error("FCM send error", code, JSON.stringify(err));
    }
  }
  return { sent, removed };
}

// Convenience for callers that only have URL + service role key.
export function makeServiceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
