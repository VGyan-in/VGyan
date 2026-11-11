package expo.modules.vgyanspeech

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.os.SystemClock
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import org.vosk.LibVosk
import org.vosk.LogLevel
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.max

private const val SAMPLE_RATE = 16000
private const val CHUNK_BYTES = 3200 // 100 ms of 16 kHz mono 16-bit PCM

class SpeechException(code: String, message: String, cause: Throwable? = null) : CodedException(code, message, cause)

/**
 * Offline speech for VGyan reading assessments.
 *
 * Records 16 kHz mono 16-bit PCM straight to a WAV file (the research original) and, when a Vosk
 * model is loaded, recognises the same audio on a separate thread with word timestamps and
 * confidences. The capture thread never waits for the recogniser, so a slow phone cannot drop
 * audio; any recognition backlog is drained after the student taps stop.
 */
class VgyanSpeechModule : Module() {
  private val models = ConcurrentHashMap<String, Model>()
  @Volatile private var session: RecordingSession? = null

  override fun definition() = ModuleDefinition {
    Name("VgyanSpeech")
    Events("onLevel")

    OnCreate { LibVosk.setLogLevel(LogLevel.WARNINGS) }

    OnDestroy {
      session?.cancel()
      session = null
      models.values.forEach { runCatching { it.close() } }
      models.clear()
    }

    AsyncFunction("loadModel") { key: String, path: String ->
      if (models.containsKey(key)) return@AsyncFunction true
      val dir = File(toPath(path))
      if (!File(dir, "am/final.mdl").exists() && !File(dir, "final.mdl").exists()) {
        throw SpeechException("ERR_MODEL_MISSING", "No Vosk model found at ${dir.name}")
      }
      try {
        models[key] = Model(dir.absolutePath)
      } catch (e: Throwable) {
        throw SpeechException("ERR_MODEL_LOAD", "Could not load speech model: ${e.message}", e)
      }
      true
    }

    Function("isModelLoaded") { key: String -> models.containsKey(key) }

    AsyncFunction("unloadModel") { key: String ->
      models.remove(key)?.let { runCatching { it.close() } }
      Unit
    }

    /** Extracts a model archive; returns the directory that contains the model (am/ or final.mdl). */
    AsyncFunction("unzip") { zipPath: String, destDir: String ->
      val dest = File(toPath(destDir))
      unzipTo(File(toPath(zipPath)), dest)
      findModelDir(dest)?.absolutePath ?: throw SpeechException("ERR_MODEL_LAYOUT", "Archive does not contain a Vosk model")
    }

    AsyncFunction("startRecording") { outputPath: String, modelKey: String? ->
      if (session != null) throw SpeechException("ERR_BUSY", "Already recording")
      val ctx = appContext.reactContext ?: throw SpeechException("ERR_CONTEXT", "No React context")
      if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw SpeechException("ERR_PERMISSION", "Microphone permission not granted")
      }
      val model = modelKey?.let { models[it] }
      val out = File(toPath(outputPath))
      out.parentFile?.mkdirs()
      val s = RecordingSession(out, model) { level -> sendEvent("onLevel", mapOf("level" to level)) }
      s.start()
      session = s
      mapOf("recognizing" to (model != null))
    }

    AsyncFunction("stopRecording") {
      val s = session ?: throw SpeechException("ERR_NOT_RECORDING", "Not recording")
      session = null
      s.stop()
    }

    AsyncFunction("cancelRecording") {
      session?.cancel()
      session = null
      Unit
    }

