package com.pumplo.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.otaliastudios.transcoder.Transcoder;
import com.otaliastudios.transcoder.TranscoderListener;
import com.otaliastudios.transcoder.strategy.DefaultVideoStrategy;
import com.otaliastudios.transcoder.strategy.RemoveTrackStrategy;

import java.io.File;

/**
 * Komprese videa vlastního cviku před uploadem (Motorola natáčí 15 MB za pár
 * sekund). Přepis přes MediaCodec (knihovna Transcoder): max výška 720 px,
 * cílový bitrate ~2 Mb/s, bez zvukové stopy. Vstup: file:// cesta z Filesystem
 * (Directory.Cache), výstup: compress-out-<čas>.mp4 v cacheDir.
 */
@CapacitorPlugin(name = "VideoCompress")
public class VideoCompressPlugin extends Plugin {

    @PluginMethod
    public void compress(PluginCall call) {
        String path = call.getString("path");
        if (path == null) { call.reject("path missing"); return; }
        if (path.startsWith("file://")) path = path.substring(7);
        int maxHeight = call.getInt("maxHeight", 720);
        long bitrate = call.getInt("bitrate", 2_000_000);

        final File out = new File(getContext().getCacheDir(), "compress-out-" + System.currentTimeMillis() + ".mp4");
        DefaultVideoStrategy video = DefaultVideoStrategy.atMost(maxHeight)
            .bitRate(bitrate)
            .frameRate(30)
            .keyFrameInterval(2f)
            .build();

        Transcoder.into(out.getAbsolutePath())
            .addDataSource(path)
            .setVideoTrackStrategy(video)
            .setAudioTrackStrategy(new RemoveTrackStrategy())
            .setListener(new TranscoderListener() {
                @Override public void onTranscodeProgress(double progress) { }
                @Override public void onTranscodeCompleted(int successCode) {
                    JSObject r = new JSObject();
                    r.put("path", "file://" + out.getAbsolutePath());
                    r.put("size", out.length());
                    call.resolve(r);
                }
                @Override public void onTranscodeCanceled() { call.reject("canceled"); }
                @Override public void onTranscodeFailed(Throwable exception) {
                    call.reject("transcode failed: " + exception.getMessage());
                }
            })
            .transcode();
    }
}
