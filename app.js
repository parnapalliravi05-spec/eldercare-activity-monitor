
// =============================================
// ELDERCARE ACTIVITY MONITOR
// Complete Dashboard + Countdown + Alert Sound
// =============================================

const API_URL = "https://eldercare-activity-monitor-backend.onrender.com";

const POLL_INTERVAL = 2000;
const MAX_POINTS = 30;
const INACTIVITY_LIMIT = 1 * 60;

let activityChart = null;
let dailyChart = null;

let previousMovement = null;
let lastTimerMovement = null;

let displayedAlerts = new Set();
let soundedAlertIds = new Set();
let eventCount = 0;

// Audio variables
let audioContext = null;
let soundUnlocked = false;

// Countdown variables
let remainingSeconds = INACTIVITY_LIMIT;
let timerStarted = false;
let timerInterval = null;


// =============================================
// HTML ELEMENT HELPER
// =============================================

function element(id) {
    return document.getElementById(id);
}


// =============================================
// SOUND SYSTEM
// =============================================

function setSoundStatus(message) {
    const status = element("soundStatus");

    if (status) {
        status.textContent = message;
    }
}


function initializeAudio() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        setSoundStatus("Audio is not supported by this browser.");
        return false;
    }

    try {
        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        return true;

    } catch (error) {
        console.error("Audio initialization error:", error);
        setSoundStatus("Unable to initialize audio.");
        return false;
    }
}


// Play one beep
function playBeep(frequency = 880, startDelay = 0) {
    if (!audioContext || audioContext.state !== "running") {
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const startTime = audioContext.currentTime + startDelay;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, startTime);

    gain.gain.exponentialRampToValueAtTime(
        0.25,
        startTime + 0.03
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + 0.23
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.24);
}


// Play three warning beeps
function playAlertSound() {
    if (!soundUnlocked || !audioContext) {
        return;
    }

    if (audioContext.state !== "running") {
        audioContext.resume().then(() => {
            playAlertSound();
        }).catch(error => {
            console.warn("Could not resume audio:", error);
        });

        return;
    }

    playBeep(880, 0);
    playBeep(880, 0.4);
    playBeep(880, 0.8);
}


// Enable sound button
async function enableAlertSound() {
    if (!initializeAudio()) {
        return;
    }

    try {
        await audioContext.resume();

        if (audioContext.state === "running") {
            soundUnlocked = true;

            setSoundStatus("Sound enabled successfully");

            const button = element("enableSound");

            if (button) {
                button.textContent = "✓ Sound Enabled";
                button.style.background = "#15803d";
            }

            // Play a short confirmation beep
            playBeep(660, 0);
        } else {
            setSoundStatus("Please allow browser audio.");
        }

    } catch (error) {
        console.error("Sound permission error:", error);
        setSoundStatus("Unable to enable sound.");
    }
}


// Test sound button
async function testAlertSound() {
    if (!soundUnlocked) {
        setSoundStatus("Click Enable Sound first.");
        return;
    }

    if (!audioContext || audioContext.state !== "running") {
        setSoundStatus("Audio is not active. Enable sound again.");
        return;
    }

    setSoundStatus("Playing test sound...");

    playAlertSound();

    setTimeout(() => {
        setSoundStatus("Test completed. Sound is ready.");
    }, 1300);
}


// Play sound only for inactivity alerts
function checkForSoundAlert(alert) {
    const title = alert.title || "";

    const isInactivityAlert =
        title === "10-Minute Inactivity Alert" ||
        title === "Prolonged Inactivity Alert";

    if (!isInactivityAlert) {
        return;
    }

    const id = alert.id ||
        title + (alert.timestamp || "");

    if (soundedAlertIds.has(id)) {
        return;
    }

    soundedAlertIds.add(id);

    if (soundedAlertIds.size > 500) {
        soundedAlertIds.clear();
        soundedAlertIds.add(id);
    }

    if (soundUnlocked) {
        playAlertSound();
    } else {
        setSoundStatus("Alert received. Enable sound to hear alerts.");
    }
}


