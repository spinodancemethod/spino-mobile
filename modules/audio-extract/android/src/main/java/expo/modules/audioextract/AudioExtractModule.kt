package expo.modules.audioextract

import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import kotlin.concurrent.thread

// Copies the audio track of a local video into an .m4a (AAC in MP4) with
// MediaExtractor + MediaMuxer: no decoding, no re-encoding, no third-party binaries.
class AudioExtractModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioExtract")

    AsyncFunction("extractAudio") { videoUri: String, outputPath: String, promise: Promise ->
      thread {
        try {
          val result = extract(videoUri, outputPath)
          promise.resolve(result)
        } catch (e: CodedException) {
          promise.reject(e)
        } catch (e: Exception) {
          promise.reject(CodedException("E_EXPORT", e.message ?: "Export failed", e))
        }
      }
    }
  }

  private fun extract(videoUri: String, outputPath: String): Map<String, Any> {
    val context = appContext.reactContext ?: throw CodedException("E_CONTEXT", "No Android context", null)
    val outFile = File(outputPath.removePrefix("file://"))
    outFile.parentFile?.mkdirs()
    if (outFile.exists()) outFile.delete()

    val extractor = MediaExtractor()
    val uri = Uri.parse(videoUri)
    if (uri.scheme == null || uri.scheme == "file") {
      extractor.setDataSource(uri.path ?: videoUri)
    } else {
      extractor.setDataSource(context, uri, null)
    }

    var audioTrack = -1
    var format: MediaFormat? = null
    for (i in 0 until extractor.trackCount) {
      val f = extractor.getTrackFormat(i)
      val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith("audio/")) { audioTrack = i; format = f; break }
    }
    if (audioTrack < 0 || format == null) {
      extractor.release()
      throw CodedException("E_NO_AUDIO", "The video has no audio track", null)
    }
    val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
    if (!mime.contains("mp4a") && !mime.contains("aac")) {
      // MediaMuxer(MP4) only accepts AAC audio; phone recordings are AAC in practice.
      extractor.release()
      throw CodedException("E_CODEC", "Unsupported audio codec $mime (expected AAC)", null)
    }

    extractor.selectTrack(audioTrack)
    val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val dst = muxer.addTrack(format)
    muxer.start()

    val maxSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) else 1 shl 20
    val buffer = ByteBuffer.allocate(maxSize.coerceAtLeast(64 * 1024))
    val info = android.media.MediaCodec.BufferInfo()
    var lastPts = 0L
    while (true) {
      info.offset = 0
      info.size = extractor.readSampleData(buffer, 0)
      if (info.size < 0) break
      info.presentationTimeUs = extractor.sampleTime
      info.flags = extractor.sampleFlags
      lastPts = info.presentationTimeUs
      muxer.writeSampleData(dst, buffer, info)
      extractor.advance()
    }
    muxer.stop(); muxer.release(); extractor.release()

    val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else lastPts
    return mapOf(
      "uri" to Uri.fromFile(outFile).toString(),
      "durationSeconds" to durationUs / 1_000_000.0,
      "sizeBytes" to outFile.length().toInt(),
    )
  }
}
