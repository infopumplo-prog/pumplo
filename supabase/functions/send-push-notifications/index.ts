import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendFcmToUser } from "../_shared/fcm.ts";

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

type Lang = 'cs' | 'en';

interface MessageBundle {
  morning: MessageTemplate[];
  missed: MessageTemplate[];
  closing: MessageTemplate[];
  closingStreak: MessageTemplate[];
  test: MessageTemplate;
}

// Localized message templates. The recipient's chosen UI language
// (user_profiles.language) selects the bundle; 'cs' is the fallback.
const MESSAGES: Record<Lang, MessageBundle> = {
  cs: {
    morning: [
      { title: '🏋️ Připravený na trénink?', body: 'Dnes máš naplánovaný {workout}. Jdeme na to!' },
      { title: '💪 Čas na trénink!', body: '{workout} čeká. Jsi připravený?' },
      { title: '🔥 Tvoje svaly volají!', body: 'Dnes je den na {workout}. Ukaž jim, co umíš!' },
      { title: '⚡ Energie na maximum!', body: '{workout} – dnešní cíl. Zvládneš to!' },
      { title: '🎯 Soustřeď se na cíl!', body: 'Dnes {workout}. Každý trénink tě posouvá vpřed!' },
    ],
    missed: [
      { title: '😤 Včera jsi vynechal trénink!', body: 'Dnes to naprav. {workout} na tebe čeká!' },
      { title: '💪 Návrat silnější!', body: 'Vynechaný trénink? Dnes to dožeň s {workout}!' },
      { title: '🔥 Čas na comeback!', body: 'Včera pauza, dnes {workout}. Jdeme!' },
      { title: '⚡ Dvojnásobná motivace!', body: 'Za včerejšek i dnešek – {workout} volá!' },
    ],
    closing: [
      { title: '⏰ Posilovna brzy zavírá!', body: 'Ještě {time} do zavření. Stihneš rychlý trénink?' },
      { title: '🏃 Poslední šance dnes!', body: 'Posilovna zavírá za {time}. Běž trénovat!' },
      { title: '⚡ Teď, nebo nikdy!', body: 'Už jen {time} do zavření. Zvládneš to!' },
    ],
    closingStreak: [
      { title: '🔥 Nepřeruš sérii {streak} dní!', body: 'Posilovna zavírá za {time}. Udrž svůj streak!' },
      { title: '💪 {streak} dní v řadě!', body: 'Ještě {time} do zavření. Nepřeruš sérii!' },
      { title: '⚡ Streak {streak} je v ohrožení!', body: 'Posilovna zavírá za {time}. Stihni to!' },
    ],
    test: { title: '🧪 Testovací notifikace', body: 'Toto je testovací notifikace. Streak: {streak} dní.' },
  },
  en: {
    morning: [
      { title: '🏋️ Ready to train?', body: 'You have {workout} planned today. Let’s go!' },
      { title: '💪 Time to train!', body: '{workout} is waiting. Are you ready?' },
      { title: '🔥 Your muscles are calling!', body: 'Today is {workout} day. Show them what you’ve got!' },
      { title: '⚡ Energy to the max!', body: '{workout} – today’s goal. You’ve got this!' },
      { title: '🎯 Focus on the goal!', body: '{workout} today. Every workout moves you forward!' },
    ],
    missed: [
      { title: '😤 You skipped yesterday’s workout!', body: 'Make up for it today. {workout} is waiting!' },
      { title: '💪 Come back stronger!', body: 'Missed a workout? Make it up today with {workout}!' },
      { title: '🔥 Time for a comeback!', body: 'Rest yesterday, {workout} today. Let’s go!' },
      { title: '⚡ Double the motivation!', body: 'For yesterday and today – {workout} is calling!' },
    ],
    closing: [
      { title: '⏰ The gym closes soon!', body: '{time} left until closing. Time for a quick workout?' },
      { title: '🏃 Last chance today!', body: 'The gym closes in {time}. Go train!' },
      { title: '⚡ Now or never!', body: 'Only {time} until closing. You can make it!' },
    ],
    closingStreak: [
      { title: '🔥 Don’t break your {streak}-day streak!', body: 'The gym closes in {time}. Keep your streak alive!' },
      { title: '💪 {streak} days in a row!', body: '{time} left until closing. Don’t break the streak!' },
      { title: '⚡ Your {streak}-day streak is at risk!', body: 'The gym closes in {time}. Make it!' },
    ],
    test: { title: '🧪 Test notification', body: 'This is a test notification. Streak: {streak} days.' },
  },
};

