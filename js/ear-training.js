import { Piano } from "./piano.js";
import {
  CHROMATIC,
  noteLabelFromMidi,
  randomIntInclusive,
  randomItem
} from "./music-theory.js";

const PLAY_DURATION_SECONDS = 5;
const SEQUENTIAL_NOTE_SECONDS = 1;
const KEY_FLASH_MS = 400;

const INTERVAL_OPTIONS = [
  { id: "m2", name: "Minor 2nd", semitones: 1 },
  { id: "M2", name: "Major 2nd", semitones: 2 },
  { id: "m3", name: "Minor 3rd", semitones: 3 },
  { id: "M3", name: "Major 3rd", semitones: 4 },
  { id: "P4", name: "Perfect 4th", semitones: 5 },
  { id: "TT", name: "Tritone", semitones: 6 },
  { id: "P5", name: "Perfect 5th", semitones: 7 },
  { id: "m6", name: "Minor 6th", semitones: 8 },
  { id: "M6", name: "Major 6th", semitones: 9 },
  { id: "m7", name: "Minor 7th", semitones: 10 },
  { id: "M7", name: "Major 7th", semitones: 11 },
  { id: "P8", name: "Perfect Octave", semitones: 12 }
];

const TRIAD_QUALITIES = [
  { id: "major", name: "Major", intervals: [0, 4, 7] },
  { id: "minor", name: "Minor", intervals: [0, 3, 7] },
  { id: "diminished", name: "Diminished", intervals: [0, 3, 6] },
  { id: "augmented", name: "Augmented", intervals: [0, 4, 8] }
];

const SEVENTH_QUALITIES = [
  { id: "maj7", name: "Major 7", intervals: [0, 4, 7, 11] },
  { id: "dom7", name: "Dominant 7", intervals: [0, 4, 7, 10] },
  { id: "min7", name: "Minor 7", intervals: [0, 3, 7, 10] },
  { id: "halfDim7", name: "Half-diminished 7", intervals: [0, 3, 6, 10] },
  { id: "dim7", name: "Diminished 7", intervals: [0, 3, 6, 9] },
  { id: "minMaj7", name: "Minor-major 7", intervals: [0, 3, 7, 11] }
];

const TRIAD_INVERSIONS = [
  { id: 0, name: "Root Position" },
  { id: 1, name: "1st Inversion" },
  { id: 2, name: "2nd Inversion" }
];

const SEVENTH_INVERSIONS = [
  { id: 0, name: "Root Position" },
  { id: 1, name: "1st Inversion" },
  { id: 2, name: "2nd Inversion" },
  { id: 3, name: "3rd Inversion" }
];

function noteNameOnly(midi) {
  return CHROMATIC[((midi % 12) + 12) % 12];
}

function createStats() {
  return {
    correct: 0,
    incorrect: 0,
    currentStreak: 0,
    bestStreak: 0
  };
}

function accuracyPercent(stats) {
  const total = stats.correct + stats.incorrect;
  if (!total) return "0";
  return ((stats.correct / total) * 100).toFixed(1);
}

function updateScoreText(scoreEl, stats) {
  scoreEl.textContent =
    `Correct: ${stats.correct} | Incorrect: ${stats.incorrect} | Accuracy: ${accuracyPercent(stats)}% | Current Streak: ${stats.currentStreak} | Best Streak: ${stats.bestStreak}`;
}

function setStatus(statusEl, text) {
  statusEl.textContent = text;
}

function buildInvertedChord(rootMidi, intervals, inversion) {
  const notes = intervals.map((offset) => rootMidi + offset);
  for (let i = 0; i < inversion; i++) {
    notes[i] += 12;
  }
  return notes.slice().sort((a, b) => a - b);
}

