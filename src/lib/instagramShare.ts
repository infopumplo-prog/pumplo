import { Capacitor, registerPlugin } from '@capacitor/core';

// Native "Share to Instagram Stories" using IG's background-image handoff:
//  - iOS: UIPasteboard key `com.instagram.sharedSticker.backgroundImage` +
//         opening `instagram-stories://share` (see InstagramSharePlugin.swift)
//  - Android: `com.instagram.share.ADD_TO_STORY` intent with the image as the
//         intent data = background (see InstagramSharePlugin.java)
// The generic Capacitor Share sheet hands IG a *file*, which IG turns into a
// sticker over the live camera (the bug). This path makes the card the actual
// Story background.
interface InstagramSharePlugin {
  isInstalled(): Promise<{ installed: boolean }>;
  shareToStories(options: { imagePath: string }): Promise<void>;
}

const InstagramShare = registerPlugin<InstagramSharePlugin>('InstagramShare');

export async function isInstagramInstalled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { installed } = await InstagramShare.isInstalled();
    return !!installed;
  } catch {
    return false;
  }
}

// Returns true if the native handoff to Instagram Stories succeeded.
export async function shareToInstagramStories(imagePath: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await InstagramShare.shareToStories({ imagePath });
    return true;
  } catch (e) {
    console.warn('[InstagramShare] story share failed:', e);
    return false;
  }
}
