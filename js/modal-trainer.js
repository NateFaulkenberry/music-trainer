import { Piano } from "./piano.js";
import {
  CHROMATIC,
  displayNote,
  normalizeNote,
  randomItem
} from "./music-theory.js";

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
const MODES = ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"];
const INTERVALS = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10]
};
const PARENT_MAJOR_OFFSETS = {
  Ionian: 0,
  Dorian: -2,
  Phrygian: -4,
  Lydian: -5,
  Mixolydian: -7,
  Aeolian: -9,
  Locrian: -11
};
const FLAT_MAJOR_PITCH_CLASSES = new Set([5, 10, 3, 8]);
const PIANO_LOW = 21;
const PIANO_HIGH = 108;
const DEGREE_BASES = ["I", "II", "III", "IV", "V", "VI", "VII"];

function modeNotes(root, mode) {
  const index = CHROMATIC.indexOf(normalizeNote(root));
  return INTERVALS[mode].map((offset) => CHROMATIC[(index + offset) % 12]);
}

function fifth(root) {
  return CHROMATIC[(CHROMATIC.indexOf(normalizeNote(root)) + 7) % 12];
}

function shouldPreferFlats(root, mode) {
  const rootPc = CHROMATIC.indexOf(normalizeNote(root));
  const parentPc = (rootPc + PARENT_MAJOR_OFFSETS[mode] + 12) % 12;
  if (FLAT_MAJOR_PITCH_CLASSES.has(parentPc)) return true;
  return root.includes("b");
}