    /** Recognises an existing 16 kHz mono 16-bit WAV (e.g. a recording made before the model was installed). */
    AsyncFunction("transcribeFile") { wavPath: String, modelKey: String ->
      val model = models[modelKey] ?: throw SpeechException("ERR_MODEL_NOT_LOADED", "Model $modelKey is not loaded")
      transcribeWav(File(toPath(wavPath)), model)
    }
  }

  private fun toPath(p: String): String = if (p.startsWith("file:")) Uri.parse(p).path ?: p.removePrefix("file://") else p

  private fun unzipTo(zip: File, dest: File) {
    dest.mkdirs()
    val root = dest.canonicalPath + File.separator
    ZipInputStream(FileInputStream(zip).buffered()).use { zin ->
      var entry = zin.nextEntry
      val buf = ByteArray(64 * 1024)
      while (entry != null) {
        val target = File(dest, entry.name)
        if (!target.canonicalPath.startsWith(root)) throw SpeechException("ERR_ZIP", "Unsafe path in archive")
        if (entry.isDirectory) {
          target.mkdirs()
        } else {
          target.parentFile?.mkdirs()
          FileOutputStream(target).use { out ->
            while (true) {
              val n = zin.read(buf)
              if (n <= 0) break
              out.write(buf, 0, n)
            }
          }
        }
        zin.closeEntry()
        entry = zin.nextEntry
      }
    }
  }

  private fun findModelDir(dir: File, depth: Int = 0): File? {
    if (File(dir, "am/final.mdl").exists() || File(dir, "final.mdl").exists()) return dir
    if (depth > 2) return null
    return dir.listFiles()?.filter { it.isDirectory }?.firstNotNullOfOrNull { findModelDir(it, depth + 1) }
  }

  private fun transcribeWav(file: File, model: Model): Map<String, Any?> {
    if (!file.exists()) throw SpeechException("ERR_NO_FILE", "Recording not found")
    val started = SystemClock.elapsedRealtime()
    val collector = ResultCollector()
    Recognizer(model, SAMPLE_RATE.toFloat()).use { rec ->
      rec.setWords(true)
      FileInputStream(file).buffered().use { input ->
        val header = WavHeader.read(input)
        if (header.sampleRate != SAMPLE_RATE || header.channels != 1 || header.bitsPerSample != 16) {
          throw SpeechException("ERR_FORMAT", "Expected 16 kHz mono 16-bit WAV, got ${header.sampleRate} Hz ${header.channels} ch ${header.bitsPerSample}-bit")
        }
        val buf = ByteArray(CHUNK_BYTES * 4)
        var remaining = header.dataBytes
        while (remaining > 0) {
          val n = input.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
          if (n <= 0) break
          remaining -= n
          if (rec.acceptWaveForm(buf, n)) collector.add(rec.result)
        }
      }
      collector.add(rec.finalResult)
    }
    return collector.toMap(SystemClock.elapsedRealtime() - started, durationMs = null)
  }

  /** One recording: capture thread → WAV file, plus an optional recogniser thread fed from a queue. */
  private class RecordingSession(val file: File, model: Model?, val onLevel: (Double) -> Unit) {
    private val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    private val record = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      max(minBuf, CHUNK_BYTES * 8),
    )
    private val recognizer: Recognizer? = model?.let { Recognizer(it, SAMPLE_RATE.toFloat()).apply { setWords(true) } }
    private val queue = LinkedBlockingQueue<ByteArray>()
    private val collector = ResultCollector()
    @Volatile private var running = false
    @Volatile private var dataBytes = 0L
    @Volatile private var captureError: Throwable? = null
    private var captureThread: Thread? = null
    private var asrThread: Thread? = null
    private var startedAt = 0L

    fun start() {
      if (record.state != AudioRecord.STATE_INITIALIZED) throw SpeechException("ERR_MIC", "Microphone could not be opened")
      running = true
      startedAt = SystemClock.elapsedRealtime()
      record.startRecording()
      captureThread = thread(name = "vgyan-capture", priority = Thread.MAX_PRIORITY) {
        try {
          RandomAccessFile(file, "rw").use { raf ->
            raf.setLength(0)
            raf.write(WavHeader.bytes(0))
            val buf = ByteArray(CHUNK_BYTES)
            var lastLevel = 0L
            while (running) {
              val n = record.read(buf, 0, buf.size)
              if (n <= 0) continue
              raf.write(buf, 0, n)
              dataBytes += n
              if (recognizer != null) queue.put(buf.copyOf(n))
              val now = SystemClock.elapsedRealtime()
              if (now - lastLevel > 120) {
                lastLevel = now
                onLevel(peakLevel(buf, n))
              }
            }
            raf.seek(0)
            raf.write(WavHeader.bytes(dataBytes))
            raf.fd.sync()
          }
        } catch (e: Throwable) {
          captureError = e
        }
      }
      if (recognizer != null) {
        asrThread = thread(name = "vgyan-asr") {
          while (true) {
            val chunk = queue.poll(200, TimeUnit.MILLISECONDS)
            if (chunk == null) {
              if (!running && captureThread?.isAlive != true) break else continue
            }
            if (chunk.isEmpty()) break // end marker
            if (recognizer.acceptWaveForm(chunk, chunk.size)) collector.add(recognizer.result)
          }
        }
      }
    }

    fun stop(): Map<String, Any?> {
      val durationMs = SystemClock.elapsedRealtime() - startedAt
      running = false
      runCatching { record.stop() }
      captureThread?.join(5000)
      record.release()
      captureError?.let { throw SpeechException("ERR_WRITE", "Could not save the recording: ${it.message}", it) }
      val stopAt = SystemClock.elapsedRealtime()
      var result: Map<String, Any?> = mapOf("text" to null, "words" to null, "asrMs" to null)
      if (recognizer != null) {
        queue.put(ByteArray(0))
        asrThread?.join()
        collector.add(recognizer.finalResult)
        recognizer.close()
        result = collector.toMap(SystemClock.elapsedRealtime() - stopAt, durationMs)
      }
      return result + mapOf(
        "uri" to Uri.fromFile(file).toString(),
        "durationMs" to (dataBytes * 1000 / (SAMPLE_RATE * 2)),
        "wallClockMs" to durationMs,
        "bytes" to (dataBytes + 44),
        "sampleRate" to SAMPLE_RATE,
      )
    }

    fun cancel() {
      running = false
      runCatching { record.stop() }
      captureThread?.join(2000)
      runCatching { record.release() }
      queue.put(ByteArray(0))
      asrThread?.join(2000)
      runCatching { recognizer?.close() }
      file.delete()
    }

    private fun peakLevel(buf: ByteArray, n: Int): Double {
      var peak = 0
      var i = 0
      while (i + 1 < n) {
        val s = (buf[i].toInt() and 0xff) or (buf[i + 1].toInt() shl 8)
        peak = max(peak, abs(s.toShort().toInt()))
        i += 2
      }
      return peak / 32768.0
    }
  }

  /** Accumulates Vosk JSON results (one per utterance) into one transcript with word timings. */
  private class ResultCollector {
    private val texts = mutableListOf<String>()
    private val words = mutableListOf<Map<String, Any>>()

    @Synchronized fun add(json: String?) {
      if (json.isNullOrBlank()) return
      val o = JSONObject(json)
      o.optString("text").trim().takeIf { it.isNotEmpty() }?.let { texts.add(it) }
      val arr: JSONArray = o.optJSONArray("result") ?: return
      for (i in 0 until arr.length()) {
        val w = arr.getJSONObject(i)
        words.add(
          mapOf(
            "word" to w.optString("word"),
            "start" to w.optDouble("start"),
            "end" to w.optDouble("end"),
            "conf" to w.optDouble("conf", -1.0),
          ),
        )
      }
    }

    @Synchronized fun toMap(asrMs: Long, durationMs: Long?): Map<String, Any?> {
      val confs = words.mapNotNull { (it["conf"] as Double).takeIf { c -> c >= 0 } }
      return mapOf(
        "text" to texts.joinToString(" "),
        "words" to words.toList(),
        "confidence" to (if (confs.isEmpty()) null else confs.average()),
        "asrMs" to asrMs,
        "durationMs" to durationMs,
      )
    }
  }
}

