from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
JAVA_BACKEND_URL = os.getenv("JAVA_BACKEND_URL", "http://localhost:8080")

print("=== HealthOps Chatbot Starting ===")
print(f"GROQ_API_KEY set: {bool(GROQ_API_KEY)}")
print(f"JAVA_BACKEND_URL: {JAVA_BACKEND_URL}")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

app = FastAPI(title="HealthOps Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    role: str
    token: str
    history: list[dict] = []

class ChatResponse(BaseModel):
    reply: str

async def fetch_backend(path: str, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=10) as c:
        try:
            resp = await c.get(f"{JAVA_BACKEND_URL}{path}", headers=headers)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            print(f"Error fetching {path}: {e}")
    return None

async def get_context_for_role(role: str, token: str) -> str:
    context_parts = []
    try:
        if role == "DOCTOR":
            availability = await fetch_backend("/api/doctor/availability", token)
            holidays     = await fetch_backend("/api/doctor/holidays", token)
            stats        = await fetch_backend("/api/doctor/dashboard/stats", token)
            patients     = await fetch_backend("/api/doctor/patients", token)
            if stats:
                context_parts.append(
                    f"Doctor Stats: totalPatients={stats.get('totalPatients')}, "
                    f"myVisits={stats.get('myVisitsCount')}, "
                    f"todayVisits={stats.get('todayVisits')}, "
                    f"myAppointments={stats.get('myAppointments')}"
                )
            days = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
            if availability:
                slots = [f"{days[int(a.get('dayOfWeek',1))]} {a.get('startTime','?')}-{a.get('endTime','?')}" for a in availability]
                context_parts.append(f"My Availability: {', '.join(slots)}")
            if holidays:
                hols = [f"{h.get('date','?')} - {h.get('reason','No reason')}" for h in holidays]
                context_parts.append(f"My Holidays: {', '.join(hols)}")
            if patients:
                patient_list = [f"{p.get('code','?')} - {p.get('fullName','?')}" for p in patients[:10]]
                context_parts.append(f"My Patients (first 10): {', '.join(patient_list)}")

        elif role == "RECEPTIONIST":
            stats        = await fetch_backend("/api/reception/dashboard/stats", token)
            appointments = await fetch_backend("/api/reception/appointments", token)
            patients     = await fetch_backend("/api/reception/patients", token)
            doctors      = await fetch_backend("/api/reception/doctors", token)
            if stats:
                context_parts.append(
                    f"Reception Stats: totalPatients={stats.get('totalPatients')}, "
                    f"totalDoctors={stats.get('totalDoctors')}, "
                    f"todayAppointments={stats.get('todayAppointments')}, "
                    f"scheduled={stats.get('scheduledAppointments')}"
                )
            if appointments:
                scheduled = [a for a in appointments if a.get('status') == 'SCHEDULED'][:5]
                appt_list = [f"#{a['id']} {a['patient']['fullName']} with Dr.{a['doctor']['user']['fullName']} at {str(a.get('scheduledAt',''))[:16]}" for a in scheduled]
                context_parts.append(f"Upcoming Appointments: {'; '.join(appt_list) if appt_list else 'None'}")
            if doctors:
                doc_list = [f"Dr.{d['user']['fullName']} ({d.get('specialization','General')})" for d in doctors]
                context_parts.append(f"Available Doctors: {', '.join(doc_list)}")

        elif role == "ADMIN":
            stats = await fetch_backend("/api/admin/dashboard/stats", token)
            if stats:
                context_parts.append(
                    f"Admin Stats: totalDoctors={stats.get('totalDoctors')}, "
                    f"totalReceptionists={stats.get('totalReceptionists')}, "
                    f"totalPatients={stats.get('totalPatients')}, "
                    f"totalAppointments={stats.get('totalAppointments')}, "
                    f"totalVisits={stats.get('totalVisits')}"
                )
    except Exception as e:
        print(f"Error building context for {role}: {e}")
        context_parts.append("Note: Some live data could not be fetched.")

    return "\n".join(context_parts) if context_parts else "No live data available."

def build_system_prompt(role: str, live_context: str) -> str:
    base = (
        "You are HealthBot, a helpful AI assistant for Meera Multispecialty "
        "Hospital's internal management system called HealthOps.\n"
        "Be concise, friendly, and professional.\n"
        "Always use the live data provided below to give accurate answers.\n"
        "If asked to perform actions, guide the user step by step through the UI.\n\n"
        f"=== LIVE SYSTEM DATA ===\n{live_context}\n=== END LIVE DATA ===\n\n"
    )
    role_prompts = {
        "DOCTOR": (
            "You are assisting a DOCTOR.\n"
            "Help with: schedule/availability, holidays, patient records, visits, reports.\n"
            "UI: Availability tab, Holidays tab, Visits tab, Patients tab, Reports tab."
        ),
        "RECEPTIONIST": (
            "You are assisting a RECEPTIONIST.\n"
            "Help with: booking appointments, registering patients, doctor schedules, reports.\n"
            "UI: Appointments tab, Patients tab, Doctor Schedule tab, Reports tab."
        ),
        "ADMIN": (
            "You are assisting an ADMIN.\n"
            "Help with: system statistics, managing doctors and receptionists, user controls.\n"
            "UI: Dashboard tab, Doctors tab, Receptionists tab, All Users tab."
        ),
    }
    return base + role_prompts.get(role, "You are assisting a hospital staff member.")

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not GROQ_API_KEY or client is None:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")
    if req.role not in ("ADMIN", "DOCTOR", "RECEPTIONIST"):
        raise HTTPException(status_code=400, detail=f"Invalid role: {req.role}")

    try:
        live_context = await get_context_for_role(req.role, req.token)
        system_prompt = build_system_prompt(req.role, live_context)

        messages = [{"role": "system", "content": system_prompt}]

        for turn in req.history[-10:]:
            role_val = turn.get("role", "user")
            parts_val = turn.get("parts", "")
            content = parts_val if isinstance(parts_val, str) else str(parts_val)
            if role_val == "model":
                role_val = "assistant"
            messages.append({"role": role_val, "content": content})

        messages.append({"role": "user", "content": req.message})

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=1000,
            messages=messages
        )

        reply = response.choices[0].message.content
        return ChatResponse(reply=reply)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")

@app.get("/health")
async def health():
    status = "unknown"
    if GROQ_API_KEY and client:
        try:
            test = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                max_tokens=10,
                messages=[{"role": "user", "content": "Say OK"}]
            )
            status = "connected"
        except Exception as e:
            status = f"error: {str(e)}"
    else:
        status = "no_key"

    return {
        "status": "ok",
        "service": "HealthOps Chatbot",
        "groq_key_set": bool(GROQ_API_KEY),
        "groq_status": status,
        "backend_url": JAVA_BACKEND_URL,
    }