const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;
const autoSpinSpeed = 0.3;
let activeButton = null; // botão atualmente destacado

// --- Utils ---
function normalize180(a) {
  // normaliza para o intervalo [-180, 180)
  let ang = ((a + 180) % 360 + 360) % 360 - 180;
  return ang;
}

function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function getButtonAngle(btn) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const btnRect = btn.getBoundingClientRect();
  const bx = btnRect.left + btnRect.width / 2;
  const by = btnRect.top + btnRect.height / 2;

  let ang = Math.atan2(by - cy, bx - cx) * (180 / Math.PI);

  // Correções manuais
  if (btn.classList.contains("oeste")) ang -= 5;     // exemplo
  if (btn.classList.contains("sudoeste")) ang += 8;  // exemplo

  return ang;
}

function spin() {
  // Gira o disco (arrastando ou no automático)
  if (isDragging) {
    currentRotation += velocity;
  } else {
    if (Math.abs(velocity) > autoSpinSpeed) {
      velocity *= 0.95;
      currentRotation += velocity;
    } else {
      velocity = 0;
      currentRotation += autoSpinSpeed;
    }
  }

  // Aplica a rotação ao disco
  disc.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;

  // --- Posição visual da seta ---
  const radius = disc.offsetWidth / 2;
  const arrowH = seta.offsetHeight || 40;
  const margem = 6;
  const r = radius - arrowH / 2 - margem;

  // Offset apenas visual (se precisar ajustar a arte da imagem)
  const ANG_FIX_VISUAL = 0;

  seta.style.transform = `
    translate(-50%, -50%)
    rotate(${currentRotation + ANG_FIX_VISUAL}deg)
    translateY(-${r}px)
  `;

  // --- DETECÇÃO CORRETA ---
  // translateY(-r) => vetor "pra cima" (-90°). rotate(+) em CSS é horário.
  // Portanto o ângulo geométrico é: -90 - currentRotation
  const setaAngle = normalize180(-90 - currentRotation);

  // Encontra o botão mais próximo dentro de uma tolerância
  const TOL = 8; // graus
  let foundButton = null;
  let bestDiff = 999;

  buttons.forEach((btn) => {
    const btnAngle = getButtonAngle(btn); // [-180, 180]
    const diff = normalize180(setaAngle - btnAngle);
    const ad = Math.abs(diff);
    if (ad <= TOL && ad < bestDiff) {
      bestDiff = ad;
      foundButton = btn;
    }
  });

  // Atualiza o destaque somente quando houver mudança
  if (foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
    }
    if (foundButton) {
      foundButton.style.backgroundColor = "#ff5050";
    }
    activeButton = foundButton;
  }

  requestAnimationFrame(spin);
}

spin();

// Quando começa a arrastar
disc.addEventListener("mousedown", (e) => {
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
});

// Quando solta o disco
window.addEventListener("mouseup", () => {
  isDragging = false;
  disc.style.cursor = "grab";
});

// Movimento do mouse
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  velocity = delta * 1.5;
  lastAngle = angle;
});


