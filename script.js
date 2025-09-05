const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");
let tonearmLifted = false;

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

// Cards
const cards = document.querySelectorAll(".card");
const cardMap = {
  "norte": document.querySelector(".card1"),
  "sul": document.querySelector(".card2"),
  "sudoeste": document.querySelector(".card3"),
  "oeste": document.querySelector(".card4")
};
function getCardFromButton(btn) {
  for (const cls of btn.classList) if (cardMap[cls]) return cardMap[cls];
  return null;
}
function closeAllCards() {
  cards.forEach(c => c.classList.remove("front", "open-vertical", "open-horizontal"));
}
function openCardSequentially(card) {
  card.classList.remove("open-horizontal");
  void card.offsetWidth;
  let fired = false;
  const onEnd = e => {
    if (e.propertyName !== "height") return;
    fired = true; void card.offsetWidth; card.classList.add("open-horizontal");
  };
  card.addEventListener("transitionend", onEnd, { once: true });
  card.classList.add("open-vertical");
  setTimeout(() => { if (!fired && card.classList.contains("open-vertical")) card.classList.add("open-horizontal"); }, 460);
}

// Flag pra saber se houve movimento real
let movedThisFrame = false;

// Rotação
function updateRotation() {
  if (tonearmLifted) return;

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
    // só detecta no desktop
    foundButton = detectButton();
  }

  if (!locked && foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
    }
    if (foundButton) foundButton.style.backgroundColor = "#ff5050";
    activeButton = foundButton;

    closeAllCards();
    if (foundButton) {
      const card = getCardFromButton(foundButton);
      if (card) card.classList.add("front");
    }
  }
  if (!locked && !foundButton) closeAllCards();

  requestAnimationFrame(spin);
}
spin();

// Drag
disc.addEventListener("mousedown", e => {
  if (window.innerWidth <= 768) return; // ignora drag no mobile
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false;
  closeAllCards();
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  disc.style.cursor = "grab";

  const targetBtn = detectButton();

  if (targetBtn) {
    // Se já estava ativo, deseleciona
    if (activeButton === targetBtn && locked) {
      locked = false;
      closeAllCards();
      const tonearm = document.querySelector(".tonearm");
      [disc, seta, ...buttons, tonearm].forEach(el => el.classList.remove("move-left"));
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
      activeButton = null;
      return;
    }

    // Caso contrário, seleciona normalmente
    locked = true;
    targetBtn.classList.add("agarrado");

    const card = getCardFromButton(targetBtn);
    if (card) {
      card.classList.add("front");
      openCardSequentially(card);
    }

    const tonearm = document.querySelector(".tonearm");
    [disc, seta, ...buttons, tonearm].forEach(el => el.classList.add("move-left"));

  } else {
    // Nenhum botão encontrado → volta pro centro
    locked = false;
    closeAllCards();
    const tonearm = document.querySelector(".tonearm");
    [disc, seta, ...buttons, tonearm].forEach(el => el.classList.remove("move-left"));
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

  movedThisFrame = true; // marca que o mouse se mexeu
});

// Popup música
window.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("musicPopup");
  setTimeout(() => {
    popup.classList.add("show");
    setTimeout(() => {
      popup.classList.remove("show");
      popup.classList.add("hide");
    }, 5000);
  }, 2000);
});

document.querySelectorAll(".close-card").forEach(btn => {
  btn.addEventListener("click", () => {
    // Fecha todos os cards
    closeAllCards();
    locked = false;

    // Volta o turntable pro centro
    const tonearm = document.querySelector(".tonearm");
    [disc, seta, ...buttons, tonearm].forEach(el => el.classList.remove("move-left"));

    // Reseta botão ativo
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
      activeButton = null;
    }
  });
});

const tonearm = document.querySelector(".tonearm");
const iconButtons = document.querySelectorAll(".icon-btn");

// --- Estado inicial ---
function setupButtons() {
  if (window.innerWidth <= 768) {
    // Mobile → sempre clicáveis
    iconButtons.forEach(btn => {
      btn.style.pointerEvents = "auto";
      btn.style.cursor = "pointer";
      btn.classList.add("enabled");
    });
  } else {
    // Desktop → começam desativados
    iconButtons.forEach(btn => btn.style.pointerEvents = "none");
  }
}
setupButtons();
window.addEventListener("resize", setupButtons);