function selectedCheckboxValues(wrapper, selector) {
  return Array.from(wrapper.querySelectorAll(selector))
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function ensureAtLeastOneChecked(wrapper, selector, fallbackValues) {
  const checked = selectedCheckboxValues(wrapper, selector);
  if (checked.length) return checked;

  fallbackValues.forEach((value, i) => {
    const input = wrapper.querySelector(`${selector}[value="${value}"]`);
    if (input && i === 0) {
      input.checked = true;
    }
  });

  return selectedCheckboxValues(wrapper, selector);
}

function createPlaybackController(audio, playBtn, durationSeconds = PLAY_DURATION_SECONDS) {
  let voices = null;
  let timer = null;
  let token = 0;
  let onAutoStop = null;

  function stop(fromTimer = false) {
    token += 1;

    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    if (voices) {
      audio.stopVoices(voices);
      voices = null;
    }

    playBtn.textContent = "Play";

    if (fromTimer && onAutoStop) {
      onAutoStop();
    }
  }

  async function start(midis, mode, options = {}) {
    stop();

    const { noteDuration = null } = options;
    const total = noteDuration ? noteDuration * midis.length : durationSeconds;

    const myToken = token;
    playBtn.textContent = "Stop";
    timer = setTimeout(() => {
      if (myToken === token) stop(true);
    }, total * 1000);

    const started = await audio.playSustained(midis, { mode, duration: total, noteDuration });

    if (myToken !== token) {
      audio.stopVoices(started);
      return;
    }

    voices = started;
  }

  return {
    isPlaying() {
      return timer !== null;
    },
    start,
    stop() {
      stop(false);
    },
    onAutoStop(handler) {
      onAutoStop = handler;
    }
  };
}

function createKeyFeedback(piano, audio) {
  const timers = new Map();

  function release(midi) {
    const timer = timers.get(midi);
    if (timer) {
      clearTimeout(timer);
      timers.delete(midi);
    }

    piano.getKeysByMidi(midi).forEach((key) => key.classList.remove("played"));
  }

  function press(midi, { sustain = false } = {}) {
    // Every note sounds; only the octaves currently on screen light up.
    const keys = piano.getKeysByMidi(midi);

    const timer = timers.get(midi);
    if (timer) {
      clearTimeout(timer);
      timers.delete(midi);
    }

    keys.forEach((key) => key.classList.add("played"));
    audio.playNote(midi, 0.35, { gain: 0.06 });

    if (!sustain && keys.length) {
      timers.set(midi, setTimeout(() => release(midi), KEY_FLASH_MS));
    }
  }

  return { press, release };
}

function createTrainerShell(container, settingsHtml, answerHtml) {
  container.innerHTML = `
    <div class="trainer-panel">
      <div class="trainer-actions">
        <button data-action="new">New Challenge</button>
        <button data-action="play">Play</button>
        <button data-action="reveal">Reveal Answer</button>
        <button data-action="reset">Reset Quiz</button>
      </div>

      <div class="trainer-status" data-role="status">Press New Challenge to begin.</div>

      <div class="trainer-grid">
        <div class="trainer-settings">${settingsHtml}</div>
        <div>
          <h3>Answer Options</h3>
          ${answerHtml}
        </div>
      </div>

      <div class="trainer-result" data-role="result">Answer is hidden until you respond.</div>
      <div class="trainer-score" data-role="score"></div>

      <h3>Interactive Piano</h3>
      <div class="keyboardWrap">
        <div data-role="piano" class="keyboard three-octave"></div>
      </div>
    </div>
  `;

  return {
    newBtn: container.querySelector('button[data-action="new"]'),
    playBtn: container.querySelector('button[data-action="play"]'),
    revealBtn: container.querySelector('button[data-action="reveal"]'),
    resetBtn: container.querySelector('button[data-action="reset"]'),
    status: container.querySelector('[data-role="status"]'),
    result: container.querySelector('[data-role="result"]'),
    score: container.querySelector('[data-role="score"]'),
    pianoEl: container.querySelector('[data-role="piano"]')
  };
}

export function initIntervalTrainer(container, audio) {
  const settingsHtml = `
    <div class="settings-group"><strong>Question</strong><div>What interval did you hear?</div></div>
    <div class="settings-group">
      <strong>Intervals</strong>
      <div class="checkbox-list">
        ${INTERVAL_OPTIONS.map((opt) => `<label><input type="checkbox" data-interval value="${opt.id}" checked> ${opt.name}</label>`).join("")}
      </div>
    </div>
    <div class="settings-group">
      <strong>Playback</strong>
      <div>
        <select data-playback>
          <option value="harmonic">Harmonic</option>
          <option value="ascending">Ascending</option>
          <option value="descending">Descending</option>
          <option value="random">Random</option>
        </select>
      </div>
    </div>
  `;

  const answerHtml = `<div class="answer-grid" data-role="answers"></div>`;
  const ui = createTrainerShell(container, settingsHtml, answerHtml);
  const intervalSettings = container.querySelectorAll('input[data-interval]');
  const playbackSelect = container.querySelector('select[data-playback]');
  const answersEl = container.querySelector('[data-role="answers"]');

  const piano = new Piano(ui.pianoEl, {
    octaves: 3,
    startMidi: 48,
    clickable: true,
    keyboardClass: "three-octave",
    onKeyPress: ({ midi }) => {
      keyFeedback.press(midi);
    }
  });

  const keyFeedback = createKeyFeedback(piano, audio);

  const playback = createPlaybackController(audio, ui.playBtn);
  const stats = createStats();
  let challenge = null;
  let answeredCorrectly = false;

  function enabledIntervals() {
    const selectedIds = ensureAtLeastOneChecked(container, 'input[data-interval]', [INTERVAL_OPTIONS[0].id]);
    return INTERVAL_OPTIONS.filter((opt) => selectedIds.includes(opt.id));
  }

  function renderAnswerButtons() {
    const options = enabledIntervals();
    answersEl.innerHTML = options
      .map((opt) => `<button class="answer-btn" data-answer="${opt.id}">${opt.name}</button>`)
      .join("");

    answersEl.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => submitAnswer(button.dataset.answer, button));
    });
  }

  function resolvedPlaybackMode() {
    const selected = playbackSelect.value;
    if (selected !== "random") return selected;
    return randomItem(["harmonic", "ascending", "descending"]);
  }

  function newChallenge() {
    const pool = enabledIntervals();
    if (!pool.length) {
      setStatus(ui.status, "Select at least one interval.");
      return;
    }

    const chosen = randomItem(pool);
    const rootMidi = randomIntInclusive(48, 71);
    const secondMidi = rootMidi + chosen.semitones;

    challenge = {
      rootMidi,
      notes: [rootMidi, secondMidi],
      answer: chosen.id,
      answerName: chosen.name,
      semitones: chosen.semitones,
      playbackMode: resolvedPlaybackMode()
    };

    answeredCorrectly = false;
    piano.clearHighlights();
    answersEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.remove("good", "bad", "selected");
    });

    ui.result.textContent = "Answer is hidden until you respond.";
    setStatus(ui.status, "Challenge generated. Listen and choose an interval.");
    playChallenge();
  }

  function playChallenge() {
    if (!challenge) {
      setStatus(ui.status, "Create a challenge first.");
      return;
    }

    const mode = challenge.playbackMode;
    const notes = mode === "descending"
      ? [challenge.notes[1], challenge.notes[0]]
      : challenge.notes;

    const isSequential = mode !== "harmonic";
    const noteDuration = isSequential ? SEQUENTIAL_NOTE_SECONDS : null;
    const totalSeconds = isSequential
      ? SEQUENTIAL_NOTE_SECONDS * notes.length
      : PLAY_DURATION_SECONDS;

    playback.start(notes, isSequential ? "sequential" : "block", { noteDuration });
    setStatus(
      ui.status,
      `Listening... Playback mode: ${mode}. Press Stop to end the ${totalSeconds}s playback early.`
    );
  }

  function togglePlayback() {
    if (playback.isPlaying()) {
      playback.stop();
      setStatus(ui.status, "Playback stopped.");
      return;
    }

    playChallenge();
  }

  function revealAnswer(isAuto = false) {
    if (!challenge) return;
    piano.clearHighlights();
    piano.addClassToMidis(challenge.notes, "revealed");

    ui.result.innerHTML =
      `<div><strong>Answer:</strong> ${challenge.answerName}</div>` +
      `<div class="note-list">Notes: ${noteLabelFromMidi(challenge.notes[0])} - ${noteLabelFromMidi(challenge.notes[1])}</div>` +
      `<div>Semitones: ${challenge.semitones}</div>` +
      (isAuto ? "" : "<div>Use Play to hear the same challenge again.</div>");
  }

  function submitAnswer(answerId, buttonEl) {
    if (!challenge) {
      setStatus(ui.status, "Create a challenge first.");
      return;
    }

    if (answeredCorrectly) {
      setStatus(ui.status, "This challenge is complete. Create a new challenge.");
      return;
    }

    const isCorrect = answerId === challenge.answer;

    if (isCorrect) {
      stats.correct += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      answeredCorrectly = true;

      buttonEl.classList.add("good");
      setStatus(ui.status, "Correct. Use Play or generate a new challenge.");
      ui.result.innerHTML = `<div class="result-correct">Correct</div>`;

      revealAnswer(true);

      answersEl.querySelectorAll("button").forEach((btn) => {
        if (btn.dataset.answer === challenge.answer) {
          btn.classList.add("good");
        }
      });
    } else {
      stats.incorrect += 1;
      stats.currentStreak = 0;
      buttonEl.classList.add("bad");
      setStatus(ui.status, "Incorrect. Try again, play again, or reveal the answer.");
      ui.result.innerHTML = `<div class="result-incorrect">Incorrect</div><div>Answer is still hidden.</div>`;
    }

    updateScoreText(ui.score, stats);
  }

  function resetQuiz() {
    Object.assign(stats, createStats());
    updateScoreText(ui.score, stats);

    answeredCorrectly = false;
    piano.clearHighlights();
    answersEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.remove("good", "bad", "selected");
    });

    ui.result.textContent = "Answer is hidden until you respond.";
    setStatus(
      ui.status,
      challenge
        ? "Quiz reset. Try this challenge again, or press New Challenge."
        : "Quiz reset. Press New Challenge."
    );
  }

  function applyPlaybackChange() {
    if (!challenge) return;

    challenge.playbackMode = resolvedPlaybackMode();

    if (playback.isPlaying()) {
      playChallenge();
      return;
    }

    setStatus(ui.status, `Playback mode: ${challenge.playbackMode}. Press Play to hear this challenge again.`);
  }

  intervalSettings.forEach((input) => {
    input.addEventListener("change", renderAnswerButtons);
  });

  playbackSelect.addEventListener("change", applyPlaybackChange);

  ui.newBtn.addEventListener("click", newChallenge);
  ui.playBtn.addEventListener("click", togglePlayback);
  ui.revealBtn.addEventListener("click", () => revealAnswer(false));
  ui.resetBtn.addEventListener("click", resetQuiz);

  renderAnswerButtons();
  updateScoreText(ui.score, stats);

  return {
    handleShortcut(action) {
      if (action === "new") newChallenge();
      if (action === "play") togglePlayback();
      if (action === "reset") resetQuiz();
    },
    handleMidiNote({ midi, on }) {
      if (on) {
        keyFeedback.press(midi, { sustain: true });
        return;
      }

      keyFeedback.release(midi);
    },
    stopPlayback() {
      playback.stop();
    }
  };
}