function pickLang(value: string | null | undefined): Lang {
  return value === 'en' ? 'en' : 'cs';
}

// ============================================================================
// Comeback / re-engagement templates (Duolingo-style escalating).
// Keyed by "days since last completed workout". `needs` = which progress signal
// the personalized (hook) variant requires; falls back to `generic` if absent.
// ============================================================================

type ComebackSignal = 'streak' | 'workouts' | 'goal' | null;
interface ComebackTpl { needs: ComebackSignal; hook: string; generic: string }

const COMEBACK_STAGES = [2, 4, 7, 11, 16, 23, 30, 44, 58, 72, 86];
const COMEBACK_TAIL_FROM = 44; // day 44+ all use the gentle "tail" template

const COMEBACK: Record<Lang, { title: string; stages: Record<number, ComebackTpl>; tail: ComebackTpl }> = {
  cs: {
    title: 'Pumplo 💪',
    stages: {
      2: { needs: null, hook: '👋 Hej {name}, dva dny pauza? Tělo už kouká, kde seš.', generic: '👋 Hej {name}, dva dny pauza? Uvidíme se v posilce?' },
      4: { needs: 'streak', hook: '🙏 {name}, čtyři dny… tvůj rekord {streak} dní by to neschvaloval.', generic: '🙏 {name}, čtyři dny ticho. Dáme to zítra?' },
      7: { needs: 'workouts', hook: '🔥 Týden bez tréninku, {name}. {workouts} tréninků za tebou — teď to nezahodíš.', generic: '🔥 Týden bez tréninku, {name}. Pojď zpátky do hry.' },
      11: { needs: 'goal', hook: '😅 {name}, svaly ti píšou, že jim chybíš. Tvůj cíl ({goal}) pořád čeká.', generic: '😅 {name}, svaly ti píšou, že jim chybíš. Vrátíš se?' },
      16: { needs: 'workouts', hook: '😤 {name}, {workouts} tréninků a teď ticho? Deal byl jinej. Zítra náprava?', generic: '😤 {name}, dva týdny? Deal byl jinej. Zítra náprava?' },
      23: { needs: null, hook: '🥺 {name}, fakt nám tam chybíš. Jeden trénink a jsi zpátky v sérii.', generic: '🥺 {name}, fakt nám tam chybíš. Jeden trénink stačí.' },
      30: { needs: 'streak', hook: '💔 Poslední šťouch, {name}. Pak tě nechám bejt — ale rekord {streak} dní by byl škoda.', generic: '💔 Poslední šťouch, {name}. Pak tě nechám bejt. Bylo by škoda toho nechat.' },
    },
    tail: { needs: null, hook: '🌱 {name}, pořád tu na tebe čeká tvůj plán. Kdykoliv budeš chtít.', generic: '🌱 {name}, pořád tu pro tebe jsme. Kdykoliv budeš chtít.' },
  },
  en: {
    title: 'Pumplo 💪',
    stages: {
      2: { needs: null, hook: "👋 Hey {name}, two days off? Your body's asking where you are.", generic: '👋 Hey {name}, two days off? See you at the gym?' },
      4: { needs: 'streak', hook: '🙏 {name}, four days… your {streak}-day record wouldn’t approve.', generic: '🙏 {name}, four quiet days. Get back to it tomorrow?' },
      7: { needs: 'workouts', hook: "🔥 A week off, {name}. {workouts} workouts behind you — don't throw it away now.", generic: '🔥 A week off, {name}. Come back into the game.' },
      11: { needs: 'goal', hook: '😅 {name}, your muscles say they miss you. Your goal ({goal}) is still waiting.', generic: '😅 {name}, your muscles say they miss you. Coming back?' },
      16: { needs: 'workouts', hook: "😤 {name}, {workouts} workouts and now silence? That wasn't the deal. Fix it tomorrow?", generic: "😤 {name}, two weeks? That wasn't the deal. Fix it tomorrow?" },
      23: { needs: null, hook: "🥺 {name}, we really miss you. One workout and you're back in the game.", generic: '🥺 {name}, we really miss you. One workout is all it takes.' },
      30: { needs: 'streak', hook: "💔 Last nudge, {name}. Then I'll leave you be — but a {streak}-day record would be a shame to lose.", generic: "💔 Last nudge, {name}. Then I'll leave you be. Would be a shame to quit." },
    },
    tail: { needs: null, hook: '🌱 {name}, your plan is still here waiting. Whenever you’re ready.', generic: '🌱 {name}, we’re still here for you. Whenever you’re ready.' },
  },
};

