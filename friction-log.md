# Friction log: Goodnight TV on Vega OS

Friction we hit building Goodnight TV, a bedtime routine that dims its own screen, on React Native for Vega (no AI in the product). It covers **building for Vega** only: OS ↔ app boundaries, audio, power and display, the SDK and CLI, the Virtual Device. Every entry has the task, steps, expected vs actual, severity, workaround, evidence, and a suggestion.

**Environment:** macOS 26 (Apple Silicon, 8 GB) · Vega SDK 0.24.12112 · Vega CLI 1.4.4 · React Native for Vega 0.83 · `keplerscript-audio-lib` 2.0.18-rn-83 · `react-native-svg` 3.0.9000000000-rn-83 · `react-linear-gradient` 2.0.9000000001-rn-83.2 · Vega Virtual Device (aarch64, OS 1.2) · Fire TV Stick (Vega OS 2, armv7) for spot checks.
**Severity:** High = forces a redesign or costs hours · Medium = costs time, workaround exists · Low = papercut.
**Status:** *measured* = we reproduced it and kept the evidence · *cited* = documented by Amazon staff or the community, not yet reproduced by us.

## What would make the next Vega version better for bedtime / ambient apps
1. **A display-power contract for apps** (#1, #2). Tell an app when the display will turn off, let it hold the display for a bounded, user-visible activity, and let it *ask* for display-off when it is done. Today an app can neither keep the screen on through a 20-minute routine nor hand the TV to sleep cleanly.
2. **An app-level brightness / backlight hint** (#3), even a coarse "dim" request. Without it, every dimming app must fake it in pixels, and the panel's backlight stays on.
3. **Make audio failure loud** (#4, #5): validate service declarations at build time, and make `-rn-83` library builds pass the build's own compatibility check.
4. **Document the key-name matrix** for OK across OS versions (#6).
5. **Let a focused control consume a key** (#16): an `onKeyDown` that can return "handled", so a slider's ◀ ▶ don't also move focus.
6. **Make a stalled audio stream visible** (#17): a write that blocks should raise an event or count as an underrun, and `pause`/`flush`/`stop` should not queue behind it.

| # | Area | Friction | Severity | Status |
|---|---|---|---|---|
| 1 | Power × display | The display is forced off after ~5 min without input, killing the foreground app, even during audio playback | High | cited · not reproducible on the VVD |
| 2 | Power × display | No app API to keep the display on, or to request display-off when done | High | cited |
| 3 | Display | No brightness or backlight control for apps: dimming must be done in pixels | High (design) | docs |
| 4 | Audio | URL-mode `AudioPlayer` reported to fail on the VVD with `MEDIA_ERR_SRC_NOT_SUPPORTED`; raw PCM works | High | cited · we chose PCM |
| 5 | Build | Every `-rn-83` system library we added (audio, linear gradient, SVG) fails the build's own compatibility check (exit code still 0), and the build edits `manifest.toml` | Medium | measured |
| 6 | Input | OK arrives under different event names across OS versions (`enter` on the VVD, OS 1.2) | Medium | measured (VVD) |
| 7 | Audio | Undeclared audio services fail silently | Medium | test planned |
| 8 | Layout | VVD layout canvas is 960×540 units for a 1920×1080 picture | Low | measured |
| 9 | Capture | No supported screen or audio capture on the VVD or the stick for the demo video | Medium | measured · worked around |
| 11 | Alexa × Vega apps | No documented way to know whether Alexa (voice or a scheduled routine) can open a sideloaded Vega app | Medium | test pending |
| 12 | Animation | `Animated.multiply(value, number)` inside a native-driven transform is silently ignored on the VVD | Medium | measured |
| 13 | Layout × Image | A full-bleed `Image` anchored with `left/top/right/bottom: 0` draws at its pixel size instead of stretching | Low | measured |
| 14 | Types × TV keyboard | `TextInput` `auxOptions` (the TV keyboard's title) is documented for Vega but missing from the RN 0.83 types | Low | measured |
| 15 | Networking | A large WebSocket message reaches the app as several ~10 KB `message` events, not one; JSON breaks silently | **High** | measured |
| 16 | Input × focus | A control that handles ◀ ▶ itself (a slider) can't consume the key: the same press also moves focus to the neighbour | Medium | measured |
| 17 | Audio × VVD | A VVD session's PCM stream slowed to ~4% of real time with no error and 0 underruns reported; stop/flush hang behind it | **High** | measured |
| 18 | Input × VVD | OK on a `TextInput` shows no on-screen keyboard on the VVD; text only arrives via `inputd-cli send_text` | Low | measured (VVD) |
| 19 | Input × focus | Leaving a `TextInput` with the D-pad is inconsistent: ▶ sometimes moves the caret first, then focus jumps to a control that isn't the nearest one | Medium | measured (VVD) |
| 10 | Accessibility | `accessibilityOrientationText` is documented and present at runtime, but missing from the RN 0.83 TypeScript types | Low | measured |

---

### 1. The display turns off after ~5 minutes idle and the app is killed (High, cited)
- **Task:** Run a 20-minute bedtime routine where the child mostly listens: no remote input during the story.
- **Steps:** Community reports on the Fire TV Stick 4K Select (Vega OS 1.1, SDK 0.23) with an actively playing `VideoPlayer` + `AudioPlayer`, `LIFESPAN_POLICY.PERMANENT`, all media services declared.
- **Expected:** An app playing audio in the foreground keeps the display, as Fire OS media apps do with a wake lock.
- **Actual:** After ~5 min of input idle, `power-service-core` calls `PowerManagerExt:forceDisplayOff`; LCM clears the backstack and kills the foreground app. Amazon staff confirmed (May 12, 2026) that no manifest privilege, API or shell command overrides it. Active media playback suppresses the *screensaver* only.
- **VVD (Oct 21, measured):** not reproduced. After a bedtime ended on our black goodnight screen, the app kept sending telemetry for 38 minutes with no input and stayed in the foreground. The Virtual Device doesn't model the idle display-off, so this can only be tested on a stick, and a VVD-only test suite would miss it.
- **Workaround (design):**
  - The routine has natural remote moments that reset the idle timer: "Done brushing", three story picks, and in long routines a mid-story "goodnight to the stars" press.
  - Each listening stretch stays under the idle window.
  - At the end, the app is already dark and silent, so when Fire TV's own idle path turns the display off, nothing bright appears first. We claim only what we control: a dark, silent app. The display-off afterwards is the platform's.
- **Evidence:** community thread 28268 (staff reply May 12, 2026); thread 28610 (`resmgr` only counts `video-playback`, `audio-playback`, `power-normal` as display sessions). Our VVD idle test: *pending*.
- **Suggestion:** A bounded, user-visible "activity in progress" session that holds the display (like Android's media session + wake lock), and a way for an app to *request* display-off at the end of a sleep or wind-down flow.

### 2. No way to keep the display on, or to hand it back (High, cited)
- **Task:** Keep the dark scene on screen through the routine, then let the TV sleep.
- **Expected:** A wake-lock-like API, or a documented rule for which app sessions keep the display.
- **Actual:** No API exists (staff, July 7, 2026: "not currently planned for the near-term roadmap"). Whether a raw `AudioPlaybackStream` counts as an `audio-playback` session isn't documented.
- **Workaround:** Our noise bed runs as a continuous PCM stream for the whole routine. Measuring whether that suppresses the screensaver on the VVD is the next test.
- **Suggestion:** Document which session types each audio API creates, and expose a "display session held" flag the app can read.

### 3. No brightness control: dimming is faked in pixels (High, design)
- **Task:** Make the TV give off less light as bedtime goes on.
- **Expected:** A coarse brightness or backlight request for the foreground app (Android has `WindowManager.LayoutParams.screenBrightness`).
- **Actual:** No documented brightness or backlight API for Vega apps. `DisplayManager` (`kepler-graphics`) covers colour depth, HDR, refresh rate and overscan only.
- **Workaround:** Goodnight TV owns the whole screen and passes every colour through `taper(color, t)`: luminance to < 1% of a bright home screen, blue removed first, contrast compressed, motion stilled, then a black veil. On an LCD, the backlight still glows behind "black", which is why we say *near-black*.
- **Evidence:** `app/src/taper.ts`, `app/test/taper.spec.ts` (light < 1% of the home screen at t = 0.85; blue share 0.76 → 0.03).
- **Suggestion:** A foreground-app brightness hint, honoured only while the app is visible.

### 4. URL-mode AudioPlayer is unreliable on the VVD; raw PCM works (High, cited)
- **Task:** Play the bear's voice and a noise bed.
- **Actual (community, Sept 2026, SDK 0.24.9914):** `AudioPlayer.src = <url>` fails with `MEDIA_ERR_SRC_NOT_SUPPORTED` and issues no HTTP request; `canPlayType('audio/mpeg')` says "probably". Raw PCM through `keplerscript-audio-lib` is audible on the same device.
- **Workaround / design:** We never used URL mode. One `AudioPlaybackStream` per track at 24 kHz mono PCM16, fed from JS: the bear (Nova Sonic's native output format, so no decoding) and the noise bed (generated on the device). Barge-in is `voiceQueue.clear()` + `pauseAsync/flushAsync/startAsync`.
- **Measured on the VVD (Oct 19, 15:41 UTC):** 2 concurrent `AudioPlaybackStream`s (24 kHz mono PCM16, `USAGE_MEDIA`), **0 native underruns** over ~2 min (`getUnderrunCountAsync`), barge-in flush (`pause → flush → start`) in **115 ms**. Our time-based pacing logged 13 resyncs in 2 min (JS timer jitter vs. the 240 ms lead), with no native underrun. (Measured on the earlier build, where the voice came from a live stream; the product now plays recorded clips through the same path.)
- **Evidence:** thread 29117; `app/src/audio/engine.ts`; telemetry in `server/evidence/run-2026-10-19T15-30-34-150Z.jsonl`. Our own URL-mode repro: not attempted (no need once PCM worked).

### 5. The `-rn-83` system libraries fail the build's own compatibility check (Medium, measured)
- **Task:** Add `@amazon-devices/keplerscript-audio-lib` to an RN 0.83 app.
- **Steps:** `npm install @amazon-devices/keplerscript-audio-lib@2.0.18-rn-83` (the RN 0.83 build on npm), then `npm run build:release`.
- **Expected:** A clean build, or a clear "use version X" message.
- **Actual:**
  - The build prints `ERROR … Library @amazon-devices/keplerscript-audio-lib is not properly configured. The version is set to 2.0.18-rn-83 but that value is not part of it's 'kepler-compatibility.json' file`, because that file lists only `2.0.4`–`2.0.18`.
  - The build still exits 0 and produces working `.vpkg`s.
  - It also **adds `[[needs.module]] /com.amazon.kepler.audio_lib_2@IAudioLib_0` to the source `manifest.toml`** without saying so.
- **Oct 20:** the same ERROR for `@amazon-devices/react-linear-gradient@2.0.9000000001-rn-83.2` and `@amazon-devices/react-native-svg@3.0.9000000000-rn-83`: the RN 0.83 builds npm offers are exactly the versions the validator rejects. The build also added `linear_gradient_2` and `svg_3` to `[needs]` on its own.
- **Workaround:** Ignore the ERROR, and commit the manifest change on purpose.
- **Evidence:** build log Oct 19, 2026 15:37 UTC (in `evidence/`).
- **Suggestion:** Add the `-rn-83` versions to `kepler-compatibility.json`, make ERROR fail the build (or call it a warning), and print a line when the build edits the manifest.

### 6. OK arrives under different event names (Medium, measuring)
- **Task:** Card picks with OK on every OS version, without raw key handlers.
- **Actual:** On the VVD (OS 1.2), `useTVEventHandler` reports OK as **`enter`**, and the arrows as `left` / `right` (`evidence/run-2026-10-19T15-30-34-150Z.jsonl`, `key` events). `Pressable.onPress` fires for it. Our sister project saw `select` on Vega OS 2. Goodnight TV logs every key name (logging only; focus stays with Vega's focus engine).
- **Workaround:** Pressable + TVFocusGuideView only; key names are never used for behaviour.

### 7. Undeclared audio services fail silently (Medium, test planned)
- **Plan:** Build once without `com.amazon.audio.stream` in `[wants]` and record what `buildAsync()` / `writeAsync()` return.

### 8. The VVD layout canvas is 960×540 (Low, measured)
- All Goodnight TV layout uses a 960×540 design space scaled by `useWindowDimensions().width / 960`.

### 9. No supported capture for the demo video (Medium, measured · worked around)
- `screenshooter` hangs the VVD display, and is blocked on the stick for the dev shell user. `screencapture -l <window>` in a loop gives ~2.5 fps and no audio.
- **Workaround:** `demo/tools/vvd-record.swift` uses macOS ScreenCaptureKit with a *desktop-independent window* filter: only the VVD window (never other windows, even overlapping ones), ~37 fps at 2×, **with the emulator's audio**. `demo/tools/take.sh` presses the remote keys on a schedule while it records, and logs each press time. One gotcha: a Swift script must touch `NSApplication.shared` first, or ScreenCaptureKit asserts in `CGS_REQUIRE_INIT`.
- **Suggestion:** `vega device screenrecord` (video + audio) for the VVD and for developer-mode devices.

### 10. A documented accessibility prop is missing from the types (Low, measured)
- **Task:** Give the story-card row orientation text for VoiceView, as the A11Y Compass KB recommends.
- **Actual:** `accessibilityOrientationText` is in the React Native for Vega system bundles, but neither `View` nor `TVFocusGuideView` declares it in the RN 0.83 TypeScript types, so `tsc` fails.
- **Workaround:** An untyped spread on a wrapping `View` (`app/src/screens/Cards.tsx`).
- **Suggestion:** Ship the Vega-specific accessibility props (`accessibilityOrientationText`, `accessibilityDescribedBy`) in the published types.

### 11. Can Alexa open a sideloaded Vega app? (Medium, test pending)
- **Task:** Make bedtime start by itself: an Alexa routine, scheduled at the planned time, says "Five minutes, then Bramble's coming", then opens Goodnight TV.
- **What we found:** Alexa routines support a schedule trigger and a Fire TV action with a typed command ("Open Goodnight TV"). Nothing in the Vega docs (Builder Tools search returned no result) says whether Alexa can resolve and launch a *sideloaded* Vega app by name, by voice or in a routine. One community report of an "open app" routine showing search results instead of the app.
- **Workaround:** The parent opens Goodnight TV with the remote (or by voice if it works).
- **Suggestion:** Document how a Vega app becomes launchable by Alexa (voice and routines), including for developer-mode sideloads, so bedtime-, alarm- and routine-style apps can start on schedule.
- **Evidence:** to be filled after the family test.

### 12. `Animated.multiply` is ignored in a native-driven transform (Medium, measured)
- **Task:** Move Bramble between spots: `transform: [{translateX: Animated.multiply(pos.x, u)}]` with `useNativeDriver: true`.
- **Expected:** The same as on iOS and Android: the node graph is sent to the native driver.
- **Actual:** On the VVD the translate had no effect at all: Bramble stayed at the origin on every screen (Oct 20, screenshots in our notes). No warning in the logs.
- **Workaround:** Keep the Animated values in pixels and pass them directly (`translateX: pos.x`).
- **Suggestion:** Support Animated arithmetic nodes in the Vega native driver, or warn when a transform falls back.

### 13. A full-bleed `Image` ignores edge anchoring and draws at its pixel size (Low, measured)
- **Task:** Show a 1920×1080 JPEG behind every screen: `<Image source={require('./tonight.jpg')} resizeMode="cover" style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0}} />`.
- **Expected:** As on iOS and Android, the image is sized by its four edges and covers the screen.
- **Actual:** On the VVD (SDK 0.24, RN 0.83) the image was drawn at 1920×1080 *layout units* (the screen is 960×540), so only the top-left quarter showed (Oct 20, one still before and after the fix).
- **Workaround:** Give the image an explicit `width` and `height` from `useWindowDimensions()`.
- **Suggestion:** Match upstream: size absolutely positioned images from their edge constraints, or document the difference on the Image page.

### 14. The TV keyboard's `auxOptions` is documented but not typed (Low, measured)
- **Task:** Give the on-screen keyboard a title for "Ask Bear for a sound": `<TextInput auxOptions="title:Describe tonight's sound" />`, as the Vega 0.83 TextInput page documents.
- **Expected:** It type-checks like the other documented props.
- **Actual:** `tsc` fails: "Property 'auxOptions' does not exist on type TextInputProps" (Oct 20). Same pattern as #10.
- **Workaround:** Spread it in untyped: `{...({auxOptions: '…'} as object)}`.
- **Suggestion:** Ship the Vega-only props (`auxOptions`, `keyboardUiMode`, `accessibilityOrientationText`) in the Vega type definitions.

### 15. A large WebSocket message arrives in pieces (High, measured)
- **Task:** Stream Bear's recorded voice from the home hub to the TV over a WebSocket: JSON messages of ~32 KB (`{type: 'voice', pcm: <base64>}`), then binary frames of ~24 KB.
- **Expected:** One `message` event per WebSocket message, as in browsers, iOS and Android RN (the protocol reassembles fragments).
- **Actual (VVD, SDK 0.24, RN 0.83, Oct 20):**
  - Text messages above ~10 KB reached `onmessage` as several partial strings. Every `JSON.parse` failed ("Unexpected character: B" / "o"), so no voice and no sound loops ever played, with no error shown. Our telemetry counted 82 failures for one short line.
  - Binary frames (after `binaryType = 'arraybuffer'`) arrived as `ArrayBuffer` pieces of ~10,068 bytes ("Unexpected end of input").
  - Small messages (settings, captions) were fine, which hid the bug.
- **Workaround:**
  - Audio goes as binary frames that carry their own length (`'GNTV'` + u32 length + header + PCM).
  - The app joins the pieces as a byte stream and cuts complete frames back out. After the fix: 11 frames, 0 errors, 126,417 of 126,417 samples played.
  - Also: `binaryType` is missing from Vega's WebSocket types (set untyped).
- **Suggestion:** Reassemble fragmented messages in the Vega WebSocket before dispatching (per RFC 6455), or document a maximum message size. Add `binaryType` to the types.

### 16. ◀ ▶ on a custom control also move focus (Medium, measured)
- **Task:** A volume slider for each sound layer (Sounds screen): focus it, then ◀ ▶ change the level, as on every TV settings screen.
- **Steps:** A `Pressable` slider, with `useTVEventHandler` changing the value on `left`/`right` (key down) while it is focused.
- **Expected:** The focused control handles ◀ ▶, and focus stays on it.
- **Actual (VVD, Oct 21):** Each press did both. The first ▶ raised "Rain on the window" from 0.75 to 0.9 **and** moved focus up-right to "Make it"; the second ▶ moved focus on to the "Quiet" preset. ◀ on a slider lowered the level and jumped focus to the Rain preset. The user reported it as "the volume setter jumps to another component when clicking twice".
  - `useTVEventHandler` is a global listener. Nothing lets a component mark a key as handled, and there is no `onKeyDown` / `preventDefault` on Vega's `Pressable`.
- **Workaround:** Wrap each slider (and our ◀ ▶ layer chooser) in `<TVFocusGuideView trapFocusLeft trapFocusRight>`. With one child, focus can't leave sideways, ▲ ▼ still move between rows, and the global handler still sees ◀ ▶. `trapFocus*` appears in the TV types with only "see README".
- **Suggestion:** Give focusable components a key callback that can return "handled" (as Android's `onKeyDown` does), or document the `TVFocusGuideView` trap as the pattern for sliders, steppers and pickers, with an example.

### 17. A VVD audio stream ran at ~4% of real time, silently (High, measured)
- **Task:** Play Bear's voice (24 kHz mono PCM, `AudioPlaybackStream.writeAsync`, 40 ms chunks, ~240 ms ahead).
- **Expected:** Real-time playback, as in the previous session (Oct 20, 18:22: median 23,952 samples/s, 0 resyncs). If the device can't keep up: underruns or an error.
- **Actual (VVD session started Oct 21 ~09:05, Mac on wired headphones and ~6.7 GB of swap):**
  - Every voice line played at **~930 samples/s**, about one 960-sample chunk per second, on every screen, including the idle Tonight screen.
  - `writeAsync` simply returned late. `getUnderrunCountAsync()` stayed **0** the whole time, and nothing was logged.
  - `pauseAsync`/`flushAsync`/`stopAsync` waited behind the blocked writes (a flush took ~35 s). Our routine awaited the flush after "We're done", so the child's press seemed to do nothing. Our telemetry, which awaited the underrun count, arrived late and in bursts.
  - Restarting the VVD fixed it: the next line played 194,799 of 194,799 samples in ~8 s, with 0 resyncs. We did not isolate the trigger (a host audio-device change and host memory pressure are both candidates).
- **Workaround:**
  - The app never waits on the native stream for more than a moment: flush ≤ 300 ms, stop ≤ 1.5 s, underrun query ≤ 500 ms.
  - A line counts as heard once its own length + 2 s has passed.
  - `start()`/`stopAll()` are serialized, so a quick Back → Start can't leave the evening with no streams.
- **Suggestion:** Count a write that blocks past its deadline as an underrun (or emit a "stalled" event). Don't queue control calls (pause, flush, stop) behind pending writes. Have the VVD follow host audio-device changes, or log when its audio backend falls behind.

### 18. No on-screen keyboard for `TextInput` on the VVD (Low, measured on the VVD only)
- **Task:** "Ask for any sound" on the Sounds screen: focus the text box, press OK, type "crickets and a campfire".
- **Expected:** The system TV keyboard opens (titled by `auxOptions`, #14).
- **Actual (VVD, Oct 21):** OK put a caret in the field, but no keyboard appeared within 5 s. Text did arrive through `vega exec vda shell "inputd-cli send_text '…'"`, and the rest of the flow worked (Nova mixed "Crickets by Campfire"). Not yet checked on the stick.
- **Suggestion:** Show the keyboard on the VVD, or say in the VVD docs that text input is via the host keyboard or `inputd-cli send_text` only.

### 19. Leaving a text field with the D-pad goes somewhere unexpected (Medium, measured on the VVD)
- **Task:** On the Sounds screen, the ask box is on a row with "Make it" right beside it. Type the words, press ▶ to reach "Make it", press OK.
- **Expected:** ▶ leaves the text field for the nearest control to the right ("Make it", same row, ~10 units away).
- **Actual (VVD, Oct 21; key log in the hub evidence, 11:54:46–11:54:59 UTC):**
  - With the text typed, the first ▶ was taken by the field (the caret).
  - The second ▶ moved focus **up and right to the "Quiet" preset tile**, a row above, skipping "Make it". OK then selected Quiet: the parent's mix was replaced by silence and nothing was asked.
  - In an earlier session on the same screen, a single ▶ went straight to "Make it". The same layout behaves differently depending on the caret's state.
- **Workaround:** Put the field and its button in one `<TVFocusGuideView trapFocusRight>`, so ▶ from the field can only land on "Make it".
- **Suggestion:** Document how a focused `TextInput` consumes ◀ ▶ (caret first? only at the ends?). When focus leaves a field, prefer the nearest control on the same row, as the Cartesian rules for other views do.