// --- Tonearm só afeta no desktop ---
tonearm.addEventListener("click", () => {
  if (window.innerWidth <= 768) return; // ignora no mobile

  tonearmLifted = !tonearmLifted;
  tonearm.classList.toggle("lifted", tonearmLifted);

  iconButtons.forEach(btn => {
    btn.style.pointerEvents = tonearmLifted ? "auto" : "none";
    btn.style.cursor = tonearmLifted ? "pointer" : "default";
    btn.classList.toggle("enabled", tonearmLifted);
  });
});

// --- Clique nos botões ---
iconButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // Desktop: precisa do braço levantado
    if (window.innerWidth > 768 && !tonearmLifted) return;

    closeAllCards();

    locked = true;
    if (activeButton) {
      activeButton.classList.remove("agarrado");
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
    }
    activeButton = btn;
    btn.classList.add("agarrado");
    btn.style.backgroundColor = "#ff5050";

    const card = getCardFromButton(btn);
    if (card) {
      card.classList.add("front");
      openCardSequentially(card);
    }

    const tonearm = document.querySelector(".tonearm");
    [disc, seta, ...buttons, tonearm].forEach(el => el.classList.add("move-left"));
  });
});
// -------- Afinador --------
const tunerArc = document.getElementById("tunerArc");
const tunerNote = document.getElementById("tunerNote");
const micToggle = document.getElementById("micToggle");
const micIcon = document.getElementById("micIcon");

let isListening = false;
let markers = [];
const totalMarkers = 11; // 5 esquerda + 1 centro + 5 direita

// Áudio global
let audioCtx = null;
let stream = null;
let stopRequested = false;

// Criar marcadores em linha reta
function createMarkers() {
  if (!tunerArc) return;
  tunerArc.innerHTML = "";
  markers = [];

  for (let i = 0; i < totalMarkers; i++) {
    const marker = document.createElement("div");
    marker.classList.add("marker");
    if (i === Math.floor(totalMarkers / 2)) marker.classList.add("center");

    marker.style.width = i === Math.floor(totalMarkers / 2) ? "16px" : "12px";
    marker.style.height = "24px";
    marker.style.margin = "0 4px";
    marker.style.borderRadius = "6px";
    marker.style.background = "#555";

    tunerArc.appendChild(marker);
    markers.push(marker);
  }
}
createMarkers();

function updateTuner(note, cents) {
  tunerNote.textContent = note;
  markers.forEach(m => (m.style.background = "#555"));

  const centerIndex = Math.floor(totalMarkers / 2);

  if (Math.abs(cents) < 5) {
    markers[centerIndex].style.background = "lime";
    return;
  }

  const step = Math.floor((Math.abs(cents) / 10)); // cada 10 cents = 1 marker
  for (let i = 1; i <= Math.min(step, 5); i++) {
    const idx = cents < 0 ? centerIndex - i : centerIndex + i;
    if (markers[idx]) {
      markers[idx].style.background = i <= 2 ? "yellow" : "red";
    }
  }
}

function resetTuner() {
  tunerNote.textContent = "";
  markers.forEach(m => (m.style.background = "#555"));
}

// Captura de áudio e detecção simplificada
async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    stopRequested = false;

    function detectPitch() {
      if (stopRequested) return;
      analyser.getFloatTimeDomainData(buffer);

      let rms = 0;
      for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
      rms = Math.sqrt(rms / buffer.length);
      if (rms < 0.01) {
        requestAnimationFrame(detectPitch);
        return;
      }

      let bestOffset = -1, bestCorrelation = 0;
      for (let offset = 20; offset < 1000; offset++) {
        let correlation = 0;
        for (let i = 0; i < buffer.length - offset; i++) {
          correlation += buffer[i] * buffer[i + offset];
        }
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      }

      if (bestOffset > 0) {
        const freq = audioCtx.sampleRate / bestOffset;
        const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const noteNum = Math.round(12 * (Math.log2(freq / 440)) + 69);
        const note = noteStrings[noteNum % 12];
        const cents = 1200 * Math.log2(freq / (440 * Math.pow(2, (noteNum - 69) / 12)));

        updateTuner(note, cents);
      }

      requestAnimationFrame(detectPitch);
    }

    detectPitch();
  } catch (err) {
    console.error("Erro ao acessar microfone:", err);
  }
}

function stopMic() {
  stopRequested = true;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  resetTuner();
}

