import { sendFcmToUser, makeServiceClient } from "../_shared/fcm.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { userId, title, body, route } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const supabase = makeServiceClient();
    const result = await sendFcmToUser(supabase, userId, {
      title: title ?? "Pumplo test",
      body: body ?? "Funguje to! 🎉",
      data: route ? { route } : {},
    });
    return new Response(JSON.stringify(result),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
