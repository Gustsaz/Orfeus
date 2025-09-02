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
  if (isDragging) {
    if (movedThisFrame) {
      currentRotation += velocity;
      if (velocity !== 0) lastSpinSign = Math.sign(velocity);
    } else {
      // mouse parado → não gira
      velocity = 0;
    }
    movedThisFrame = false; // reseta pro próximo frame
  } else {
    // inércia após soltar
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

  const foundButton = detectButton();

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
