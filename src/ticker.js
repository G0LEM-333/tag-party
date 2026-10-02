// Background ticker for game.js (keepRunning). It lives in a Web Worker because a worker's timers keep running at full speed while the
// page is hidden or minimised, whereas timers (and animation frames) on the page itself are slowed down or stopped completely.
// All it does is nudge the page ~60 times a second; the page decides whether the game actually needs a step.
setInterval(() => postMessage(0), 16);