// =============================================
// INACTIVITY COUNTDOWN
// =============================================

function updateTimerDisplay() {
    const timer = element("countdownTimer");
    const message = element("timerMessage");

    if (!timer || !message) return;

    if (!timerStarted) {
        timer.textContent = "10:00";
        message.textContent = "Waiting for sensor data...";
        timer.style.color = "#2563eb";
        return;
    }

    if (remainingSeconds <= 0) {
        timer.textContent = "00:00";
        message.textContent = "TIME UP — Inactivity detected";
        timer.style.color = "#dc2626";
        return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timer.textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");

    message.textContent = "Time remaining without movement";

    timer.style.color =
        remainingSeconds <= 60 ? "#dc2626" : "#2563eb";
}


function startInactivityTimer() {
    if (timerInterval) return;

    timerStarted = true;

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
        }

        updateTimerDisplay();
    }, 1000);
}


function resetInactivityTimer() {
    remainingSeconds = INACTIVITY_LIMIT;
    updateTimerDisplay();
}


function handleTimerMovement(movement) {
    if (!timerStarted) {
        lastTimerMovement = movement;
        startInactivityTimer();
        return;
    }

    if (
        lastTimerMovement !== null &&
        movement > lastTimerMovement
    ) {
        resetInactivityTimer();
    }

    lastTimerMovement = movement;
}


// =============================================
// CONNECTION STATUS
// =============================================

function setConnection(connected) {
    const connection = element("connection");
    const backendText = element("backendText");
    const backendDot = element("backendDot");
    const pir = element("pir");

    if (connection) {
        connection.textContent = connected
            ? "● Connected"
            : "● Disconnected";

        connection.className = connected
            ? "status-badge connected"
            : "status-badge disconnected";
    }

    if (backendText) {
        backendText.textContent = connected
            ? "Connected"
            : "Disconnected";
    }

    if (backendDot) {
        backendDot.className = connected
            ? "status-dot good"
            : "status-dot bad";
    }

    if (pir) {
        pir.textContent = connected
            ? "Receiving sensor data"
            : "Waiting for sensor";
    }
}


// =============================================
// TIME FORMAT
// =============================================

