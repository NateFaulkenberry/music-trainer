import { AudioEngine } from "./audio.js";
import { initMidi, onMidiNote } from "./midi.js";
import { initModalTrainer } from "./modal-trainer.js";
import {
  initIntervalTrainer,
  initTriadTrainer,
  initSeventhTrainer
} from "./ear-training.js";

const audio = new AudioEngine();

const views = {
  modal: document.getElementById("view-modal"),
  ear: document.getElementById("view-ear")
};

const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
let activeView = "modal";
let activeEarView = "intervals";

const earViews = {
  intervals: document.getElementById("view-intervals"),
  triads: document.getElementById("view-triads"),
  sevenths: document.getElementById("view-sevenths")
};

const earNavButtons = Array.from(document.querySelectorAll("[data-ear-view]"));

const controllers = {
  modal: initModalTrainer(views.modal, audio),
  intervals: initIntervalTrainer(earViews.intervals, audio),
  triads: initTriadTrainer(earViews.triads, audio),
  sevenths: initSeventhTrainer(earViews.sevenths, audio)
};

function stopActiveEarPlayback() {
  const controller = controllers[activeEarView];
  if (controller && typeof controller.stopPlayback === "function") {
    controller.stopPlayback();
  }
}

function switchEarView(nextView) {
  if (!earViews[nextView]) return;
  stopActiveEarPlayback();
  activeEarView = nextView;

  Object.entries(earViews).forEach(([name, element]) => {
    element.classList.toggle("active", name === nextView);
  });

  earNavButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.earView === nextView);
  });
}

function switchView(nextView) {
  if (!views[nextView]) return;

  if (activeView === "modal" && controllers.modal && typeof controllers.modal.onViewHidden === "function") {
    controllers.modal.onViewHidden();
  }

  if (activeView === "ear" && nextView !== "ear") {
    stopActiveEarPlayback();
  }

  activeView = nextView;

  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("active", name === nextView);
  });

  navButtons.filter((button) => button.dataset.view).forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
}

navButtons.filter((button) => button.dataset.view).forEach((button) => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

earNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchEarView(button.dataset.earView);
  });
});

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

document.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) return;

  if (activeView === "modal") {
    if (event.code === "Space") {
      event.preventDefault();
      if (event.repeat) return;
      controllers.modal.playDroneToggle();
      return;
    }

    if (event.code === "Enter") {
      event.preventDefault();
      if (event.repeat) return;
      controllers.modal.generateMode();
      return;
    }

    if (event.code === "KeyR") {
      if (event.repeat) return;
      controllers.modal.resetQuiz();
    }

    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (event.repeat) return;
    controllers[activeEarView].handleShortcut("play");
    return;
  }

  if (event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    controllers[activeEarView].handleShortcut("new");
    return;
  }

  if (event.code === "KeyR") {
    if (event.repeat) return;
    controllers[activeEarView].handleShortcut("reset");
    return;
  }

});

function activeController() {
  return activeView === "modal" ? controllers.modal : controllers[activeEarView];
}

onMidiNote((event) => {
  const controller = activeController();
  if (controller && typeof controller.handleMidiNote === "function") {
    controller.handleMidiNote(event);
  }
});

function bootstrap() {
  switchEarView("intervals");
  switchView("modal");
  controllers.modal.resetQuiz();
  controllers.modal.generateMode();
  initMidi();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
