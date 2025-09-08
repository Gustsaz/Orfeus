const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;

const friction = 0.985;
const minSpin = 0.25;
let lastSpinSign = 1;

let activeButton = null;
let locked = false;

// Utils
function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function detectButton() {
  const rad = (currentRotation - 90) * Math.PI / 180;
  const sx = Math.cos(rad), sy = Math.sin(rad);
  let foundButton = null, bestDot = -2;

  buttons.forEach(btn => {
    const rect = disc.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const br = btn.getBoundingClientRect();
    const bx = br.left + br.width / 2 - cx;
    const by = br.top + br.height / 2 - cy;

    const len = Math.hypot(bx, by);
    const vx = bx / len, vy = by / len;
    const dot = sx * vx + sy * vy;
    const angleDiff = Math.acos(dot) * (180 / Math.PI);

    if (angleDiff <= 15 && dot > bestDot) {
      bestDot = dot; foundButton = btn;
    }
  });
  return foundButton;
}

// Flag pra saber se houve movimento real
let movedThisFrame = false;

// Rotação
function updateRotation() {
  if (isDragging) {
    if (movedThisFrame) {
      currentRotation += velocity;
      if (velocity !== 0) lastSpinSign = Math.sign(velocity);
    } else {
      velocity = 0;
    }
    movedThisFrame = false;
  } else {
    if (Math.abs(velocity) > minSpin) {
      velocity *= friction;
      currentRotation += velocity;
    } else {
      velocity = lastSpinSign * minSpin;
      currentRotation += velocity;
    }
  }
}

// Loop
function spin() {
  if (!locked) updateRotation();

  // aplica rotação no disco
  disc.style.setProperty("--rotation", `${currentRotation}deg`);

  // posiciona a seta (orbita o raio)
  const radius = disc.offsetWidth / 2;
  const arrowH = seta.offsetHeight || 40;
  const margem = 6;
  const r = radius - arrowH / 2 - margem;
  seta.style.transform = `
    translate(-50%, -50%)
    rotate(${currentRotation}deg)
    translateY(-${r}px)
  `;

  let foundButton = null;
  if (window.innerWidth > 768) {
    foundButton = detectButton();
  }

  if (!locked && foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
    }
    if (foundButton) foundButton.style.backgroundColor = "#ff5050";
    activeButton = foundButton;
  }

  requestAnimationFrame(spin);
}
spin();

// Drag
disc.addEventListener("mousedown", e => {
  if (window.innerWidth <= 768) return;
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false;
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  disc.style.cursor = "grab";

  const targetBtn = detectButton();

  if (targetBtn) {
    locked = true;
    targetBtn.classList.add("agarrado");
    goToTabFromButton(targetBtn);
  } else {
    locked = false;
  }
});

// Move
window.addEventListener("mousemove", e => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  velocity = delta * 1.5;
  lastAngle = angle;

  movedThisFrame = true;
});

// Popup música
window.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("musicPopup");
  if (!popup) return;
  setTimeout(() => {
    popup.classList.add("show");
    setTimeout(() => {
      popup.classList.remove("show");
      popup.classList.add("hide");
    }, 5000);
  }, 2000);
});

// --- Tabs ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach(page => page.classList.remove("active"));

  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const tabPage = document.getElementById(tabId);

  if (tabBtn) tabBtn.classList.add("active");
  if (tabPage) tabPage.classList.add("active");
}

// --- Mapear botões do disco para abas ---
function goToTabFromButton(btn) {
  if (btn.classList.contains("norte")) {
    switchTab("afinador");
  } else if (btn.classList.contains("sul")) {
    switchTab("cursos");
  } else if (btn.classList.contains("sudoeste")) {
    switchTab("instrumentos");
  } else if (btn.classList.contains("oeste")) {
    switchTab("ranking");
  }
}

