# Goodnight TV

**The TV that puts your kids to bed.** A bedtime routine for Fire TV (Vega OS): a calm voice walks the child through teeth, pajamas, the big light and a story, while a candle burns for exactly tonight's routine and the screen dims itself to black. No next episode.

Demo video (under 3 min): https://www.youtube.com/watch?v=FqS5VNkX7mQ

Built for the Amazon "Build, Ship, Shape" hackathon, Fire TV track. Vega developer friction found along the way: [friction-log.md](friction-log.md). The research behind the idea: [CONCEPT.md](CONCEPT.md).

## What's here
| Folder | What it is |
|---|---|
| `app/` | The TV app: React Native for Vega 0.83 (Vega SDK 0.24), package `com.goodnighttv.app` |
| `server/` | A small hub on the home network: records Bear's lines once with Amazon Polly (voice Amy) and caches them, streams voice and sound loops to the TV, mixes "ask for any sound" with Amazon Nova, keeps a log of the night |
| `design/simple/` | The six-panel design the app was built from |
| `design/sounds/CREDITS.md` | Sources and licenses of the field recordings |

### In the app (`app/src`)
- `App.tsx`: the evening as one async script (Tonight → steps → story → the candle finale), lifecycle, Back, telemetry.
- `light.ts`: the light curve. Everything (veil, amber, the candle's glow, the darkness gathering) follows how far the candle has burned.
- `ui/candle.tsx`: the candle, drawn in code; the flicker is a pre-computed loop on the native animation driver.
- `audio/engine.ts`: two raw-PCM streams (`keplerscript-audio-lib`): voice, and a bed that mixes the sound layers.
- `screens/`: Tonight, Step, StoryTime, Goodnight, Setup, Sounds (and a Light lab for tuning).
- `ui/kit.tsx`: Scene, Button, Toggle, Slider (holds ◀ ▶ with `TVFocusGuideView`), Chooser.

## Run the hub
```sh
cd server && npm install
cp .env.example .env   # NOVA_API_KEY=… (Amazon Nova API key, for "ask for any sound")
node --env-file=.env index.js
```
- Bear's voice uses Amazon Polly through your AWS credentials (`aws login`). Every line is recorded once into `server/cache/voice/`; bedtime only plays from that cache. Without Polly, new lines fall back to the Mac voice "Daniel" and Polly is retried every 5 minutes.
- Sound loops: put the source recordings listed in `design/sounds/CREDITS.md` under `design/sounds/commons/raw/`, then `node tools/loops.js` (writes `server/cache/loops/`). White, pink and brown noise are generated on the TV and need nothing.
- Optional: `GEMINI_API_KEY` lets a musical wish ("a soft piano") be composed by Lyria; everything else works without it.
- The app runs without the hub too, just without the voice and the recorded sounds.

## Build and run on the Vega Virtual Device
```sh
cd app && npm install
npm run build:release                 # build/{x86_64,armv7,aarch64}-release/*.vpkg
vega virtual-device start
vega device install-app -p build/aarch64-release/goodnighttv_aarch64.vpkg   # Apple Silicon
vega device launch-app -a com.goodnighttv.app.main
```
- The app finds the hub at `10.0.2.2:8790` (the Mac, from the Virtual Device) or `127.0.0.1:8790`. Add your hub's LAN address to `SERVERS` in `app/src/config.ts` to use a Fire TV Stick over Wi-Fi.
- `DEMO = true` in `app/src/config.ts` runs step timers 10× faster (for filming). It's `false` for real bedtimes.
- On a Mac with 8 GB of RAM, build with the Virtual Device stopped.

## Fire TV Stick (Vega OS)
```sh
vega exec vda connect <stick-ip>:5555        # Developer options → Connection mode: TCP/IP
vega device install-app -d <stick-ip>:5555 -p build/armv7-release/goodnighttv_armv7.vpkg
vega device launch-app  -d <stick-ip>:5555 -a com.goodnighttv.app.main
```
Over USB, let the stick reach the hub with `vega exec vda -s <serial> reverse tcp:8790 tcp:8790`.

## Tests
```sh
cd app && npx tsc --noEmit -p . && npx jest     # 17 tests
cd server && npm test                          # 8 tests
```

## Credits
- Art: storybook scenes made with an image model from my own design boards (an original character), with light and motion layered on top in code.
- Voice: Amazon Polly, generative voice "Amy".
- Field recordings: Wikimedia Commons, see `design/sounds/CREDITS.md`.
- Fonts: Fredoka and Nunito (SIL Open Font License, `app/assets/fonts/OFL.txt`).

MIT License, see [LICENSE](LICENSE).
