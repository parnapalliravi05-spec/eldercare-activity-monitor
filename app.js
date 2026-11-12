
// ==========================================
// ELDERCARE ACTIVITY MONITOR
// Live ESP32 + FastAPI + Website Connection
// ==========================================

// Render backend URL
const API_URL =
  "https://eldercare-activity-monitor-backend.onrender.com";

// Refresh interval: 2 seconds
const REFRESH_INTERVAL = 2000;

// Website inputs
const movementInput = document.getElementById("movementInput");
const doorInput = document.getElementById("doorInput");
const applianceInput = document.getElementById("applianceInput");

// Buttons
const calculateBtn = document.getElementById("calculateBtn");
const normalBtn = document.getElementById("normalBtn");
const lowBtn = document.getElementById("lowBtn");
const resetBtn = document.getElementById("resetBtn");

// Dashboard outputs
const riskLevel = document.getElementById("riskLevel");
const riskScore = document.getElementById("riskScore");
const heroScore = document.getElementById("heroScore");

const alertBox = document.getElementById("alertBox");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");

const totalEvents = document.getElementById("totalEvents");

// Activity bars
const movementBar = document.getElementById("movementBar");
const doorBar = document.getElementById("doorBar");
const applianceBar = document.getElementById("applianceBar");


// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard(data) {
  const movement = Number(data.movement_count) || 0;
  const door = Number(data.door_events) || 0;
  const appliance = Number(data.appliance_events) || 0;

  const total =
    data.total_events !== undefined
      ? Number(data.total_events)
      : movement + door + appliance;

  const score = Number(data.risk_score) || 0;
  const state = String(data.status || "UNKNOWN").toUpperCase();

  movementInput.value = movement;
  doorInput.value = door;
  applianceInput.value = appliance;

  riskLevel.textContent = state;
  riskScore.textContent = score + "%";
  heroScore.textContent = score + "%";
  totalEvents.textContent = total;

  if (state === "NORMAL") {
    alertBox.className = "alert-box normal";
    alertTitle.textContent = "Normal activity";
    alertMessage.textContent =
      "Activity is currently within the expected range.";
  } else if (state.includes("LOW")) {
    alertBox.className = "alert-box low";
    alertTitle.textContent = "Low activity";
    alertMessage.textContent =
      "Activity is lower than the normal demonstration range.";
  } else {
    alertBox.className = "alert-box alert";
    alertTitle.textContent = "High activity-risk";
    alertMessage.textContent =
      "Very low activity detected. A caregiver check may be appropriate.";
  }

  updateBars(movement, door, appliance);
}


// ==========================================
// ACTIVITY BAR DISPLAY
// ==========================================

function updateBars(movement, door, appliance) {
  const maxValue = Math.max(movement, door, appliance, 1);

  movementBar.style.height =
    Math.min((movement / maxValue) * 100, 100) + "%";

  doorBar.style.height =
    Math.min((door / maxValue) * 100, 100) + "%";

  applianceBar.style.height =
    Math.min((appliance / maxValue) * 100, 100) + "%";
}


// ==========================================
// GET LATEST DATA FROM RENDER BACKEND
// ==========================================

async function getLiveData() {
  try {
    const response = await fetch(API_URL + "/latest", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Backend returned HTTP " + response.status);
    }

    const data = await response.json();

    updateDashboard(data);

    console.log("Live backend data received:", data);

  } catch (error) {
    console.error("Backend connection error:", error);

    alertBox.className = "alert-box low";
    alertTitle.textContent = "Backend connection problem";
    alertMessage.textContent =
      "Waiting for the backend. Please check the ESP32 and Render service.";
  }
}


// ==========================================
// MANUAL DEMONSTRATION CALCULATION
// ==========================================

function getNumber(input) {
  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function calculateActivity() {
  const movement = getNumber(movementInput);
  const door = getNumber(doorInput);
  const appliance = getNumber(applianceInput);

  const total = movement + door + appliance;

  let score;
  let state;
  let title;
  let message;
  let className;

  if (total >= 22) {
    score = 12;
    state = "NORMAL";
    title = "Normal activity";
    message = "Activity is currently within the expected range.";
    className = "normal";
  } else if (total >= 12) {
    score = 38;
    state = "LOW ACTIVITY";
    title = "Low activity";
    message = "Activity is lower than the normal demonstration range.";
    className = "low";
  } else {
    score = 78;
    state = "HIGH RISK";
    title = "High activity-risk";
    message = "Very low activity detected. A caregiver check may be appropriate.";
    className = "alert";
  }

  updateDashboard({
    movement_count: movement,
    door_events: door,
    appliance_events: appliance,
    total_events: total,
    risk_score: score,
    status: state
  });

  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertBox.className = "alert-box " + className;
}


// ==========================================
// BUTTON EVENTS
// ==========================================

normalBtn.addEventListener("click", function () {
  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;
  calculateActivity();
});

lowBtn.addEventListener("click", function () {
  movementInput.value = 7;
  doorInput.value = 2;
  applianceInput.value = 2;
  calculateActivity();
});

calculateBtn.addEventListener("click", calculateActivity);

resetBtn.addEventListener("click", function () {
  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;
  calculateActivity();
});


// ==========================================
// START LIVE MONITORING
// ==========================================

getLiveData();

setInterval(getLiveData, REFRESH_INTERVAL);
