# music-trainer

Static browser-based music training site with:

- Modal Trainer (original workflow preserved)
- Interval Ear Training
- Triad Ear Training
- 7th Chord Ear Training

## Run

This project is fully client-side and has no backend dependencies.

1. Open the folder in VS Code.
2. Start a local static server (for example, Live Server extension).
3. Open `index.html` in the browser through that server.

## Structure

- `index.html`: site navigation and training view containers
- `styles.css`: shared styling for all trainers
- `js/audio.js`: shared Web Audio engine
- `js/piano.js`: shared reusable piano component
- `js/modal-trainer.js`: modal trainer logic
- `js/ear-training.js`: interval, triad, and 7th chord trainers
- `js/app.js`: top-level view routing and keyboard shortcut coordination