// --- Virtual Piano ---
window.addEventListener("DOMContentLoaded", () => {
  const whiteKeysContainer = document.querySelector("#virtual-piano .white-keys");
  const blackKeysContainer = document.querySelector("#virtual-piano .black-keys");

  if (!whiteKeysContainer || !blackKeysContainer) return;

  // Oitavas que queremos
  const startOctave = 3;
  const endOctave = 5;

  const whiteOrder = ["C", "D", "E", "F", "G", "A", "B"];
  const blackOrder = ["C#", "D#", "", "F#", "G#", "A#"];

  // Criar teclas
  let keyIndex = 0;
  for (let octave = startOctave; octave <= endOctave; octave++) {
    whiteOrder.forEach((note, i) => {
      const key = document.createElement("div");
      key.classList.add("key", "white");
      key.dataset.note = `${note}${octave}`;
      key.style.left = `${keyIndex * 40}px`;
      whiteKeysContainer.appendChild(key);
      keyIndex++;
    });

    blackOrder.forEach((note, i) => {
      if (note === "") return;
      const key = document.createElement("div");
      key.classList.add("key", "black");
      key.dataset.note = `${note}${octave}`;
      key.style.left = `${40 * (i + (octave - startOctave) * 7) + 26}px`;
      blackKeysContainer.appendChild(key);
    });
  }

  // --- Player com samples reais de piano ---
  const sampler = new Tone.Sampler({
    urls: {
      "A0": "A0.mp3",
      "C1": "C1.mp3",
      "D#1": "Ds1.mp3",
      "F#1": "Fs1.mp3",
      "A1": "A1.mp3",
      "C2": "C2.mp3",
      "D#2": "Ds2.mp3",
      "F#2": "Fs2.mp3",
      "A2": "A2.mp3",
      "C3": "C3.mp3",
      "D#3": "Ds3.mp3",
      "F#3": "Fs3.mp3",
      "A3": "A3.mp3",
      "C4": "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      "A4": "A4.mp3",
      "C5": "C5.mp3",
      "D#5": "Ds5.mp3",
      "F#5": "Fs5.mp3",
      "A5": "A5.mp3",
      "C6": "C6.mp3"
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/"
  }).toDestination();

  // Funções de tocar e parar notas
  function playNote(note) {
    sampler.triggerAttack(note);
  }
  function stopNote(note) {
    sampler.triggerRelease(note);
  }

  // Controle de clique e arraste
  let isMouseDown = false;
  let lastKey = null;

  function activateKey(key) {
    if (!key) return;
    const note = key.dataset.note;
    if (lastKey && lastKey !== key) {
      stopNote(lastKey.dataset.note);
      lastKey.classList.remove("active");
    }
    playNote(note);
    key.classList.add("active");
    lastKey = key;
  }

  function deactivateKey(key) {
    if (!key) return;
    stopNote(key.dataset.note);
    key.classList.remove("active");
    lastKey = null;
  }

  document.querySelectorAll("#virtual-piano .key").forEach(key => {
    key.addEventListener("mousedown", e => {
      isMouseDown = true;
      activateKey(key);
    });
    key.addEventListener("mouseenter", e => {
      if (isMouseDown) activateKey(key);
    });
    key.addEventListener("mouseup", e => {
      deactivateKey(key);
      isMouseDown = false;
    });
    key.addEventListener("mouseleave", e => {
      if (!isMouseDown) deactivateKey(key);
    });
  });

  window.addEventListener("mouseup", () => {
    if (lastKey) deactivateKey(lastKey);
    isMouseDown = false;
  });
});

// --- Afinador ---
const tunerArc = document.getElementById("tunerArc");
const tunerNote = document.getElementById("tunerNote");
const micToggle = document.getElementById("micToggle");
const micIcon = document.getElementById("micIcon");

let audioCtx = null;
let analyser = null;
let buffer = null;
let running = false;
let stream = null;
let markers = [];

// Cria 11 marcadores (5 à esquerda, 1 centro, 5 à direita)
function createMarkers() {
  if (!tunerArc) return;
  tunerArc.innerHTML = "";
  markers = [];

  for (let i = 0; i < 11; i++) {
    const marker = document.createElement("div");
    marker.classList.add("marker");
    if (i === 5) marker.classList.add("center");
    tunerArc.appendChild(marker);
    markers.push(marker);
  }
}
createMarkers();

function freqToNote(freq) {
  const A4 = 440;
  const noteNames = ["C", "C#", "D", "D#", "E", "F",
                     "F#", "G", "G#", "A", "A#", "B"];
  const noteNum = Math.round(12 * Math.log2(freq / A4) + 69);
  const note = noteNames[noteNum % 12]; // 🔹 só a nota
  const noteFreq = A4 * Math.pow(2, (noteNum - 69) / 12);
  const cents = Math.floor(1200 * Math.log2(freq / noteFreq));
  return { note, cents };
}

function updateTunerDisplay(note, cents) {
  tunerNote.textContent = note;

  // reset
  markers.forEach(m => m.style.background = "#555");

  if (Math.abs(cents) < 5) {
    markers[5].style.background = "lime"; // afinado
  } else {
    const steps = Math.min(5, Math.floor(Math.abs(cents) / 10));
    for (let i = 1; i <= steps; i++) {
      const idx = cents < 0 ? 5 - i : 5 + i;
      if (markers[idx]) {
        markers[idx].style.background = i <= 2 ? "yellow" : "red";
      }
    }
  }
}

function resetTuner() {
  tunerNote.textContent = "--";
  markers.forEach(m => m.style.background = "#555");
}

function detectPitch() {
  if (!running) return;

  analyser.getFloatTimeDomainData(buffer);

  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) {
    resetTuner();
    requestAnimationFrame(detectPitch);
    return;
  }

  let bestOffset = -1, bestCorr = 0;
  for (let offset = 20; offset < 1000; offset++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      corr += buffer[i] * buffer[i + offset];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset > -1) {
    const freq = audioCtx.sampleRate / bestOffset;
    const { note, cents } = freqToNote(freq);
    updateTunerDisplay(note, cents);
  }

  requestAnimationFrame(detectPitch);
}

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    buffer = new Float32Array(analyser.fftSize);
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    running = true;
    detectPitch();
  } catch (err) {
    console.error("Erro ao acessar microfone:", err);
  }
}

function stopMic() {
  running = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  resetTuner();
}

micToggle.addEventListener("click", () => {
  if (!running) {
    micIcon.src = "imgs/mic_on_icon.png";
    startMic();
  } else {
    micIcon.src = "imgs/mic_off_icon.png";
    stopMic();
  }
});
