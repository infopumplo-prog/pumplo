

# Plan: Fix Profile State After Registration & Push Notification VAPID Key Issue

## Overview

Two critical bugs to fix:

1. **"Dokonči svůj profil" warning appears after registration** - Profile data isn't refreshed after registration completes, so Home.tsx shows stale `onboarding_completed: false`

2. **Push notifications not sending** - VAPID private key is in raw 32-byte format, but code tries to import as PKCS#8, causing "expected valid PKCS#8 data" errors

---

## Issue 1: Profile State Not Updating After Registration

### Root Cause

In `Auth.tsx`, after successful registration:
1. Profile is updated with `onboarding_completed: true` (line 138)
2. Navigation to `/` happens immediately (line 188)

But in `Home.tsx`:
- `useUserProfile` hook has cached the OLD profile data (before update)
- The `onAuthStateChange` listener triggers on `SIGNED_IN`, but that fires BEFORE the profile update
- Result: Home.tsx renders with stale `profile.onboarding_completed === false`

### Solution

Force the `useUserProfile` hook to refetch after Auth.tsx completes registration. Two approaches:

**Option A (Recommended)**: Add a short delay before navigation, then manually trigger profile refetch via a global event or context method.

**Option B (Simpler)**: After profile update in Auth.tsx, wait until we can verify the profile is updated before navigating.

I'll implement **Option B** - add a verification loop that confirms `onboarding_completed === true` before navigating:

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add profile verification before navigation |

### Code Changes

After the profile update succeeds (line 152), add a verification step:

```typescript
// 5. Verify profile was updated before navigating
let verified = false;
let verifyAttempts = 5;

while (!verified && verifyAttempts > 0) {
  const { data: verifyProfile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .single();
  
  if (verifyProfile?.onboarding_completed === true) {
    verified = true;
  } else {
    verifyAttempts--;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// 6. Force a small delay for React Query cache invalidation
await new Promise(resolve => setTimeout(resolve, 100));
```

This ensures the database has committed the change before we navigate.

---

## Issue 2: Push Notifications Failing - VAPID Key Format

### Root Cause

The edge function logs show:
```
Failed to send to user xxx: expected valid PKCS#8 data
```

This happens at line 147-153 in `send-push-notifications/index.ts`:
```typescript
const cryptoKey = await crypto.subtle.importKey(
  'pkcs8',
  privateKeyBuffer,
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign']
);
```

**The problem**: VAPID private keys are stored as **raw 32-byte** values (base64url encoded), NOT in PKCS#8 format. PKCS#8 is an ASN.1 DER structure that includes algorithm identifiers and wrapping.

### Solution

Use **JWK (JSON Web Key)** import instead of PKCS#8. This is the standard approach for Web Crypto API with raw EC keys.

To create a JWK:
1. Extract X and Y coordinates from the public key (bytes 1-32 and 33-64)
2. Use the private key as the `d` parameter
3. Import as JWK

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-push-notifications/index.ts` | Replace PKCS#8 import with JWK import |

### Code Changes

Replace the `createVapidAuthHeader` function (lines 123-206) with a corrected version:

```typescript
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
    throw new Error('Invalid public key format - expected 65-byte uncompressed key');
  }
  
  const xBytes = publicKeyBytes.slice(1, 33);
  const yBytes = publicKeyBytes.slice(33, 65);
  const privateKeyBytes = base64UrlDecode(privateKey);
  
  if (privateKeyBytes.length !== 32) {
    throw new Error('Invalid private key format - expected 32 bytes');
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

  // WebCrypto returns raw 64-byte signature (R || S) for P-256
  // No DER parsing needed when using WebCrypto with ECDSA
  const token = `${unsignedToken}.${base64UrlEncode(signature)}`;

  return {
    authorization: `vapid t=${token}, k=${publicKey}`,
    cryptoKey: publicKey,
  };
}
```

### Key Differences

| Aspect | Old (Broken) | New (Fixed) |
|--------|-------------|-------------|
| Import format | `pkcs8` | `jwk` |
| Key structure | Raw bytes as ArrayBuffer | JWK object with x, y, d |
| Public key usage | Only for auth header | Also for extracting x, y coordinates |
| Signature handling | Manual DER parsing | Direct use (WebCrypto returns raw) |

---

## Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Profile warning after registration | Stale cached profile data | Verify profile update before navigation |
| Push notifications failing | PKCS#8 import with raw key | JWK import with extracted coordinates |

## Files Changed

1. `src/pages/Auth.tsx` - Add profile verification loop
2. `supabase/functions/send-push-notifications/index.ts` - Fix VAPID key import

---

## Technical Notes

### Notification Timing

The notification system uses scheduled invocations:
- **Morning notifications**: Every hour, checks if current hour matches user's `preferred_time` (6, 10, 14, 18)
- **Closing notifications**: Every 15 minutes, checks if gym closes in 30-120 minutes

This means notifications are NOT "exactly on the dot" - they have a tolerance window. If the edge function runs at 6:05 and your preferred time is "morning" (hour 6), you'll still get the notification.

### VAPID Key Format Clarification

Standard web-push libraries generate:
- **Public key**: 65 bytes (0x04 + 32 bytes X + 32 bytes Y), base64url encoded
- **Private key**: 32 bytes raw, base64url encoded

The fix ensures we correctly parse and use these formats with the Web Crypto API.

