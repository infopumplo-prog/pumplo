import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Message Templates
// ============================================================================

interface MessageTemplate {
  title: string;
  body: string;
}

const MORNING_MESSAGES: MessageTemplate[] = [
  { title: '🏋️ Pripravený na tréning?', body: 'Dnes máš naplánovaný {workout}. Ideme do toho!' },
  { title: '💪 Čas na tréning!', body: '{workout} čaká. Si pripravený?' },
  { title: '🔥 Tvoje svaly volajú!', body: 'Dnes je deň na {workout}. Ukáž im, čo vieš!' },
  { title: '⚡ Energia na maximum!', body: '{workout} - dnešný cieľ. Zvládneš to!' },
  { title: '🎯 Fokus na cieľ!', body: 'Dnes {workout}. Každý tréning ťa posúva vpred!' },
];

const MISSED_WORKOUT_MESSAGES: MessageTemplate[] = [
  { title: '😤 Včera si vynechal tréning!', body: 'Dnes to naprav. {workout} na teba čaká!' },
  { title: '💪 Návrat silnejší!', body: 'Vynechaný tréning? Dnes to dožeň s {workout}!' },
  { title: '🔥 Čas na comeback!', body: 'Včera pause, dnes {workout}. Ideme!' },
  { title: '⚡ Dvojnásobná motivácia!', body: 'Za včerajšok aj dnes - {workout} volá!' },
];

const CLOSING_SOON_MESSAGES: MessageTemplate[] = [
  { title: '⏰ Posilka čoskoro zatvára!', body: 'Ešte {time} do zatvorenia. Stihneš rýchly tréning?' },
  { title: '🏃 Posledná šanca dnes!', body: 'Gym zatvára o {time}. Bež trénovať!' },
  { title: '⚡ Teraz alebo nikdy!', body: 'Už len {time} do zatvorenia. Zvládneš to!' },
];

const CLOSING_SOON_STREAK_MESSAGES: MessageTemplate[] = [
  { title: '🔥 Neprerušuj sériu {streak} dní!', body: 'Gym zatvára o {time}. Udrž svoj streak!' },
  { title: '💪 {streak} dní v rade!', body: 'Ešte {time} do zatvorenia. Neprerušuj sériu!' },
  { title: '⚡ Streak {streak} je v ohrození!', body: 'Posilka zatvára o {time}. Stihni to!' },
];

// ============================================================================
// Helpers
// ============================================================================

type NotificationType = 'morning' | 'missed' | 'closing';