export function initModalTrainer(root, audio) {
  const elements = {
    generateBtn: root.querySelector("#modalGenerateBtn"),
    playDroneBtn: root.querySelector("#modalPlayDroneBtn"),
    revealBtn: root.querySelector("#modalRevealBtn"),
    resetBtn: root.querySelector("#modalResetBtn"),
    result: root.querySelector("#modalResult"),
    droneText: root.querySelector("#modalDroneText"),
    droneKb: root.querySelector("#modalDroneKb"),
    quizKb: root.querySelector("#modalQuizKb"),
    notes: root.querySelector("#modalNotes"),
    parentMajorInfo: root.querySelector("#modalParentMajorInfo"),
    chordsSection: root.querySelector("#modalChordsSection"),
    score: root.querySelector("#modalScore"),
    midiStatus: root.querySelector("#modalMidiStatus"),
    midiMonitor: root.querySelector("#modalMidiMonitor")
  };

  let currentNotes = [];
  let currentDrone = null;
  let currentKey = "";
  let currentMode = "";
  let correct = 0;
  let incorrect = 0;
  let foundNotes = new Set();
  let preferFlats = false;
  let dronePlaying = false;
  let droneVoices = [];

  const dronePiano = new Piano(elements.droneKb, {
    octaves: 2,
    startMidi: 48,
    clickable: false,
    keyboardClass: "two-octave",
    labelFormatter: (note) => displayNote(note, preferFlats)
  });

  const quizPiano = new Piano(elements.quizKb, {
    octaves: 1,
    startMidi: 60,
    clickable: true,
    keyboardClass: "one-octave",
    labelFormatter: (note) => displayNote(note, preferFlats),
    onKeyPress: ({ note, midi }) => hit(note, midi)
  });

  function setDroneButtonLabel() {
    elements.playDroneBtn.textContent = dronePlaying ? "Pause Drone" : "Play Drone";
  }

  function updateScore() {
    const total = correct + incorrect;
    const accuracy = total ? ((correct / total) * 100).toFixed(1) : "0";
    elements.score.textContent = `Correct: ${correct} | Incorrect: ${incorrect} | Accuracy: ${accuracy}%`;
  }

  function droneOctaveForNoteIndex(index) {
    return index >= 3 ? 1 : 0;
  }

  function currentDisplayNotes(notes) {
    return notes.map((n) => displayNote(n, preferFlats));
  }

  function majorKeyForMode(rootNote, mode) {
    const rootPc = CHROMATIC.indexOf(normalizeNote(rootNote));
    const parentPc = (rootPc + PARENT_MAJOR_OFFSETS[mode] + 12) % 12;
    const parentSharp = CHROMATIC[parentPc];
    return displayNote(parentSharp, shouldPreferFlats(rootNote, mode));
  }

  function chordLabelForDegree(index) {
    const rootNote = currentNotes[index];
    const third = currentNotes[(index + 2) % 7];
    const fifthNote = currentNotes[(index + 4) % 7];
    const rootPc = CHROMATIC.indexOf(rootNote);
    const thirdInt = (CHROMATIC.indexOf(third) - rootPc + 12) % 12;
    const fifthInt = (CHROMATIC.indexOf(fifthNote) - rootPc + 12) % 12;
    const shownRoot = displayNote(rootNote, preferFlats);

    if (thirdInt === 4 && fifthInt === 7) return shownRoot + "maj";
    if (thirdInt === 3 && fifthInt === 7) return shownRoot + "min";
    if (thirdInt === 3 && fifthInt === 6) return shownRoot + "dim";
    if (thirdInt === 4 && fifthInt === 8) return shownRoot + "aug";
    return shownRoot;
  }

  function romanDegreeForQuality(index) {
    const rootNote = currentNotes[index];
    const third = currentNotes[(index + 2) % 7];
    const fifthNote = currentNotes[(index + 4) % 7];
    const rootPc = CHROMATIC.indexOf(rootNote);
    const thirdInt = (CHROMATIC.indexOf(third) - rootPc + 12) % 12;
    const fifthInt = (CHROMATIC.indexOf(fifthNote) - rootPc + 12) % 12;
    const base = DEGREE_BASES[index];

    if (thirdInt === 4 && fifthInt === 7) return base;
    if (thirdInt === 3 && fifthInt === 7) return base.toLowerCase();
    if (thirdInt === 3 && fifthInt === 6) return base.toLowerCase() + "\u00B0";
    if (thirdInt === 4 && fifthInt === 8) return base + "+";
    return base;
  }

  function renderChordsTable() {
    const degreeHeaderCells = currentNotes.map((_, i) => "<th>" + romanDegreeForQuality(i) + "</th>").join("");
    const chordCells = currentNotes.map((_, i) => "<td>" + chordLabelForDegree(i) + "</td>").join("");
    const showSecondaryDominants = currentMode === "Ionian" || currentMode === "Aeolian";

    let secondaryContent = "";
    if (showSecondaryDominants) {
      const secondaryTop = ["<th>" + romanDegreeForQuality(0) + "</th>"];
      const secondaryBottom = ["<td>" + chordLabelForDegree(0) + "</td>"];

      for (let i = 1; i < currentNotes.length; i++) {
        const targetRoman = romanDegreeForQuality(i);
        const targetRootPc = CHROMATIC.indexOf(currentNotes[i]);
        const dominantRootPc = (targetRootPc + 7) % 12;
        const dominantRoot = displayNote(CHROMATIC[dominantRootPc], preferFlats);

        secondaryTop.push("<th>V/" + targetRoman + "</th>");
        secondaryBottom.push("<td>" + dominantRoot + "7</td>");
        secondaryTop.push("<th>" + targetRoman + "7</th>");
        secondaryBottom.push("<td>" + chordLabelForDegree(i) + "</td>");
      }

      secondaryContent =
        '<div class="tableTitle secondaryTable">Secondary Dominants</div>' +
        '<table aria-label="Secondary dominants">' +
        "<tr>" + secondaryTop.join("") + "</tr>" +
        "<tr>" + secondaryBottom.join("") + "</tr>" +
        "</table>";
    }

    elements.chordsSection.innerHTML =
      '<div class="tableTitle">Diatonic Chords</div>' +
      '<table aria-label="Diatonic chords">' +
      "<tr>" + degreeHeaderCells + "</tr>" +
      "<tr>" + chordCells + "</tr>" +
      "</table>" +
      secondaryContent;
  }

  function updateDroneHighlights() {
    const active = new Set();
    if (currentDrone) {
      currentDrone.notes.forEach((note, i) => {
        active.add(note + "|" + droneOctaveForNoteIndex(i));
      });
    }

    dronePiano.getKeyElements().forEach((key) => {
      key.classList.remove("drone");
      const keyId = key.dataset.note + "|" + key.dataset.octave;
      if (dronePlaying && active.has(keyId)) {
        key.classList.add("drone");
      }
    });
  }

  function droneChoices(rootNote) {
    const normalized = normalizeNote(rootNote);
    const rootIndex = CHROMATIC.indexOf(normalized);
    const fifthNote = fifth(rootNote);

    return [
      {
        name: rootNote + "maj7",
        notes: [normalized, CHROMATIC[(rootIndex + 4) % 12], fifthNote, CHROMATIC[(rootIndex + 11) % 12]]
      },
      {
        name: rootNote + " triad",
        notes: [normalized, CHROMATIC[(rootIndex + 4) % 12], fifthNote]
      },
      {
        name: rootNote + " + " + displayNote(fifthNote, preferFlats) + " drone",
        notes: [normalized, fifthNote]
      }
    ];
  }

  function refreshPianos() {
    dronePiano.setOptions({ labelFormatter: (note) => displayNote(note, preferFlats) });
    quizPiano.setOptions({ labelFormatter: (note) => displayNote(note, preferFlats) });
    updateDroneHighlights();
  }

  function stopDrone() {
    if (!droneVoices.length) {
      dronePlaying = false;
      updateDroneHighlights();
      setDroneButtonLabel();
      return;
    }

    audio.stopDrone(droneVoices);
    droneVoices = [];
    dronePlaying = false;
    updateDroneHighlights();
    setDroneButtonLabel();
  }

  async function startDrone() {
    if (!currentDrone || dronePlaying) return;

    const midiNotes = currentDrone.notes.map((note, i) => {
      const octaveOffset = droneOctaveForNoteIndex(i) * 12;
      return 48 + CHROMATIC.indexOf(note) + octaveOffset;
    });

    droneVoices = await audio.startDrone(midiNotes, { gain: 0.05, type: "sine" });
    dronePlaying = true;
    updateDroneHighlights();
    setDroneButtonLabel();
  }

  function revealNotes() {
    if (!currentNotes.length) return;
    elements.notes.textContent = currentDisplayNotes(currentNotes).join(" - ");
    const parentMajor = majorKeyForMode(currentKey, currentMode);
    elements.parentMajorInfo.textContent = "Parent major key: " + parentMajor + " major";
    renderChordsTable();

    quizPiano.getKeyElements().forEach((key) => {
      if (currentNotes.includes(key.dataset.note)) {
        key.classList.add("revealed");
      }
    });
  }

  function completeMode() {
    elements.notes.textContent = currentDisplayNotes(currentNotes).join(" - ");
    const parentMajor = majorKeyForMode(currentKey, currentMode);
    elements.parentMajorInfo.textContent = "Parent major key: " + parentMajor + " major";
    renderChordsTable();

    quizPiano.getKeyElements().forEach((key) => {
      key.classList.remove("good");
      if (currentNotes.includes(key.dataset.note)) {
        key.classList.add("revealed");
      }
    });
  }

  function resetQuiz() {
    foundNotes = new Set();
    quizPiano.clearHighlights(["good", "bad", "revealed"]);

    correct = 0;
    incorrect = 0;
    updateScore();

    elements.notes.textContent = "";
    elements.parentMajorInfo.textContent = "";
    elements.chordsSection.innerHTML = "";
  }

  async function hit(note, midiNote = null) {
    if (!currentNotes.length) return;

    const playbackNote = Number.isInteger(midiNote)
      ? midiNote
      : 60 + CHROMATIC.indexOf(note);

    await audio.playNote(playbackNote, 0.4, { gain: 0.08 });

    quizPiano.getKeysByNote(note).forEach((key) => {
      if (currentNotes.includes(note)) {
        if (!foundNotes.has(note)) {
          correct += 1;
          foundNotes.add(note);
        }

        key.classList.add("good");
        if (foundNotes.size === currentNotes.length) {
          completeMode();
        }
      } else {
        key.classList.add("bad");
        incorrect += 1;
      }
    });

    updateScore();
  }

  function generateMode() {
    stopDrone();
    foundNotes = new Set();
    currentKey = randomItem(KEYS);
    currentMode = randomItem(MODES);
    currentNotes = modeNotes(currentKey, currentMode);
    preferFlats = shouldPreferFlats(currentKey, currentMode);
    currentDrone = randomItem(droneChoices(currentKey));

    correct = 0;
    incorrect = 0;
    updateScore();

    elements.result.textContent = currentKey + " " + currentMode;
    elements.droneText.textContent = "Drone: " + currentDrone.name;
    elements.notes.textContent = "";
    elements.parentMajorInfo.textContent = "";
    elements.chordsSection.innerHTML = "";

    refreshPianos();
  }

  function playDroneToggle() {
    if (!currentDrone) return;
    if (dronePlaying) {
      stopDrone();
      return;
    }
    startDrone();
  }

  function attachMidiInput(input) {
    input.onmidimessage = (event) => {
      const [status, note, velocity] = event.data;
      const noteName = CHROMATIC[note % 12];
      const inPianoRange = note >= PIANO_LOW && note <= PIANO_HIGH;

      elements.midiMonitor.textContent =
        `status=${status} note=${note} velocity=${velocity} mapped=${noteName} piano88=${inPianoRange}`;

      if ((status & 0xf0) === 0x90 && velocity > 0) {
        if (!inPianoRange) return;
        hit(noteName, note);
      }
    };
  }

  function initMidi() {
    if (!navigator.requestMIDIAccess) {
      elements.midiStatus.textContent = "MIDI: Web MIDI not supported";
      return;
    }

    navigator.requestMIDIAccess()
      .then((midi) => {
        elements.midiStatus.textContent = "MIDI Ready";
        const connectAll = () => {
          for (const input of midi.inputs.values()) {
            attachMidiInput(input);
          }
        };
        connectAll();
        midi.onstatechange = () => {
          connectAll();
        };
      })
      .catch(() => {
        elements.midiStatus.textContent = "MIDI Access Failed";
      });
  }

  elements.generateBtn.addEventListener("click", generateMode);
  elements.playDroneBtn.addEventListener("click", playDroneToggle);
  elements.revealBtn.addEventListener("click", revealNotes);
  elements.resetBtn.addEventListener("click", resetQuiz);

  setDroneButtonLabel();
  initMidi();

  return {
    generateMode,
    resetQuiz,
    playDroneToggle,
    revealNotes,
    onViewHidden: () => {
      stopDrone();
    }
  };
}
