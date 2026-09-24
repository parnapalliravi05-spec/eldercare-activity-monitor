const movementInput = document.getElementById("movementInput");
const doorInput = document.getElementById("doorInput");
const applianceInput = document.getElementById("applianceInput");

const calculateBtn = document.getElementById("calculateBtn");
const normalBtn = document.getElementById("normalBtn");
const lowBtn = document.getElementById("lowBtn");
const resetBtn = document.getElementById("resetBtn");

const riskLevel = document.getElementById("riskLevel");
const riskScore = document.getElementById("riskScore");
const heroScore = document.getElementById("heroScore");

const alertBox = document.getElementById("alertBox");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");

const totalEvents = document.getElementById("totalEvents");

const movementBar = document.getElementById("movementBar");
const doorBar = document.getElementById("doorBar");
const applianceBar = document.getElementById("applianceBar");


function getNumber(input) {
  const value = Number(input.value);

  if (Number.isNaN(value) || value < 0) {
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


  /*
    DEMONSTRATION RULE

    Total >= 22  → NORMAL
    Total 12-21  → LOW ACTIVITY
    Total < 12   → HIGH RISK

    This is a prototype activity heuristic.
    It is NOT a medical diagnosis.
  */

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


  riskLevel.textContent = state;
  riskScore.textContent = score + "%";
  heroScore.textContent = score + "%";

  alertTitle.textContent = title;
  alertMessage.textContent = message;

  alertBox.className = "alert-box " + className;

  totalEvents.textContent = total;


  updateBars(movement, door, appliance);
}


function updateBars(movement, door, appliance) {

  const maxValue = Math.max(
    movement,
    door,
    appliance,
    1
  );


  movementBar.style.height =
    Math.min((movement / maxValue) * 100, 100) + "%";


  doorBar.style.height =
    Math.min((door / maxValue) * 100, 100) + "%";


  applianceBar.style.height =
    Math.min((appliance / maxValue) * 100, 100) + "%";
}


/* NORMAL DEMO */

normalBtn.addEventListener("click", function () {

  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;

  calculateActivity();

});


/* LOW ACTIVITY DEMO */

lowBtn.addEventListener("click", function () {

  movementInput.value = 7;
  doorInput.value = 2;
  applianceInput.value = 2;

  calculateActivity();

});


/* CALCULATE */

calculateBtn.addEventListener("click", function () {

  calculateActivity();

});


/* RESET */

resetBtn.addEventListener("click", function () {

  movementInput.value = 18;
  doorInput.value = 5;
  applianceInput.value = 7;

  calculateActivity();

});


/* INITIAL STATE */

calculateActivity();
