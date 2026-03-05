/* /script.js
   Which is the Major Scale?
   - Squarespace iframe sizing + scroll forwarding preserved
*/
(() => {
  "use strict";

  const AUDIO_DIR = "audio";
  const LS_KEY_NAME = "ms_player_name";

  // UI Sounds
  const UI_SND_SELECT = "select1.mp3";
  const UI_SND_BACK = "back1.mp3";
  const UI_SND_CORRECT = "correct1.mp3";
  const UI_SND_INCORRECT = "incorrect1.mp3";

  // Playback timing (seconds)
  const NOTE_GAP_SEC = 0.30;     
  const NOTE_HOLD_SEC = 0.50;    
  const NOTE_FADEIN_SEC = 0.01;  
  const NOTE_FADE_SEC = 0.40;    
  const START_LEAD_SEC = 0.06;   
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

  const PC_TO_STEM = {
    0: "c", 1: "csharp", 2: "d", 3: "dsharp", 4: "e", 5: "f",
    6: "fsharp", 7: "g", 8: "gsharp", 9: "a", 10: "asharp", 11: "b",
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

  const titleWrap = $("titleWrap");
  const titleImgWide = $("titleImgWide");
  const titleImgWrapped = $("titleImgWrapped");
  
  const restartBtn = $("restartBtn");
  const playScale1Btn = $("playScale1Btn");
  const playScale2Btn = $("playScale2Btn");
  const playReferenceBtn = $("playReferenceBtn");
  const answerScale1Btn = $("answerScale1Btn");
  const answerScale2Btn = $("answerScale2Btn");
  const nextBtn = $("nextBtn");

  const settingsBtn = $("settingsBtn");
  const infoBtn = $("infoBtn");
  const downloadScoreBtn = $("downloadScoreBtn");

  const feedbackOut = $("feedbackOut");
  const scoreOut = $("scoreOut");
  const questionHint = $("questionHint");

  // Modals
  const introModal = $("introModal");
  const introBeginBtn = $("introBeginBtn");
  const introRootModeSelect = $("introRootModeSelect");

  const settingsModal = $("settingsModal");
  const settingsRootModeSelect = $("settingsRootModeSelect");
  const settingsRestartBtn = $("settingsRestartBtn");
  const settingsCancelBtn = $("settingsCancelBtn");

  const infoModal = $("infoModal");
  const infoClose = $("infoClose");

  const scoreModal = $("scoreModal");
  const scoreModalContinueBtn = $("scoreModalContinueBtn");
  const modalDownloadScorecardBtn = $("modalDownloadScorecardBtn");

  const streakModal = $("streakModal");
  const modalTitleRecord = $("modalTitleRecord");
  const modalBodyRecord = $("modalBodyRecord");
  const modalCloseRecord = $("modalCloseRecord");
  const modalDownloadRecord = $("modalDownloadRecord");

  const scoreMeta = $("scoreMeta");
  const modalScoreMeta = $("modalScoreMeta");
  const playerNameInput = $("playerNameInput");
  const modalPlayerNameInput = $("modalPlayerNameInput");

  // ---------- dynamic title resizing ----------
  function setTitleMode(mode) {
    if (!titleWrap) return;
    titleWrap.classList.toggle("titleModeWide", mode === "wide");
    titleWrap.classList.toggle("titleModeWrapped", mode === "wrapped");
  }
  function computeDesiredWideWidthPx() {
    const cssMax = 600;
    const natural = titleImgWide?.naturalWidth || cssMax;
    return Math.min(cssMax, natural);
  }
  function updateTitleForWidth() {
    if (!titleWrap || !titleImgWide || !titleImgWrapped) return;
    const available = Math.floor(titleWrap.getBoundingClientRect().width);
    const desiredWide = computeDesiredWideWidthPx();
    if (available + 1 < desiredWide) setTitleMode("wrapped");
    else setTitleMode("wide");
  }

  // ---------- iframe sizing + scroll forwarding ----------

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

  // ---------- state ----------

  let svg = null;
  const pitchToKey = new Map();
  let allPitches = [];

  let hasInteracted = false;
  let awaitingNext = false;
  let isPlaying = false;
  let playingOwnerToken = null; 

  let currentRootMode = "same"; 
  const score = { asked: 0, correct: 0, streak: 0, longestStored: 0 };

  let currentQuestion = null; // { scale1, scale2, majorIndex, majorName }
  let milestonesEnabled = true;

  // playback cancellation
  let playbackToken = 0;
  const playbackTimers = new Set();

  // ---------- audio ----------

  let audioCtx = null;
  let masterGain = null;

  const bufferPromiseCache = new Map();
  const activeVoices = new Set();
  const activeUiAudios = new Set();
  let synthFallbackWarned = false;

  function ensureAudioGraph() {
    if (audioCtx) return audioCtx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    audioCtx = new Ctx();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.92;

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -10;   
    compressor.knee.value = 12;         
    compressor.ratio.value = 12;        
    compressor.attack.value = 0.002;    
    compressor.release.value = 0.25;

    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);

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

    activeVoices.forEach((v) => {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
        v.src.stop(now + fade + 0.05);
      } catch (e) {}
    });
    activeVoices.clear();
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

  function pitchToFrequency(pitch) {
    const A4 = pitchFromPcOct(9, 4);
    return 440 * Math.pow(2, (pitch - A4) / 12);
  }

  function playSynthToneWindowed(pitch, whenSec, playSec, fadeOutSec, gain = 0.65) {
    const ctx = ensureAudioGraph();
    if (!ctx || !masterGain) return null;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitchToFrequency(pitch), whenSec);

    const g = ctx.createGain();
    const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 0.65);
    const fadeIn = 0.01;
    const endAt = whenSec + Math.max(0.05, playSec);

    g.gain.setValueAtTime(0, whenSec);
    g.gain.linearRampToValueAtTime(safeGain, whenSec + fadeIn);

    const fade = Math.max(0.015, Number.isFinite(fadeOutSec) ? fadeOutSec : 0.06);
    const fadeStart = Math.max(whenSec + 0.02, endAt - fade);
    g.gain.setValueAtTime(safeGain, fadeStart);
    g.gain.linearRampToValueAtTime(0, endAt);

    osc.connect(g);
    g.connect(masterGain);

    trackVoice(osc, g, whenSec);
    osc.start(whenSec);
    osc.stop(endAt + 0.03);
    return osc;
  }

  function maybeWarnSynthFallback(missingUrl) {
    if (synthFallbackWarned) return;
    synthFallbackWarned = true;
    console.warn("Audio sample missing; using synthesized tones instead:", missingUrl);
  }

  function playVoiceAt(buffer, pitch, whenSec, { gain = 1, holdSec = NOTE_HOLD_SEC, fadeSec = NOTE_FADE_SEC } = {}) {
    const ctx = ensureAudioGraph();
    if (!ctx || !masterGain) return null;

    if (!buffer) {
        return playSynthToneWindowed(pitch, whenSec, holdSec, fadeSec, gain * 0.7);
    }

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

  function stopAllUiSounds() {
    for (const a of Array.from(activeUiAudios)) {
      try { a.pause(); a.currentTime = 0; } catch {}
      activeUiAudios.delete(a);
    }
  }

  async function playUiSound(filename) {
    try {
      const url = `${AUDIO_DIR}/${filename}`;
      const buffer = await loadBuffer(url);
      if (!buffer) return;
      const ctx = ensureAudioGraph();
      if (!ctx) return;
      
      const when = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.setValueAtTime(2.0, when);

      src.connect(g);
      g.connect(masterGain);
      trackVoice(src, g, when);
      src.start(when);
    } catch (e) { console.error("UI Sound error:", e); }
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
    if (feedbackOut) feedbackOut.innerHTML = safe;
  }

  function scorePercent() {
    if (score.asked <= 0) return 0;
    return Math.round((score.correct / score.asked) * 1000) / 10;
  }

  function displayLongest() {
    return Math.max(score.longestStored, score.streak);
  }

  function updateScoreMetaText() {
    const metaText = `Mode: ${currentRootMode === "same" ? "Same root" : "Different roots"}`;
    if (scoreMeta) scoreMeta.textContent = metaText;
    if (modalScoreMeta) modalScoreMeta.textContent = metaText;
  }

  function renderScore() {
    const items = [
      ["Questions asked", score.asked],
      ["Answers correct", score.correct],
      ["Correct in a row", score.streak],
      ["Longest correct streak", displayLongest()],
      ["Percentage correct", `${scorePercent()}%`],
    ];

    scoreOut.innerHTML = items.map(([k, v]) =>
        `<div class="scoreItem"><span class="scoreK">${k}</span><span class="scoreV">${v}</span></div>`
    ).join("");
    
    updateScoreMetaText();
  }

  // Modals framework
  let lastFocusEl = null;
  function openModal(modalEl) {
    lastFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalEl.classList.remove("hidden");
    postHeightNow();
  }

  function closeModal(modalEl) {
    modalEl.classList.add("hidden");
    postHeightNow();
    if (lastFocusEl) {
      try { lastFocusEl.focus(); } catch {}
    }
  }

  function isVisible(modalEl) { return !modalEl.classList.contains("hidden"); }

  function showRecordPopup(title, message, { showDownload = false } = {}) {
    if (!streakModal || !modalTitleRecord || !modalBodyRecord || !modalDownloadRecord || !modalCloseRecord) return;
    modalTitleRecord.textContent = title;
    modalBodyRecord.textContent = message;
    modalDownloadRecord.classList.toggle("hidden", !showDownload);
    openModal(streakModal);
    modalCloseRecord.focus();
  }

  let scoreModalContinueCallback = null;
  function showScoreModal(onContinue) {
    scoreModalContinueCallback = onContinue;
    
    if ($("modalAsked")) $("modalAsked").textContent = score.asked;
    if ($("modalCorrect")) $("modalCorrect").textContent = score.correct;
    if ($("modalStreak")) $("modalStreak").textContent = score.streak;
    if ($("modalLongest")) $("modalLongest").textContent = displayLongest();
    if ($("modalPercent")) $("modalPercent").textContent = `${scorePercent()}%`;
    
    updateScoreMetaText();
    openModal(scoreModal);
    try { scoreModalContinueBtn.focus(); } catch {}
  }


  function setControlsEnabled() {
    const hasQ = !!currentQuestion;
    const isModalOpen = isVisible(introModal) || isVisible(settingsModal) || isVisible(infoModal) || isVisible(scoreModal) || isVisible(streakModal);

    playScale1Btn.disabled = !hasQ || isPlaying || isModalOpen || awaitingNext;
    playScale2Btn.disabled = !hasQ || isPlaying || isModalOpen || awaitingNext;
    playReferenceBtn.disabled = isPlaying || isModalOpen || awaitingNext;

    answerScale1Btn.disabled = !hasQ || awaitingNext || isPlaying || isModalOpen;
    answerScale2Btn.disabled = !hasQ || awaitingNext || isPlaying || isModalOpen;

    nextBtn.disabled = !awaitingNext || isModalOpen;
    nextBtn.classList.toggle("nextReady", awaitingNext && !isModalOpen);

    restartBtn.disabled = !hasInteracted || isModalOpen;
    downloadScoreBtn.disabled = isModalOpen || score.asked === 0;
  }

  function clearAnswerButtonStates() {
    answerScale1Btn.classList.remove("correct", "incorrect");
    answerScale2Btn.classList.remove("correct", "incorrect");
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

    try { k.dataset.flashToken = String(token ?? ""); } catch {}

    k.classList.remove("flash1", "flash2");
    try { void k.getBoundingClientRect(); } catch {}
    k.classList.add(cls);

    const t = setTimeout(() => {
      try {
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

    const sameRoot = (currentRootMode === "same");

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
      
      let buf = null;
      let url = null;
      if (stem) {
          url = noteUrl(stem, oct);
          buf = await loadBuffer(url);
          if (!buf) {
            maybeWarnSynthFallback(url);
          }
      }

      bufs.push({ pitch, buf, url });
    }
    return { bufs };
  }

  async function playScale(pitches, labelForFeedback, whichScale) {
    hasInteracted = true;
    const ctx = ensureAudioGraph();
    if (!ctx) return;

    await resumeAudioIfNeeded();

    const token = ++playbackToken;

    clearFlashTimers();
    stopAllNotes(0.10);

    isPlaying = true;
    playingOwnerToken = token;
    setControlsEnabled();

    // Only update feedback text if we're not waiting for next (so answers remain visible)
    if (!awaitingNext) {
      setResult(`Playing <strong>${labelForFeedback}</strong>…`);
    }

    try {
      const loaded = await loadScaleBuffers(pitches);
      if (!loaded) {
        if (!awaitingNext) setResult(`Error preparing audio.`);
        return;
      }

      const { bufs } = loaded;

      const startCtx = ctx.currentTime + START_LEAD_SEC;
      const startWall = performance.now();
      const startCtxAtWall = ctx.currentTime;

      for (let i = 0; i < bufs.length; i++) {
        const when = startCtx + (i * NOTE_GAP_SEC);
        playVoiceAt(bufs[i].buf, bufs[i].pitch, when, { gain: 1, holdSec: NOTE_HOLD_SEC, fadeSec: NOTE_FADE_SEC });

        const ms = Math.max(0, (when - startCtxAtWall) * 1000);
        const t = setTimeout(() => {
          if (token !== playbackToken) return;
          flashKey(bufs[i].pitch, token, whichScale);
        }, ms);
        playbackTimers.add(t);
      }

      const totalSec = ((bufs.length - 1) * NOTE_GAP_SEC) + NOTE_HOLD_SEC + NOTE_FADE_SEC + 0.15;
      const finishMs = Math.max(0, totalSec * 1000 - (performance.now() - startWall));
      await new Promise((r) => setTimeout(r, finishMs));

      if (token !== playbackToken) return; 

      if (!awaitingNext) {
        setResult("Which was the Major scale? Choose <strong>Scale 1</strong> or <strong>Scale 2</strong>.");
      }
    } finally {
      if (playingOwnerToken === token) {
        isPlaying = false;
        playingOwnerToken = null;
        setControlsEnabled();
      }
    }
  }

  async function playScale1() {
    if (!currentQuestion || awaitingNext) return;
    await playScale(currentQuestion.scale1, "Scale 1", 1);
  }

  async function playScale2() {
    if (!currentQuestion || awaitingNext) return;
    await playScale(currentQuestion.scale2, "Scale 2", 2);
  }

  async function playReferenceCMajor() {
    if (awaitingNext) return;
    hasInteracted = true;
    const root = pitchFromPcOct(0, 4); // C4
    const pitches = buildMajorScale(root);
    await playScale(pitches, "C Major (C4)", 1);
  }

  // ---------- answering ----------

  function considerMilestonePopup() {
    if (!milestonesEnabled) return;
    const msg = MILESTONES.get(score.streak);
    if (!msg) return;

    showRecordPopup("Milestone!", msg, { showDownload: false });

    if (score.streak >= 30) milestonesEnabled = false;
  }

  function answer(whichScale) {
    if (!currentQuestion || isPlaying || awaitingNext) return;
    hasInteracted = true;
    awaitingNext = true;

    score.asked += 1;

    const correctScale = currentQuestion.majorIndex;
    const isCorrect = whichScale === correctScale;
    
    stopAllUiSounds();
    clearAnswerButtonStates();

    if (isCorrect) {
      setTimeout(() => playUiSound(UI_SND_CORRECT), 20);
      score.correct += 1;
      score.streak += 1;
      score.longestStored = Math.max(score.longestStored, score.streak);

      if (whichScale === 1) answerScale1Btn.classList.add("correct");
      else answerScale2Btn.classList.add("correct");

      setResult(`Correct! ✅ Scale ${correctScale} was the Major Scale`);
      considerMilestonePopup();
    } else {
      playUiSound(UI_SND_INCORRECT);
      score.streak = 0;

      if (whichScale === 1) answerScale1Btn.classList.add("incorrect");
      else answerScale2Btn.classList.add("incorrect");

      if (correctScale === 1) answerScale1Btn.classList.add("correct");
      else answerScale2Btn.classList.add("correct");

      setResult(`Incorrect! ❌ That was not the Major Scale - it was actually Scale ${correctScale}`);
    }

    renderScore();
    setControlsEnabled();
  }

  async function goNext() {
    if (!awaitingNext) return;
    stopAllNotes(0.08);
    stopAllUiSounds();

    awaitingNext = false;
    clearFlashTimers();
    clearAnswerButtonStates();

    currentQuestion = generateQuestion();
    if (questionHint) {
      questionHint.textContent = currentQuestion?.sameRoot
        ? "Both scales start on the same root for this question."
        : "Scales may start on different roots for this question.";
    }
    
    setResult("Press <strong>Play Scale 1</strong> and <strong>Play Scale 2</strong>, then choose which was Major.");
    setControlsEnabled();
  }

  function resetGame({ openIntro = false } = {}) {
    stopAllNotes(0.08);
    stopAllUiSounds();

    isPlaying = false;
    hasInteracted = false;
    awaitingNext = false;
    playbackToken += 1;
    
    clearFlashTimers();
    clearAnswerButtonStates();

    score.asked = 0;
    score.correct = 0;
    score.streak = 0;
    score.longestStored = 0;
    milestonesEnabled = true;

    renderScore();
    
    if (openIntro) {
      currentQuestion = null;
      if (questionHint) questionHint.textContent = "";
      setResult("Press <strong>Play Scale 1</strong> and <strong>Play Scale 2</strong>, then choose which was Major.");
      setControlsEnabled();

      openModal(introModal);
      try { introBeginBtn.focus(); } catch {}
    } else {
      hasInteracted = true; 
      currentQuestion = generateQuestion();
      if (questionHint) {
        questionHint.textContent = currentQuestion?.sameRoot
          ? "Both scales start on the same root for this question."
          : "Scales may start on different roots for this question.";
      }

      setResult("Press <strong>Play Scale 1</strong> and <strong>Play Scale 2</strong>, then choose which was Major.");
      setControlsEnabled();
    }
  }

  // Settings syncing logic
  function isSettingsDirty() {
    return settingsRootModeSelect.value !== currentRootMode;
  }
  
  function updateSettingsDirtyUi() {
    const dirty = isSettingsDirty();
    settingsRestartBtn.disabled = !dirty;
    settingsRestartBtn.classList.toggle("is-disabled", !dirty);
  }
  
  function applyRootMode(newMode) {
    currentRootMode = newMode;
    updateScoreMetaText();
  }

  // Name input sync
  function loadInitialName() {
    const saved = localStorage.getItem(LS_KEY_NAME);
    const v = String(saved || "").trim();
    return v.slice(0, 32);
  }

  function saveName(name) { try { localStorage.setItem(LS_KEY_NAME, String(name || "").trim().slice(0, 32)); } catch {} }

  function syncNames(val) {
    if (playerNameInput && playerNameInput.value !== val) playerNameInput.value = val;
    if (modalPlayerNameInput && modalPlayerNameInput.value !== val) modalPlayerNameInput.value = val;
  }
  if (playerNameInput) playerNameInput.addEventListener("input", (e) => syncNames(e.target.value));
  if (modalPlayerNameInput) modalPlayerNameInput.addEventListener("input", (e) => syncNames(e.target.value));


  // ---------- PNG downloads ----------
  async function loadImage(src) {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  
  function drawImageContain(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const r = Math.min(w / iw, h / ih);
    const dw = Math.max(1, iw * r);
    const dh = Math.max(1, ih * r);
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    return { w: dw, h: dh, x: dx, y: dy };
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function sanitizeFilenamePart(s) {
    const v = String(s || "").trim().replace(/\s+/g, "_");
    const cleaned = v.replace(/[^a-zA-Z0-9_\-]+/g, "");
    return cleaned.slice(0, 32) || "";
  }
  
  function safeText(s) { return String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim(); }

  async function downloadScorecardPng(nameInputEl) {
    const LAYOUT = {
      gapAfterImage: 32,           
      gapAfterUrl: 36,             
      gapAfterTitle: 30,           
      gapAfterMeta: 28,            
      gapAfterName: 22,            
      gapNoNameCompensation: 12,   
      mainGridRowGap: 14,          
    };

    const name = safeText(nameInputEl?.value);
    if (nameInputEl) saveName(name);

    const W = 720;
    const rowsCount = 5;
    const rowH = 58;
    const baseContentH = 340; 
    const H = baseContentH + (rowsCount * (rowH + LAYOUT.mainGridRowGap)) + 80; 
    
    const dpr = Math.max(1, Math.floor((window.devicePixelRatio || 1) * 100) / 100);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const pad = 34;
    const cardX = pad;
    const cardY = pad;
    const cardW = W - pad * 2;
    const cardH = H - pad * 2;

    ctx.fillStyle = "#f9f9f9";
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.stroke();

    const titleSrc = titleImgWide?.getAttribute("src") || "images/title.png";
    const titleImg = await loadImage(titleSrc);

    let yCursor = cardY + 26;

    if (titleImg) {
      const imgMaxW = Math.min(520, cardW - 40);
      const imgMaxH = 92;
      drawImageContain(ctx, titleImg, (W - imgMaxW) / 2, yCursor, imgMaxW, imgMaxH);
      yCursor += imgMaxH + LAYOUT.gapAfterImage;
    }

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "800 18px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("www.eartraininglab.com", W / 2, yCursor);
    yCursor += LAYOUT.gapAfterUrl;

    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.font = "700 26px Arial, Helvetica, sans-serif";
    ctx.fillText("Score Card", W / 2, yCursor);
    yCursor += LAYOUT.gapAfterTitle;

    ctx.font = "800 18px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillText(`Mode: ${currentRootMode === "same" ? "Same root" : "Different roots"}`, W / 2, yCursor);
    yCursor += LAYOUT.gapAfterMeta;

    if (name) {
      ctx.fillText(`Name: ${name}`, W / 2, yCursor);
      yCursor += LAYOUT.gapAfterName;
    } else {
      yCursor += LAYOUT.gapNoNameCompensation; 
    }

    ctx.fillStyle = "#111";
    ctx.textAlign = "left";

    const rowX = cardX + 26;
    const rowW = cardW - 52;
    
    const rows = [
      ["Questions asked", String(score.asked)],
      ["Answers correct", String(score.correct)],
      ["Correct in a row", String(score.streak)],
      ["Longest correct streak", String(displayLongest())],
      ["Percentage correct", `${scorePercent()}%`],
    ];

    for (const [k, v] of rows) {
      ctx.fillStyle = "#ffffff";
      drawRoundRect(ctx, rowX, yCursor, rowW, rowH, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.70)";
      ctx.font = "900 18px Arial, Helvetica, sans-serif";
      ctx.fillText(k, rowX + 16, yCursor + 33);

      ctx.fillStyle = "#111";
      ctx.font = "900 22px Arial, Helvetica, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(v, rowX + rowW - 16, yCursor + 37);
      ctx.textAlign = "left";

      yCursor += rowH + LAYOUT.mainGridRowGap;
    }

    ctx.textAlign = "center";
    ctx.font = "800 14px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText("Which is the Major Scale? - www.eartraininglab.com", W / 2, cardY + cardH - 24);

    const fileBase = name ? `${sanitizeFilenamePart(name)}_scorecard` : "scorecard";
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function drawCardBaseOld(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfbfc";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#111";
    ctx.fillRect(8, 8, w - 16, 74);
  }

  function drawWrappedTextOld(ctx, text, x, y, maxWidth, lineHeight) {
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

  async function downloadRecordPng(streakValue, playerName) {
    const w = 980;
    const h = 420;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawCardBaseOld(ctx, w, h);

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px Arial";
    ctx.fillText("Which is the Major Scale? — Record", 28, 56);

    ctx.fillStyle = "#111";
    ctx.font = "900 28px Arial";
    ctx.fillText(`${streakValue} correct in a row!`, 28, 142);

    ctx.font = "700 22px Arial";
    ctx.fillStyle = "#111";
    const msg = `${playerName} just scored ${streakValue} correct answers in a row on the "Which is the Major Scale?" game 🎉🎶🥳`;
    drawWrappedTextOld(ctx, msg, 28, 200, w - 56, 34);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "700 16px Arial";
    ctx.fillText("Downloaded from www.eartraininglab.com 🎶", 28, h - 36);

    canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Which Is The Major Scale Record.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
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
  }

  // ---------- Events ----------

  function bind() {
    
    // Intro modal
    function handleIntroContinue() {
      playUiSound(UI_SND_SELECT);
      const newMode = String(introRootModeSelect.value || "same");
      applyRootMode(newMode);
      if (settingsRootModeSelect) settingsRootModeSelect.value = newMode;
      
      hasInteracted = true; 
      currentQuestion = generateQuestion();
      if (questionHint) {
        questionHint.textContent = currentQuestion?.sameRoot
          ? "Both scales start on the same root for this question."
          : "Scales may start on different roots for this question.";
      }

      closeModal(introModal);
      resumeAudioIfNeeded();
      setResult("Press <strong>Play Scale 1</strong> and <strong>Play Scale 2</strong>, then choose which was Major.");
      setControlsEnabled();
      try { playScale1Btn.focus(); } catch {}
    }
    introBeginBtn.addEventListener("click", handleIntroContinue);
    
    // Settings modal
    settingsBtn.addEventListener("click", () => {
        playUiSound(UI_SND_SELECT);
        stopAllNotes(0.06);
        if (settingsRootModeSelect) settingsRootModeSelect.value = currentRootMode;
        openModal(settingsModal);
        updateSettingsDirtyUi();
        try { settingsRootModeSelect.focus(); } catch {}
    });
    
    settingsCancelBtn.addEventListener("click", () => {
        playUiSound(UI_SND_BACK);
        if (settingsRootModeSelect) settingsRootModeSelect.value = currentRootMode;
        updateSettingsDirtyUi();
        closeModal(settingsModal);
    });
    
    settingsRootModeSelect.addEventListener("change", updateSettingsDirtyUi);
    
    settingsRestartBtn.addEventListener("click", () => {
      if (settingsRestartBtn.disabled) return;
      playUiSound(UI_SND_SELECT);
      const newMode = String(settingsRootModeSelect.value || "same");
      
      closeModal(settingsModal);

      showScoreModal(() => {
        applyRootMode(newMode);
        if (introRootModeSelect) introRootModeSelect.value = newMode;
        resetGame({ openIntro: false });
      });
    });

    // Info Modal
    infoBtn.addEventListener("click", () => {
        playUiSound(UI_SND_SELECT);
        stopAllNotes(0.06);
        openModal(infoModal);
        try { infoClose.focus(); } catch {}
    });

    infoClose.addEventListener("click", () => {
        playUiSound(UI_SND_BACK);
        closeModal(infoModal);
    });

    // Score modal
    scoreModalContinueBtn.addEventListener("click", () => {
      playUiSound(UI_SND_SELECT);
      closeModal(scoreModal);
      if (scoreModalContinueCallback) scoreModalContinueCallback();
    });

    // Main buttons
    restartBtn.addEventListener("click", () => {
      showScoreModal(() => {
        resetGame({ openIntro: true });
      });
    });

    playScale1Btn.addEventListener("click", playScale1);
    playScale2Btn.addEventListener("click", playScale2);
    playReferenceBtn.addEventListener("click", playReferenceCMajor);

    answerScale1Btn.addEventListener("click", () => answer(1));
    answerScale2Btn.addEventListener("click", () => answer(2));

    nextBtn.addEventListener("click", goNext);

    downloadScoreBtn.addEventListener("click", () => {
      playUiSound(UI_SND_SELECT);
      downloadScorecardPng(playerNameInput);
    });
    modalDownloadScorecardBtn.addEventListener("click", () => {
      playUiSound(UI_SND_SELECT);
      downloadScorecardPng(modalPlayerNameInput);
    });
    
    modalDownloadRecord.addEventListener("click", () => {
        const name = safeText(playerNameInput.value) || "Player";
        downloadRecordPng(score.longestStored || displayLongest(), name);
    });

    // Modals closing overrides
    modalCloseRecord?.addEventListener("click", () => {
        playUiSound(UI_SND_BACK);
        closeModal(streakModal);
    });
    streakModal?.addEventListener("click", (e) => { 
        if (e.target === streakModal) {
            playUiSound(UI_SND_BACK);
            closeModal(streakModal); 
        }
    });
    introModal?.addEventListener("click", (e) => { 
        if (e.target === introModal) {
            playUiSound(UI_SND_BACK);
            closeModal(introModal); 
        }
    });
    settingsModal?.addEventListener("click", (e) => { 
        if (e.target === settingsModal) {
            playUiSound(UI_SND_BACK);
            if (settingsRootModeSelect) settingsRootModeSelect.value = currentRootMode;
            closeModal(settingsModal);
        }
    });
    infoModal?.addEventListener("click", (e) => { 
        if (e.target === infoModal) {
            playUiSound(UI_SND_BACK);
            closeModal(infoModal);
        }
    });

    window.addEventListener("resize", () => {
      updateTitleForWidth();
    });

    document.addEventListener("keydown", async (e) => {
      if (e.key === "Escape") {
        if (isVisible(settingsModal)) {
          playUiSound(UI_SND_BACK);
          if (settingsRootModeSelect) settingsRootModeSelect.value = currentRootMode;
          closeModal(settingsModal);
          return;
        }
        if (isVisible(infoModal)) {
          playUiSound(UI_SND_BACK);
          closeModal(infoModal);
          return;
        }
        if (isVisible(streakModal)) { 
          playUiSound(UI_SND_BACK);
          closeModal(streakModal); 
          return; 
        }
        return;
      }

      if (isVisible(settingsModal) || isVisible(introModal) || isVisible(scoreModal) || isVisible(streakModal) || isVisible(infoModal)) return;

      if (e.code === "Digit1") { e.preventDefault(); await playScale1(); }
      if (e.code === "Digit2") { e.preventDefault(); await playScale2(); }
      if (e.code === "KeyC") { e.preventDefault(); await playReferenceCMajor(); }

      if (!awaitingNext && !isPlaying) {
        if (e.code === "KeyQ" || e.code === "ArrowLeft") { e.preventDefault(); answer(1); }
        if (e.code === "KeyW" || e.code === "ArrowRight") { e.preventDefault(); answer(2); }
      }

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (awaitingNext) await goNext();
      }
    });
  }

  function initTitleSwap() {
    if (!titleWrap || !titleImgWide || !titleImgWrapped) return;

    const tryUpdate = () => updateTitleForWidth();

    if (titleImgWide.complete) tryUpdate();
    else titleImgWide.addEventListener("load", tryUpdate, { once: true });

    if (titleImgWrapped.complete) tryUpdate();
    else titleImgWrapped.addEventListener("load", tryUpdate, { once: true });

    const tro = new ResizeObserver(() => updateTitleForWidth());
    tro.observe(titleWrap);
  }

  function init() {
    applyGlobalCssVars();
    bind();
    initTitleSwap();
    initKeyboard();

    const initialName = loadInitialName();
    if (playerNameInput) playerNameInput.value = initialName;
    if (modalPlayerNameInput) modalPlayerNameInput.value = initialName;

    applyRootMode("same");

    updateTitleForWidth();
    resetGame({ openIntro: true });
  }

  init();
})();