function formatTime(value) {
    if (!value) return "Not available";

    return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


// =============================================
// ACTIVITY CHART
// =============================================

function initializeActivityChart() {
    const canvas = element("activityChart");

    if (!canvas || typeof Chart === "undefined") return;

    activityChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: [],

            datasets: [{
                label: "Movement Events",
                data: [],
                borderColor: "#4776e6",
                backgroundColor: "rgba(71,118,230,0.12)",
                fill: true,
                tension: 0.35,
                borderWidth: 3,
                pointRadius: 3
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,

            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}


function updateActivityChart(movement) {
    if (!activityChart) return;

    const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    activityChart.data.labels.push(time);
    activityChart.data.datasets[0].data.push(movement);

    if (activityChart.data.labels.length > MAX_POINTS) {
        activityChart.data.labels.shift();
        activityChart.data.datasets[0].data.shift();
    }

    activityChart.update("none");
}


// =============================================
// LIVE ALERT DISPLAY
// =============================================

function displayAlerts(alerts) {
    const container = element("alerts");

    if (!container) return;

    if (!Array.isArray(alerts) || alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-item info">
                <strong>No current alerts</strong>
                <p>Monitoring for activity.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = alerts.map(alert => {

        const type = ["success", "warning", "critical", "info"]
            .includes(alert.type) ? alert.type : "info";

        const icon = {
            success: "🚶",
            warning: "⚠️",
            critical: "🚨",
            info: "ℹ️"
        }[type];

        const title = escapeHTML(alert.title || "Activity Alert");
        const message = escapeHTML(alert.message || "");

        const time = alert.timestamp
            ? formatTime(alert.timestamp)
            : "";

        return `
            <div class="alert-item ${type}">
                <span class="alert-icon">${icon}</span>

                <div>
                    <strong>${title}</strong>
                    <p>${message}</p>
                    <small>${time}</small>
                </div>
            </div>
        `;

    }).join("");

    alerts.forEach(alert => {

        const id = alert.id || (
            (alert.title || "") + (alert.timestamp || "")
        );

        if (!displayedAlerts.has(id)) {
            displayedAlerts.add(id);

            addEvent(
                alert.title,
                alert.message,
                alert.timestamp
            );
        }

        checkForSoundAlert(alert);
    });

    if (displayedAlerts.size > 500) {
        displayedAlerts.clear();
    }
}


// =============================================
// SAFE TEXT DISPLAY
// =============================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// =============================================
// EVENT FEED
// =============================================

function addEvent(title, message, timestamp) {
    const container = element("events");

    if (!container) return;

    if (eventCount === 0) {
        container.innerHTML = "";
    }

    eventCount++;

    const event = document.createElement("div");
    event.className = "event-item";

    const safeTitle = escapeHTML(title || "Activity Event");
    const safeMessage = escapeHTML(message || "");

    const safeTime = escapeHTML(
        timestamp
            ? formatTime(timestamp)
            : formatTime(new Date())
    );

    event.innerHTML = `
        <div>
            <strong>${safeTitle}</strong>
            <p>${safeMessage}</p>
        </div>

        <small>${safeTime}</small>
    `;

    container.prepend(event);

    while (container.children.length > 30) {
        container.removeChild(container.lastChild);
    }
}


// =============================================
// UPDATE DASHBOARD
// =============================================

function updateDashboard(data) {

    if (element("movement")) {
        element("movement").textContent =
            data.movement_count ?? 0;
    }

    if (element("risk")) {
        element("risk").textContent =
            (data.risk_score ?? 0) + "%";
    }

    if (element("riskStatus")) {
        element("riskStatus").textContent =
            data.status || "Monitoring";
    }

    if (element("riskFill")) {
        const score = Math.max(
            0,
            Math.min(100, Number(data.risk_score) || 0)
        );

        element("riskFill").style.width = score + "%";
    }

    if (element("riskNote")) {
        element("riskNote").textContent =
            "Experimental activity indicator — not a diagnosis.";
    }

    if (element("updated")) {
        element("updated").textContent =
            "Last updated: " + formatTime(data.updated_at);
    }

    const movement = Number(data.movement_count) || 0;

    handleTimerMovement(movement);

    if (
        previousMovement === null ||
        movement !== previousMovement
    ) {
        updateActivityChart(movement);
        previousMovement = movement;
    }

    displayAlerts(data.alerts || []);
}


// =============================================
// FETCH LIVE DATA
// =============================================

async function fetchLatestData() {
    try {
        const response = await fetch(API_URL + "/latest", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Backend response error");
        }

        const data = await response.json();

        setConnection(true);
        updateDashboard(data);

    } catch (error) {
        console.error("Unable to fetch live data:", error);
        setConnection(false);
    }
}


// =============================================
// DAILY REPORT
// =============================================

function initializeDailyChart() {
    const canvas = element("dailyChart");

    if (!canvas || typeof Chart === "undefined") return;

    dailyChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels: [],

            datasets: [{
                label: "Movement Events",
                data: [],
                backgroundColor: "#4776e6",
                borderRadius: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}


async function loadDailyReport() {
    const report = element("dailyReport");
    const dateInput = element("reportDate");

    if (!report || !dateInput) return;

    const date = dateInput.value;

    if (!date) {
        report.textContent = "Please select a date.";
        return;
    }

    report.innerHTML = "<p>Generating report...</p>";

    try {
        const response = await fetch(
            API_URL + "/daily-report?date=" +
            encodeURIComponent(date),
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Report request failed");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        report.innerHTML = `
            <h3>Daily Summary — ${escapeHTML(data.date)}</h3>

            <div class="report-stats">
                <div>
                    <strong>${data.total_movement_events}</strong>
                    <p>Total movement events</p>
                </div>

                <div>
                    <strong>${data.number_of_movement_updates}</strong>
                    <p>Movement updates</p>
                </div>
            </div>

            <p>First movement: ${
                data.first_movement
                    ? formatTime(data.first_movement)
                    : "No movement recorded"
            }</p>

            <p>Last movement: ${
                data.last_movement
                    ? formatTime(data.last_movement)
                    : "No movement recorded"
            }</p>

            <small>${escapeHTML(data.note || "")}</small>
        `;

        if (dailyChart && data.hourly_activity) {
            dailyChart.data.labels =
                Object.keys(data.hourly_activity);

            dailyChart.data.datasets[0].data =
                Object.values(data.hourly_activity);

            dailyChart.update();
        }

    } catch (error) {
        console.error("Daily report error:", error);

        report.innerHTML = `
            <p>Unable to load the daily report. Please try again.</p>
        `;
    }
}


// =============================================
// MANUAL ACTIVITY CALCULATOR
// =============================================

function calculateManualActivity() {
    const movement = Math.max(
        0,
        Number(element("manualMovement")?.value) || 0
    );

    const door = Math.max(
        0,
        Number(element("manualDoor")?.value) || 0
    );

    const appliance = Math.max(
        0,
        Number(element("manualAppliance")?.value) || 0
    );

    const total = movement + door + appliance;

    let score;
    let status;

    if (total >= 22) {
        score = 12;
        status = "NORMAL ACTIVITY";
    } else if (total >= 12) {
        score = 38;
        status = "LOW ACTIVITY";
    } else {
        score = 78;
        status = "HIGH INACTIVITY INDICATOR";
    }

    const result = element("manualResult");

    if (result) {
        result.innerHTML = `
            <h3>Calculation Result</h3>
            <p>Total activity events: <strong>${total}</strong></p>
            <p>Experimental indicator: <strong>${score}%</strong></p>
            <p>Status: <strong>${status}</strong></p>
            <small>This is a demonstration rule, not a validated risk prediction.</small>
        `;
    }
}


function resetManualActivity() {
    if (element("manualMovement")) {
        element("manualMovement").value = 0;
    }

    if (element("manualDoor")) {
        element("manualDoor").value = 0;
    }

    if (element("manualAppliance")) {
        element("manualAppliance").value = 0;
    }

    if (element("manualResult")) {
        element("manualResult").innerHTML = `
            <h3>Calculation Result</h3>
            <p>Enter your activity counts and click Calculate Activity.</p>
        `;
    }
}


// =============================================
// NAVIGATION
// =============================================

function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach(link => {

        link.addEventListener("click", () => {

            document.querySelectorAll(".nav-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });
}


// =============================================
// START APPLICATION
// =============================================

document.addEventListener("DOMContentLoaded", () => {

    initializeActivityChart();
    initializeDailyChart();
    setupNavigation();

    updateTimerDisplay();

    // Enable sound button
    if (element("enableSound")) {
        element("enableSound").addEventListener(
            "click",
            enableAlertSound
        );
    }

    // Test sound button
    if (element("testSound")) {
        element("testSound").addEventListener(
            "click",
            testAlertSound
        );
    }

    const today = new Date();

    const localDate = new Date(
        today.getTime() -
        today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    if (element("reportDate")) {
        element("reportDate").value = localDate;
    }

    if (element("loadReport")) {
        element("loadReport").addEventListener(
            "click",
            loadDailyReport
        );
    }

    if (element("calculateManual")) {
        element("calculateManual").addEventListener(
            "click",
            calculateManualActivity
        );
    }

    if (element("resetManual")) {
        element("resetManual").addEventListener(
            "click",
            resetManualActivity
        );
    }

    if (element("clear")) {
        element("clear").addEventListener("click", () => {

            if (element("events")) {
                element("events").innerHTML =
                    '<p class="empty-events">Event feed cleared.</p>';
            }

            eventCount = 0;
        });
    }

    fetchLatestData();

    setInterval(fetchLatestData, POLL_INTERVAL);
});
