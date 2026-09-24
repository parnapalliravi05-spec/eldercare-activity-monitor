const movementInput = document.getElementById("movement");
const doorInput = document.getElementById("door");
const applianceInput = document.getElementById("appliance");

const riskLevel = document.getElementById("riskLevel");
const riskScore = document.getElementById("riskScore");
const heroScore = document.getElementById("heroScore");
const heroStatus = document.getElementById("heroStatus");
const alertBox = document.getElementById("alertBox");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");
const lastActivity = document.getElementById("lastActivity");

const movementBar = document.getElementById("movementBar");
const doorBar = document.getElementById("doorBar");
const applianceBar = document.getElementById("applianceBar");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateRisk() {
  const movement = Math.max(0, Number(movementInput.value) || 0);
  const door = Math.max(0, Number(doorInput.value) || 0);
  const appliance = Math.max(0, Number(applianceInput.value) || 0);

  const total = movement + door + appliance;

  // Demo-only heuristic. This is NOT a clinical or validated ML model.
  let score;
  let state;

  if (total >= 22) {
    score = 12;
    state = "NORMAL";
  } else if (total >= 12) {
    score = 38;
    state = "LOW ACTIVITY";
  } else {
    score = 78;
    state = "HIGH RISK";
  }

  updateDashboard(score, state, movement, door, appliance);
}

function updateDashboard(score, state, movement, door, appliance) {
  riskScore.textContent = `${score}%`;
  heroScore.textContent = `${score}%`;
  riskLevel.textContent = state;

  const total = movement + door + appliance;
  movementBar.style.height = `${clamp(movement / 25 * 100, 5, 100)}%`;
  doorBar.style.height = `${clamp(door / 10 * 100, 5, 100)}%`;
  applianceBar.style.height = `${clamp(appliance / 12 * 100, 5, 100)}%`;

  lastActivity.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  alertBox.className = "alert-box";

  if (state === "NORMAL") {
    alertBox.classList.add("normal");
    alertTitle.textContent = "Normal activity";
    alertMessage.textContent = "Daily activity is within the expected range.";
    heroStatus.textContent = "SYSTEM NORMAL";
  } else if (state === "LOW ACTIVITY") {
    alertBox.classList.add("low");
    alertTitle.textContent = "Low activity detected";
    alertMessage.textContent = "Activity is below the expected range. Continue monitoring.";
    heroStatus.textContent = "LOW ACTIVITY";
  } else {
    alertBox.classList.add("high");
    alertTitle.textContent = "Prototype alert";
    alertMessage.textContent = "Activity is substantially below the demo baseline. A caregiver check may be appropriate.";
    heroStatus.textContent = "ALERT";
  }
}

document.getElementById("normalBtn").addEventListener("click", () => {
  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;
  calculateRisk();
});

document.getElementById("lowBtn").addEventListener("click", () => {
  movementInput.value = 1;
  doorInput.value = 0;
  applianceInput.value = 0;
  calculateRisk();
});

document.getElementById("calculateBtn").addEventListener("click", calculateRisk);

document.getElementById("resetBtn").addEventListener("click", () => {
  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;
  calculateRisk();
});

[movementInput, doorInput, applianceInput].forEach(input => {
  input.addEventListener("input", calculateRisk);
});

calculateRisk();
