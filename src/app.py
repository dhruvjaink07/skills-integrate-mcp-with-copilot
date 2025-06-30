"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import os
import json
from pathlib import Path
import secrets

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Security setup
security = HTTPBasic()

# Load teacher credentials
def load_teachers():
    teachers_file = os.path.join(Path(__file__).parent, "teachers.json")
    with open(teachers_file, 'r') as f:
        return json.load(f)

# Load activities from JSON file
def load_activities():
    activities_file = os.path.join(Path(__file__).parent, "activities.json")
    with open(activities_file, 'r') as f:
        return json.load(f)

# Save activities to JSON file
def save_activities(activities_data):
    activities_file = os.path.join(Path(__file__).parent, "activities.json")
    with open(activities_file, 'w') as f:
        json.dump(activities_data, f, indent=2)

def verify_teacher(credentials: HTTPBasicCredentials = Depends(security)):
    """Verify teacher credentials"""
    teachers_data = load_teachers()
    for teacher in teachers_data["teachers"]:
        if (secrets.compare_digest(credentials.username, teacher["username"]) and
            secrets.compare_digest(credentials.password, teacher["password"])):
            return teacher
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid teacher credentials",
        headers={"WWW-Authenticate": "Basic"},
    )

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Global activities variable - loaded from JSON
activities = load_activities()


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    # Always reload activities from JSON file to get latest data
    return load_activities()


@app.get("/auth/status")
def check_auth_status(teacher: dict = Depends(verify_teacher)):
    """Check if user is authenticated as a teacher"""
    return {"authenticated": True, "teacher": teacher["name"], "username": teacher["username"]}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, teacher: dict = Depends(verify_teacher)):
    """Sign up a student for an activity (teacher only)"""
    # Reload activities to get latest data
    global activities
    activities = load_activities()
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Check capacity
    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(
            status_code=400,
            detail="Activity is at full capacity"
        )

    # Add student
    activity["participants"].append(email)
    
    # Save changes back to JSON file
    save_activities(activities)
    
    return {"message": f"Teacher {teacher['name']} signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, teacher: dict = Depends(verify_teacher)):
    """Unregister a student from an activity (teacher only)"""
    # Reload activities to get latest data
    global activities
    activities = load_activities()
    
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    
    # Save changes back to JSON file
    save_activities(activities)
    
    return {"message": f"Teacher {teacher['name']} unregistered {email} from {activity_name}"}
