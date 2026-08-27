import { CHROMATIC, noteNameFromMidi } from "./music-theory.js";

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSETS = [1, 3, 6, 8, 10];
const BLACK_POSITIONS = [28, 68, 148, 188, 228];

export class Piano {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      octaves: 1,
      startMidi: 60,
      clickable: false,
      keyboardClass: "",
      labelFormatter: (note) => note,
      onKeyPress: null,
      ...options
    };

    this.keyElements = [];
    this.render();
  }

  setOptions(nextOptions = {}) {
    this.options = { ...this.options, ...nextOptions };
    this.render();
  }

  render() {
    const {
      octaves,
      startMidi,
      clickable,
      keyboardClass,
      labelFormatter,
      onKeyPress
    } = this.options;

    this.container.innerHTML = "";
    this.keyElements = [];
    this.container.className = "keyboard " + keyboardClass;

    let whiteLeft = 0;

    for (let octave = 0; octave < octaves; octave++) {
      WHITE_OFFSETS.forEach((offset) => {
        const midi = startMidi + octave * 12 + offset;
        const note = CHROMATIC[(midi % 12 + 12) % 12];
        const key = document.createElement("div");
        key.className = "white" + (clickable ? " clickable" : "");
        key.style.left = whiteLeft + "px";
        key.dataset.note = note;
        key.dataset.midi = String(midi);
        key.dataset.octave = String(octave);
        key.textContent = labelFormatter(note, midi);

        if (clickable && typeof onKeyPress === "function") {
          key.addEventListener("click", () => {
            onKeyPress({
              note,
              midi,
              octave,
              keyElement: key
            });
          });
        }

        this.container.appendChild(key);
        this.keyElements.push(key);
        whiteLeft += 40;
      });
    }

    for (let octave = 0; octave < octaves; octave++) {
      BLACK_OFFSETS.forEach((offset, i) => {
        const midi = startMidi + octave * 12 + offset;
        const note = noteNameFromMidi(midi);
        const key = document.createElement("div");
        key.className = "black" + (clickable ? " clickable" : "");
        key.style.left = BLACK_POSITIONS[i] + octave * 280 + "px";
        key.dataset.note = note;
        key.dataset.midi = String(midi);
        key.dataset.octave = String(octave);
        key.textContent = labelFormatter(note, midi);

        if (clickable && typeof onKeyPress === "function") {
          key.addEventListener("click", () => {
            onKeyPress({
              note,
              midi,
              octave,
              keyElement: key
            });
          });
        }

        this.container.appendChild(key);
        this.keyElements.push(key);
      });
    }
  }

  getKeyElements() {
    return [...this.keyElements];
  }

  getKeysByNote(noteName) {
    return this.keyElements.filter((el) => el.dataset.note === noteName);
  }

  getKeysByMidi(midi) {
    return this.keyElements.filter((el) => Number(el.dataset.midi) === midi);
  }

  clearHighlights(classNames = ["good", "bad", "revealed", "drone", "played"]) {
    this.keyElements.forEach((el) => {
      classNames.forEach((className) => el.classList.remove(className));
    });
  }

  addClassToMidis(midis, className) {
    const target = new Set(midis);
    this.keyElements.forEach((el) => {
      const midi = Number(el.dataset.midi);
      if (target.has(midi)) {
        el.classList.add(className);
      }
    });
  }

  addClassToNoteNames(noteNames, className) {
    const target = new Set(noteNames);
    this.keyElements.forEach((el) => {
      if (target.has(el.dataset.note)) {
        el.classList.add(className);
      }
    });
  }
}