function getRandomMessage(messages: MessageTemplate[]): MessageTemplate {
  return messages[Math.floor(Math.random() * messages.length)];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} ${hours === 1 ? 'hodinu' : 'hodiny'}`;
  return `${hours}h ${mins}min`;
}

function getWeekday(date: Date = new Date()): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function getPragueTime(): { hour: number; minute: number; weekday: string; dateKey: string } {
  const now = new Date();
  const pragueTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  return {
    hour: pragueTime.getHours(),
    minute: pragueTime.getMinutes(),
    weekday: getWeekday(pragueTime),
    dateKey: pragueTime.toISOString().split('T')[0],
  };
}

function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { hour: parseInt(match[1]), minute: parseInt(match[2]) };
}

function getMinutesUntilClose(openingHours: Record<string, { open: string; close: string }>, weekday: string): number | null {
  const todayHours = openingHours[weekday];
  if (!todayHours || !todayHours.close) return null;
  
  const closeTime = parseTime(todayHours.close);
  if (!closeTime) return null;
  
  const { hour, minute } = getPragueTime();
  const currentMinutes = hour * 60 + minute;
  const closeMinutes = closeTime.hour * 60 + closeTime.minute;
  
  if (closeMinutes <= currentMinutes) return null;
  return closeMinutes - currentMinutes;
}

// ============================================================================
// Web Push Implementation (simplified for Deno)
// ============================================================================

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createVapidAuthHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const headerB64 = base64UrlEncode(headerBytes);
  const payloadB64 = base64UrlEncode(payloadBytes);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key - convert to proper ArrayBuffer
  const privateKeyBytes = base64UrlDecode(privateKey);
  const privateKeyBuffer = new ArrayBuffer(privateKeyBytes.length);
  new Uint8Array(privateKeyBuffer).set(privateKeyBytes);
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (64 bytes)
  const signatureBytes = new Uint8Array(signature);
  let rawSignature: Uint8Array;
  
  if (signatureBytes.length === 64) {
    rawSignature = signatureBytes;
  } else {
    // Parse DER format
    rawSignature = new Uint8Array(64);
    
    const rLength = signatureBytes[3];
    const rStart = 4;
    const sStart = rStart + rLength + 2;
    const sLength = signatureBytes[sStart - 1];
    
    const r = signatureBytes.slice(rStart, rStart + rLength);
    const s = signatureBytes.slice(sStart, sStart + sLength);
    
    // Pad r and s to 32 bytes each
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    
    if (r.length <= 32) {
      rPadded.set(r, 32 - r.length);
    } else {
      rPadded.set(r.slice(r.length - 32));
    }
    
    if (s.length <= 32) {
      sPadded.set(s, 32 - s.length);
    } else {
      sPadded.set(s.slice(s.length - 32));
    }
    
    rawSignature.set(rPadded, 0);
    rawSignature.set(sPadded, 32);
  }

  const token = `${unsignedToken}.${base64UrlEncode(rawSignature)}`;

  return {
    authorization: `vapid t=${token}, k=${publicKey}`,
    cryptoKey: publicKey,
  };
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const { authorization } = await createVapidAuthHeader(
      audience,
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    // For now, send unencrypted (most push services accept this for simple payloads)
    // Full encryption would require implementing RFC 8291 (ECDH + AES-GCM)
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'TTL': '86400',
        'Content-Type': 'application/json',
        'Urgency': 'normal',
      },
      body: payload,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, statusCode: response.status };
    } else if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid
      return { success: false, statusCode: response.status, error: 'subscription_expired' };
    } else {
      const text = await response.text();
      return { success: false, statusCode: response.status, error: text };
    }
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Notification Processing
// ============================================================================

interface UserProfile {
  user_id: string;
  push_subscription: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
  training_days: string[] | null;
  preferred_time: string | null;
  current_streak: number;
  notification_morning_reminder: boolean;
  notification_missed_workout: boolean;
  notification_closing_soon: boolean;
  selected_gym_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWorkoutName(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const { data: plan } = await supabase
    .from('user_workout_plans')
    .select('goal_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!plan) return 'tréning';

  const goalNames: Record<string, string> = {
    'strength': 'silový tréning',
    'hypertrophy': 'objemový tréning',
    'endurance': 'vytrvalostný tréning',
    'weight_loss': 'tréning na chudnutie',
  };

  return goalNames[plan.goal_id] || 'tréning';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkWorkedOutOnDate(
  supabase: SupabaseClient<any>,
  userId: string,
  date: Date
): Promise<boolean> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('started_at', startOfDay.toISOString())
    .lte('started_at', endOfDay.toISOString())
    .limit(1);

  return (data?.length || 0) > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkMissedPreviousTraining(
  supabase: SupabaseClient<any>,
  userId: string,
  trainingDays: string[]
): Promise<boolean> {
  const { weekday } = getPragueTime();
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const todayIndex = dayOrder.indexOf(weekday);
  
  // Find the previous training day
  for (let i = 1; i <= 7; i++) {
    const prevIndex = (todayIndex - i + 7) % 7;
    const prevDay = dayOrder[prevIndex];
    
    if (trainingDays.includes(prevDay)) {
      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - i);
      return !(await checkWorkedOutOnDate(supabase, userId, prevDate));
    }
  }
  
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function wasNotificationSentToday(
  supabase: SupabaseClient<any>,
  userId: string,
  notificationType: NotificationType,
  dateKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .eq('date_key', dateKey)
    .limit(1);

  return (data?.length || 0) > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logNotification(
  supabase: SupabaseClient<any>,
  userId: string,
  notificationType: NotificationType,
  dateKey: string
): Promise<void> {
  await supabase.from('notification_logs').insert({
    user_id: userId,
    notification_type: notificationType,
    date_key: dateKey,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMorningNotifications(
  supabase: SupabaseClient<any>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ sent: number; skipped: number; errors: number }> {
  const stats = { sent: 0, skipped: 0, errors: 0 };
  const { hour, weekday, dateKey } = getPragueTime();

  // Map preferred_time to target hours
  const timeToHour: Record<string, number> = {
    'morning': 6,
    'late_morning': 10,
    'afternoon': 14,
    'evening': 18,
  };

  // Find which preferred_time matches current hour
  let targetPreferredTime: string | null = null;
  for (const [time, targetHour] of Object.entries(timeToHour)) {
    if (targetHour === hour) {
      targetPreferredTime = time;
      break;
    }
  }

  if (!targetPreferredTime) {
    console.log(`Hour ${hour} doesn't match any notification time, skipping morning notifications`);
    return stats;
  }

  console.log(`Processing morning notifications for preferred_time=${targetPreferredTime}, weekday=${weekday}`);

  // Query users
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('user_id, push_subscription, training_days, preferred_time, current_streak, notification_morning_reminder, notification_missed_workout')
    .not('push_subscription', 'is', null)
    .eq('preferred_time', targetPreferredTime)
    .eq('notification_morning_reminder', true);

  if (error) {
    console.error('Error fetching users:', error);
    return stats;
  }

  console.log(`Found ${users?.length || 0} users with matching preferences`);

  for (const user of (users || []) as UserProfile[]) {
    // Check if today is a training day
    if (!user.training_days?.includes(weekday)) {
      stats.skipped++;
      continue;
    }

    // Check if already sent today
    if (await wasNotificationSentToday(supabase, user.user_id, 'morning', dateKey)) {
      stats.skipped++;
      continue;
    }

    // Check if missed previous training
    const missedPrevious = user.notification_missed_workout && 
      await checkMissedPreviousTraining(supabase, user.user_id, user.training_days);

    const workoutName = await getWorkoutName(supabase, user.user_id);
    const messages = missedPrevious ? MISSED_WORKOUT_MESSAGES : MORNING_MESSAGES;
    const message = getRandomMessage(messages);

    const title = message.title.replace('{workout}', workoutName);
    const body = message.body.replace('{workout}', workoutName);

    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon.ico',
      data: { url: '/' },
    });

    const result = await sendWebPush(
      user.push_subscription!,
      payload,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    if (result.success) {
      await logNotification(supabase, user.user_id, missedPrevious ? 'missed' : 'morning', dateKey);
      stats.sent++;
      console.log(`Sent ${missedPrevious ? 'missed' : 'morning'} notification to user ${user.user_id}`);
    } else if (result.error === 'subscription_expired') {
      // Clear invalid subscription
      await supabase
        .from('user_profiles')
        .update({ push_subscription: null })
        .eq('user_id', user.user_id);
      stats.errors++;
      console.log(`Cleared expired subscription for user ${user.user_id}`);
    } else {
      stats.errors++;
      console.error(`Failed to send to user ${user.user_id}:`, result.error);
    }
  }

  return stats;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processClosingNotifications(
  supabase: SupabaseClient<any>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ sent: number; skipped: number; errors: number }> {
  const stats = { sent: 0, skipped: 0, errors: 0 };
  const { weekday, dateKey } = getPragueTime();

  console.log(`Processing closing notifications for weekday=${weekday}`);

  // Query users with selected gym
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select(`
      user_id, 
      push_subscription, 
      training_days, 
      current_streak, 
      notification_closing_soon, 
      selected_gym_id
    `)
    .not('push_subscription', 'is', null)
    .not('selected_gym_id', 'is', null)
    .eq('notification_closing_soon', true);

  if (error) {
    console.error('Error fetching users:', error);
    return stats;
  }

  console.log(`Found ${users?.length || 0} users with gym selected`);

  for (const user of (users || []) as UserProfile[]) {
    // Check if today is a training day
    if (!user.training_days?.includes(weekday)) {
      stats.skipped++;
      continue;
    }

    // Check if already sent today
    if (await wasNotificationSentToday(supabase, user.user_id, 'closing', dateKey)) {
      stats.skipped++;
      continue;
    }

    // Check if already worked out today
    if (await checkWorkedOutOnDate(supabase, user.user_id, new Date())) {
      stats.skipped++;
      continue;
    }

    // Get gym opening hours
    const { data: gym } = await supabase
      .from('gyms')
      .select('opening_hours')
      .eq('id', user.selected_gym_id!)
      .single();

    if (!gym?.opening_hours) {
      stats.skipped++;
      continue;
    }

    const minutesUntilClose = getMinutesUntilClose(gym.opening_hours as Record<string, { open: string; close: string }>, weekday);
    if (minutesUntilClose === null || minutesUntilClose > 120 || minutesUntilClose < 30) {
      stats.skipped++;
      continue;
    }

    const messages = user.current_streak > 0 ? CLOSING_SOON_STREAK_MESSAGES : CLOSING_SOON_MESSAGES;
    const message = getRandomMessage(messages);

    const timeStr = formatMinutes(minutesUntilClose);
    const title = message.title
      .replace('{streak}', String(user.current_streak))
      .replace('{time}', timeStr);
    const body = message.body
      .replace('{streak}', String(user.current_streak))
      .replace('{time}', timeStr);

    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon.ico',
      data: { url: '/' },
    });

    const result = await sendWebPush(
      user.push_subscription!,
      payload,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    if (result.success) {
      await logNotification(supabase, user.user_id, 'closing', dateKey);
      stats.sent++;
      console.log(`Sent closing notification to user ${user.user_id}`);
    } else if (result.error === 'subscription_expired') {
      await supabase
        .from('user_profiles')
        .update({ push_subscription: null })
        .eq('user_id', user.user_id);
      stats.errors++;
    } else {
      stats.errors++;
      console.error(`Failed to send to user ${user.user_id}:`, result.error);
    }
  }

  return stats;
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Push notification function invoked');

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Missing VAPID configuration');
    return new Response(
      JSON.stringify({ error: 'Missing VAPID configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Parse request body
  let notificationType: NotificationType | null = null;
  try {
    const body = await req.json();
    notificationType = body.type || null;
  } catch {
    // No body or invalid JSON - process all types
  }

  const results: Record<string, { sent: number; skipped: number; errors: number }> = {};

  // Process morning/missed notifications
  if (!notificationType || notificationType === 'morning' || notificationType === 'missed') {
    results.morning = await processMorningNotifications(
      supabase,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );
  }

  // Process closing soon notifications
  if (!notificationType || notificationType === 'closing') {
    results.closing = await processClosingNotifications(
      supabase,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );
  }

  console.log('Notification processing complete:', results);

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