const GOAL_LABELS: Record<Lang, Record<string, string>> = {
  cs: { muscle_gain: 'nabrat svaly', strength: 'síla', fat_loss: 'zhubnout', general_fitness: 'kondice', endurance: 'vytrvalost' },
  en: { muscle_gain: 'build muscle', strength: 'strength', fat_loss: 'fat loss', general_fitness: 'fitness', endurance: 'endurance' },
};

// Fill {name} gracefully — drop it (and surrounding comma/space) when missing.
function fillName(text: string, name: string | null): string {
  if (name) return text.replace(/\{name\}/g, name);
  return text
    .replace(/,?\s*\{name\}/g, '')
    .replace(/\{name\}\s*,?\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ============================================================================
// Helpers
// ============================================================================

type NotificationType = 'morning' | 'missed' | 'closing' | 'comeback';

function getRandomMessage(messages: MessageTemplate[]): MessageTemplate {
  return messages[Math.floor(Math.random() * messages.length)];
}

function formatMinutes(minutes: number, lang: Lang): string {
  if (lang === 'en') {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    return `${h}h ${m}min`;
  }
  if (minutes < 60) return `${minutes} minut`;
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
  language: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWorkoutName(supabase: SupabaseClient<any>, userId: string, lang: Lang): Promise<string> {
  const fallback = lang === 'en' ? 'workout' : 'trénink';

  const { data: plan } = await supabase
    .from('user_workout_plans')
    .select('goal_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!plan) return fallback;

  const goalNames: Record<Lang, Record<string, string>> = {
    cs: {
      'strength': 'silový trénink',
      'hypertrophy': 'objemový trénink',
      'endurance': 'vytrvalostní trénink',
      'weight_loss': 'trénink na hubnutí',
    },
    en: {
      'strength': 'strength workout',
      'hypertrophy': 'hypertrophy workout',
      'endurance': 'endurance workout',
      'weight_loss': 'weight-loss workout',
    },
  };

  return goalNames[lang][plan.goal_id] || fallback;
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
  // Select by preferences only — no longer require a web push_subscription, so
  // native-app users (FCM device tokens, no web sub) are included too.
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('user_id, push_subscription, training_days, preferred_time, current_streak, notification_morning_reminder, notification_missed_workout, language')
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

    // Suppress if a comeback push already went out today (avoid double-spam).
    if (await wasNotificationSentToday(supabase, user.user_id, 'comeback', dateKey)) {
      stats.skipped++;
      continue;
    }

    // Check if missed previous training
    const missedPrevious = user.notification_missed_workout && 
      await checkMissedPreviousTraining(supabase, user.user_id, user.training_days);

    const lang = pickLang(user.language);
    const workoutName = await getWorkoutName(supabase, user.user_id, lang);
    const messages = missedPrevious ? MESSAGES[lang].missed : MESSAGES[lang].morning;
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

    let delivered = false;

    // Web push (browser/PWA) — only if the user has a subscription and VAPID is set.
    if (user.push_subscription && vapidPrivateKey) {
      const result = await sendWebPush(
        user.push_subscription,
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );
      if (result.success) {
        delivered = true;
      } else if (result.error === 'subscription_expired') {
        await supabase.from('user_profiles').update({ push_subscription: null }).eq('user_id', user.user_id);
        console.log(`Cleared expired subscription for user ${user.user_id}`);
      } else {
        console.error(`Web push failed for user ${user.user_id}:`, result.error);
      }
    }

    // Native push (iOS/Android via FCM) — no-op if no device tokens.
    try {
      const fcm = await sendFcmToUser(supabase, user.user_id, { title, body, data: { route: '/' } });
      if (fcm.sent > 0) delivered = true;
    } catch (e) {
      console.error(`FCM failed for user ${user.user_id}:`, e);
    }

    if (delivered) {
      await logNotification(supabase, user.user_id, missedPrevious ? 'missed' : 'morning', dateKey);
      stats.sent++;
      console.log(`Sent ${missedPrevious ? 'missed' : 'morning'} notification to user ${user.user_id}`);
    } else {
      stats.skipped++;
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
      selected_gym_id,
      language
    `)
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

    // Suppress if a comeback push already went out today (avoid double-spam).
    if (await wasNotificationSentToday(supabase, user.user_id, 'comeback', dateKey)) {
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

    const lang = pickLang(user.language);
    const messages = user.current_streak > 0 ? MESSAGES[lang].closingStreak : MESSAGES[lang].closing;
    const message = getRandomMessage(messages);

    const timeStr = formatMinutes(minutesUntilClose, lang);
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

    let delivered = false;

    if (user.push_subscription && vapidPrivateKey) {
      const result = await sendWebPush(
        user.push_subscription,
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );
      if (result.success) {
        delivered = true;
      } else if (result.error === 'subscription_expired') {
        await supabase.from('user_profiles').update({ push_subscription: null }).eq('user_id', user.user_id);
      } else {
        console.error(`Web push failed for user ${user.user_id}:`, result.error);
      }
    }

    try {
      const fcm = await sendFcmToUser(supabase, user.user_id, { title, body, data: { route: '/' } });
      if (fcm.sent > 0) delivered = true;
    } catch (e) {
      console.error(`FCM failed for user ${user.user_id}:`, e);
    }

    if (delivered) {
      await logNotification(supabase, user.user_id, 'closing', dateKey);
      stats.sent++;
      console.log(`Sent closing notification to user ${user.user_id}`);
    } else {
      stats.skipped++;
    }
  }

  return stats;
}

// ============================================================================
// Comeback / re-engagement notifications
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDaysSinceLastWorkout(supabase: SupabaseClient<any>, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('started_at, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const last = new Date((data.completed_at || data.started_at) as string);
  const pragueNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const pragueLast = new Date(last.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const d0 = Date.UTC(pragueNow.getFullYear(), pragueNow.getMonth(), pragueNow.getDate());
  const d1 = Date.UTC(pragueLast.getFullYear(), pragueLast.getMonth(), pragueLast.getDate());
  return Math.floor((d0 - d1) / 86400000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCompletedWorkoutCount(supabase: SupabaseClient<any>, userId: string): Promise<number> {
  const { count } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null);
  return count || 0;
}

interface ComebackUser {
  user_id: string;
  first_name: string | null;
  preferred_time: string | null;
  language: string | null;
  primary_goal: string | null;
  max_streak: number | null;
  push_subscription: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processComebackNotifications(
  supabase: SupabaseClient<any>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  force = false,
  testDays?: number,
  testUserId?: string,
): Promise<{ sent: number; skipped: number; errors: number }> {
  const stats = { sent: 0, skipped: 0, errors: 0 };
  const { hour, dateKey } = getPragueTime();
  // Comeback (win-back) goes out at the user's preferred hour, EXCEPT the
  // 'morning' (6:00) slot — a "come back and train" nudge at 6am is unread
  // (everyone's asleep), so morning users get it in the evening (18:00) like
  // the evening slot. Daily morning workout reminders keep their 6:00 time.
  const timeToHour: Record<string, number> = { morning: 18, late_morning: 10, afternoon: 14, evening: 18 };

  // Comeback only runs at the comeback hours (null preferred_time -> 10:00).
  // `force` (test only) bypasses the hour gate, per-day dedup and logging;
  // testDays overrides the computed absence; testUserId limits to one user.
  if (!force && ![10, 14, 18].includes(hour)) return stats;

  let query = supabase
    .from('user_profiles')
    .select('user_id, first_name, preferred_time, language, primary_goal, max_streak, push_subscription')
    .eq('notification_comeback', true);
  if (testUserId) query = query.eq('user_id', testUserId);
  const { data: users, error } = await query;
  if (error) { console.error('Error fetching comeback users:', error); return stats; }

  for (const user of (users || []) as ComebackUser[]) {
    const sendHour = timeToHour[user.preferred_time ?? ''] ?? 10;
    if (!force && sendHour !== hour) { stats.skipped++; continue; }

    const d = testDays ?? await getDaysSinceLastWorkout(supabase, user.user_id);
    if (d === null || !COMEBACK_STAGES.includes(d)) { stats.skipped++; continue; }

    if (!force && await wasNotificationSentToday(supabase, user.user_id, 'comeback', dateKey)) { stats.skipped++; continue; }

    const lang = pickLang(user.language);
    const tpl = d >= COMEBACK_TAIL_FROM ? COMEBACK[lang].tail : COMEBACK[lang].stages[d];
    if (!tpl) { stats.skipped++; continue; }

    // Personalized (hook) when the required signal exists, else generic.
    let chosen = tpl.generic;
    if (tpl.needs === null) {
      chosen = tpl.hook;
    } else if (tpl.needs === 'streak' && (user.max_streak ?? 0) >= 3) {
      chosen = tpl.hook.replace('{streak}', String(user.max_streak));
    } else if (tpl.needs === 'workouts') {
      const count = await getCompletedWorkoutCount(supabase, user.user_id);
      if (count >= 5) chosen = tpl.hook.replace('{workouts}', String(count));
    } else if (tpl.needs === 'goal' && user.primary_goal) {
      const label = GOAL_LABELS[lang][user.primary_goal];
      if (label) chosen = tpl.hook.replace('{goal}', label); // else keep generic
    }

    const title = COMEBACK[lang].title;
    const body = fillName(chosen, user.first_name);

    const payload = JSON.stringify({ title, body, icon: '/pwa-192x192.png', badge: '/favicon.ico', data: { url: '/' } });
    let delivered = false;

    if (user.push_subscription && vapidPrivateKey) {
      const r = await sendWebPush(user.push_subscription, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (r.success) delivered = true;
      else if (r.error === 'subscription_expired') await supabase.from('user_profiles').update({ push_subscription: null }).eq('user_id', user.user_id);
    }
    try {
      const fcm = await sendFcmToUser(supabase, user.user_id, { title, body, data: { route: '/' } });
      if (fcm.sent > 0) delivered = true;
    } catch (e) { console.error(`FCM comeback failed for ${user.user_id}:`, e); }

    if (delivered) {
      if (!force) await logNotification(supabase, user.user_id, 'comeback', dateKey);
      stats.sent++;
      console.log(`Sent comeback (day ${d}) to user ${user.user_id}`);
    } else {
      stats.skipped++;
    }
  }

  return stats;
}

// ============================================================================
// Broadcast: admin-authored custom push to all users (or one gym), native + web
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBroadcast(
  supabase: SupabaseClient<any>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  title: string,
  body: string,
  gymId?: string,
): Promise<{ sent: number; skipped: number; errors: number }> {
  const stats = { sent: 0, skipped: 0, errors: 0 };

  let query = supabase.from('user_profiles').select('user_id, push_subscription');
  if (gymId) query = query.eq('selected_gym_id', gymId);
  const { data: users, error } = await query;
  if (error) { console.error('Broadcast user fetch error:', error); return stats; }

  const payload = JSON.stringify({
    title, body, icon: '/pwa-192x192.png', badge: '/favicon.ico', data: { url: '/' },
  });

  for (const user of (users || []) as UserProfile[]) {
    let delivered = false;

    if (user.push_subscription && vapidPrivateKey) {
      const r = await sendWebPush(user.push_subscription, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (r.success) delivered = true;
      else if (r.error === 'subscription_expired') await supabase.from('user_profiles').update({ push_subscription: null }).eq('user_id', user.user_id);
    }
    try {
      const fcm = await sendFcmToUser(supabase, user.user_id, { title, body, data: { route: '/' } });
      if (fcm.sent > 0) delivered = true;
    } catch (e) {
      console.error(`Broadcast FCM failed for ${user.user_id}:`, e);
    }

    if (delivered) stats.sent++;
    else stats.skipped++;
  }

  console.log(`Broadcast sent=${stats.sent} skipped=${stats.skipped}`);
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
    .select('user_id, push_subscription, current_streak, language')
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

    const lang = pickLang(user.language);
    const tpl = MESSAGES[lang].test;
    const payload = JSON.stringify({
      title: tpl.title,
      body: tpl.body.replace('{streak}', String(user.current_streak || 0)),
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

  // --- Auth gate: only the cron (CRON_SECRET) or an authenticated admin (the
  // Dashboard broadcast/test trigger) may fire pushes. Blocks anonymous spam. ---
  const authHeader = req.headers.get('Authorization') ?? '';
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    let isAdmin = false;
    if (authHeader) {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        const { data: role } = await authClient
          .from('user_roles').select('role')
          .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        isAdmin = !!role;
      }
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  console.log('Push notification function invoked');

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  // Debug: Log key info (lengths only, not actual values for security)
  console.log('VAPID Key Debug:', {
    publicKeyLength: vapidPublicKey?.length,
    publicKeyPrefix: vapidPublicKey?.substring(0, 10),
    privateKeyLength: vapidPrivateKey?.length,
    hasSubject: !!vapidSubject,
  });

  // VAPID is only needed for WEB push. Native (FCM) reminders work without it,
  // so don't hard-fail — just disable the web-push channel when VAPID is absent.
  const webPushEnabled = !!(vapidPublicKey && vapidPrivateKey && vapidSubject);
  if (!webPushEnabled) {
    console.warn('VAPID not configured — web push disabled, FCM (native) still active');
  }
  
  // Validate key formats (only when web push is enabled)
  if (webPushEnabled) {
    try {
      const pubKeyBytes = base64UrlDecode(vapidPublicKey!);
      const privKeyBytes = base64UrlDecode(vapidPrivateKey!);
      if (pubKeyBytes.length !== 65) {
        console.error(`Invalid public key: expected 65 bytes, got ${pubKeyBytes.length}`);
      }
      if (privKeyBytes.length !== 32) {
        console.error(`Invalid private key: expected 32 bytes, got ${privKeyBytes.length}`);
      }
    } catch (e) {
      console.error('Key decode error:', e);
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Parse request body
  let notificationType: NotificationType | 'test' | null = null;
  let forceComeback = false;
  let testComebackDays: number | undefined;
  let testComebackUser: string | undefined;
  let bcTitle = '';
  let bcBody = '';
  let bcGymId: string | undefined;
  try {
    const body = await req.json();
    notificationType = body.type || null;
    forceComeback = body.force === true;
    testComebackDays = typeof body.test_days === 'number' ? body.test_days : undefined;
    testComebackUser = typeof body.test_user_id === 'string' ? body.test_user_id : undefined;
    bcTitle = typeof body.title === 'string' ? body.title.trim() : '';
    bcBody = typeof body.body === 'string' ? body.body.trim() : '';
    bcGymId = typeof body.gym_id === 'string' ? body.gym_id : undefined;
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

  // BROADCAST: admin sends a custom push to all users (or one gym), native + web.
  if (notificationType === 'broadcast') {
    if (!bcTitle || !bcBody) {
      return new Response(JSON.stringify({ success: false, error: 'Missing title/body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    results.broadcast = await processBroadcast(supabase, vapidPublicKey, vapidPrivateKey, vapidSubject, bcTitle, bcBody, bcGymId);
    console.log('Broadcast complete:', results);
    return new Response(JSON.stringify({ success: true, mode: 'broadcast', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Process comeback notifications FIRST so morning/closing can suppress
  // themselves for any user who just received a comeback push today.
  if (!notificationType || notificationType === 'comeback') {
    results.comeback = await processComebackNotifications(
      supabase,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject,
      forceComeback,
      testComebackDays,
      testComebackUser
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
