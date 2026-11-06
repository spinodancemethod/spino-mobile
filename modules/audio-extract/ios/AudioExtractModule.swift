import ExpoModulesCore
import AVFoundation

// Extracts the audio track of a local video into an AAC .m4a using
// AVAssetExportSession. No re-encode of video, no third-party binaries.
public class AudioExtractModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioExtract")

    AsyncFunction("extractAudio") { (videoUri: String, outputPath: String, promise: Promise) in
      guard let inputURL = URL(string: videoUri) ?? URL(fileURLWithPath: videoUri) as URL? else {
        promise.reject("E_INPUT", "Invalid video URI")
        return
      }
      let outputURL = outputPath.hasPrefix("file://") ? URL(string: outputPath)! : URL(fileURLWithPath: outputPath)
      try? FileManager.default.removeItem(at: outputURL)

      let asset = AVURLAsset(url: inputURL)
      guard asset.tracks(withMediaType: .audio).first != nil else {
        promise.reject("E_NO_AUDIO", "The video has no audio track")
        return
      }
      guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
        promise.reject("E_SESSION", "Could not create export session")
        return
      }
      session.outputURL = outputURL
      session.outputFileType = .m4a
      session.shouldOptimizeForNetworkUse = true
      session.exportAsynchronously {
        switch session.status {
        case .completed:
          let duration = CMTimeGetSeconds(asset.duration)
          let size = (try? FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? NSNumber)?.intValue ?? 0
          promise.resolve([
            "uri": outputURL.absoluteString,
            "durationSeconds": duration.isFinite ? duration : 0,
            "sizeBytes": size,
          ])
        case .cancelled:
          promise.reject("E_CANCELLED", "Export cancelled")
        default:
          promise.reject("E_EXPORT", session.error?.localizedDescription ?? "Export failed")
        }
      }
    }
  }
}