private class WavHeader(val sampleRate: Int, val channels: Int, val bitsPerSample: Int, val dataBytes: Long) {
  companion object {
    fun bytes(dataLen: Long): ByteArray {
      val byteRate = SAMPLE_RATE * 2
      val h = ByteArray(44)
      fun put32(off: Int, v: Long) { for (i in 0 until 4) h[off + i] = ((v shr (8 * i)) and 0xff).toByte() }
      fun put16(off: Int, v: Int) { h[off] = (v and 0xff).toByte(); h[off + 1] = ((v shr 8) and 0xff).toByte() }
      "RIFF".toByteArray().copyInto(h, 0)
      put32(4, 36 + dataLen)
      "WAVE".toByteArray().copyInto(h, 8)
      "fmt ".toByteArray().copyInto(h, 12)
      put32(16, 16)
      put16(20, 1) // PCM
      put16(22, 1) // mono
      put32(24, SAMPLE_RATE.toLong())
      put32(28, byteRate.toLong())
      put16(32, 2)
      put16(34, 16)
      "data".toByteArray().copyInto(h, 36)
      put32(40, dataLen)
      return h
    }

    /** Parses RIFF chunks up to "data", leaving the stream positioned at the first sample. */
    fun read(input: java.io.InputStream): WavHeader {
      fun le32(b: ByteArray) = (b[0].toLong() and 0xff) or ((b[1].toLong() and 0xff) shl 8) or ((b[2].toLong() and 0xff) shl 16) or ((b[3].toLong() and 0xff) shl 24)
      fun le16(b: ByteArray, o: Int) = (b[o].toInt() and 0xff) or ((b[o + 1].toInt() and 0xff) shl 8)
      val riff = ByteArray(12)
      if (input.read(riff) != 12 || String(riff, 0, 4) != "RIFF" || String(riff, 8, 4) != "WAVE") throw SpeechException("ERR_FORMAT", "Not a WAV file")
      var rate = 0; var ch = 0; var bits = 0
      val hdr = ByteArray(8)
      while (input.read(hdr) == 8) {
        val id = String(hdr, 0, 4)
        val len = le32(hdr.copyOfRange(4, 8))
        if (id == "fmt ") {
          val fmt = ByteArray(len.toInt())
          input.read(fmt)
          ch = le16(fmt, 2); rate = le32(fmt.copyOfRange(4, 8)).toInt(); bits = le16(fmt, 14)
        } else if (id == "data") {
          return WavHeader(rate, ch, bits, len)
        } else {
          input.skip(len)
        }
      }
      throw SpeechException("ERR_FORMAT", "WAV has no data chunk")
    }
  }
}
