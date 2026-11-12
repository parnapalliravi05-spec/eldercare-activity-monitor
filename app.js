
const API_URL = "https://eldercare-activity-monitor-backend.onrender.com";
const POLL_MS = 2000;
const MAX_POINTS = 30;

// -------------------------------
// DASHBOARD ELEMENTS
// -------------------------------

const movementElement = document.getElementById("movement");
const doorElement = document.getElementById("door");
const applianceElement = document.getElementById("appliance");
const riskElement = document.getElementById("risk");
const riskStatusElement = document.getElementById("riskStatus");
const riskFillElement = document.getElementById("riskFill");
const riskNoteElement = document.getElementById("riskNote");

const connectionElement = document.getElementById("connection");
const updatedElement = document.getElementById("updated");
const pirElement = document.getElementById("pir");
const backendDot = document.getElementById("backendDot");
const backendText = document.getElementById("backendText");

const eventsElement = document.getElementById("events");
const clearButton = document.getElementById("clear");
const movementDeltaElement = document.getElementById("movementDelta");

// -------------------------------
// CHART SETUP
// -------------------------------

const labels = [];
const movementPoints = [];

let activityChart = null;
let previousMovement = null;
let eventCount = 0;

const chartCanvas = document.getElementById("activityChart");

if (chartCanvas && window.Chart) {
    activityChart = new Chart(chartCanvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Movement Events",
                data: movementPoints,
                borderColor: "#4776e6",
                backgroundColor: "rgba(71, 118, 230, 0.12)",
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Movement Count"
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: "Time"
                    }
                }
            }
        }
    });
}

// -------------------------------
// HELPER FUNCTIONS
// -------------------------------

function getNumber(data, possibleNames) {
    for (const name of possibleNames) {
        const value = Number(data?.[name]);

        if (data?.[name] !== undefined && Number.isFinite(value)) {
            return value;
        }
    }

    return 0;
}

function updateConnection(isConnected) {
    if (connectionElement) {
        connectionElement.textContent = isConnected
            ? "● Connected"
            : "● Disconnected";

        connectionElement.className = isConnected
            ? "status-badge good"
            : "status-badge";
    }

    if (backendDot) {
        backendDot.className = isConnected
            ? "status-dot good"
            : "status-dot";
    }

    if (backendText) {
        backendText.textContent = isConnected
            ? "Backend Connected"
            : "Backend Disconnected";
    }
}

function addEvent(message) {
    if (!eventsElement) return;

    if (eventCount === 0) {
        eventsElement.innerHTML = "";
    }

    const event = document.createElement("div");
    event.className = "event-item";

    const time = new Date().toLocaleTimeString();

    const messageElement = document.createElement("span");
    messageElement.textContent = message;

    const timeElement = document.createElement("small");
    timeElement.textContent = time;

    event.appendChild(messageElement);
    event.appendChild(timeElement);

    eventsElement.prepend(event);

    eventCount++;

    while (eventsElement.children.length > 20) {
        eventsElement.removeChild(eventsElement.lastChild);
    }
}

// -------------------------------
// LIVE RISK DISPLAY
// -------------------------------

function updateRiskDisplay(data) {
    const suppliedRisk = data.risk_score ?? data.riskScore ?? data.risk;

    const score = Number(suppliedRisk);

    if (suppliedRisk !== undefined && Number.isFinite(score)) {
        const safeScore = Math.max(0, Math.min(100, score));

        if (riskElement) {
            riskElement.textContent = Math.round(safeScore) + "%";
        }

        if (riskFillElement) {
            riskFillElement.style.width = safeScore + "%";
        }

        const suppliedStatus = data.risk_status ?? data.riskStatus;

        if (riskStatusElement) {
            riskStatusElement.textContent =
                suppliedStatus || "Prototype activity indicator";
        }
    } else {
        if (riskElement) {
            riskElement.textContent = "--";
        }

        if (riskStatusElement) {
            riskStatusElement.textContent =
                "Risk score not supplied by backend";
        }

        if (riskFillElement) {
            riskFillElement.style.width = "0%";
        }
    }

    if (riskNoteElement) {
        riskNoteElement.textContent =
            "Experimental activity indicator — not a diagnosis.";
    }
}

// -------------------------------
// UPDATE LIVE DASHBOARD
// -------------------------------

