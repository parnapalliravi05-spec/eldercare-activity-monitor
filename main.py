
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

# -----------------------------------
# SETTINGS
# -----------------------------------

WARNING_INACTIVITY_MINUTES = 30
CRITICAL_INACTIVITY_MINUTES = 60
LOW_ACTIVITY_EVENTS_6H = 3

# Keeps recent history in memory.
# History is cleared if the Render service restarts.
activity_history = deque(maxlen=10000)

previous_movement_count = None
last_movement_time = None

# -----------------------------------
# REQUEST MODEL
# -----------------------------------

class ActivityData(BaseModel):
    movement_count: int = Field(default=0, ge=0)
    door_events: int = Field(default=0, ge=0)
    appliance_events: int = Field(default=0, ge=0)

# -----------------------------------
# INITIAL DATA
# -----------------------------------

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

# -----------------------------------
# HELPER: TIME
# -----------------------------------

def current_time():
    return datetime.now(timezone.utc)

def parse_time(value):
    return datetime.fromisoformat(value)

# -----------------------------------
# HELPER: MOVEMENT HISTORY
# -----------------------------------

def get_recent_events(hours=24):
    cutoff = current_time() - timedelta(hours=hours)

    return [
        event for event in activity_history
        if parse_time(event["timestamp"]) >= cutoff
    ]

# -----------------------------------
# HELPER: ALERT GENERATION
# -----------------------------------

def generate_alerts(now, movement_events):
    alerts = []

    if last_movement_time is None:
        alerts.append({
            "type": "info",
            "title": "Waiting for Movement",
            "message": "Waiting for the first movement detection."
        })
        return alerts

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
            )
        })

    elif inactive_minutes >= WARNING_INACTIVITY_MINUTES:
        alerts.append({
            "type": "warning",
            "title": "Low Movement Alert",
            "message": (
                f"No movement detected for "
                f"{int(inactive_minutes)} minutes."
            )
        })

    events_6h = get_recent_events(6)

    if len(events_6h) < LOW_ACTIVITY_EVENTS_6H:
        alerts.append({
            "type": "warning",
            "title": "Low Activity Alert",
            "message": (
                "Movement activity is below the configured "
                "six-hour threshold."
            )
        })

    if not alerts:
        alerts.append({
            "type": "success",
            "title": "Activity Normal",
            "message": "Recent movement activity has been detected."
        })

    return alerts

# -----------------------------------
# HELPER: EXPERIMENTAL RISK INDICATOR
# -----------------------------------

def calculate_risk(now):
    if last_movement_time is None:
        return 78, "WAITING FOR ACTIVITY"

    inactive_minutes = (
        now - last_movement_time
    ).total_seconds() / 60

    recent_events = get_recent_events(24)
    daily_movements = sum(
        event["movement_delta"] for event in recent_events
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

# -----------------------------------
# HOME
# -----------------------------------

@app.get("/")
def home():
    return {
        "message": "ElderCare API is running",
        "status": "online"
    }

# -----------------------------------
# RECEIVE ESP32 ACTIVITY
# -----------------------------------

@app.post("/activity")
def receive_activity(data: ActivityData):
    global previous_movement_count
    global last_movement_time

    now = current_time()

    movement = data.movement_count

    if previous_movement_count is None:
        movement_delta = movement
    elif movement >= previous_movement_count:
        movement_delta = movement - previous_movement_count
    else:
        # Handles an ESP32 counter reset.
        movement_delta = movement

    previous_movement_count = movement

    if movement_delta > 0:
        last_movement_time = now

        activity_history.append({
            "timestamp": now.isoformat(),
            "movement_delta": movement_delta,
            "movement_total": movement
        })

    total = (
        movement
        + data.door_events
        + data.appliance_events
    )

    risk_score, status = calculate_risk(now)

    alerts = generate_alerts(
        now,
        get_recent_events(24)
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
        "alerts": alerts,
        "updated_at": now.isoformat()
    })

    return latest_data

# -----------------------------------
# LATEST DATA
# -----------------------------------

@app.get("/latest")
def get_latest_activity():
    now = current_time()

    risk_score, status = calculate_risk(now)

    latest_data["risk_score"] = risk_score
    latest_data["status"] = status
    latest_data["alerts"] = generate_alerts(
        now,
        get_recent_events(24)
    )

    return latest_data

# -----------------------------------
# MOVEMENT HISTORY
# -----------------------------------

@app.get("/history")
def get_history(hours: int = 24):
    if hours < 1 or hours > 168:
        return {
            "error": "Hours must be between 1 and 168."
        }

    events = get_recent_events(hours)

    return {
        "period_hours": hours,
        "movement_events": len(events),
        "total_movements": sum(
            event["movement_delta"] for event in events
        ),
        "history": list(events)
    }

# -----------------------------------
# DAILY ACTIVITY REPORT
# -----------------------------------

@app.get("/daily-report")
def daily_report(date: Optional[str] = None):
    if date is None:
        selected_date = current_time().date()
    else:
        try:
            selected_date = datetime.strptime(
                date, "%Y-%m-%d"
            ).date()
        except ValueError:
            return {
                "error": "Use date format YYYY-MM-DD."
            }

    start = datetime(
        selected_date.year,
        selected_date.month,
        selected_date.day,
        tzinfo=timezone.utc
    )

    end = start + timedelta(days=1)

    events = [
        event for event in activity_history
        if start <= parse_time(event["timestamp"]) < end
    ]

    hourly = {f"{hour:02d}:00": 0 for hour in range(24)}

    for event in events:
        event_time = parse_time(event["timestamp"])
        hour = event_time.hour
        hourly[f"{hour:02d}:00"] += event["movement_delta"]

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
