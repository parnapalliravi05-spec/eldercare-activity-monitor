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

# SETTINGS
WARNING_INACTIVITY_MINUTES = 10
CRITICAL_INACTIVITY_MINUTES = 60
RISK_ACTIVITY_WINDOW_HOURS = 6
FULL_ACTIVITY_EVENTS = 20

activity_history = deque(maxlen=20000)
recent_alerts = deque(maxlen=100)
previous_movement_count = None
last_movement_time = None
monitoring_start_time = None
inactivity_alert_level = None


class ActivityData(BaseModel):
    movement_count: int = Field(default=0, ge=0)
    door_events: int = Field(default=0, ge=0)
    appliance_events: int = Field(default=0, ge=0)


latest_data = {
    "movement_count": 0,
    "door_events": 0,
    "appliance_events": 0,
    "total_events": 0,
    "risk_score": 78,
    "status": "WAITING FOR ACTIVITY",
    "last_movement_time": None,
    "alerts": [],
    "updated_at": None,
}


def now_utc():
    return datetime.now(timezone.utc)


def get_recent_events(hours=24):
    cutoff = now_utc() - timedelta(hours=hours)
    return [
        event for event in activity_history
        if datetime.fromisoformat(event["timestamp"]) >= cutoff
    ]


def create_movement_alert(delta, now):
    recent_alerts.appendleft({
        "id": now.isoformat(),
        "type": "success",
        "title": "Movement Detected",
        "message": f"{delta} new movement event(s) detected by the PIR sensor.",
        "timestamp": now.isoformat(),
    })


def generate_inactivity_alerts(now):
    global inactivity_alert_level

    alerts = []
    reference_time = last_movement_time or monitoring_start_time

    if reference_time is None:
        return [{
            "id": "waiting-for-movement",
            "type": "info",
            "title": "Waiting for Movement",
            "message": "Waiting for the first movement detection.",
            "timestamp": now.isoformat(),
        }]

    inactive_minutes = max(0, (now - reference_time).total_seconds() / 60)

    if inactive_minutes >= CRITICAL_INACTIVITY_MINUTES:
        if inactivity_alert_level != "critical":
            recent_alerts.appendleft({
                "id": "inactivity-critical-" + reference_time.isoformat(),
                "type": "critical",
                "title": "Prolonged Inactivity Alert",
                "message": f"No movement detected for {int(inactive_minutes)} minutes.",
                "timestamp": now.isoformat(),
            })
            inactivity_alert_level = "critical"
    elif inactive_minutes >= WARNING_INACTIVITY_MINUTES:
        if inactivity_alert_level is None:
            recent_alerts.appendleft({
                "id": "inactivity-warning-" + reference_time.isoformat(),
                "type": "warning",
                "title": "10-Minute Inactivity Alert",
                "message": "No movement has been detected for 10 minutes. Please check the monitored activity.",
                "timestamp": now.isoformat(),
            })
            inactivity_alert_level = "warning"

    six_hour_events = get_recent_events(RISK_ACTIVITY_WINDOW_HOURS)
    six_hour_movements = sum(event["movement_delta"] for event in six_hour_events)

    if six_hour_movements < 3:
        alerts.append({
            "id": "low-activity-six-hour",
            "type": "warning",
            "title": "Low Activity Alert",
            "message": "Movement activity is below the configured six-hour threshold.",
            "timestamp": now.isoformat(),
        })

    return alerts


# Experimental estimate only; not a medical or loneliness diagnosis.
# Recalculated on every incoming ESP32 reading and every /latest request.
def calculate_risk(now):
    reference_time = last_movement_time or monitoring_start_time
