
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ElderCare Activity Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ActivityData(BaseModel):
    movement_count: int = 0
    door_events: int = 0
    appliance_events: int = 0

latest_data = {
    "movement_count": 0,
    "door_events": 0,
    "appliance_events": 0,
    "total_events": 0,
    "risk_score": 78,
    "status": "HIGH RISK",
}

@app.get("/")
def home():
    return {"message": "ElderCare API is running"}

@app.post("/activity")
def receive_activity(data: ActivityData):
    total = (
        data.movement_count
        + data.door_events
        + data.appliance_events
    )

    if total >= 22:
        score = 12
        status = "NORMAL"
    elif total >= 12:
        score = 38
        status = "LOW ACTIVITY"
    else:
        score = 78
        status = "HIGH RISK"

    latest_data.update({
        "movement_count": data.movement_count,
        "door_events": data.door_events,
        "appliance_events": data.appliance_events,
        "total_events": total,
        "risk_score": score,
        "status": status,
    })

    return latest_data

@app.get("/latest")
def get_latest_activity():
    return latest_data
