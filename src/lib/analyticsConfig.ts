// Meta (Facebook) App Events for the native app. Empty = Meta fully off: the SDK is
// never initialised and no event is sent. Fill BOTH together with the native config
// in the same build (iOS Info.plist FacebookAppID/FacebookClientToken/FacebookDisplayName,
// Android strings.xml + manifest meta-data) — see
// docs/superpowers/specs/2026-10-05-app-analytics-design.md, section "Meta setup".
export const META_APP_ID: string = '';
export const META_CLIENT_TOKEN: string = '';

export const META_ENABLED = META_APP_ID !== '' && META_CLIENT_TOKEN !== '';
