const noteListeners = new Set();
const messageListeners = new Set();
const statusListeners = new Set();

let statusText = "MIDI: Initializing...";
let requested = false;

function setStatus(text) {
  statusText = text;
  statusListeners.forEach((handler) => handler(statusText));
}

function subscribe(set, handler) {
  set.add(handler);
  return () => set.delete(handler);
}

export function onMidiNote(handler) {
  return subscribe(noteListeners, handler);
}

export function onMidiMessage(handler) {
  return subscribe(messageListeners, handler);
}

export function onMidiStatus(handler) {
  handler(statusText);
  return subscribe(statusListeners, handler);
}

function handleMessage(event) {
  const [status, note, velocity] = event.data;
  const command = status & 0xf0;

  messageListeners.forEach((handler) => handler({ status, note, velocity }));

  if (command === 0x90 && velocity > 0) {
    noteListeners.forEach((handler) => handler({ midi: note, velocity, on: true }));
    return;
  }

  if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    noteListeners.forEach((handler) => handler({ midi: note, velocity: 0, on: false }));
  }
}

export function initMidi() {
  if (requested) return;
  requested = true;

  if (!navigator.requestMIDIAccess) {
    setStatus("MIDI: Web MIDI not supported");
    return;
  }

  navigator.requestMIDIAccess()
    .then((midi) => {
      setStatus("MIDI Ready");

      const connectAll = () => {
        for (const input of midi.inputs.values()) {
          input.onmidimessage = handleMessage;
        }
      };

      connectAll();
      midi.onstatechange = connectAll;
    })
    .catch(() => {
      setStatus("MIDI Access Failed");
    });
}
