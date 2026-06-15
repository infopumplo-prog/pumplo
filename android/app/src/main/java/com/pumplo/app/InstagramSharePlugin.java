package com.pumplo.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

// Shares a finished-workout card directly as an Instagram Story BACKGROUND via
// the ADD_TO_STORY intent. The generic share sheet hands IG a file, which IG
// drops onto the live camera as a sticker; using ADD_TO_STORY with the image as
// the intent data makes it the full Story background instead.
// Needs <queries> visibility for com.instagram.android (AndroidManifest).
@CapacitorPlugin(name = "InstagramShare")
public class InstagramSharePlugin extends Plugin {

    private static final String IG_PACKAGE = "com.instagram.android";

    @PluginMethod
    public void isInstalled(PluginCall call) {
        boolean installed;
        try {
            getContext().getPackageManager().getPackageInfo(IG_PACKAGE, 0);
            installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }
        JSObject ret = new JSObject();
        ret.put("installed", installed);
        call.resolve(ret);
    }

    @PluginMethod
    public void shareToStories(PluginCall call) {
        String path = call.getString("imagePath");
        if (path == null) {
            call.reject("missing imagePath");
            return;
        }
        try {
            Uri parsed = Uri.parse(path);
            File file = new File(parsed.getPath());
            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent("com.instagram.share.ADD_TO_STORY");
            intent.setDataAndType(contentUri, "image/jpeg");
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra("source_application", getContext().getPackageName());

            getContext().grantUriPermission(
                IG_PACKAGE, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getActivity().startActivityForResult(intent, 0);
                call.resolve();
            } else {
                call.reject("instagram not installed");
            }
        } catch (Exception e) {
            call.reject("share failed: " + e.getMessage());
        }
    }
}
