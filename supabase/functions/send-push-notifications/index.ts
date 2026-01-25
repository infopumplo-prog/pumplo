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
  publicKey: string,  // base64url encoded 65-byte uncompressed public key
  privateKey: string  // base64url encoded 32-byte raw private key
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

  // Decode the public key to extract X and Y coordinates
  const publicKeyBytes = base64UrlDecode(publicKey);
  
  // Public key is 65 bytes: 0x04 prefix + 32 bytes X + 32 bytes Y
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error(`Invalid public key format - expected 65-byte uncompressed key, got ${publicKeyBytes.length} bytes`);
  }
  
  const xBytes = publicKeyBytes.slice(1, 33);
  const yBytes = publicKeyBytes.slice(33, 65);
  const privateKeyBytes = base64UrlDecode(privateKey);
  
  if (privateKeyBytes.length !== 32) {
    throw new Error(`Invalid private key format - expected 32 bytes, got ${privateKeyBytes.length} bytes`);
  }

  // Create JWK for the private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(xBytes),
    y: base64UrlEncode(yBytes),
    d: base64UrlEncode(privateKeyBytes),
    ext: true,
  };

  // Import as JWK (not PKCS#8!)
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // WebCrypto returns raw 64-byte signature (R || S) for P-256 - no DER parsing needed
  const token = `${unsignedToken}.${base64UrlEncode(signature)}`;

  return {
    authorization: `vapid t=${token}, k=${publicKey}`,
    cryptoKey: publicKey,
  };
}

// ============================================================================
// RFC 8291 Encryption Implementation
// ============================================================================

async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

async function importSubscriberPublicKey(p256dhBase64: string): Promise<CryptoKey> {
  const keyBytes = base64UrlDecode(p256dhBase64);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  return new Uint8Array(bits);
}

async function hkdfExpand(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const ikmBuffer = ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer;
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const infoBuffer = info.buffer.slice(info.byteOffset, info.byteOffset + info.byteLength) as ArrayBuffer;
  
  const key = await crypto.subtle.importKey(
    'raw',
    ikmBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: infoBuffer,
    },
    key,
    length * 8
  );
  
  return new Uint8Array(bits);
}

function createInfo(
  type: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  // Format: "Content-Encoding: <type>\0" + "P-256\0" + pubkey lengths + keys
  const info = new Uint8Array(
    'Content-Encoding: '.length + type.length + 1 + 
    'P-256'.length + 1 + 
    2 + clientPublicKey.length + 
    2 + serverPublicKey.length
  );
  
  let offset = 0;
  
  // "Content-Encoding: <type>\0"
  const cePrefix = new TextEncoder().encode(`Content-Encoding: ${type}\0`);
  info.set(cePrefix, offset);
  offset += cePrefix.length;
  
  // "P-256\0"
  const curve = new TextEncoder().encode('P-256\0');
  info.set(curve, offset);
  offset += curve.length;
  
  // Client public key length (2 bytes, big endian) + key
  info[offset] = (clientPublicKey.length >> 8) & 0xff;
  info[offset + 1] = clientPublicKey.length & 0xff;
  offset += 2;
  info.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  // Server public key length (2 bytes, big endian) + key
  info[offset] = (serverPublicKey.length >> 8) & 0xff;
  info[offset + 1] = serverPublicKey.length & 0xff;
  offset += 2;
  info.set(serverPublicKey, offset);
  
  return info;
}

