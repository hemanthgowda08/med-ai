import os
import math
import re
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# ======================================================
# BASIC SYMPTOM LOGIC
# ======================================================

SYMPTOM_WEIGHTS = {
    "chest pain": 60,
    "shortness of breath": 65,
    "difficulty breathing": 65,
    "heart attack": 100,
    "stroke": 100,
    "unconscious": 100,
    "fever": 25,
    "vomiting": 30,
    "vomiting blood": 90,
    "headache": 20,
    "dizziness": 30,
}

CRITICAL_OVERRIDE = {
    "heart attack",
    "stroke",
    "unconscious",
    "vomiting blood",
}

RESP_FLOOR = {
    "shortness of breath",
    "difficulty breathing",
}

def normalize(text):
    text = text.lower()
    return re.sub(r"[^\w\s]", " ", text)

def analyze_symptoms(text):
    text = normalize(text)
    score = 0
    detected = []

    for symptom, weight in SYMPTOM_WEIGHTS.items():
        if symptom in text:
            detected.append(symptom)
            score += weight

    score = min(score, 100)

    # Critical override
    if set(detected) & CRITICAL_OVERRIDE:
        urgency = "Critical"
        score = 100
    else:
        if score <= 25:
            urgency = "Low"
        elif score <= 50:
            urgency = "Moderate"
        elif score <= 75:
            urgency = "High"
        else:
            urgency = "Critical"

    # Respiratory floor
    if set(detected) & RESP_FLOOR and urgency in ("Low", "Moderate"):
        urgency = "High"
        score = max(score, 65)

    if urgency == "Critical":
        department = "Emergency / ICU"
        advice = "CALL 108 IMMEDIATELY."
    elif urgency == "High":
        department = "Emergency Department"
        advice = "Visit hospital immediately."
    elif urgency == "Moderate":
        department = "General Medicine"
        advice = "Consult doctor soon."
    else:
        department = "General Medicine"
        advice = "Rest and monitor symptoms."

    return {
        "score": score,
        "urgency": urgency,
        "department": department,
        "advice": advice,
        "detected_symptoms": detected,
    }

# ======================================================
# HOSPITAL DATA
# ======================================================

HOSPITALS = [
    {
        "name": "Aster CMI Hospital",
        "latitude": 13.0540,
        "longitude": 77.5946,
        "general_beds": 26,
        "icu_beds": 9,
        "emergency_beds": 5,
        "contact": "+91 9812345678",
    },
    {
        "name": "Manipal Hospital Hebbal",
        "latitude": 13.0478,
        "longitude": 77.5921,
        "general_beds": 30,
        "icu_beds": 10,
        "emergency_beds": 6,
        "contact": "+91 9900112233",
    },
    {
        "name": "Apollo Spectra Hospital",
        "latitude": 13.0451,
        "longitude": 77.6012,
        "general_beds": 25,
        "icu_beds": 8,
        "emergency_beds": 5,
        "contact": "+91 9876501234",
    },
    {
        "name": "Fortis Hospital Bangalore",
        "latitude": 13.0312,
        "longitude": 77.5634,
        "general_beds": 22,
        "icu_beds": 7,
        "emergency_beds": 4,
        "contact": "+91 9711223344",
    },
    {
        "name": "Green Valley Hospital",
        "latitude": 13.0352,
        "longitude": 77.5970,
        "general_beds": 20,
        "icu_beds": 6,
        "emergency_beds": 3,
        "contact": "+91 9123456780",
    },
    {
        "name": "Columbia Asia Hospital",
        "latitude": 13.0389,
        "longitude": 77.6105,
        "general_beds": 15,
        "icu_beds": 3,
        "emergency_beds": 2,
        "contact": "+91 9632145678",
    },
    {
        "name": "Sparsh Hospital",
        "latitude": 13.0198,
        "longitude": 77.5743,
        "general_beds": 18,
        "icu_beds": 5,
        "emergency_beds": 3,
        "contact": "+91 9845012345",
    },
    {
        "name": "Sakra World Hospital",
        "latitude": 12.9876,
        "longitude": 77.6398,
        "general_beds": 28,
        "icu_beds": 9,
        "emergency_beds": 5,
        "contact": "+91 9845678901",
    },
    {
        "name": "BGS Gleneagles Hospital",
        "latitude": 12.9102,
        "longitude": 77.4985,
        "general_beds": 16,
        "icu_beds": 4,
        "emergency_beds": 2,
        "contact": "+91 9741234567",
    },
    {
        "name": "City Care Hospital",
        "latitude": 13.0285,
        "longitude": 77.5890,
        "general_beds": 12,
        "icu_beds": 4,
        "emergency_beds": 2,
        "contact": "+91 9876543210",
    },
]

# ======================================================
# HELPERS
# ======================================================

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return round(R * 2 * math.asin(min(1.0, math.sqrt(a))), 2)

def get_status(h, urgency):
    if urgency == "Critical":
        available = h["icu_beds"] + h["emergency_beds"]
    else:
        available = h["general_beds"] + h["icu_beds"] + h["emergency_beds"]

    if available == 0:
        return "FULL"
    elif available <= 5:
        return "LIMITED"
    return "AVAILABLE"

# ======================================================
# ROUTES
# ======================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    symptoms = data.get("symptoms", "").strip()
    if not symptoms:
        return jsonify({"error": "No symptoms provided"}), 400

    return jsonify(analyze_symptoms(symptoms))

@app.route("/hospitals", methods=["POST"])
def hospitals():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    lat = float(data.get("lat"))
    lon = float(data.get("lon"))
    urgency = data.get("urgency", "Low")

    results = []

    for h in HOSPITALS:
        results.append({
            "name": h["name"],
            "latitude": h["latitude"],
            "longitude": h["longitude"],
            "general_beds": h["general_beds"],
            "icu_beds": h["icu_beds"],
            "emergency_beds": h["emergency_beds"],
            "contact": h["contact"],
            "distance_km": haversine(lat, lon, h["latitude"], h["longitude"]),
            "status": get_status(h, urgency),
        })

    return jsonify(sorted(results, key=lambda x: x["distance_km"]))

# ======================================================
# RUN
# ======================================================

if __name__ == "__main__":
    app.run(debug=True)