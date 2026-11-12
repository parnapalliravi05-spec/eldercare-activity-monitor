
const API_URL = "https://eldercare-activity-monitor-backend.onrender.com";
const POLL_MS = 2000;
const MAX_POINTS = 30;

const $ = id => document.getElementById(id);

let chart;
let previousMovement = null;
let previousDataKey = null;
let feed = [];

// CONNECTION STATUS

function connection(online) {

  $("connection").classList.toggle("offline", !online);

  $("connection").innerHTML = `
    <i></i>
    ${online ? "LIVE · CONNECTED" : "RECONNECTING"}
  `;

  $("backendText").textContent = online
    ? "Cloud backend connected"
    : "Backend connection unavailable";

  $("backendDot").classList.toggle("good", online);

  $("pir").textContent = online ? "ONLINE" : "NO DATA";
  $("pir").classList.toggle("good", online);
}

// ACTIVITY EVENT FEED

function addEvent(title, detail) {

  feed.unshift({
    title,
    detail,
    time: new Date().toLocaleTimeString()
  });

  feed = feed.slice(0, 7);

  $("events").innerHTML = feed.map(item => `
    <div class="event">
      <div>
        <b>${item.title}</b>
        <small>${item.detail}</small>
      </div>
      <small>${item.time}</small>
    </div>
  `).join("");

}

// INITIALIZE LIVE GRAPH

function initChart() {

  const ctx = $("activityChart").getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);

  gradient.addColorStop(0, "rgba(105,93,246,.22)");
  gradient.addColorStop(1, "rgba(105,93,246,0)");

  chart = new Chart(ctx, {

    type: "line",

    data: {

      labels: [],

      datasets: [{

        label: "Movement events",

        data: [],

        borderColor: "#6d61f2",
        backgroundColor: gradient,

        fill: true,
        tension: 0.35,
        borderWidth: 2.5,

        pointRadius: 2,
        pointBackgroundColor: "#fff",
        pointBorderColor: "#6d61f2"

      }]

    },

    options: {

      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 250
      },

      plugins: {
        legend: {
          display: false
        }
      },

      scales: {

        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 6,
            color: "#9aa3b2",
            font: {
              size: 9
            }
          },
          border: {
            display: false
          }
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
            color: "#9aa3b2",
            font: {
              size: 9
            }
          },

          grid: {
            color: "#eff1f6"
          },

          border: {
            display: false
          }
        }

      }

    }

  });

}

// ADD A NEW GRAPH READING

function sampleChart(value) {

  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  chart.data.labels.push(time);

  chart.data.datasets[0].data.push(value);

  if (chart.data.labels.length > MAX_POINTS) {

    chart.data.labels.shift();

    chart.data.datasets[0].data.shift();

  }

  chart.update("none");

}

// UPDATE DASHBOARD WITH BACKEND DATA

function updateDashboard(data) {

  const movement = Number(data.movement_count) || 0;

  const door = Number(data.door_events) || 0;

  const appliance = Number(data.appliance_events) || 0;

  const risk = Math.max(
    0,
    Math.min(100, Number(data.risk_score) || 0)
  );

  const status = String(data.status || "UNKNOWN")
    .toUpperCase();

  // UPDATE SENSOR COUNTS

  $("movement").textContent = movement;

  $("door").textContent = door;

  $("appliance").textContent = appliance;

  // UPDATE RISK INDICATOR

  $("risk").textContent = risk + "%";

  $("riskFill").style.width = risk + "%";

  $("riskStatus").textContent = status.replaceAll("_", " ");

  $("riskNote").textContent =
    status.includes("NORMAL")
      ? "Activity is within the prototype's normal range"
      : status.includes("LOW")
      ? "Activity is below the prototype's normal range"
      : "Prototype activity indicator — review context";

  // UPDATE LAST REFRESH TIME

  $("updated").textContent =
    new Date().toLocaleTimeString();

  // CHECK FOR NEW MOVEMENT

  if (previousMovement === null) {

    $("movementDelta").textContent =
      "First live reading received";

    addEvent(
      "Monitoring connected",
      `Initial movement count: ${movement}`
    );

  }

  else if (movement !== previousMovement) {

    const difference = movement - previousMovement;

    $("movementDelta").textContent =
      difference > 0
        ? `+${difference} new movement event(s)`
        : "Movement counter changed";

    addEvent(
      "Movement data updated",
      `Movement count: ${movement}`
    );

  }

  else {

    $("movementDelta").textContent =
      "No new movement since last reading";

  }

  // ADD READING TO GRAPH

  sampleChart(movement);

  // DETECT OTHER SENSOR CHANGES

  const dataKey = [
    movement,
    door,
    appliance,
    risk,
    status
  ].join("|");

  if (
    previousDataKey !== null &&
    dataKey !== previousDataKey &&
    movement === previousMovement &&
    (door !== 0 || appliance !== 0)
  ) {

    addEvent(
      "Sensor data updated",
      `Door: ${door} · Appliance: ${appliance}`
    );

  }

  previousMovement = movement;

  previousDataKey = dataKey;

}

// FETCH LIVE DATA FROM RENDER

async function pollBackend() {

  try {

    const response = await fetch(
      `${API_URL}/latest`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    if (!response.ok) {

      throw new Error(`HTTP ${response.status}`);

    }

    const data = await response.json();

    console.log("Live backend data received:", data);

    connection(true);

    updateDashboard(data);

  }

  catch (error) {

    console.error("Backend connection error:", error);

    connection(false);

  }

}

// CLEAR EVENT FEED

$("clear").addEventListener("click", () => {

  feed = [];

  $("events").textContent = "Event feed cleared.";

});

// START LIVE MONITORING

initChart();

pollBackend();

setInterval(pollBackend, POLL_MS);
