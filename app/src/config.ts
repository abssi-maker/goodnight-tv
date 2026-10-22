// Where the hub lives, tried in turn until one answers:
//   10.0.2.2  the Mac, seen from the Vega Virtual Device (QEMU's host alias)
//   127.0.0.1 the Mac, seen from a Fire TV Stick on USB after `vda reverse tcp:8790 tcp:8790`
// Add the hub's LAN address here to use the stick over Wi-Fi.
// The hub only gives Bear his voice (recorded once, cached) and logs the night; without it the app
// still runs the whole routine with captions.
export const SERVERS = ['ws://10.0.2.2:8790', 'ws://127.0.0.1:8790'];

// Demo mode runs the step timers 10× faster (a 2-minute brush passes in 12 s) for filming.
// Off for real bedtimes.
export const DEMO = true; // DEMO BUILD for the video: set back to false after recording
export const TIME_SCALE = DEMO ? 10 : 1;

// Testing: open the Light lab at launch (the candle and the light curve, with controls). Off for
// real use; "Open app" in the lab goes to Tonight.
export const LAB = false;

// Seconds the goodnight screen takes to fade to black.
export const GOODNIGHT_FADE_S = DEMO ? 12 : 40;

// Tonight's sound fades out this long after goodnight, when the grown-up chose "Fade out".
export const FADE_OUT_MIN = 20;
