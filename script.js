const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;

const friction = 0.985;       // atrito suave da inércia
const minSpin = 0.25;         // velocidade mínima (°/frame) para manter giro
let lastSpinSign = 1;         // último sentido (+1 horário, -1 anti-horário)

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
  const sx = Math.cos(rad);
  const sy = Math.sin(rad);

  let foundButton = null;
  let bestDot = -2;

  buttons.forEach((btn) => {
    const rect = disc.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const btnRect = btn.getBoundingClientRect();
    const bx = btnRect.left + btnRect.width / 2 - cx;
    const by = btnRect.top + btnRect.height / 2 - cy;

    const len = Math.hypot(bx, by);
    const vx = bx / len;
    const vy = by / len;

    const dot = sx * vx + sy * vy;
    const angleDiff = Math.acos(dot) * (180 / Math.PI);

    if (angleDiff <= 15 && dot > bestDot) {
      bestDot = dot;
      foundButton = btn;
    }
  });

  return foundButton;
}

// Mapeia botões para cartas
const cards = document.querySelectorAll(".card");
const cardMap = {
  "norte": document.querySelector(".card1"),
  "sul": document.querySelector(".card2"),
  "sudoeste": document.querySelector(".card3"),
  "oeste": document.querySelector(".card4")
};

function getCardFromButton(btn) {
  for (const cls of btn.classList) {
    if (cardMap[cls]) return cardMap[cls];
  }
  return null;
}

function closeAllCards() {
  cards.forEach(c => c.classList.remove("front", "open-vertical", "open-horizontal"));
}

// Abre em duas etapas: height -> width (com transitionend + fallback)
function openCardSequentially(card) {
  card.classList.remove("open-horizontal");
  void card.offsetWidth; // reflow

  let fired = false;
  const onEnd = (e) => {
    if (e.propertyName !== "height") return;
    fired = true;
    void card.offsetWidth;
    card.classList.add("open-horizontal");
  };
  card.addEventListener("transitionend", onEnd, { once: true });

  card.classList.add("open-vertical");

  // Fallback se o evento não disparar
  setTimeout(() => {
    if (!fired && card.classList.contains("open-vertical")) {
      card.classList.add("open-horizontal");
    }
  }, 460); // ~ tempo da transição de height + folga
}

// Física de rotação (NÃO depende de locked)
function updateRotation() {
  if (isDragging) {
    currentRotation += velocity;
    if (velocity !== 0) lastSpinSign = Math.sign(velocity);
  } else {
    if (Math.abs(velocity) > minSpin) {
      velocity *= friction;
      currentRotation += velocity;
    } else {
      // mantém giro contínuo no último sentido
      velocity = lastSpinSign * minSpin;
      currentRotation += velocity;
    }
  }
}

// Loop principal
function spin() {
  if (!locked) {
    updateRotation();
  }
  // aplica rotação no disco
  disc.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;

  // seta
  const radius = disc.offsetWidth / 2;
  const arrowH = seta.offsetHeight || 40;
  const margem = 6;
  const r = radius - arrowH / 2 - margem;

  seta.style.transform = `
    translate(-50%, -50%)
    rotate(${currentRotation}deg)
    translateY(-${r}px)
  `;

  // detecção do botão sob a seta
  const foundButton = detectButton();

  // Só atualiza UI dos cards quando NÃO está travado
  if (!locked && foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
    }
    if (foundButton) {
      foundButton.style.backgroundColor = "#ff5050";
    }
    activeButton = foundButton;

    closeAllCards();
    if (foundButton) {
      const card = getCardFromButton(foundButton);
      if (card) card.classList.add("front");
    }
  }

  if (!locked && !foundButton) {
    closeAllCards();
  }

  requestAnimationFrame(spin);
}
spin();

// arrastar
disc.addEventListener("mousedown", (e) => {
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false;       // destrava ao começar novo arrasto
  closeAllCards();      // fecha qualquer card aberto
});

// soltar
window.addEventListener("mouseup", () => {
  if (!isDragging) return;

  isDragging = false;
  disc.style.cursor = "grab";

  const targetBtn = detectButton();
  if (targetBtn) {
    locked = true;
    targetBtn.classList.add("agarrado");

    // Congela o ângulo atual na posição do botão escolhido
    velocity = 0;

    const card = getCardFromButton(targetBtn);
    if (card) {
      card.classList.add("front");
      openCardSequentially(card);
    }
  } else {
    locked = false;
    closeAllCards();
  }
});


// movimento
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  velocity = delta * 1.5; // “força” do arremesso
  lastAngle = angle;
});

// Mostra popup da música após 5 segundos da primeira carga
window.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("musicPopup");
  setTimeout(() => {
    popup.classList.add("show");
  }, 2000);
});