async function encryptPayload(
  payload: string,
  subscriberPublicKeyBase64: string,
  authSecretBase64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Generate ephemeral ECDH key pair for this message
  const serverKeyPair = await generateECDHKeyPair();
  const serverPublicKey = await exportPublicKey(serverKeyPair.publicKey);
  
  // Import subscriber's public key
  const subscriberPublicKey = await importSubscriberPublicKey(subscriberPublicKeyBase64);
  const subscriberPublicKeyBytes = base64UrlDecode(subscriberPublicKeyBase64);
  
  // Get auth secret
  const authSecret = base64UrlDecode(authSecretBase64);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Derive shared secret using ECDH
  const sharedSecret = await deriveSharedSecret(serverKeyPair.privateKey, subscriberPublicKey);
  
  // Create info strings for HKDF
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const keyInfo = createInfo('aesgcm', subscriberPublicKeyBytes, serverPublicKey);
  const nonceInfo = createInfo('nonce', subscriberPublicKeyBytes, serverPublicKey);
  
  // Derive PRK (pseudo-random key) from shared secret and auth
  const prk = await hkdfExpand(sharedSecret, authSecret, authInfo, 32);
  
  // Derive content encryption key (CEK) and nonce
  const cek = await hkdfExpand(prk, salt, keyInfo, 16);
  const nonce = await hkdfExpand(prk, salt, nonceInfo, 12);
  
  // Import CEK for AES-GCM
  const cekBuffer = cek.buffer.slice(cek.byteOffset, cek.byteOffset + cek.byteLength) as ArrayBuffer;
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cekBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Pad the payload (RFC 8291 requires padding)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddingLength = 0; // Minimal padding for simplicity
  const padded = new Uint8Array(2 + paddingLength + payloadBytes.length);
  padded[0] = (paddingLength >> 8) & 0xff;
  padded[1] = paddingLength & 0xff;
  padded.set(payloadBytes, 2 + paddingLength);
  
  // Encrypt with AES-128-GCM
  const nonceBuffer = nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) as ArrayBuffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBuffer },
    aesKey,
    padded
  );
  
  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    serverPublicKey,
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

    // Encrypt the payload using RFC 8291
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    // Convert ciphertext to ArrayBuffer for fetch body
    const ciphertextBuffer = ciphertext.buffer.slice(
      ciphertext.byteOffset, 
      ciphertext.byteOffset + ciphertext.byteLength
    ) as ArrayBuffer;

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'TTL': '86400',
        'Content-Encoding': 'aesgcm',
        'Encryption': `salt=${base64UrlEncode(salt)}`,
        'Crypto-Key': `dh=${base64UrlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Urgency': 'normal',
      },
      body: ciphertextBuffer,
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
// Test Mode: Send notification to all users with push_subscription (bypass conditions)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processTestNotifications(
  supabase: SupabaseClient<any>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ sent: number; skipped: number; errors: number; details: string[] }> {
  const stats = { sent: 0, skipped: 0, errors: 0, details: [] as string[] };

  console.log('TEST MODE: Sending notifications to ALL users with push_subscription');

  // Query ALL users with push_subscription (no conditions)
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('user_id, push_subscription, current_streak')
    .not('push_subscription', 'is', null);

  if (error) {
    console.error('Error fetching users:', error);
    stats.details.push(`Error fetching users: ${error.message}`);
    return stats;
  }

  console.log(`Found ${users?.length || 0} users with push_subscription`);
  stats.details.push(`Found ${users?.length || 0} users with push_subscription`);

  for (const user of (users || []) as UserProfile[]) {
    if (!user.push_subscription) {
      stats.skipped++;
      continue;
    }

    const payload = JSON.stringify({
      title: '🧪 Test notifikácia',
      body: `Toto je testovacia notifikácia. Streak: ${user.current_streak || 0} dní.`,
      icon: '/pwa-192x192.png',
      badge: '/favicon.ico',
      data: { url: '/' },
    });

    console.log(`Attempting to send test notification to user ${user.user_id}`);
    console.log(`Subscription endpoint: ${user.push_subscription.endpoint}`);

    const result = await sendWebPush(
      user.push_subscription,
      payload,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    if (result.success) {
      stats.sent++;
      const msg = `✅ Sent to user ${user.user_id} (status: ${result.statusCode})`;
      console.log(msg);
      stats.details.push(msg);
    } else if (result.error === 'subscription_expired') {
      await supabase
        .from('user_profiles')
        .update({ push_subscription: null })
        .eq('user_id', user.user_id);
      stats.errors++;
      const msg = `❌ Subscription expired for user ${user.user_id}`;
      console.log(msg);
      stats.details.push(msg);
    } else {
      stats.errors++;
      const msg = `❌ Failed for user ${user.user_id}: ${JSON.stringify(result.error)}`;
      console.error(msg);
      stats.details.push(msg);
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
  let notificationType: NotificationType | 'test' | null = null;
  try {
    const body = await req.json();
    notificationType = body.type || null;
  } catch {
    // No body or invalid JSON - process all types
  }

  const results: Record<string, { sent: number; skipped: number; errors: number; details?: string[] }> = {};

  // TEST MODE: bypass all conditions
  if (notificationType === 'test') {
    results.test = await processTestNotifications(
      supabase,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );
    
    console.log('Test notification processing complete:', results);
    
    return new Response(
      JSON.stringify({ success: true, mode: 'test', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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
