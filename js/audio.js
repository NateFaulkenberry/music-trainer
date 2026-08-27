export class AudioEngine {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx();
  }

  get context() {
    return this.audioCtx;
  }

  async resume() {
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  freqFromMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  scheduleTone(midi, options = {}) {
    const {
      startTime = this.audioCtx.currentTime + 0.01,
      duration = 0.35,
      gain = 0.08,
      type = "sine",
      attack = 0.005,
      release = 0.03
    } = options;

    const osc = this.audioCtx.createOscillator();
    const amp = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(this.freqFromMidi(midi), startTime);

    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(gain, startTime + attack);
    amp.gain.setValueAtTime(gain, startTime + Math.max(attack, duration - release));
    amp.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(amp);
    amp.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.005);

    return { osc, amp, endTime: startTime + duration };
  }

  async playNote(midi, duration = 0.35, options = {}) {
    await this.resume();
    this.scheduleTone(midi, { ...options, duration });
    return duration;
  }

  async playNotes(midis, duration = 0.5, options = {}) {
    await this.resume();
    const {
      mode = "block",
      gap = 0.24,
      gain = 0.08,
      type = "sine"
    } = options;

    const start = this.audioCtx.currentTime + 0.01;

    if (mode === "arpeggiated") {
      midis.forEach((midi, i) => {
        this.scheduleTone(midi, {
          startTime: start + i * gap,
          duration,
          gain,
          type
        });
      });
      return duration + (midis.length - 1) * gap;
    }

    midis.forEach((midi) => {
      this.scheduleTone(midi, {
        startTime: start,
        duration,
        gain,
        type
      });
    });

    return duration;
  }

  async playInterval(note1, note2, mode = "harmonic") {
    if (mode === "ascending") {
      return this.playNotes([note1, note2], 0.42, { mode: "arpeggiated", gap: 0.32 });
    }

    if (mode === "descending") {
      return this.playNotes([note2, note1], 0.42, { mode: "arpeggiated", gap: 0.32 });
    }

    return this.playNotes([note1, note2], 0.65, { mode: "block" });
  }

  async playChord(notes, mode = "block") {
    if (mode === "arpeggiated") {
      return this.playNotes(notes, 0.4, { mode: "arpeggiated", gap: 0.18 });
    }
    return this.playNotes(notes, 0.8, { mode: "block" });
  }

  scheduleSustainedVoice(midi, options = {}) {
    const {
      startTime = this.audioCtx.currentTime + 0.01,
      stopTime = startTime + 5,
      gain = 0.06,
      type = "sine",
      attack = 0.01,
      release = 0.08
    } = options;

    const osc = this.audioCtx.createOscillator();
    const amp = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(this.freqFromMidi(midi), startTime);

    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(gain, startTime + attack);
    amp.gain.setValueAtTime(gain, Math.max(startTime + attack, stopTime - release));
    amp.gain.linearRampToValueAtTime(0.0001, stopTime);

    osc.connect(amp);
    amp.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(stopTime + 0.01);

    return { osc, amp };
  }

  async playSustained(midis, options = {}) {
    await this.resume();
    const {
      mode = "block",
      duration = 5,
      noteDuration = null,
      gain = 0.06,
      type = "sine"
    } = options;

    const start = this.audioCtx.currentTime + 0.01;

    if (mode === "sequential" && midis.length > 1) {
      const slot = noteDuration || duration / midis.length;
      return midis.map((midi, i) =>
        this.scheduleSustainedVoice(midi, {
          startTime: start + i * slot,
          stopTime: start + (i + 1) * slot,
          gain,
          type
        })
      );
    }

    return midis.map((midi) =>
      this.scheduleSustainedVoice(midi, {
        startTime: start,
        stopTime: start + duration,
        gain,
        type
      })
    );
  }

  stopVoices(voices) {
    if (!voices || !voices.length) {
      return;
    }

    const now = this.audioCtx.currentTime;
    const stopAt = now + 0.05;

    voices.forEach((voice) => {
      voice.amp.gain.cancelScheduledValues(now);
      voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
      voice.amp.gain.linearRampToValueAtTime(0.0001, stopAt);
      try {
        voice.osc.stop(stopAt);
      } catch (err) {
        /* oscillator already stopped */
      }
    });
  }

  async startDrone(midis, options = {}) {
    await this.resume();
    const { gain = 0.05, type = "sine" } = options;
    const start = this.audioCtx.currentTime + 0.01;

    return midis.map((midi) => {
      const osc = this.audioCtx.createOscillator();
      const amp = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(this.freqFromMidi(midi), start);
      amp.gain.setValueAtTime(gain, start);

      osc.connect(amp);
      amp.connect(this.audioCtx.destination);
      osc.start(start);

      return { osc, amp };
    });
  }

  stopDrone(voices) {
    if (!voices || !voices.length) {
      return;
    }

    const now = this.audioCtx.currentTime;
    const stopAt = now + 0.04;

    voices.forEach((voice) => {
      voice.amp.gain.setTargetAtTime(0.0001, now, 0.015);
      voice.osc.stop(stopAt);
    });
  }
}
