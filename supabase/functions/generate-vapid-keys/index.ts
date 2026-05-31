const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    // Export public key in raw format (65 bytes for uncompressed P-256)
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKey = base64UrlEncode(publicKeyBuffer);

    // Export private key in PKCS8 format
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKey = base64UrlEncode(privateKeyBuffer);

    // Also export the raw private key (just the 32-byte scalar) for web-push compatibility
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const privateKeyRaw = jwk.d || '';

    console.log('Generated new VAPID key pair successfully');

    return new Response(
      JSON.stringify({
        success: true,
        keys: {
          publicKey,
          privateKey,
          privateKeyRaw,
        },
        instructions: {
          step1: 'Copy the publicKey and update VAPID_PUBLIC_KEY in usePushNotifications.ts',
          step2: 'Add VAPID_PRIVATE_KEY secret with the privateKey value',
          step3: 'Add VAPID_SUBJECT secret with value like: mailto:admin@pumplo.app',
          note: 'Use privateKeyRaw if your web-push library expects the raw 32-byte format',
        },
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error generating VAPID keys:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
