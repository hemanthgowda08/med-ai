// ── STATE ──
let currentUrgency = "Low";

// ── INIT ──
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("checkBtn").addEventListener("click", runAnalysis);
});

// ── MAIN FLOW ──
function runAnalysis() {
    const symptoms = document.getElementById("symptomsInput").value.trim();
    const inputError = document.getElementById("inputError");

    // Client-side validation
    if (!symptoms) {
        inputError.classList.remove("hidden");
        return;
    }
    inputError.classList.add("hidden");

    setLoading(true);

    // STEP 1: Analyze symptoms
    fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms })
    })
    .then(function (res) {
        if (!res.ok) throw new Error("Analyze request failed: " + res.status);
        return res.json();
    })
    .then(function (analysis) {
        if (analysis.error) throw new Error(analysis.error);

        currentUrgency = analysis.urgency;
        displayAnalysis(analysis);

        // STEP 2: Get location and fetch hospitals
        if (!navigator.geolocation) {
            useFallbackLocation();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                document.getElementById("locationLabel").textContent =
                    "Your location: " + lat.toFixed(4) + ", " + lon.toFixed(4);
                fetchHospitals(lat, lon, currentUrgency);
            },
            function () {
                // Location denied — use Bengaluru city center as fallback
                useFallbackLocation();
            }
        );
    })
    .catch(function (err) {
        setLoading(false);
        showGlobalError("Analysis failed: " + err.message);
    });
}

function useFallbackLocation() {
    const fallbackLat = 13.0285;
    const fallbackLon = 77.5890;
    document.getElementById("locationLabel").textContent =
        "Using default location: Bengaluru (location permission denied)";
    fetchHospitals(fallbackLat, fallbackLon, currentUrgency);
}

// ── FETCH HOSPITALS ──
function fetchHospitals(lat, lon, urgency) {
    fetch("/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: lat, lon: lon, urgency: urgency })
    })
    .then(function (res) {
        if (!res.ok) throw new Error("Hospital request failed: " + res.status);
        return res.json();
    })
    .then(function (hospitals) {
        if (hospitals.error) throw new Error(hospitals.error);
        displayHospitals(hospitals);
        setLoading(false);
    })
    .catch(function (err) {
        setLoading(false);
        showGlobalError("Could not load hospitals: " + err.message);
    });
}

// ── DISPLAY ANALYSIS ──
function displayAnalysis(data) {
    // Show urgency section
    const urgencySection = document.getElementById("urgencySection");
    urgencySection.classList.remove("hidden");

    // Urgency badge
    const badge = document.getElementById("urgencyBadge");
    badge.textContent = "● " + data.urgency + " Urgency";
    badge.className = "urgency-badge " + data.urgency.toLowerCase();

    // Score, department, advice
    document.getElementById("scoreValue").textContent = data.score + " / 100";
    document.getElementById("deptValue").textContent   = data.department;
    document.getElementById("adviceValue").textContent = data.advice;

    // Detected symptoms tags
    const tagsContainer = document.getElementById("symptomsDetected");
    tagsContainer.innerHTML = "";
    if (data.detected_symptoms && data.detected_symptoms.length > 0) {
        data.detected_symptoms.forEach(function (symptom) {
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = symptom;
            tagsContainer.appendChild(tag);
        });
    } else {
        tagsContainer.innerHTML = '<span class="tag-none">No specific symptoms matched</span>';
    }

    // Score meter
    const fill = document.getElementById("meterFill");
    const score = data.score;
    let meterColor;
    if (score <= 30)      meterColor = "var(--low)";
    else if (score <= 60) meterColor = "var(--moderate)";
    else if (score <= 80) meterColor = "var(--high)";
    else                  meterColor = "var(--critical)";

    // Trigger animation on next frame
    setTimeout(function () {
        fill.style.width      = score + "%";
        fill.style.background = meterColor;
    }, 80);

    // Emergency panel
    const emergencyPanel = document.getElementById("emergencyPanel");
    if (data.urgency === "Critical") {
        emergencyPanel.classList.remove("hidden");
        emergencyPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
        emergencyPanel.classList.add("hidden");
    }
}

// ── DISPLAY HOSPITALS ──
function displayHospitals(hospitals) {
    const section    = document.getElementById("hospitalSection");
    const container  = document.getElementById("hospitalContainer");

    section.classList.remove("hidden");
    container.innerHTML = "";

    if (hospitals.length === 0) {
        container.innerHTML = '<p class="tag-none">No hospitals found.</p>';
        return;
    }

    hospitals.forEach(function (h) {
        const genClass = h.general_beds   === 0 ? "zero" : "general";
        const icuClass = h.icu_beds       === 0 ? "zero" : "icu";
        const emgClass = h.emergency_beds === 0 ? "zero" : "emergency";

        const statusClass = h.status === "AVAILABLE" ? "available"
                          : h.status === "LIMITED"   ? "limited"
                          : "full";

        const card = document.createElement("div");
        card.className = "hospital-card";
        card.innerHTML =
            '<div class="hospital-name">' + h.name + '</div>' +
            '<div class="hospital-distance">&#128205; ' + h.distance_km + ' km away</div>' +
            '<div class="bed-row">' +
                '<div class="bed-stat">' +
                    '<span class="bed-count ' + genClass + '">' + h.general_beds + '</span>' +
                    '<span class="bed-label">General</span>' +
                '</div>' +
                '<div class="bed-stat">' +
                    '<span class="bed-count ' + icuClass + '">' + h.icu_beds + '</span>' +
                    '<span class="bed-label">ICU</span>' +
                '</div>' +
                '<div class="bed-stat">' +
                    '<span class="bed-count ' + emgClass + '">' + h.emergency_beds + '</span>' +
                    '<span class="bed-label">Emergency</span>' +
                '</div>' +
            '</div>' +
            '<div class="hospital-footer">' +
                '<span class="hospital-contact">&#128222; ' + h.contact + '</span>' +
                '<span class="status-badge ' + statusClass + '">' + h.status + '</span>' +
            '</div>';

        container.appendChild(card);
    });
}

// ── LOADING STATE ──
function setLoading(isLoading) {
    const btn    = document.getElementById("checkBtn");
    const text   = document.getElementById("btnText");
    const loader = document.getElementById("btnLoader");

    btn.disabled = isLoading;
    text.classList.toggle("hidden", isLoading);
    loader.classList.toggle("hidden", !isLoading);
}

// ── GLOBAL ERROR ──
function showGlobalError(message) {
    const err = document.getElementById("inputError");
    err.textContent = "⚠ " + message;
    err.classList.remove("hidden");
}