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
  if (tabPage) {
    tabPage.classList.add("active");
    // aplica fade-in para filhos da página
    Array.from(tabPage.children).forEach((el, idx) => {
      el.classList.add('fade-in-load');
      el.style.setProperty('--fade-delay', `${idx * 60}ms`);
    });
    setTimeout(() => {
      Array.from(tabPage.children).forEach(el => {
        el.classList.remove('fade-in-load');
        el.style.removeProperty('--fade-delay');
      });
    }, 1200);
  }
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
  const instButtons = document.querySelectorAll('.instrument-selector .inst-btn');
  const rkButtons = document.querySelectorAll('.home-ranking .rk-btn');
  const rkTableBody = document.querySelector('#homeRankingTable tbody');
  const instrumentArea = document.getElementById('instrument-area');
  const modulesRoot = document.querySelector('#cursos .modules');
  const lessonPanel = document.getElementById('lessonPanel');
  const lessonContent = document.getElementById('lessonContent');
  const lessonClose = document.getElementById('lessonClose');
  const courseBar = document.getElementById('courseProgressBar');
  const courseText = document.getElementById('courseProgressText');

  if (!whiteKeysContainer || !blackKeysContainer) return;
  // Ranking Firebase (coleção 'scores' com campos: user, points, period: 'all'|'monthly'|'weekly')
  async function loadRanking(period) {
    try {
      if (!window.firebase || !firebase.firestore) return;
      const db = firebase.firestore();
      let query = db.collection('scores');
      if (period !== 'all') query = query.where('period', '==', period);
      query = query.orderBy('points', 'desc').limit(10);
      const snap = await query.get();
      const rows = [];
      let pos = 1;
      snap.forEach(doc => {
        const d = doc.data();
        rows.push(`<tr><td>${pos++}</td><td>${d.user || 'Anônimo'}</td><td>${d.points || 0}</td></tr>`);
      });
      if (rkTableBody) rkTableBody.innerHTML = rows.join('');
    } catch (err) { console.error('Ranking error', err); }
  }

  if (rkButtons.length) {
    rkButtons.forEach(b => {
      b.addEventListener('click', () => {
        rkButtons.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const host = document.querySelector('.home-ranking');
        if (host) { host.classList.add('fade-in-load'); setTimeout(() => host.classList.remove('fade-in-load'), 450); }
        loadRanking(b.dataset.period);
      });
    });
    loadRanking('all');
  }

  // -------- Cursos (progresso simples em localStorage) --------
  const PROGRESS_KEY = 'orfeus.course.progress';
  function readProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { done: [] }; } catch { return { done: [] }; }
  }
  function writeProgress(state) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); }
  function updateProgressUI() {
    const state = readProgress();
    const total = 2;
    const pct = Math.round((state.done.length / total) * 100);
    if (courseBar) courseBar.style.width = pct + "%";
    if (courseText) courseText.textContent = pct + "% concluído";
    document.querySelectorAll('#cursos .module-card').forEach(card => {
      const id = card.dataset.module;
      const status = card.querySelector('.module-status');
      if (state.done.includes(id)) { status.dataset.status = 'done'; status.textContent = '✓'; }
      else { status.dataset.status = 'pending'; status.textContent = '✕'; }
    });
  }
  function completeModule(id) {
    const state = readProgress();
    if (!state.done.includes(id)) state.done.push(id);
    writeProgress(state);
    updateProgressUI();
  }

  function openLesson(id) {
    if (!lessonPanel || !lessonContent) return;
    let html = '';
    if (id === '1') {
      html = `
    <h3>Módulo 1 — Sons agudos e graves</h3>
    
    <!-- Vídeo explicativo -->
    <div style="margin:16px 0;">
      <iframe width="100%" height="315" src="https://www.youtube.com/embed/t8n2K5db5Wc" 
        title="Graves e Agudos na Música" frameborder="0" allowfullscreen></iframe>
    </div>

    <p>Na música, chamamos de <b>altura</b> a percepção do quão <b>grave</b> ou <b>agudo</b> é um som.</p>
    <ul>
      <li><b>Sons graves</b> → frequências baixas, como o bumbo ou vozes masculinas mais profundas.</li>
      <li><b>Sons agudos</b> → frequências altas, como apitos, flautas ou vozes femininas mais finas.</li>
    </ul>
    <p>Essas diferenças acontecem porque o som é uma onda. Quanto maior a frequência, mais agudo o som. Quanto menor a frequência, mais grave.</p>
    <p>No afinador do Orfeus, você pode falar ou cantar notas diferentes e observar como a tela reage: tons mais agudos aparecem em notas mais altas, e os graves em notas mais baixas.</p>

    <!-- Mini Quiz -->
    <div id="quiz1" style="margin-top:20px; padding:12px; border:1px solid #333; border-radius:8px;">
      <h4>Mini Quiz</h4>
      <p>Qual dos instrumentos abaixo normalmente produz <b>sons mais graves</b>?</p>
      <button class="quiz-option" data-correct="true">Contrabaixo</button>
      <button class="quiz-option">Flauta doce</button>
      <button class="quiz-option">Apito</button>
      <p id="quiz1-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    }
    else if (id === '2') {
      html = `
        <h3>Módulo 2 — Identificação de som pelo instrumento</h3>
        <p>Use a aba Instrumentos e compare o mesmo <b>nome de nota</b> em timbres diferentes.
        Tente diferenciar a <b>tessitura</b> (oitava) e o <b>timbre</b> (cor sonora).</p>
      `;
    }

    lessonContent.innerHTML = html;
    // Se for o módulo 1, ativa o quiz
    if (id === '1') {
      const quiz = document.getElementById('quiz1');
      if (quiz) {
        quiz.querySelectorAll('.quiz-option').forEach(btn => {
          btn.addEventListener('click', async () => {
            const feedback = document.getElementById('quiz1-feedback');
            if (btn.dataset.correct) {
              feedback.textContent = "✅ Correto! Você ganhou +10 pontos!";
              feedback.style.color = "lightgreen";

              // Atualiza ranking no Firestore
              if (window.firebase && firebase.firestore && auth.currentUser) {
                try {
                  const db = firebase.firestore();
                  const user = auth.currentUser;
                  const userRef = db.collection("scores").doc(user.uid + "_all");
                  await db.runTransaction(async (t) => {
                    const doc = await t.get(userRef);
                    let newPoints = 10;
                    if (doc.exists) newPoints = (doc.data().points || 0) + 10;
                    t.set(userRef, { user: user.displayName, points: newPoints, period: "all" });
                  });
                } catch (err) { console.error("Erro ao salvar pontos:", err); }
              }

            } else {
              feedback.textContent = "❌ Ops! Tente novamente.";
              feedback.style.color = "red";
            }
          });
        });
      }


    }

    // 🔹 anima a abertura
    lessonPanel.classList.remove('hidden');
    setTimeout(() => lessonPanel.classList.add('show'), 20);

  }
  if (lessonClose) {
    lessonClose.addEventListener('click', () => {
      lessonPanel.classList.remove('show');
      setTimeout(() => lessonPanel.classList.add('hidden'), 300); // espera animação
    });
  }
  if (modulesRoot) {
    modulesRoot.querySelectorAll('.module-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.module-card').dataset.module;
        openLesson(id);
        completeModule(id);
      });
    });
    updateProgressUI();
  }
  const container = document.getElementById('virtual-piano');

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
      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = `${note}${octave}`;
      key.appendChild(label);
      whiteKeysContainer.appendChild(key);
      keyIndex++;
    });

    blackOrder.forEach((note, i) => {
      if (note === "") return;
      const key = document.createElement("div");
      key.classList.add("key", "black");
      key.dataset.note = `${note}${octave}`;
      key.style.left = `${40 * (i + (octave - startOctave) * 7) + 26}px`;
      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = `${note}${octave}`;
      key.appendChild(label);
      blackKeysContainer.appendChild(key);
    });
  }

  // --- Player com samples reais de piano ---
  let currentInstrument = 'piano';
  let sampler = new Tone.Sampler({
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

  async function switchInstrument(inst) {
    currentInstrument = inst;
    if (sampler) sampler.dispose();
    if (inst === 'piano') {
      sampler = new Tone.Sampler({
        urls: { "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", "A1": "A1.mp3", "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", "A5": "A5.mp3", "C6": "C6.mp3" },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/"
      }).toDestination();
    } else if (inst === 'guitar') {
      sampler = new Tone.Sampler({
        urls: { "C3": "C3.mp3", "E3": "E3.mp3", "G3": "G3.mp3", "C4": "C4.mp3", "E4": "E4.mp3", "G4": "G4.mp3" },
        release: 2,
        baseUrl: "https://tonejs.github.io/audio/berklee/guitar-acoustic/"
      }).toDestination();
    } else if (inst === 'drums') {
      sampler = new Tone.Sampler({
        urls: { "C1": "kick.mp3", "D1": "snare.mp3", "E1": "hihat.mp3" },
        baseUrl: "https://tonejs.github.io/audio/drum-samples/CR78/"
      }).toDestination();
    } else if (inst === 'flute') {
      sampler = new Tone.Sampler({
        urls: { "C4": "C4.mp3", "E4": "E4.mp3", "G4": "G4.mp3", "C5": "C5.mp3" },
        release: 2,
        baseUrl: "https://tonejs.github.io/audio/berklee/flute/"
      }).toDestination();
    }
  }

  if (instButtons.length) {
    instButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        instButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderInstrumentUI(btn.dataset.inst);
        await switchInstrument(btn.dataset.inst);
      });
    });
    // render inicial explícito
    renderInstrumentUI('piano');
  }

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

  function attachKeyHandlers() {
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
  }
  attachKeyHandlers();

  function renderInstrumentUI(inst) {
    if (!instrumentArea) return;
    instrumentArea.innerHTML = '';
    if (inst === 'piano' || inst === 'guitar' || inst === 'flute') {
      const vp = document.createElement('div');
      vp.id = 'virtual-piano';
      const white = document.createElement('div'); white.className = 'white-keys';
      const black = document.createElement('div'); black.className = 'black-keys';
      vp.appendChild(white); vp.appendChild(black);
      instrumentArea.appendChild(vp);
      // rebuild keys
      buildKeyboard();
      attachKeyHandlers();
    }
    if (inst === 'drums') {
      const grid = document.createElement('div');
      grid.id = 'drum-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(3, 100px)';
      grid.style.gap = '12px';
      const pads = [
        { label: 'Kick', note: 'C1' },
        { label: 'Snare', note: 'D1' },
        { label: 'HiHat', note: 'E1' },
        { label: 'Clap', note: 'F1' },
        { label: 'Tom', note: 'G1' },
        { label: 'Ride', note: 'A1' }
      ];
      pads.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p.label;
        b.style.padding = '16px';
        b.style.background = '#1a1a1a';
        b.style.color = '#fff';
        b.style.border = '1px solid #262626';
        b.style.cursor = 'pointer';
        b.addEventListener('mousedown', () => { sampler.triggerAttackRelease(p.note, '8n'); });
        grid.appendChild(b);
      });
      instrumentArea.appendChild(grid);
    }
  }

  function buildKeyboard() {
    const white = document.querySelector('#virtual-piano .white-keys');
    const black = document.querySelector('#virtual-piano .black-keys');
    if (!white || !black) return;
    white.innerHTML = ''; black.innerHTML = '';
    let keyIndex = 0;
    for (let octave = startOctave; octave <= endOctave; octave++) {
      whiteOrder.forEach((note) => {
        const key = document.createElement('div');
        key.classList.add('key', 'white');
        key.dataset.note = `${note}${octave}`;
        key.style.left = `${keyIndex * 40}px`;
        const label = document.createElement('div');
        label.className = 'note-label';
        label.textContent = `${note}${octave}`;
        key.appendChild(label);
        white.appendChild(key);
        keyIndex++;
      });
      blackOrder.forEach((note, i) => {
        if (!note) return;
        const key = document.createElement('div');
        key.classList.add('key', 'black');
        key.dataset.note = `${note}${octave}`;
        key.style.left = `${40 * (i + (octave - startOctave) * 7) + 26}px`;
        const label = document.createElement('div');
        label.className = 'note-label';
        label.textContent = `${note}${octave}`;
        key.appendChild(label);
        black.appendChild(key);
      });
    }
  }
});

// --- Afinador ---
const tunerArc = document.getElementById("tunerArc");
const tunerNote = document.getElementById("tunerNote");
const tunerCents = document.getElementById("tunerCents");
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
  const note = noteNames[(noteNum % 12 + 12) % 12];
  const octave = Math.floor(noteNum / 12) - 1;
  const noteFreq = A4 * Math.pow(2, (noteNum - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / noteFreq));
  return { note, octave, cents };
}

function updateTunerDisplay(note, octave, cents) {
  tunerNote.textContent = `${note}${octave}`;
  if (tunerCents) tunerCents.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;

  // reset
  markers.forEach(m => m.style.background = "#2b2b2b");

  if (Math.abs(cents) < 5) {
    markers[5].style.background = "#ffffff"; // afinado
  } else {
    const steps = Math.min(5, Math.floor(Math.abs(cents) / 10));
    for (let i = 1; i <= steps; i++) {
      const idx = cents < 0 ? 5 - i : 5 + i;
      if (markers[idx]) {
        markers[idx].style.background = i <= 2 ? "#999" : "#666";
      }
    }
  }
}

function resetTuner() {
  tunerNote.textContent = "--";
  markers.forEach(m => m.style.background = "#555");
}

// Suavização simples de frequência
let lastFreq = null;
function smoothFreq(freq) {
  if (lastFreq === null) { lastFreq = freq; return freq; }
  const alpha = 0.2; // suavização exponencial
  lastFreq = alpha * freq + (1 - alpha) * lastFreq;
  return lastFreq;
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
    const rawFreq = audioCtx.sampleRate / bestOffset;
    const freq = smoothFreq(rawFreq);
    const { note, octave, cents } = freqToNote(freq);
    updateTunerDisplay(note, octave, cents);
  }

  requestAnimationFrame(detectPitch);
}

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

// --- Login com Google ---
const loginBtn = document.getElementById("google-login-btn");
const authUI = document.getElementById("auth-ui");
const userInfo = document.createElement("div");
userInfo.id = "user-info";

function renderUser(user){
  if (!user) {
    // Usuário não logado
    if (authUI) authUI.innerHTML = `
      <button id="google-login-btn">
        <img src="imgs/gmail.png" alt="Google Logo"> Entrar com Google
      </button>
    `;
    const btn = document.getElementById("google-login-btn");
    if (btn) btn.addEventListener("click", googleLogin);
  } else {
    // Usuário logado
    if (authUI) {
      authUI.innerHTML = `
        <div id="user-info">
          <img src="${user.photoURL || 'imgs/user.png'}" alt="Foto">
          <span>${user.displayName || "Usuário"}</span>
          <button id="logout-btn">Sair</button>
        </div>
      `;
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) logoutBtn.addEventListener("click", googleLogout);
    }
  }
}

async function googleLogin(){
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    // 🔹 Salva/atualiza usuário no Firestore
    if (firebase.firestore) {
      const db = firebase.firestore();
      await db.collection("users").doc(user.uid).set({
        name: user.displayName,
        email: user.email,
        photo: user.photoURL,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    renderUser(user);
  } catch(err){
    console.error("Erro no login:", err);
  }
}

async function googleLogout(){
  try {
    await auth.signOut();
    renderUser(null);
  } catch(err){
    console.error("Erro no logout:", err);
  }
}

// 🔹 Monitorar login automaticamente
auth.onAuthStateChanged(user => {
  renderUser(user);
});