function updateDashboard(data) {
    const movement = getNumber(data, [
        "movement_count",
        "movement",
        "movement_events"
    ]);

    const door = getNumber(data, [
        "door_events",
        "door_count",
        "door"
    ]);

    const appliance = getNumber(data, [
        "appliance_events",
        "appliance_count",
        "appliance"
    ]);

    if (movementElement) movementElement.textContent = movement;
    if (doorElement) doorElement.textContent = door;
    if (applianceElement) applianceElement.textContent = appliance;

    if (pirElement) {
        pirElement.textContent = "Receiving activity data";
    }

    if (movementDeltaElement) {
        if (previousMovement === null) {
            movementDeltaElement.textContent = "First reading received";
        } else if (movement > previousMovement) {
            movementDeltaElement.textContent =
                "+" + (movement - previousMovement) + " new movement event(s)";
        } else {
            movementDeltaElement.textContent = "No new movement events";
        }
    }

    if (previousMovement !== null && movement > previousMovement) {
        addEvent(
            "Movement detected. Total movement count: " + movement
        );
    }

    previousMovement = movement;

    updateRiskDisplay(data);

    // Update chart
    const time = new Date().toLocaleTimeString();

    if (activityChart) {
        labels.push(time);
        movementPoints.push(movement);

        if (labels.length > MAX_POINTS) {
            labels.shift();
            movementPoints.shift();
        }

        activityChart.update("none");
    }

    if (updatedElement) {
        updatedElement.textContent =
            "Last updated: " + new Date().toLocaleTimeString();
    }
}

// -------------------------------
// FETCH LIVE BACKEND DATA
// -------------------------------

async function fetchLiveData() {
    try {
        const response = await fetch(
            API_URL + "/latest",
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Backend returned " + response.status);
        }

        const data = await response.json();

        updateDashboard(data);
        updateConnection(true);

        console.log("Live backend data received:", data);

    } catch (error) {
        console.error("Backend connection error:", error);

        updateConnection(false);

        if (pirElement) {
            pirElement.textContent = "Waiting for sensor data";
        }

        if (updatedElement) {
            updatedElement.textContent = "Unable to fetch latest data";
        }
    }
}

// -------------------------------
// MANUAL ACTIVITY CALCULATOR
// -------------------------------

const manualMovement = document.getElementById("manualMovement");
const manualDoor = document.getElementById("manualDoor");
const manualAppliance = document.getElementById("manualAppliance");

const calculateButton = document.getElementById("calculateManual");
const resetButton = document.getElementById("resetManual");
const manualResult = document.getElementById("manualResult");

function calculateManualActivity() {
    const movement = Number(manualMovement?.value);
    const door = Number(manualDoor?.value);
    const appliance = Number(manualAppliance?.value);

    const values = [movement, door, appliance];

    if (
        values.some(value =>
            !Number.isFinite(value) || value < 0 || !Number.isInteger(value)
        )
    ) {
        manualResult.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter valid whole numbers greater than or equal to zero.</p>
        `;
        return;
    }

    const total = movement + door + appliance;

    let score;
    let status;
    let description;

    // Demonstration thresholds for the academic prototype.
    if (total >= 22) {
        score = 12;
        status = "Normal Activity";
        description = "The entered activity count is relatively high.";
    } else if (total >= 12) {
        score = 38;
        status = "Low Activity";
        description = "The entered activity count is moderate.";
    } else {
        score = 78;
        status = "High Inactivity Indicator";
        description = "The entered activity count is relatively low.";
    }

    manualResult.innerHTML = `
        <h3>Manual Calculation Result</h3>

        <div class="manual-result-grid">
            <div>
                <span>Total Events</span>
                <strong>${total}</strong>
            </div>

            <div>
                <span>Prototype Indicator</span>
                <strong>${score}%</strong>
            </div>
        </div>

        <h3>${status}</h3>
        <p>${description}</p>

        <small>
            This result is based only on the entered counts and
            demonstration thresholds. It is not a medical or
            validated loneliness-risk assessment.
        </small>
    `;

    addEvent("Manual calculator used. Total entered events: " + total);
}

if (calculateButton) {
    calculateButton.addEventListener("click", calculateManualActivity);
}

if (resetButton) {
    resetButton.addEventListener("click", () => {
        if (manualMovement) manualMovement.value = 0;
        if (manualDoor) manualDoor.value = 0;
        if (manualAppliance) manualAppliance.value = 0;

        if (manualResult) {
            manualResult.innerHTML = `
                <h3>Calculation Result</h3>
                <p>Enter your activity counts and click Calculate Activity.</p>
            `;
        }
    });
}

// -------------------------------
// CLEAR EVENT FEED
// -------------------------------

if (clearButton && eventsElement) {
    clearButton.addEventListener("click", () => {
        eventCount = 0;
        eventsElement.innerHTML = `
            <p class="empty-events">No recent events.</p>
        `;
    });
}

// -------------------------------
// START LIVE MONITORING
// -------------------------------

fetchLiveData();
setInterval(fetchLiveData, POLL_MS);

console.log("ElderCare dashboard initialized.");