function createChordTrainer(container, audio, config) {
  const qualityInputs = config.qualities
    .map((quality) => `<label><input type="checkbox" data-quality value="${quality.id}" checked> ${quality.name}</label>`)
    .join("");

  const inversionInputs = config.inversions
    .map((inv) => `<label><input type="checkbox" data-inversion value="${inv.id}" checked> ${inv.name}</label>`)
    .join("");

  const settingsHtml = `
    <div class="settings-group">
      <strong>Qualities</strong>
      <div class="checkbox-list">${qualityInputs}</div>
    </div>
    <div class="settings-group">
      <strong>Inversions</strong>
      <div class="checkbox-list">${inversionInputs}</div>
    </div>
    <div class="settings-group">
      <strong>Playback</strong>
      <div>
        <select data-playback>
          <option value="block">Block</option>
          <option value="arpeggiated">Arpeggiated</option>
        </select>
      </div>
    </div>
  `;

  const answerHtml = `
    <div>
      <div><strong>Quality</strong></div>
      <div class="choice-grid" data-role="qualityChoices">
        ${config.qualities.map((q) => `<button class="answer-btn" data-quality-choice="${q.id}">${q.name}</button>`).join("")}
      </div>
    </div>
    <div>
      <div><strong>Inversion</strong></div>
      <div class="choice-grid" data-role="inversionChoices">
        ${config.inversions.map((inv) => `<button class="answer-btn" data-inversion-choice="${inv.id}">${inv.name}</button>`).join("")}
      </div>
    </div>
    <div class="trainer-actions">
      <button data-action="submit">Submit Answer</button>
    </div>
  `;

  const ui = createTrainerShell(container, settingsHtml, answerHtml);

  const playbackSelect = container.querySelector('select[data-playback]');
  const qualityButtons = Array.from(container.querySelectorAll('button[data-quality-choice]'));
  const inversionButtons = Array.from(container.querySelectorAll('button[data-inversion-choice]'));
  const submitBtn = container.querySelector('button[data-action="submit"]');

  const piano = new Piano(ui.pianoEl, {
    octaves: 3,
    startMidi: 48,
    clickable: true,
    keyboardClass: "three-octave",
    onKeyPress: ({ midi }) => {
      keyFeedback.press(midi);
    }
  });

  const keyFeedback = createKeyFeedback(piano, audio);

  const playback = createPlaybackController(audio, ui.playBtn);
  const stats = createStats();
  let challenge = null;
  let answeredCorrectly = false;
  let selectedQuality = null;
  let selectedInversion = null;

  function enabledQualities() {
    const selected = ensureAtLeastOneChecked(container, 'input[data-quality]', [config.qualities[0].id]);
    return config.qualities.filter((quality) => selected.includes(quality.id));
  }

  function enabledInversions() {
    const selected = ensureAtLeastOneChecked(container, 'input[data-inversion]', [String(config.inversions[0].id)]);
    return config.inversions.filter((inv) => selected.includes(String(inv.id)));
  }

  function clearChoiceHighlights() {
    qualityButtons.forEach((btn) => btn.classList.remove("selected", "good", "bad"));
    inversionButtons.forEach((btn) => btn.classList.remove("selected", "good", "bad"));
  }

  function markSelected() {
    qualityButtons.forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.qualityChoice === selectedQuality);
    });
    inversionButtons.forEach((btn) => {
      btn.classList.toggle("selected", Number(btn.dataset.inversionChoice) === selectedInversion);
    });
  }

  function newChallenge() {
    const qualityPool = enabledQualities();
    const inversionPool = enabledInversions();

    if (!qualityPool.length || !inversionPool.length) {
      setStatus(ui.status, "Select at least one quality and inversion.");
      return;
    }

    const quality = randomItem(qualityPool);
    const inversion = randomItem(inversionPool);
    const rootMidi = randomIntInclusive(45, 64);
    const notes = buildInvertedChord(rootMidi, quality.intervals, inversion.id);

    challenge = {
      rootMidi,
      quality: quality.id,
      qualityName: quality.name,
      inversion: inversion.id,
      inversionName: inversion.name,
      notes,
      answer: {
        quality: quality.id,
        inversion: inversion.id
      },
      playbackMode: playbackSelect.value
    };

    answeredCorrectly = false;
    selectedQuality = null;
    selectedInversion = null;

    clearChoiceHighlights();
    markSelected();
    piano.clearHighlights();
    ui.result.textContent = "Answer is hidden until you respond.";
    setStatus(ui.status, "Challenge generated. Listen and identify quality and inversion.");

    playChallenge();
  }

  function playChallenge() {
    if (!challenge) {
      setStatus(ui.status, "Create a challenge first.");
      return;
    }

    const isArpeggiated = challenge.playbackMode === "arpeggiated";
    const noteDuration = isArpeggiated ? SEQUENTIAL_NOTE_SECONDS : null;
    const totalSeconds = isArpeggiated
      ? SEQUENTIAL_NOTE_SECONDS * challenge.notes.length
      : PLAY_DURATION_SECONDS;

    playback.start(
      challenge.notes,
      isArpeggiated ? "sequential" : "block",
      { noteDuration }
    );
    setStatus(
      ui.status,
      `Listening... Playback mode: ${challenge.playbackMode}. Press Stop to end the ${totalSeconds}s playback early.`
    );
  }

  function togglePlayback() {
    if (playback.isPlaying()) {
      playback.stop();
      setStatus(ui.status, "Playback stopped.");
      return;
    }

    playChallenge();
  }

  function revealAnswer(auto) {
    if (!challenge) return;

    piano.clearHighlights();
    piano.addClassToMidis(challenge.notes, "revealed");

    const noteList = challenge.notes.map((midi) => noteLabelFromMidi(midi)).join(" - ");

    ui.result.innerHTML =
      (auto ? "<div class=\"result-correct\">Correct</div>" : "") +
      `<div><strong>Answer:</strong> ${noteNameOnly(challenge.rootMidi)} ${challenge.qualityName} - ${challenge.inversionName}</div>` +
      `<div class="note-list">Notes: ${noteList}</div>`;
  }

  function submitAnswer() {
    if (!challenge) {
      setStatus(ui.status, "Create a challenge first.");
      return;
    }

    if (answeredCorrectly) {
      setStatus(ui.status, "Challenge already solved. Generate a new challenge.");
      return;
    }

    if (!selectedQuality || selectedInversion === null) {
      setStatus(ui.status, "Choose both a quality and an inversion, then submit.");
      return;
    }

    const qualityCorrect = selectedQuality === challenge.answer.quality;
    const inversionCorrect = selectedInversion === challenge.answer.inversion;
    const isCorrect = qualityCorrect && inversionCorrect;

    if (isCorrect) {
      stats.correct += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      answeredCorrectly = true;

      qualityButtons.forEach((btn) => {
        if (btn.dataset.qualityChoice === selectedQuality) btn.classList.add("good");
      });
      inversionButtons.forEach((btn) => {
        if (Number(btn.dataset.inversionChoice) === selectedInversion) btn.classList.add("good");
      });

      revealAnswer(true);
      setStatus(ui.status, "Correct. Play again or create a new challenge.");
    } else {
      stats.incorrect += 1;
      stats.currentStreak = 0;

      qualityButtons.forEach((btn) => {
        if (btn.dataset.qualityChoice === selectedQuality) {
          btn.classList.add(qualityCorrect ? "good" : "bad");
        }
      });

      inversionButtons.forEach((btn) => {
        if (Number(btn.dataset.inversionChoice) === selectedInversion) {
          btn.classList.add(inversionCorrect ? "good" : "bad");
        }
      });

      ui.result.innerHTML = "<div class=\"result-incorrect\">Incorrect</div><div>Answer remains hidden. Try again or reveal.</div>";
      setStatus(ui.status, "Incorrect. Try again, play again, or reveal the answer.");
    }

    updateScoreText(ui.score, stats);
  }

  function resetQuiz() {
    Object.assign(stats, createStats());
    updateScoreText(ui.score, stats);

    answeredCorrectly = false;
    selectedQuality = null;
    selectedInversion = null;
    clearChoiceHighlights();
    markSelected();
    piano.clearHighlights();

    ui.result.textContent = "Answer is hidden until you respond.";
    setStatus(
      ui.status,
      challenge
        ? "Quiz reset. Try this challenge again, or press New Challenge."
        : "Quiz reset. Press New Challenge."
    );
  }

  function applyPlaybackChange() {
    if (!challenge) return;

    challenge.playbackMode = playbackSelect.value;

    if (playback.isPlaying()) {
      playChallenge();
      return;
    }

    setStatus(ui.status, `Playback mode: ${challenge.playbackMode}. Press Play to hear this challenge again.`);
  }

  playbackSelect.addEventListener("change", applyPlaybackChange);

  qualityButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedQuality = btn.dataset.qualityChoice;
      markSelected();
    });
  });

  inversionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInversion = Number(btn.dataset.inversionChoice);
      markSelected();
    });
  });

  ui.newBtn.addEventListener("click", newChallenge);
  ui.playBtn.addEventListener("click", togglePlayback);
  ui.revealBtn.addEventListener("click", () => revealAnswer(false));
  ui.resetBtn.addEventListener("click", resetQuiz);
  submitBtn.addEventListener("click", submitAnswer);

  updateScoreText(ui.score, stats);

  return {
    handleShortcut(action) {
      if (action === "new") newChallenge();
      if (action === "play") togglePlayback();
      if (action === "reset") resetQuiz();
    },
    handleMidiNote({ midi, on }) {
      if (on) {
        keyFeedback.press(midi, { sustain: true });
        return;
      }

      keyFeedback.release(midi);
    },
    stopPlayback() {
      playback.stop();
    }
  };
}

export function initTriadTrainer(container, audio) {
  return createChordTrainer(container, audio, {
    qualities: TRIAD_QUALITIES,
    inversions: TRIAD_INVERSIONS
  });
}

export function initSeventhTrainer(container, audio) {
  return createChordTrainer(container, audio, {
    qualities: SEVENTH_QUALITIES,
    inversions: SEVENTH_INVERSIONS
  });
}