micToggle.addEventListener("click", () => {
  isListening = !isListening;
  micIcon.src = isListening ? "imgs/mic_on_icon.png" : "imgs/mic_off_icon.png";
  if (isListening) {
    startMic();
  } else {
    stopMic();
  }
});
// -------- Piano Virtual no Card3 (Tone.js Sampler + Glissando) --------
window.addEventListener("DOMContentLoaded", () => {
  const whiteContainer = document.querySelector("#virtual-piano .white-keys");
  const blackContainer = document.querySelector("#virtual-piano .black-keys");

  const sampler = new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3"
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/"
  }).toDestination();

  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const notes = [];
  for (let octave = 3; octave <= 5; octave++) {
    noteNames.forEach(name =>
      notes.push({ name: name + octave, black: name.includes("#") })
    );
  }

  let isMouseDown = false;
  let whiteIndex = 0;

  function playNote(key, note) {
    key.classList.add("active");
    Tone.start();
    sampler.triggerAttack(note);
  }

  function stopNote(key, note) {
    key.classList.remove("active");
    sampler.triggerRelease(note);
  }

  function slideNote(key, note) {
    if (isMouseDown) {
      key.classList.add("active");
      Tone.start();
      sampler.triggerAttackRelease(note, "8n");
    }
  }

  notes.forEach(note => {
    const key = document.createElement("div");
    key.classList.add("key", note.black ? "black" : "white");
    key.dataset.note = note.name;

    if (note.black) {
      key.style.left = `${whiteIndex * 40 - 13}px`;
      blackContainer.appendChild(key);
    } else {
      whiteContainer.appendChild(key);
      whiteIndex++;
    }

    key.addEventListener("mousedown", () => {
      isMouseDown = true;
      playNote(key, note.name);
    });

    key.addEventListener("mouseup", () => {
      isMouseDown = false;
      stopNote(key, note.name);
    });

    key.addEventListener("mouseover", () => {
      slideNote(key, note.name);
    });

    key.addEventListener("mouseleave", () => {
      key.classList.remove("active");
    });
  });

  // quando soltar o mouse fora do piano → reseta
  document.addEventListener("mouseup", () => {
    isMouseDown = false;
    document.querySelectorAll(".key.active").forEach(k =>
      k.classList.remove("active")
    );
  });
});

// Referências para os elementos HTML
const authUiContainer = document.getElementById("auth-ui");

// Função para renderizar o estado de login
// Função para renderizar o estado de login
function renderAuthUi(user) {
    if (user) {
        // Usuário logado: mostra nome, foto e botão de logout
        const userInfoHtml = `
            <div id="user-info">
                <img src="${user.photoURL}" alt="Foto de perfil">
                <span>${user.displayName}</span>
                <button id="logout-btn">Sair</button>
            </div>
        `;
        authUiContainer.innerHTML = userInfoHtml;
        document.getElementById("logout-btn").addEventListener("click", () => {
            auth.signOut()
                .then(() => console.log("Usuário desconectado."))
                .catch((error) => console.error("Erro ao sair:", error));
        });
    } else {
        // Usuário não logado: mostra o botão de login
        const loginBtnHtml = `
            <button id="google-login-btn">
                <img src="imgs/gmail.png" alt="Google Logo"> Entrar com Google
            </button>
        `;
        authUiContainer.innerHTML = loginBtnHtml;

        // --- Aqui está o ajuste ---
        document.getElementById("google-login-btn").addEventListener("click", () => {
            auth.signInWithPopup(provider)
                .then((result) => {
                    const user = result.user;
                    console.log("Usuário logado (popup):", user.displayName);
                })
                .catch((error) => {
                    console.warn("Erro no Popup:", error.code, error.message);

                    // Fallback para Redirect
                    if (error.code === "auth/operation-not-supported-in-this-environment" ||
                        error.code === "auth/popup-blocked" ||
                        error.code === "auth/popup-closed-by-user") {
                        console.log("Tentando login com Redirect...");
                        auth.signInWithRedirect(provider);
                    }
                });
        });

        // Tratamento do resultado do Redirect
        auth.getRedirectResult()
            .then((result) => {
                if (result.user) {
                    console.log("Usuário logado via redirect:", result.user.displayName);
                }
            })
            .catch((error) => {
                console.error("Erro no Redirect:", error.message);
            });
    }
}


// Ouve as mudanças no estado de autenticação
auth.onAuthStateChanged((user) => {
    renderAuthUi(user);
});
