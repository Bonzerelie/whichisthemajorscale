/* /script.js
   Which is the Major Scale?
   - Uses the same keyboard/audio template as the existing game.
   - Requires a user gesture to start audio (Begin Game button).
*/
(() => {
  "use strict";

  const AUDIO_DIR = "audio";

  // Playback timing (seconds)
  const NOTE_GAP_SEC = 0.30;     // onset-to-onset gap
  const NOTE_HOLD_SEC = 0.50;    // full level hold (per note)
  const NOTE_FADEIN_SEC = 0.01;  // fade in (per note)
  const NOTE_FADE_SEC = 0.40;    // fade to silence (per note)
  const START_LEAD_SEC = 0.06;   // tiny lead-in so UI can update
  const STOP_FADE_SEC = 0.06;

  // Keyboard rendering
  const OUTER_H = 320;
  const BORDER_PX = 19;

  const WHITE_W = 40;
  const WHITE_H = OUTER_H - (BORDER_PX * 2);
  const BLACK_W = Math.round(WHITE_W * 0.62);
  const BLACK_H = Math.round(WHITE_H * 0.63);

  const RADIUS = 18;
  const WHITE_CORNER_R = 10;

  // Scale highlight colors (match CSS)
  const SCALE1_COLOR = "#2b8cff";
  const SCALE2_COLOR = "#ff4da3";

  // Keyboard highlight fade (seconds) – separate from audio envelope; purely visual.
  const KEY_FLASH_TOTAL_SEC = 1.85;

  const LIMITER_THRESHOLD_DB = -6;

  const PC_TO_STEM = {
    0: "c",
    1: "csharp",
    2: "d",
    3: "dsharp",
    4: "e",
    5: "f",
    6: "fsharp",
    7: "g",
    8: "gsharp",
    9: "a",
    10: "asharp",
    11: "b",
  };

  const PC_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const PC_NAMES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

  const KEYBOARD_PRESETS = {
    "4oct-c2": { startOctave: 2, octaves: 4, endOnFinalC: true },
  };

  const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12]; // TTSTTTS

  const MILESTONES = new Map([
    [5,  "5 correct in a row! Nicely done. Can you get to 10?! 🧐"],
    [10, "10 correct! 🥳 Great work, you know your major scales! Will you get to 15?!"],
    [15, "That's 15 correct! Brilliant! 👏🫡 Next is 20 - can you do it?!"],
    [20, "Awesome! 20 correct in a row! 😊👏🎉 Colour me impressed. You're definitely ready to move onto the next game!"],
    [30, "30 in a row correct!!! ✅ 🥳 You're still going?! You're definitely good enough to move on, but you are the master of your own fate. Either way, I commend your dedication to Major scale identification 😌 There are no popup milestones after this, but know that the ear training lab is ever grateful for your presence and your perseverance 🫡 Thanks and Happy Training!"],
  ]);

  const $ = (id) => document.getElementById(id);

  const mount = $("mount");

  const beginBtn = $("beginBtn");
  const playScale1Btn = $("playScale1Btn");
  const playScale2Btn = $("playScale2Btn");
  const playReferenceBtn = $("playReferenceBtn");
  const answerScale1Btn = $("answerScale1Btn");
  const answerScale2Btn = $("answerScale2Btn");
  const rootModeSel = $("rootMode");

  const downloadScoreBtn = $("downloadScoreBtn");

  const feedbackOut = $("feedbackOut");
  const scoreOut = $("scoreOut");
  const questionHint = $("questionHint");

  const streakModal = $("streakModal");
  const modalTitle = $("modalTitle");
  const modalBody = $("modalBody");
  const modalClose = $("modalClose");
  const modalDownload = $("modalDownload");
  const infoBtn = $("infoBtn");


  // Safety: if HTML/JS mismatch, fail loudly in UI.
  if (
    !mount ||
    !beginBtn || !playScale1Btn || !playScale2Btn || !playReferenceBtn ||
    !answerScale1Btn || !answerScale2Btn || !rootModeSel ||
    !downloadScoreBtn || !feedbackOut || !scoreOut ||
    !streakModal || !modalTitle || !modalBody || !modalClose || !modalDownload
  ) {
    const msg = "UI mismatch: required elements are missing. Ensure index.html matches script.js.";
    if (feedbackOut) feedbackOut.textContent = msg;
    else alert(msg);
    return;
  }

  // ---------- iframe sizing + scroll forwarding (template compatibility) ----------

  let lastHeight = 0;

  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const height = Math.ceil(entry.contentRect.height);
      if (height !== lastHeight) {
        parent.postMessage({ iframeHeight: height }, "*");
        lastHeight = height;
      }
    }
  });

  ro.observe(document.documentElement);

  function postHeightNow() {
    try {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      );
      parent.postMessage({ iframeHeight: h }, "*");
    } catch {}
  }

  window.addEventListener("load", () => {
    postHeightNow();
    setTimeout(postHeightNow, 250);
    setTimeout(postHeightNow, 1000);
  });

  window.addEventListener("orientationchange", () => {
    setTimeout(postHeightNow, 100);
    setTimeout(postHeightNow, 500);
  });

  function enableScrollForwardingToParent() {
    const SCROLL_GAIN = 6.0;

    const isVerticallyScrollable = () =>
      document.documentElement.scrollHeight > window.innerHeight + 2;

    const isInteractiveTarget = (t) =>
      t instanceof Element && !!t.closest("button, a, input, select, textarea, label");

    const isInPianoStrip = (t) =>
      t instanceof Element && !!t.closest("#mount, .mount, svg, .key");

    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lockedMode = null;

    let lastMoveTs = 0;
    let vScrollTop = 0;

    window.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.target;

      lockedMode = null;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastY = startY;

      lastMoveTs = e.timeStamp || performance.now();
      vScrollTop = 0;

      if (isInteractiveTarget(t) || isInPianoStrip(t)) lockedMode = "x";
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      if (isVerticallyScrollable()) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;

      const dx = x - startX;
      const dy = y - startY;

      if (!lockedMode) {
        if (Math.abs(dy) > Math.abs(dx) + 4) lockedMode = "y";
        else if (Math.abs(dx) > Math.abs(dy) + 4) lockedMode = "x";
        else return;
      }
      if (lockedMode !== "y") return;

      const nowTs = e.timeStamp || performance.now();
      const dt = Math.max(8, nowTs - lastMoveTs);
      lastMoveTs = nowTs;

      const fingerStep = (y - lastY) * SCROLL_GAIN;
      lastY = y;

      const scrollTopDelta = -fingerStep;

      const instV = scrollTopDelta / dt;
      vScrollTop = vScrollTop * 0.75 + instV * 0.25;

      e.preventDefault();
      parent.postMessage({ scrollTopDelta }, "*");
    }, { passive: false });

    function endGesture() {
      if (lockedMode === "y" && Math.abs(vScrollTop) > 0.05) {
        const capped = Math.max(-5.5, Math.min(5.5, vScrollTop));
        parent.postMessage({ scrollTopVelocity: capped }, "*");
      }
      lockedMode = null;
      vScrollTop = 0;
    }

    window.addEventListener("touchend", endGesture, { passive: true });
    window.addEventListener("touchcancel", endGesture, { passive: true });

    window.addEventListener("wheel", (e) => {
      if (isVerticallyScrollable()) return;
      parent.postMessage({ scrollTopDelta: e.deltaY }, "*");
    }, { passive: true });
  }

  enableScrollForwardingToParent();

  // ---------- state ----------

  let svg = null;
  const pitchToKey = new Map();
  let allPitches = [];

  let started = false;
  let isPlaying = false;
  let playingOwnerToken = null; // token that currently owns isPlaying state


  const score = { asked: 0, correct: 0, streak: 0, longestStored: 0 };

  let currentQuestion = null; // { scale1, scale2, majorIndex, majorName }
  let milestonesEnabled = true;

  // Feedback popup mode (visual). The aria-live region (#feedbackOut) is kept for screen readers.
  const USE_FEEDBACK_POPUP = true;
  const FEEDBACK_POPUP_AUTOCLOSE_MS = 0; // set to 0 to require manual close
  let feedbackPopupTimer = null;
  let feedbackModalActive = false;

  // playback cancellation
  let playbackToken = 0;
  const playbackTimers = new Set();

  // ---------- audio ----------

  let audioCtx = null;
  let masterGain = null;
  let limiter = null;

  const bufferPromiseCache = new Map();
  const activeVoices = new Set();

  function ensureAudioGraph() {
    if (audioCtx) return audioCtx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      alert("Your browser doesn’t support Web Audio (required for playback).");
      return null;
    }

    audioCtx = new Ctx();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.92;

    limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = LIMITER_THRESHOLD_DB;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;

    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);

    return audioCtx;
  }

  async function resumeAudioIfNeeded() {
    const ctx = ensureAudioGraph();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
  }

  function trackVoice(src, gain, startTime) {
    const voice = { src, gain, startTime };
    activeVoices.add(voice);
    src.onended = () => activeVoices.delete(voice);
    return voice;
  }

  function stopAllNotes(fadeSec = STOP_FADE_SEC) {
    const ctx = ensureAudioGraph();
    if (!ctx) return;

    const now = ctx.currentTime;
    const fade = Math.max(0.01, Number.isFinite(fadeSec) ? fadeSec : STOP_FADE_SEC);

    for (const v of Array.from(activeVoices)) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setTargetAtTime(0, now, fade / 6);
        const stopAt = Math.max(now + fade, (v.startTime || now) + 0.001);
        v.src.stop(stopAt + 0.02);
      } catch {}
    }
  }

  function noteUrl(stem, octaveNum) {
    return `${AUDIO_DIR}/${stem}${octaveNum}.mp3`;
  }

  function loadBuffer(url) {
    if (bufferPromiseCache.has(url)) return bufferPromiseCache.get(url);

    const p = (async () => {
      const ctx = ensureAudioGraph();
      if (!ctx) return null;

      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return await ctx.decodeAudioData(ab);
      } catch {
        return null;
      }
    })();

    bufferPromiseCache.set(url, p);
    return p;
  }

  function playVoiceAt(buffer, whenSec, { gain = 1, holdSec = NOTE_HOLD_SEC, fadeSec = NOTE_FADE_SEC } = {}) {
    const ctx = ensureAudioGraph();
    if (!ctx || !masterGain) return null;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const g = ctx.createGain();
    const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 1);

    const fadeIn = Math.max(0.01, NOTE_FADEIN_SEC);
    const hold = Math.max(0.02, Number.isFinite(holdSec) ? holdSec : NOTE_HOLD_SEC);
    const fade = Math.max(0.02, Number.isFinite(fadeSec) ? fadeSec : NOTE_FADE_SEC);

    g.gain.setValueAtTime(0, whenSec);
    g.gain.linearRampToValueAtTime(safeGain, whenSec + fadeIn);
    g.gain.setValueAtTime(safeGain, whenSec + hold);
    g.gain.linearRampToValueAtTime(0, whenSec + hold + fade);

    src.connect(g);
    g.connect(masterGain);
    trackVoice(src, g, whenSec);

    src.start(whenSec);
    src.stop(whenSec + hold + fade + 0.05);
    return src;
  }

  // ---------- pitch helpers ----------

  function pitchFromPcOct(pc, oct) { return (oct * 12) + pc; }
  function pcFromPitch(pitch) { return ((pitch % 12) + 12) % 12; }
  function getStemForPc(pc) { return PC_TO_STEM[(pc + 12) % 12] || null; }

  function pcName(pc) {
    const isAcc = [1, 3, 6, 8, 10].includes(pc);
    return isAcc ? `${PC_NAMES_SHARP[pc]} / ${PC_NAMES_FLAT[pc]}` : PC_NAMES_SHARP[pc];
  }

  function majorNameFromRootPitch(rootPitch) {
    return `${pcName(pcFromPitch(rootPitch))} Major`;
  }

  // ---------- UI helpers ----------

  function setResult(html) {
    const safe = html || "";
    feedbackOut.innerHTML = safe ? `<span class="feedbackMsg">${safe}</span>` : "";
  }

  function scorePercent() {
    if (score.asked <= 0) return 0;
    return Math.round((score.correct / score.asked) * 1000) / 10;
  }

  function displayLongest() {
    return Math.max(score.longestStored, score.streak);
  }

  function renderScore() {
    const items = [
      ["Questions asked", score.asked],
      ["Answers correct", score.correct],
      ["Correct in a row", score.streak],
      ["Longest correct streak", displayLongest()],
      ["Percentage correct", `${scorePercent()}%`],
    ];

    scoreOut.innerHTML =
      `<div class="scoreGrid">` +
      items.map(([k, v]) =>
        `<div class="scoreItem"><span class="scoreK">${k}</span><span class="scoreV">${v}</span></div>`
      ).join("") +
      `</div>`;
  }

  function showPopup(title, message, { showDownload = false } = {}) {
    feedbackModalActive = true;
    setControlsEnabled();

    modalTitle.textContent = title;
    modalBody.textContent = message;
    modalDownload.classList.toggle("hidden", !showDownload);
    streakModal.classList.remove("hidden");
    modalClose.focus();
  }

  function hidePopup() {
    streakModal.classList.add("hidden");
    if (feedbackPopupTimer) { clearTimeout(feedbackPopupTimer); feedbackPopupTimer = null; }
    feedbackModalActive = false;
    setControlsEnabled();
  }

  function showFeedbackPopup(title, message) {
    if (!USE_FEEDBACK_POPUP) return;
    if (feedbackPopupTimer) { clearTimeout(feedbackPopupTimer); feedbackPopupTimer = null; }
    feedbackModalActive = true;
    showPopup(title, message, { showDownload: false });
    setControlsEnabled();
    if (FEEDBACK_POPUP_AUTOCLOSE_MS > 0) {
      feedbackPopupTimer = setTimeout(() => {
        hidePopup();
      }, FEEDBACK_POPUP_AUTOCLOSE_MS);
    }
  }

  function setControlsEnabled() {
    const hasQ = !!currentQuestion;

    playScale1Btn.disabled = !started || !hasQ || isPlaying || feedbackModalActive;
    playScale2Btn.disabled = !started || !hasQ || isPlaying || feedbackModalActive;
    playReferenceBtn.disabled = !started || isPlaying;

    answerScale1Btn.disabled = !started || !hasQ || isPlaying;
    answerScale2Btn.disabled = !started || !hasQ || isPlaying;

    downloadScoreBtn.disabled = !started;
  }

  function updateBeginButton() {
    beginBtn.textContent = started ? "Restart Game" : "Begin Game";
    beginBtn.classList.toggle("pulse", !started);
  }

  function applyGlobalCssVars() {
    document.documentElement.style.setProperty("--scale1", SCALE1_COLOR);
    document.documentElement.style.setProperty("--scale2", SCALE2_COLOR);
    document.documentElement.style.setProperty("--scale1RGBA", hexToRgba(SCALE1_COLOR, 0.32));
    document.documentElement.style.setProperty("--scale2RGBA", hexToRgba(SCALE2_COLOR, 0.32));
  }

  // ---------- keyboard highlights ----------

  function clearAllKeyFlashes() {
    if (!svg) return;
    for (const k of svg.querySelectorAll(".key.flash1, .key.flash2")) {
      k.classList.remove("flash1", "flash2");
      try { delete k.dataset.flashToken; } catch {}
    }
  }

  function clearFlashTimers() {
    for (const t of Array.from(playbackTimers)) {
      clearTimeout(t);
      playbackTimers.delete(t);
    }
    clearAllKeyFlashes();
  }

  function flashKey(pitch, token, whichScale) {
    if (!svg) return;
    const k = pitchToKey.get(pitch);
    if (!k) return;

    const cls = whichScale === 2 ? "flash2" : "flash1";

    // Mark this key with the current flash token so stale timers can't "win".
    try { k.dataset.flashToken = String(token ?? ""); } catch {}

    k.classList.remove("flash1", "flash2");
    // Force style flush for SVG so re-adding the same class reliably restarts animations.
    try { void k.getBoundingClientRect(); } catch {}
    k.classList.add(cls);

    const t = setTimeout(() => {
      try {
        // Only remove if this timeout still corresponds to the last flash we applied to this key.
        if (String(k.dataset.flashToken || "") !== String(token ?? "")) return;
        k.classList.remove("flash1", "flash2");
        try { delete k.dataset.flashToken; } catch {}
      } finally {
        playbackTimers.delete(t);
      }
    }, Math.round(KEY_FLASH_TOTAL_SEC * 1000));
    playbackTimers.add(t);
  }

  // ---------- scale generation ----------

  function randomInt(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function pickRandomRootPitchInRange(minP, maxRoot) {
    return randomInt(minP, maxRoot);
  }

  function buildMajorScale(rootPitch) {
    return MAJOR_OFFSETS.map((o) => rootPitch + o);
  }

  function buildNearMajorScale(rootPitch, minPitch, maxPitch) {
    const degrees = [1, 2, 3, 4, 5, 6]; // never alter root (0) or octave (7)
    const base = MAJOR_OFFSETS;

    for (let attempt = 0; attempt < 300; attempt++) {
      const offsets = base.slice();

      const wantTwo = Math.random() < 0.35;
      const n = wantTwo ? 2 : 1;

      const chosen = [];
      while (chosen.length < n) {
        const d = degrees[randomInt(0, degrees.length - 1)];
        if (!chosen.includes(d)) chosen.push(d);
      }

      for (const idx of chosen) {
        const shift = Math.random() < 0.5 ? -1 : 1;
        offsets[idx] = offsets[idx] + shift;
      }

      let ok = true;
      for (let i = 1; i < offsets.length; i++) {
        if (offsets[i] <= offsets[i - 1]) { ok = false; break; }
      }
      if (!ok) continue;

      const pitches = offsets.map((o) => rootPitch + o);

      if (pitches[0] < minPitch || pitches[pitches.length - 1] > maxPitch) continue;

      const s = new Set(pitches);
      if (s.size !== pitches.length) continue;

      let sameAsMajor = true;
      for (let i = 0; i < base.length; i++) {
        if (offsets[i] !== base[i]) { sameAsMajor = false; break; }
      }
      if (sameAsMajor) continue;

      return pitches;
    }

    const fallback = MAJOR_OFFSETS.slice();
    fallback[2] = 3;
    return fallback.map((o) => rootPitch + o);
  }

  function generateQuestion() {
    if (!allPitches.length) return null;

    const minPitch = allPitches[0];
    const maxPitch = allPitches[allPitches.length - 1];
    const maxRoot = maxPitch - 12;
    if (maxRoot < minPitch) return null;

    const sameRoot = rootModeSel.value === "same";

    const rootMajor = pickRandomRootPitchInRange(minPitch, maxRoot);

    let rootNear = rootMajor;
    if (!sameRoot) {
      for (let i = 0; i < 40; i++) {
        const r = pickRandomRootPitchInRange(minPitch, maxRoot);
        if (r !== rootMajor) { rootNear = r; break; }
      }
    }

    const majorScale = buildMajorScale(rootMajor);
    const nearScale = buildNearMajorScale(rootNear, minPitch, maxPitch);

    const majorName = majorNameFromRootPitch(rootMajor);

    const majorIsScale1 = Math.random() < 0.5;
    const scale1 = majorIsScale1 ? majorScale : nearScale;
    const scale2 = majorIsScale1 ? nearScale : majorScale;

    return {
      scale1,
      scale2,
      majorIndex: majorIsScale1 ? 1 : 2,
      majorName,
      sameRoot,
      rootMajor,
      rootNear,
    };
  }

  // ---------- playback ----------

  async function loadScaleBuffers(pitches) {
    const bufs = [];
    for (const pitch of pitches) {
      const key = pitchToKey.get(pitch);
      if (!key) return null;

      const pc = Number(key.getAttribute("data-pc"));
      const oct = Number(key.getAttribute("data-oct"));
      const stem = getStemForPc(pc);
      if (!stem) return null;

      const url = noteUrl(stem, oct);
      const buf = await loadBuffer(url);
      if (!buf) return { missingUrl: url };

      bufs.push({ pitch, buf });
    }
    return { bufs };
  }

  async function playScale(pitches, labelForFeedback, whichScale) {
    if (!started) return;
    const ctx = ensureAudioGraph();
    if (!ctx) return;

    await resumeAudioIfNeeded();

    const token = ++playbackToken;

    // Cancel any pending visuals from a previous playback attempt.
    clearFlashTimers(); // also clears any stuck flash classes
    stopAllNotes(0.10);

    isPlaying = true;
    playingOwnerToken = token;
    setControlsEnabled();

    setResult(`Playing <strong>${labelForFeedback}</strong>…`);

    try {
      const loaded = await loadScaleBuffers(pitches);
      if (!loaded || loaded.missingUrl) {
        setResult(`Missing audio: <code>${loaded?.missingUrl || "unknown"}</code>`);
        return;
      }

      const { bufs } = loaded;

      const startCtx = ctx.currentTime + START_LEAD_SEC;
      const startWall = performance.now();
      const startCtxAtWall = ctx.currentTime;

      for (let i = 0; i < bufs.length; i++) {
        const when = startCtx + (i * NOTE_GAP_SEC);
        playVoiceAt(bufs[i].buf, when, { gain: 1, holdSec: NOTE_HOLD_SEC, fadeSec: NOTE_FADE_SEC });

        const ms = Math.max(0, (when - startCtxAtWall) * 1000);
        const t = setTimeout(() => {
          // If a newer playback started, don't flash this note.
          if (token !== playbackToken) return;
          flashKey(bufs[i].pitch, token, whichScale);
        }, ms);
        playbackTimers.add(t);
      }

      const totalSec = ((bufs.length - 1) * NOTE_GAP_SEC) + NOTE_HOLD_SEC + NOTE_FADE_SEC + 0.15;
      const finishMs = Math.max(0, totalSec * 1000 - (performance.now() - startWall));
      await new Promise((r) => setTimeout(r, finishMs));

      if (token !== playbackToken) return; // cancelled/overridden

      setResult("Which was the Major scale? Choose <strong>Scale 1</strong> or <strong>Scale 2</strong>.");
    } finally {
      // Only the most recent playScale call is allowed to re-enable controls.
      if (playingOwnerToken === token) {
        isPlaying = false;
        playingOwnerToken = null;
        setControlsEnabled();
      }
    }
  }

  async function playScale1() {
    if (!currentQuestion) return;
    await playScale(currentQuestion.scale1, "Scale 1", 1);
  }

  async function playScale2() {
    if (!currentQuestion) return;
    await playScale(currentQuestion.scale2, "Scale 2", 2);
  }

  async function playReferenceCMajor() {
    const root = pitchFromPcOct(0, 4); // C4
    const pitches = buildMajorScale(root);
    await playScale(pitches, "C Major (C4)", 1);
  }

  // ---------- answering ----------

  function considerMilestonePopup() {
    if (!milestonesEnabled) return;
    const msg = MILESTONES.get(score.streak);
    if (!msg) return;

    showPopup("Milestone!", msg, { showDownload: false });

    if (score.streak >= 30) milestonesEnabled = false;
  }

  function answer(whichScale) {
    if (!started || !currentQuestion || isPlaying) return;

    score.asked += 1;

    const correctScale = currentQuestion.majorIndex;
    const isCorrect = whichScale === correctScale;

    if (isCorrect) {
      score.correct += 1;
      score.streak += 1;
      score.longestStored = Math.max(score.longestStored, score.streak);

      const msg = `Correct! ✅ Scale ${correctScale} was the ${currentQuestion.majorName} scale.`;
      setResult(`Correct! <span class="resultIcon" aria-hidden="true">✅</span> Scale ${correctScale} was the <strong>${currentQuestion.majorName}</strong> scale.`);
      showFeedbackPopup("Correct!", msg);
      considerMilestonePopup();
    } else {
      score.streak = 0;
      const msg = `Incorrect ❌ Scale ${correctScale} was the ${currentQuestion.majorName} scale.`;
      setResult(`Incorrect <span class="resultIcon" aria-hidden="true">❌</span> Scale ${correctScale} was the <strong>${currentQuestion.majorName}</strong> scale.`);
      showFeedbackPopup("Incorrect", msg);
    }

    renderScore();

    currentQuestion = generateQuestion();
    if (questionHint) {
      questionHint.textContent = currentQuestion?.sameRoot
        ? "Both scales start on the same root for this question."
        : "Scales may start on different roots for this question.";
    }
    setControlsEnabled();
  }

  // ---------- PNG downloads ----------

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  function drawCardBase(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfbfc";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = "#111";
    ctx.fillRect(8, 8, w - 16, 74);
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  }

  function getPlayerName() {
    const prev = localStorage.getItem("ms_player_name") || "";
    const name = window.prompt("Enter your name for the score card:", prev) ?? "";
    const trimmed = String(name).trim();
    if (trimmed) localStorage.setItem("ms_player_name", trimmed);
    return trimmed || "Player";
  }

  async function downloadScoreCardPng(playerName) {
    const w = 620;
    const h = 520;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawCardBase(ctx, w, h);

    ctx.fillStyle = "#fff";
    ctx.font = "900 28px Arial";
    ctx.fillText("Which is the Major Scale? — Scorecard", 28, 56);

    const bodyX = 28;
    const bodyY = 130;

    ctx.fillStyle = "#111";
    ctx.font = "900 22px Arial";
    ctx.fillText("Summary", bodyX, bodyY);

    ctx.font = "700 20px Arial";
    const lines = [
      `Name: ${playerName}`,
      `Root note mode: ${rootModeSel.value === "same" ? "Same root" : "Different roots"}`,
      `Questions asked: ${score.asked}`,
      `Answers correct: ${score.correct}`,
      `Correct in a row: ${score.streak}`,
      `Longest correct streak: ${displayLongest()}`,
      `Percentage correct: ${scorePercent()}%`,
    ];

    let y = bodyY + 44;
    for (const ln of lines) {
      ctx.fillText(ln, bodyX, y);
      y += 34;
    }

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "700 16px Arial";
    ctx.fillText("Downloaded from www.eartraininglab.com 🎶", bodyX, h - 36);

    const blob = await canvasToPngBlob(canvas);
    if (blob) downloadBlob(blob, "Which is the Major Scale - Scorecard.png");
  }

  async function downloadRecordPng(streakValue, playerName) {
    const w = 980;
    const h = 420;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawCardBase(ctx, w, h);

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px Arial";
    ctx.fillText("Which is the Major Scale? — Record", 28, 56);

    ctx.fillStyle = "#111";
    ctx.font = "900 28px Arial";
    ctx.fillText(`${streakValue} correct in a row!`, 28, 142);

    ctx.font = "700 22px Arial";
    ctx.fillStyle = "#111";
    const msg = `${playerName} just scored ${streakValue} correct answers in a row on the "Which is the Major Scale?" game 🎉🎶🥳`;
    drawWrappedText(ctx, msg, 28, 200, w - 56, 34);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "700 16px Arial";
    ctx.fillText("Downloaded from www.eartraininglab.com 🎶", 28, h - 36);

    const blob = await canvasToPngBlob(canvas);
    if (blob) downloadBlob(blob, "Which is the Major Scale - Record.png");
  }

  async function onDownloadScoreCard() {
    const name = getPlayerName();
    await downloadScoreCardPng(name);
  }

  async function onDownloadRecord() {
    const name = getPlayerName();
    const v = displayLongest();
    await downloadRecordPng(v, name);
  }

  // ---------- Keyboard SVG ----------

  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs = {}, children = []) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    for (const c of children) n.appendChild(c);
    return n;
  }

  function hexToRgba(hex, alpha) {
    const m = String(hex).replace("#", "").trim();
    const rgb = (m.length === 3)
      ? [m[0] + m[0], m[1] + m[1], m[2] + m[2]].map((x) => parseInt(x, 16))
      : [m.slice(0, 2), m.slice(2, 4), m.slice(4, 6)].map((x) => parseInt(x, 16));
    const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0.28));
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  }

  function darken(hex, amt) {
    const m = String(hex).replace("#", "").trim();
    const rgb = (m.length === 3)
      ? [m[0] + m[0], m[1] + m[1], m[2] + m[2]].map((x) => parseInt(x, 16))
      : [m.slice(0, 2), m.slice(2, 4), m.slice(4, 6)].map((x) => parseInt(x, 16));
    const to = (c) => Math.max(0, Math.min(255, Math.round(c)));
    const out = rgb.map((c) => to(c * (1 - amt)));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  function outerRoundedWhitePath(x, y, w, h, r, roundLeft) {
    const rr = Math.max(0, Math.min(r, Math.min(w / 2, h / 2)));
    if (roundLeft) {
      return [
        `M ${x + rr} ${y}`,
        `H ${x + w}`,
        `V ${y + h}`,
        `H ${x + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
        `V ${y + rr}`,
        `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
        `Z`
      ].join(" ");
    }
    return [
      `M ${x} ${y}`,
      `H ${x + w - rr}`,
      `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
      `V ${y + h - rr}`,
      `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
      `H ${x}`,
      `V ${y}`,
      `Z`
    ].join(" ");
  }

  const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
  const WHITE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const BLACK_BY_WHITE_INDEX = {
    0: ["C#", "Db", 1],
    1: ["D#", "Eb", 3],
    3: ["F#", "Gb", 6],
    4: ["G#", "Ab", 8],
    5: ["A#", "Bb", 10],
  };

  function cloneShapeForOverlay(shape) {
    const overlay = shape.cloneNode(true);
    overlay.classList.add("hlOverlay");
    return overlay;
  }

  function makeWhiteKey(x, y, w, h, label, pc, pitch, roundLeft, roundRight, octaveNum) {
    const base = (roundLeft || roundRight)
      ? el("path", { d: outerRoundedWhitePath(x, y, w, h, WHITE_CORNER_R, roundLeft) })
      : el("rect", { x, y, width: w, height: h });

    const overlay = cloneShapeForOverlay(base);
    overlay.classList.add("hlWhite");

    const noteTextY = y + h - 16;
    const text = el("text", { x: x + w / 2, y: noteTextY, "text-anchor": "middle" });
    text.textContent = label;

    return el("g", {
      class: "key white",
      "data-pc": pc,
      "data-abs": pitch,
      "data-oct": octaveNum,
    }, [base, overlay, text]);
  }

  function makeBlackKey(x, y, w, h, sharpName, flatName, pc, pitch, octaveNum) {
    const base = el("rect", { x, y, width: w, height: h, rx: 4, ry: 4 });
    const overlay = cloneShapeForOverlay(base);
    overlay.classList.add("hlBlack");

    const text = el("text", { x: x + w / 2, y: y + Math.round(h * 0.46), "text-anchor": "middle" });
    const t1 = el("tspan", { x: x + w / 2, dy: "-6" }); t1.textContent = sharpName;
    const t2 = el("tspan", { x: x + w / 2, dy: "14" }); t2.textContent = flatName;
    text.appendChild(t1);
    text.appendChild(t2);

    return el("g", {
      class: "key black",
      "data-pc": pc,
      "data-abs": pitch,
      "data-oct": octaveNum,
    }, [base, overlay, text]);
  }

  function buildKeyboardSvg(preset) {
    const { startOctave, octaves, endOnFinalC } = preset;

    const totalWhite = octaves * 7 + (endOnFinalC ? 1 : 0);
    const innerW = totalWhite * WHITE_W;
    const outerW = innerW + (BORDER_PX * 2);

    const s = el("svg", {
      id: "pianoSvg",
      width: outerW,
      height: OUTER_H,
      viewBox: `0 0 ${outerW} ${OUTER_H}`,
      role: "img",
      "aria-label": "Keyboard",
      preserveAspectRatio: "xMidYMid meet",
    });

    s.style.width = "100%";
    s.style.maxWidth = `${outerW}px`;
    s.style.height = "auto";

    s.style.setProperty("--hl1", SCALE1_COLOR);
    s.style.setProperty("--hl2", SCALE2_COLOR);

    const style = el("style");
    style.textContent = `
      @keyframes hlFade {
        0%   { opacity: 0; }
        12%  { opacity: 1; }
        55%  { opacity: 0.78; }
        100% { opacity: 0; }
      }

      /* Label fades to match the highlight overlay timing */
      @keyframes whiteLabelFade {
        0%   { fill: #111; }
        12%  { fill: rgba(255,255,255,0.95); }
        55%  { fill: rgba(255,255,255,0.95); }
        100% { fill: #111; }
      }

      @keyframes blackLabelFade {
        0%   { opacity: 0; }
        12%  { opacity: 1; }
        55%  { opacity: 1; }
        100% { opacity: 0; }
      }

      .white rect, .white path { fill:#fff; stroke:#222; stroke-width:1; }
      .white text { font-family: Arial, Helvetica, sans-serif; font-size:14px; fill:#111; pointer-events:none; user-select:none; }

      .black rect { fill: url(#blackGrad); stroke:#111; stroke-width:1; }
      .black text { font-family: Arial, Helvetica, sans-serif; font-size:12px; fill:#fff; pointer-events:none; user-select:none; opacity:0; }

      /* Keyboard is display-only in this game (no user note-play) */
      .key { cursor:default; pointer-events:none; }

      .hlOverlay { opacity:0; pointer-events:none; }

      /* Per-scale highlight overlays (fade back to the base key fill) */
      .white .hlWhite { fill: var(--hl1); }
      .black .hlBlack { fill: url(#hlBlackGrad1); }

      .key.flash1 .hlOverlay { animation: hlFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }
      .key.flash1.white text { font-weight:800; animation: whiteLabelFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }
      .key.flash1.black text { animation: blackLabelFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }

      .key.flash2.white .hlWhite { fill: var(--hl2); }
      .key.flash2.black .hlBlack { fill: url(#hlBlackGrad2); }
      .key.flash2 .hlOverlay { animation: hlFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }
      .key.flash2.white text { font-weight:800; animation: whiteLabelFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }
      .key.flash2.black text { animation: blackLabelFade ${KEY_FLASH_TOTAL_SEC}s ease-out 1; }
    `;
    s.appendChild(style);

    const defs = el("defs");

    const blackGrad = el("linearGradient", { id: "blackGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, [
      el("stop", { offset: "0%", "stop-color": "#3a3a3a" }),
      el("stop", { offset: "100%", "stop-color": "#000000" }),
    ]);

    const hlBlackGrad1 = el("linearGradient", { id: "hlBlackGrad1", x1: "0", y1: "0", x2: "0", y2: "1" }, [
      el("stop", { offset: "0%", "stop-color": SCALE1_COLOR }),
      el("stop", { offset: "100%", "stop-color": darken(SCALE1_COLOR, 0.45) }),
    ]);

    const hlBlackGrad2 = el("linearGradient", { id: "hlBlackGrad2", x1: "0", y1: "0", x2: "0", y2: "1" }, [
      el("stop", { offset: "0%", "stop-color": SCALE2_COLOR }),
      el("stop", { offset: "100%", "stop-color": darken(SCALE2_COLOR, 0.45) }),
    ]);

    defs.appendChild(blackGrad);
    defs.appendChild(hlBlackGrad1);
    defs.appendChild(hlBlackGrad2);
    s.appendChild(defs);

    s.appendChild(el("rect", {
      x: BORDER_PX / 2,
      y: BORDER_PX / 2,
      width: outerW - BORDER_PX,
      height: OUTER_H - BORDER_PX,
      rx: RADIUS,
      ry: RADIUS,
      fill: "#ffffff",
      stroke: "#000000",
      "stroke-width": BORDER_PX,
    }));

    const gWhite = el("g", { id: "whiteKeys" });
    const gBlack = el("g", { id: "blackKeys" });
    s.appendChild(gWhite);
    s.appendChild(gBlack);

    const startX = BORDER_PX;
    const startY = BORDER_PX;

    for (let i = 0; i < totalWhite; i++) {
      const x = startX + (i * WHITE_W);
      const noteName = WHITE_NOTES[i % 7];
      const pc = WHITE_PC[noteName];
      const octIndex = Math.floor(i / 7);
      const octaveNum = startOctave + octIndex;
      const pitch = pitchFromPcOct(pc, octaveNum);

      const label = (noteName === "C" && octaveNum === 4) ? "C4" : noteName;
      const isFirst = (i === 0);
      const isLast = (i === totalWhite - 1);

      gWhite.appendChild(makeWhiteKey(x, startY, WHITE_W, WHITE_H, label, pc, pitch, isFirst, isLast, octaveNum));
    }

    for (let oct = 0; oct < octaves; oct++) {
      const baseWhite = oct * 7;
      const octaveNum = startOctave + oct;

      for (const [whiteI, info] of Object.entries(BLACK_BY_WHITE_INDEX)) {
        const wi = Number(whiteI);
        const [sharpName, flatName, pc] = info;

        const leftWhiteX = startX + ((baseWhite + wi) * WHITE_W);
        const x = leftWhiteX + WHITE_W - (BLACK_W / 2);

        const pitch = pitchFromPcOct(pc, octaveNum);
        gBlack.appendChild(makeBlackKey(x, startY, BLACK_W, BLACK_H, sharpName, flatName, pc, pitch, octaveNum));
      }
    }

    return s;
  }

  function initKeyboard() {
    const preset = KEYBOARD_PRESETS["4oct-c2"];

    mount.innerHTML = "";
    pitchToKey.clear();

    svg = buildKeyboardSvg(preset);
    mount.appendChild(svg);

    const keys = [...svg.querySelectorAll(".key")];
    for (const g of keys) {
      const pc = Number(g.getAttribute("data-pc"));
      const oct = Number(g.getAttribute("data-oct"));
      const pitch = pitchFromPcOct(pc, oct);
      pitchToKey.set(pitch, g);
    }

    allPitches = [...pitchToKey.keys()].sort((a, b) => a - b);

    // Piano keys are intentionally non-interactive in this game.
    // (Clicking/playing individual notes could cancel a scale playback and leave the UI stuck.)
  }

  async function playSinglePitch(pitch) {
    if (!Number.isFinite(pitch)) return;

    const key = pitchToKey.get(pitch);
    if (!key) return;

    const pc = Number(key.getAttribute("data-pc"));
    const oct = Number(key.getAttribute("data-oct"));
    const stem = getStemForPc(pc);
    if (!stem) return;

    await resumeAudioIfNeeded();

    const url = noteUrl(stem, oct);
    const buf = await loadBuffer(url);
    if (!buf) {
      setResult(`Missing audio: <code>${url}</code>`);
      return;
    }

    const ctx = ensureAudioGraph();
    if (!ctx) return;

    const token = ++playbackToken;
    clearFlashTimers();
    stopAllNotes(0.10);

    playVoiceAt(buf, ctx.currentTime + 0.01, { gain: 0.9, holdSec: 0.6, fadeSec: 0.5 });
    flashKey(pitch, token, 1);
  }

  // ---------- game loop ----------

  function resetScore() {
    stopAllNotes();
    clearFlashTimers();

    score.asked = 0;
    score.correct = 0;
    score.streak = 0;
    score.longestStored = 0;
    milestonesEnabled = true;

    renderScore();
  }

  async function beginGame() {
    await resumeAudioIfNeeded();

    started = true;
    updateBeginButton();
    resetScore();

    currentQuestion = generateQuestion();
    if (questionHint) {
      questionHint.textContent = currentQuestion?.sameRoot
        ? "Both scales start on the same root for this question."
        : "Scales may start on different roots for this question.";
    }

    setResult("Press <strong>Play Scale 1</strong> and <strong>Play Scale 2</strong>, then choose which was Major.");
    setControlsEnabled();
  }

  async function restartGame() {
    started = false;
    isPlaying = false;
    currentQuestion = null;
    playbackToken += 1;

    stopAllNotes();
    clearFlashTimers();

    updateBeginButton();
    renderScore();
    setResult("Press <strong>Begin Game</strong> to start.");
    setControlsEnabled();

    await beginGame();
  }

  // ---------- Events ----------

  function bind() {
    beginBtn.addEventListener("click", async () => {
      if (!started) await beginGame();
      else await restartGame();
    });

    playScale1Btn.addEventListener("click", playScale1);
    playScale2Btn.addEventListener("click", playScale2);
    playReferenceBtn.addEventListener("click", playReferenceCMajor);

    answerScale1Btn.addEventListener("click", () => answer(1));
    answerScale2Btn.addEventListener("click", () => answer(2));

    downloadScoreBtn.addEventListener("click", onDownloadScoreCard);

    infoBtn.addEventListener("click", () => {
      // Optional: if the feedback popup is auto-closing, stop that timer so it doesn't close your info popup.
      if (feedbackPopupTimer) { clearTimeout(feedbackPopupTimer); feedbackPopupTimer = null; }
    
      showPopup(
        "More information",
        'The vast majority of Western music uses the major scale as it\'s harmonic basis. Becuase of this, and because of our continued exposire to Western music, we are often able to recognise the sound or \'tonality\' of the major scale. Recognising the major scale is a very useful skill, and something we can practice here.',
        { showDownload: false }
      );
    });
    

    modalClose.addEventListener("click", hidePopup);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !streakModal.classList.contains("hidden")) hidePopup();
});

streakModal.addEventListener("click", (e) => {
  if (e.target === streakModal) hidePopup();
});

    modalDownload.addEventListener("click", onDownloadRecord);

    document.addEventListener("keydown", async (e) => {
      if (!started) return;

      if (e.code === "Digit1") { e.preventDefault(); await playScale1(); }
      if (e.code === "Digit2") { e.preventDefault(); await playScale2(); }
      if (e.code === "KeyC") { e.preventDefault(); await playReferenceCMajor(); }

      if (e.code === "KeyQ") { e.preventDefault(); answer(1); }
      if (e.code === "KeyW") { e.preventDefault(); answer(2); }
    });
  }

  function init() {
    applyGlobalCssVars();
    bind();
    initKeyboard();
    renderScore();
    updateBeginButton();
    setControlsEnabled();
    setResult("Press <strong>Begin Game</strong> to start.");
  }

  init();
})();
