
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from collections import deque
from typing import Optional

app = FastAPI(title="ElderCare Activity Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------
# SETTINGS
# ---------------------------------------

WARNING_INACTIVITY_MINUTES = 30
CRITICAL_INACTIVITY_MINUTES = 60
LOW_ACTIVITY_EVENTS_6H = 3

activity_history = deque(maxlen=20000)
recent_alerts = deque(maxlen=100)

previous_movement_count = None
last_movement_time = None

# ---------------------------------------
# REQUEST MODEL
# ---------------------------------------

class ActivityData(BaseModel):
    movement_count: int = Field(default=0, ge=0)
    door_events: int = Field(default=0, ge=0)
    appliance_events: int = Field(default=0, ge=0)


# ---------------------------------------
# LATEST DATA
# ---------------------------------------

latest_data = {
    "movement_count": 0,
    "door_events": 0,
    "appliance_events": 0,
    "total_events": 0,
    "risk_score": 78,
    "status": "WAITING FOR ACTIVITY",
    "last_movement_time": None,
    "alerts": [],
    "updated_at": None
}


def now_utc():
    return datetime.now(timezone.utc)


def get_recent_events(hours=24):
    cutoff = now_utc() - timedelta(hours=hours)

    return [
        event for event in activity_history
        if datetime.fromisoformat(event["timestamp"]) >= cutoff
    ]


# ---------------------------------------
# ACTIVITY ALERTS
# ---------------------------------------

def create_movement_alert(delta, now):
    alert = {
        "id": now.isoformat(),
        "type": "success",
        "title": "Movement Detected",
        "message": (
            f"{delta} new movement event(s) detected "
            "by the PIR sensor."
        ),
        "timestamp": now.isoformat()
    }

    recent_alerts.appendleft(alert)


def generate_inactivity_alerts(now):
    alerts = []

    if last_movement_time is None:
        return [{
            "type": "info",
            "title": "Waiting for Movement",
            "message": "Waiting for the first movement detection.",
            "timestamp": now.isoformat()
        }]

    inactive_minutes = (
        now - last_movement_time
    ).total_seconds() / 60

    if inactive_minutes >= CRITICAL_INACTIVITY_MINUTES:
        alerts.append({
            "type": "critical",
            "title": "Prolonged Inactivity Alert",
            "message": (
                f"No movement detected for "
                f"{int(inactive_minutes)} minutes."
            ),
            "timestamp": now.isoformat()
        })

    elif inactive_minutes >= WARNING_INACTIVITY_MINUTES:
        alerts.append({
            "type": "warning",
            "title": "Low Movement Alert",
            "message": (
                f"No movement detected for "
                f"{int(inactive_minutes)} minutes."
            ),
            "timestamp": now.isoformat()
        })

    six_hour_events = get_recent_events(6)

    six_hour_movements = sum(
        event["movement_delta"] for event in six_hour_events
    )

    if six_hour_movements < LOW_ACTIVITY_EVENTS_6H:
        alerts.append({
            "type": "warning",
            "title": "Low Activity Alert",
            "message": (
                "Movement activity is below the configured "
                "six-hour threshold."
            ),
            "timestamp": now.isoformat()
        })

    return alerts


# ---------------------------------------
# EXPERIMENTAL ACTIVITY RISK INDICATOR
# ---------------------------------------

def calculate_risk(now):
    if last_movement_time is None:
        return 78, "WAITING FOR ACTIVITY"

    inactive_minutes = (
        now - last_movement_time
    ).total_seconds() / 60

    events = get_recent_events(24)

    daily_movements = sum(
        event["movement_delta"] for event in events
    )

    inactivity_score = min(
        70,
        int(inactive_minutes / 60 * 35)
    )

    if daily_movements < 3:
        activity_score = 30
    elif daily_movements < 10:
        activity_score = 20
    elif daily_movements < 25:
        activity_score = 10
    else:
        activity_score = 0

    score = min(100, inactivity_score + activity_score)

    if score < 30:
        status = "NORMAL ACTIVITY"
    elif score < 60:
        status = "LOW ACTIVITY"
    else:
        status = "HIGH INACTIVITY INDICATOR"

    return score, status


# ---------------------------------------
# HOME
# ---------------------------------------

@app.get("/")
def home():
    return {
        "message": "ElderCare API is running",
        "status": "online"
    }


# ---------------------------------------
# RECEIVE ESP32 DATA
# ---------------------------------------

@app.post("/activity")
def receive_activity(data: ActivityData):
    global previous_movement_count
    global last_movement_time

    now = now_utc()
    movement = data.movement_count

    if previous_movement_count is None:
        movement_delta = movement
    elif movement >= previous_movement_count:
        movement_delta = movement - previous_movement_count
    else:
        # Handles ESP32 counter reset
        movement_delta = movement

    previous_movement_count = movement

    # Record each new movement detection
    if movement_delta > 0:
        last_movement_time = now

        activity_history.append({
            "timestamp": now.isoformat(),
            "movement_delta": movement_delta,
            "movement_total": movement
        })

        # Immediately create a movement alert
        create_movement_alert(movement_delta, now)

    total = (
        movement
        + data.door_events
        + data.appliance_events
    )

    risk_score, status = calculate_risk(now)

    inactivity_alerts = generate_inactivity_alerts(now)

    all_alerts = (
        list(recent_alerts)[:20]
        + inactivity_alerts
    )

    latest_data.update({
        "movement_count": movement,
        "door_events": data.door_events,
        "appliance_events": data.appliance_events,
        "total_events": total,
        "risk_score": risk_score,
        "status": status,
        "last_movement_time": (
            last_movement_time.isoformat()
            if last_movement_time else None
        ),
        "alerts": all_alerts,
        "updated_at": now.isoformat()
    })

    return latest_data


# ---------------------------------------
# LATEST DATA FOR WEBSITE
# ---------------------------------------

@app.get("/latest")
def get_latest_activity():
    now = now_utc()

    risk_score, status = calculate_risk(now)

    latest_data["risk_score"] = risk_score
    latest_data["status"] = status

    inactivity_alerts = generate_inactivity_alerts(now)

    latest_data["alerts"] = (
        list(recent_alerts)[:20]
        + inactivity_alerts
    )

    return latest_data


# ---------------------------------------
# MOVEMENT HISTORY
# ---------------------------------------

@app.get("/history")
def get_history(hours: int = 24):
    if hours < 1 or hours > 168:
        return {"error": "Hours must be between 1 and 168."}

    events = get_recent_events(hours)

    return {
        "period_hours": hours,
        "movement_events": len(events),
        "total_movements": sum(
            event["movement_delta"] for event in events
        ),
        "history": list(events)
    }


# ---------------------------------------
# DAILY ACTIVITY REPORT
# ---------------------------------------

@app.get("/daily-report")
def daily_report(date: Optional[str] = None):
    if date is None:
        selected_date = now_utc().date()
    else:
        try:
            selected_date = datetime.strptime(
                date, "%Y-%m-%d"
            ).date()
        except ValueError:
            return {"error": "Use date format YYYY-MM-DD."}

    start = datetime(
        selected_date.year,
        selected_date.month,
        selected_date.day,
        tzinfo=timezone.utc
    )

    end = start + timedelta(days=1)

    events = [
        event for event in activity_history
        if start <= datetime.fromisoformat(
            event["timestamp"]
        ) < end
    ]

    hourly = {
        f"{hour:02d}:00": 0
        for hour in range(24)
    }

    for event in events:
        event_time = datetime.fromisoformat(
            event["timestamp"]
        )
        hourly[f"{event_time.hour:02d}:00"] += (
            event["movement_delta"]
        )

    return {
        "date": selected_date.isoformat(),
        "total_movement_events": sum(
            event["movement_delta"] for event in events
        ),
        "number_of_movement_updates": len(events),
        "hourly_activity": hourly,
        "first_movement": (
            events[0]["timestamp"] if events else None
        ),
        "last_movement": (
            events[-1]["timestamp"] if events else None
        ),
        "note": (
            "Experimental activity summary. "
            "Not a medical or loneliness diagnosis."
        )
    }
