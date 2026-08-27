export const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC_TO_SHARP = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#"
};

const SHARP_TO_FLAT = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb"
};

export function normalizeNote(note) {
  return ENHARMONIC_TO_SHARP[note] || note;
}

export function noteNameFromMidi(midi) {
  return CHROMATIC[((midi % 12) + 12) % 12];
}

export function noteLabelFromMidi(midi, preferFlats = false) {
  const note = noteNameFromMidi(midi);
  const shown = preferFlats ? (SHARP_TO_FLAT[note] || note) : note;
  const octave = Math.floor(midi / 12) - 1;
  return shown + octave;
}

export function displayNote(note, preferFlats = false) {
  if (!preferFlats) return note;
  return SHARP_TO_FLAT[note] || note;
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
