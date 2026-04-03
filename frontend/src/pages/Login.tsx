import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type DoctorPublic = {
  id: number;
  name: string;
  specialization: string;
  phone: string;
  availability: { id: number; dayOfWeek: number; startTime: string; endTime: string }[];
  holidays: { date: string; reason: string }[];
};

type BookingForm = {
  patientName: string;
  patientPhone: string;
  doctorId: number | null;
  scheduledAt: string;
  reason: string;
};

type BookingResult = {
  appointmentId: number;
  patientCode: string;
  doctorName: string;
  scheduledAt: string;
};

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Specialization icons ─────────────────────────────────────────────────────
const SPEC_ICONS: Record<string, string> = {
  "Cardiology": "❤️", "Neurology": "🧠", "Orthopedics": "🦴",
  "Pediatrics": "👶", "Gynecology": "👩‍⚕️", "Dermatology": "🔬",
  "General Medicine": "🏥", "ENT": "👂", "Ophthalmology": "👁️",
  "Psychiatry": "🧘", "Oncology": "🎗️", "Radiology": "📡",
};

function getSpecIcon(spec: string) {
  return SPEC_ICONS[spec] || "👨‍⚕️";
}

// ─── Check if doctor is available on a given date ─────────────────────────────
function isDoctorAvailable(doctor: DoctorPublic, dateStr: string): { ok: boolean; reason?: string } {
  if (!dateStr) return { ok: false };
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // convert JS 0=Sun to 7=Sun

  const hasSlot = doctor.availability.some(a => a.dayOfWeek === dayOfWeek);
  if (!hasSlot) {
    return { ok: false, reason: `Not available on ${DAYS[dayOfWeek]}s` };
  }

  const localDate = dateStr.split("T")[0];
  const onHoliday = doctor.holidays.some(h => h.date === localDate);
  if (onHoliday) {
    const holiday = doctor.holidays.find(h => h.date === localDate);
    return { ok: false, reason: `On leave: ${holiday?.reason || "Holiday"}` };
  }

  return { ok: true };
}

// ─── Doctor Card for the picker popup ────────────────────────────────────────
function DoctorCard({
  doctor, selected, scheduledAt, onSelect,
}: {
  doctor: DoctorPublic;
  selected: boolean;
  scheduledAt: string;
  onSelect: () => void;
}) {
  const availability = scheduledAt ? isDoctorAvailable(doctor, scheduledAt) : null;
  const hasAvailability = doctor.availability.length > 0;

  return (
    <div
      onClick={() => availability?.ok !== false && hasAvailability && onSelect()}
      className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 group
        ${selected
          ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
          : availability?.ok === false
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-50"
        }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
          ✓
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0
          ${selected ? "bg-blue-100" : "bg-gradient-to-br from-blue-50 to-indigo-100"}`}>
          {getSpecIcon(doctor.specialization)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Dr. {doctor.name}</p>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">{doctor.specialization || "General"}</p>

          {/* Availability pills */}
          {doctor.availability.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {doctor.availability.slice(0, 4).map(a => (
                <span key={a.id} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                  {DAY_SHORT[a.dayOfWeek]} {a.startTime}–{a.endTime}
                </span>
              ))}
              {doctor.availability.length > 4 && (
                <span className="text-[10px] text-gray-400">+{doctor.availability.length - 4} more</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-red-400 mt-1">⚠ No schedule set</p>
          )}

          {/* Availability status for selected date */}
          {scheduledAt && availability && (
            <div className={`mt-2 text-xs font-semibold flex items-center gap-1
              ${availability.ok ? "text-emerald-600" : "text-red-500"}`}>
              {availability.ok ? "✓ Available on selected date" : `✕ ${availability.reason}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Doctor Picker Modal ──────────────────────────────────────────────────────
function DoctorPickerModal({
  doctors, selectedId, scheduledAt, onSelect, onClose,
}: {
  doctors: DoctorPublic[];
  selectedId: number | null;
  scheduledAt: string;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterSpec, setFilterSpec] = useState("all");

  const specializations = ["all", ...Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)))];

  const filtered = doctors.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase());
    const matchesSpec = filterSpec === "all" || d.specialization === filterSpec;
    return matchesSearch && matchesSpec;
  });

  // Sort: available first
  const sorted = [...filtered].sort((a, b) => {
    if (!scheduledAt) return 0;
    const aOk = isDoctorAvailable(a, scheduledAt).ok ? 1 : 0;
    const bOk = isDoctorAvailable(b, scheduledAt).ok ? 1 : 0;
    return bOk - aOk;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] border border-gray-100"
        style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-black text-gray-900">Choose Your Doctor</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                {scheduledAt
                  ? `Showing availability for ${new Date(scheduledAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}`
                  : "Select a date first to check availability"}
              </p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg transition-colors">
              ×
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              placeholder="Search by name or specialization…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Specialization filter */}
          <div className="flex gap-2 flex-wrap">
            {specializations.map(s => (
              <button key={s} onClick={() => setFilterSpec(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${filterSpec === s
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s === "all" ? "All Specialties" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Doctor list */}
        <div className="overflow-y-auto flex-1 p-4">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">👨‍⚕️</p>
              <p className="font-medium">No doctors found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sorted.map(d => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  selected={selectedId === d.id}
                  scheduledAt={scheduledAt}
                  onSelect={() => { onSelect(d.id); onClose(); }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-3xl">
          <p className="text-xs text-gray-400 text-center">
            🟢 Green = available on selected date · 🔴 Red = not available / on leave
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Success Modal ────────────────────────────────────────────────────
function BookingSuccess({ result, onClose }: { result: BookingResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-gray-100 text-center p-8"
        style={{ animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">
          🎉
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-1">Booked!</h3>
        <p className="text-gray-500 text-sm mb-6">Your appointment has been confirmed</p>

        <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Appointment ID</span>
            <span className="font-bold text-gray-900">#{result.appointmentId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Patient Code</span>
            <span className="font-mono font-bold text-blue-600">{result.patientCode}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Doctor</span>
            <span className="font-bold text-gray-900">{result.doctorName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Date & Time</span>
            <span className="font-bold text-gray-900">
              {new Date(result.scheduledAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}{" "}
              {new Date(result.scheduledAt).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
        </div>

        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-5">
          📝 Note your Patient Code <strong>{result.patientCode}</strong> for future visits
        </p>

        <button onClick={onClose}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Booking state
  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<BookingResult | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [form, setForm] = useState<BookingForm>({
    patientName: "",
    patientPhone: "",
    doctorId: null,
    scheduledAt: "",
    reason: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<BookingForm & { doctorId: string }>>({});

  const { login } = useAuth();
  const nav = useNavigate();

  // Load doctors on mount
  useEffect(() => {
    setDoctorsLoading(true);
    fetch("/api/public/doctors")
      .then(r => r.json())
      .then(data => setDoctors(Array.isArray(data) ? data : []))
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, []);

  const selectedDoctor = doctors.find(d => d.id === form.doctorId) || null;

  // ─── Login submit ───────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    if (!email || !password) {
      setErr("Please fill in all fields");
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login({ fullName: data.fullName, role: data.role, token: data.token });
      nav("/");
    } catch (e: any) {
      setErr(e.response?.status === 401 ? "Invalid email or password" : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Booking validation ─────────────────────────────────────────────────────
  function validateBooking(): boolean {
    const errs: typeof formErrors = {};
    if (!form.patientName.trim()) errs.patientName = "Name is required";
    if (!form.patientPhone.trim()) errs.patientPhone = "Phone is required";
    else if (!/^\+?[\d\s\-()+]{7,15}$/.test(form.patientPhone)) errs.patientPhone = "Invalid phone number";
    if (!form.doctorId) (errs as any).doctorId = "Please select a doctor";
    if (!form.scheduledAt) (errs as any).scheduledAt = "Please select date & time";
    else {
      const selected = new Date(form.scheduledAt);
      if (selected <= new Date()) (errs as any).scheduledAt = "Must be a future date & time";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Booking submit ─────────────────────────────────────────────────────────
  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingError(null);
    if (!validateBooking()) return;
    setBookingLoading(true);
    try {
      const res = await fetch("/api/public/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: form.patientName.trim(),
          patientPhone: form.patientPhone.trim(),
          doctorId: form.doctorId,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          reason: form.reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.message || "Booking failed. Please try again.");
        return;
      }
      setBookingSuccess(data);
      setForm({ patientName: "", patientPhone: "", doctorId: null, scheduledAt: "", reason: "" });
      setFormErrors({});
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const inp = `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white`;
  const inpErr = `w-full px-4 py-3 border border-red-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition-all bg-red-50`;

  // ─── Contact form ───────────────────────────────────────────────────────────
  const [contactForm, setContactForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", department: "", message: ""
  });
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    alert("Message sent successfully! We will get back to you soon.");
    setContactForm({ firstName: "", lastName: "", email: "", phone: "", department: "", message: "" });
  };

  return (
    <div className="min-h-screen w-full">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
      `}</style>

      {/* Modals */}
      {showDoctorPicker && (
        <DoctorPickerModal
          doctors={doctors}
          selectedId={form.doctorId}
          scheduledAt={form.scheduledAt}
          onSelect={id => setForm(f => ({ ...f, doctorId: id }))}
          onClose={() => setShowDoctorPicker(false)}
        />
      )}
      {bookingSuccess && (
        <BookingSuccess result={bookingSuccess} onClose={() => setBookingSuccess(null)} />
      )}

      {/* ── Top Navbar ── */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-10 py-5 z-20 bg-white/90 backdrop-blur-md shadow-sm">
        <h1 className="text-xl md:text-2xl font-black text-gray-800">
          🏥 Meera Multispecialty Hospital
        </h1>
        <nav className="space-x-6 text-gray-600 font-medium hidden md:flex items-center">
          <button onClick={() => scrollTo("about")} className="hover:text-blue-600 transition text-sm">About Us</button>
          <button onClick={() => scrollTo("services")} className="hover:text-blue-600 transition text-sm">Services</button>
          <button onClick={() => scrollTo("book-appointment")} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold transition-colors">Book Appointment</button>
          <button onClick={() => scrollTo("contact")} className="hover:text-blue-600 transition text-sm">Contact</button>
        </nav>
      </header>

      {/* ── Hero Section with Login ── */}
      <div className="flex flex-col lg:flex-row min-h-screen pt-16">
        <div className="relative lg:w-1/2 bg-cover bg-center min-h-[400px] lg:min-h-screen"
          style={{ backgroundImage: "url('https://www.lakeshoresurgerycenter.com/wp-content/uploads/PAS_7350-1-1200x801.jpg')" }}>
          <div className="absolute inset-0 bg-blue-900 bg-opacity-70 flex flex-col justify-center items-center text-center p-8">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">Caring for Life</h2>
            <p className="text-blue-100 text-xl max-w-lg leading-relaxed mb-8">
              Excellence in healthcare, compassion in service. Your health is our priority.
            </p>
            <button onClick={() => scrollTo("book-appointment")}
              className="px-8 py-3.5 bg-white text-blue-700 font-bold rounded-2xl shadow-xl hover:scale-105 transition-transform text-base">
              📅 Book an Appointment
            </button>
          </div>
        </div>

        <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Doctors & Staff Login</h2>
            <form className="space-y-5" onSubmit={submit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input type="email" className={`${inp} border-gray-300`} placeholder="Enter your email"
                  value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input type="password" className={`${inp} border-gray-300`} placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button type="button" className="text-blue-600 hover:text-blue-800 font-medium">Forgot password?</button>
              </div>
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <span>⚠</span>{err}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
            <div className="mt-5 text-center text-sm text-gray-500">
              Need help? <span className="font-semibold text-blue-600">support@meerahospital.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── BOOK AN APPOINTMENT SECTION ── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="book-appointment" className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4 backdrop-blur-sm border border-white/30">
              No Login Required
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Book an Appointment
            </h2>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Schedule your visit in minutes. Select your preferred doctor, check their availability, and confirm your slot — all in one place.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
              {/* Form header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
                <h3 className="text-xl font-black text-gray-900">Patient Appointment Form</h3>
                <p className="text-sm text-gray-500 mt-1">Fill in your details and pick a convenient time</p>
              </div>

              <form className="p-8 space-y-5" onSubmit={submitBooking}>

                {/* Patient Name + Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={formErrors.patientName ? inpErr : `${inp} border-gray-200`}
                      placeholder="e.g. Ramesh Sharma"
                      value={form.patientName}
                      onChange={e => { setForm(f => ({ ...f, patientName: e.target.value })); setFormErrors(x => ({ ...x, patientName: undefined })); }}
                    />
                    {formErrors.patientName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{formErrors.patientName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={(formErrors as any).patientPhone ? inpErr : `${inp} border-gray-200`}
                      placeholder="e.g. 9876543210"
                      value={form.patientPhone}
                      onChange={e => { setForm(f => ({ ...f, patientPhone: e.target.value })); setFormErrors(x => ({ ...x, patientPhone: undefined })); }}
                    />
                    {(formErrors as any).patientPhone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{(formErrors as any).patientPhone}</p>}
                  </div>
                </div>

                {/* Date & Time */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Preferred Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className={(formErrors as any).scheduledAt ? inpErr : `${inp} border-gray-200`}
                    value={form.scheduledAt}
                    min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                    onChange={e => { setForm(f => ({ ...f, scheduledAt: e.target.value })); setFormErrors(x => ({ ...x, scheduledAt: undefined })); }}
                  />
                  {(formErrors as any).scheduledAt && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{(formErrors as any).scheduledAt}</p>}
                  {form.scheduledAt && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      📅 {new Date(form.scheduledAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {" · "}{new Date(form.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>

                {/* Doctor Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Select Doctor <span className="text-red-500">*</span>
                  </label>

                  {selectedDoctor ? (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
                      ${form.scheduledAt && !isDoctorAvailable(selectedDoctor, form.scheduledAt).ok
                        ? "border-red-300 bg-red-50"
                        : "border-blue-300 bg-blue-50"}`}
                      onClick={() => setShowDoctorPicker(true)}>
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                        {getSpecIcon(selectedDoctor.specialization)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">Dr. {selectedDoctor.name}</p>
                        <p className="text-xs text-blue-600 font-semibold">{selectedDoctor.specialization}</p>
                        {form.scheduledAt && (
                          <p className={`text-xs mt-0.5 font-semibold ${isDoctorAvailable(selectedDoctor, form.scheduledAt).ok ? "text-emerald-600" : "text-red-500"}`}>
                            {isDoctorAvailable(selectedDoctor, form.scheduledAt).ok
                              ? "✓ Available on selected date"
                              : `✕ ${isDoctorAvailable(selectedDoctor, form.scheduledAt).reason}`}
                          </p>
                        )}
                      </div>
                      <button type="button" className="text-xs text-blue-600 font-semibold bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 flex-shrink-0">
                        Change
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowDoctorPicker(true)}
                      disabled={doctorsLoading}
                      className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all text-left flex items-center gap-3
                        ${(formErrors as any).doctorId
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"}`}>
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                        {doctorsLoading ? "⏳" : "👨‍⚕️"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600">
                          {doctorsLoading ? "Loading doctors…" : "Click to choose a doctor"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {doctors.length > 0 ? `${doctors.length} doctor${doctors.length !== 1 ? "s" : ""} available` : "See all available specialists"}
                        </p>
                      </div>
                      {!doctorsLoading && <span className="ml-auto text-blue-500 text-lg">→</span>}
                    </button>
                  )}
                  {(formErrors as any).doctorId && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{(formErrors as any).doctorId}</p>}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Reason for Visit
                  </label>
                  <textarea
                    className={`${inp} border-gray-200 resize-none`} rows={3}
                    placeholder="Briefly describe your symptoms or reason for visit (optional)"
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>

                {/* Error banner */}
                {bookingError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">⚠</span>
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={bookingLoading}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                    disabled:opacity-60 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2
                    shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.99]">
                  {bookingLoading
                    ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Booking…</>
                    : "📅 Confirm Appointment"}
                </button>

                <p className="text-center text-xs text-gray-400">
                  By booking, you agree to our terms. Your patient code will be shared on confirmation.
                </p>
              </form>
            </div>

            {/* Info cards below form */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { icon: "🆓", title: "No Account Needed", desc: "Book without creating a login" },
                { icon: "✅", title: "Instant Confirmation", desc: "Get your appointment ID right away" },
                { icon: "🔔", title: "Easy Reschedule", desc: "Call us to change your slot" },
              ].map(c => (
                <div key={c.title} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center text-white">
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <p className="font-bold text-sm">{c.title}</p>
                  <p className="text-xs text-blue-100 mt-0.5">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── About Us ── */}
      <section id="about" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-6 text-center">About Meera Multispecialty Hospital</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Established with a vision to provide comprehensive healthcare services, we are committed to delivering world-class medical care with compassion and excellence.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "🏥", title: "2+ Years of Excellence", desc: "Serving the community with dedication and advanced medical care since 2023." },
              { icon: "👨‍⚕️", title: "Expert Medical Team", desc: "Board-certified specialists and experienced healthcare professionals." },
              { icon: "⚡", title: "24/7 Emergency Care", desc: "Round-the-clock emergency services with state-of-the-art equipment." },
            ].map(c => (
              <div key={c.title} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4 mx-auto">{c.icon}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{c.title}</h3>
                <p className="text-gray-600">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 bg-gray-50 rounded-2xl p-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-gray-800 mb-6">Our Mission</h3>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  To provide exceptional healthcare services combining advanced medical technology with personalized, compassionate care.
                </p>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white p-4 rounded-lg shadow"><div className="text-2xl font-bold text-blue-600">50+</div><div className="text-gray-600">Beds</div></div>
                  <div className="bg-white p-4 rounded-lg shadow"><div className="text-2xl font-bold text-blue-600">10+</div><div className="text-gray-600">Specialists</div></div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
                <h4 className="text-2xl font-bold mb-4">Our Values</h4>
                <ul className="space-y-3">
                  {["Compassionate Care", "Clinical Excellence", "Patient Safety", "24/7 Availability", "Community Service"].map(v => (
                    <li key={v} className="flex items-center gap-3"><span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">✓</span>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-6 text-center">Our Medical Services</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
            Comprehensive healthcare across multiple specialties, delivered by our expert medical team.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "❤️", title: "Cardiology", description: "Advanced cardiac care including interventional cardiology and preventive heart health programs.", services: ["Cardiac Catheterization", "Angioplasty & Stenting", "Heart Surgery", "ECG & Echo Services"] },
              { icon: "🧠", title: "Neurology", description: "Comprehensive neurological care for brain, spine, and nervous system disorders.", services: ["Brain & Spine Surgery", "Stroke Treatment", "Epilepsy Management", "Neurological Rehabilitation"] },
              { icon: "🦴", title: "Orthopedics", description: "Expert treatment for bone, joint, and musculoskeletal conditions.", services: ["Joint Replacement", "Arthroscopic Surgery", "Trauma Care", "Sports Medicine"] },
              { icon: "👶", title: "Pediatrics", description: "Specialized healthcare for infants, children, and adolescents.", services: ["Newborn Care", "Pediatric Surgery", "Vaccination Programs", "Child Development"] },
              { icon: "👩‍⚕️", title: "Gynecology", description: "Complete women's healthcare including maternity and fertility treatments.", services: ["Maternity Care", "Fertility Treatment", "Minimally Invasive Surgery", "Women's Health Screenings"] },
              { icon: "🔬", title: "Diagnostics", description: "State-of-the-art diagnostic services with accurate and timely results.", services: ["MRI & CT Scans", "Laboratory Services", "Digital X-Ray", "Pathology Services"] },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{s.title}</h3>
                <p className="text-gray-600 mb-4 text-sm">{s.description}</p>
                <ul className="text-sm text-gray-500 space-y-1">
                  {s.services.map((item, idx) => <li key={idx}>• {item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-20 bg-gray-800 text-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-white mb-6 text-center">Contact Us</h2>
          <p className="text-lg text-gray-300 text-center mb-12 max-w-3xl mx-auto">
            Get in touch with us for appointments, inquiries, or emergency services.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              { icon: "📍", color: "bg-blue-600", title: "Hospital Address", content: "123 Medical Center Drive\nHealthcare District\nPune, Maharashtra 411001\nIndia" },
              { icon: "📞", color: "bg-green-600", title: "Phone Numbers", content: "Main: +91-20-2567-8900\nEmergency: +91-20-2567-8911\nAppointments: +91-20-2567-8922\nToll Free: 1800-123-4567" },
              { icon: "📧", color: "bg-purple-600", title: "Email & Web", content: "General: info@meerahospital.com\nAppointments: appointments@meerahospital.com\nEmergency: emergency@meerahospital.com\nWebsite: www.meerahospital.com" },
            ].map(c => (
              <div key={c.title} className="bg-gray-700 p-8 rounded-xl">
                <div className={`w-12 h-12 ${c.color} rounded-lg flex items-center justify-center text-white text-xl mb-4`}>{c.icon}</div>
                <h3 className="text-xl font-bold mb-3">{c.title}</h3>
                <p className="text-gray-300 whitespace-pre-line text-sm leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-gray-700 p-8 rounded-xl">
              <h3 className="text-2xl font-bold mb-6">Send us a Message</h3>
              <form className="space-y-4" onSubmit={handleContactSubmit}>
                <div className="grid md:grid-cols-2 gap-4">
                  <input type="text" placeholder="First Name" required
                    className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
                    value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} />
                  <input type="text" placeholder="Last Name" required
                    className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
                    value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} />
                </div>
                <input type="email" placeholder="Email Address" required
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
                  value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                <input type="tel" placeholder="Phone Number"
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
                  value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                <select required className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white focus:outline-none"
                  value={contactForm.department} onChange={e => setContactForm({ ...contactForm, department: e.target.value })}>
                  <option value="">Select Department</option>
                  <option value="general">General Inquiry</option>
                  <option value="appointment">Appointment Request</option>
                  <option value="emergency">Emergency</option>
                  <option value="billing">Billing</option>
                  <option value="feedback">Feedback</option>
                </select>
                <textarea placeholder="Your Message" rows={4} required
                  className="w-full px-4 py-3 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white placeholder-gray-400 focus:outline-none"
                  value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} />
                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">Send Message</button>
              </form>
            </div>
            <div className="space-y-8">
              <div className="bg-gray-700 p-8 rounded-xl">
                <h3 className="text-2xl font-bold mb-6">Hospital Hours</h3>
                <div className="space-y-3 text-sm">
                  {[["Emergency Services", "24/7", "text-green-400"], ["OPD Timings", "8:00 AM - 8:00 PM", "text-white"], ["Pharmacy", "24 Hours", "text-white"], ["Laboratory", "6:00 AM - 10:00 PM", "text-white"], ["Radiology", "24 Hours", "text-white"]].map(([label, val, cls]) => (
                    <div key={label as string} className="flex justify-between">
                      <span>{label}</span>
                      <span className={`font-semibold ${cls}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-700 p-8 rounded-xl">
                <h3 className="text-2xl font-bold mb-4">Emergency</h3>
                <p className="text-sm mb-2">24/7 Emergency Services</p>
                <p className="text-2xl font-bold text-red-400">+91-20-2567-8911</p>
                <p className="text-sm mt-2">Ambulance: <span className="font-bold">108</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-bold text-lg mb-4">Meera Multispecialty Hospital</h4>
              <p className="text-sm">Your trusted healthcare partner providing comprehensive medical services.</p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollTo("about")} className="hover:text-white transition">About Us</button></li>
                <li><button onClick={() => scrollTo("services")} className="hover:text-white transition">Services</button></li>
                <li><button onClick={() => scrollTo("book-appointment")} className="hover:text-white transition">Book Appointment</button></li>
                <li><button onClick={() => scrollTo("contact")} className="hover:text-white transition">Contact</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Patient Services</h5>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollTo("book-appointment")} className="hover:text-white transition">Book Appointment</button></li>
                <li><a href="#" className="hover:text-white transition">Patient Portal</a></li>
                <li><a href="#" className="hover:text-white transition">Health Packages</a></li>
                <li><a href="#" className="hover:text-white transition">Insurance</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Emergency</h5>
              <p className="text-sm mb-2">24/7 Emergency Services</p>
              <p className="text-lg font-bold text-red-400">+91-20-2567-8911</p>
              <p className="text-sm mt-2">Ambulance: 108</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 Meera Multispecialty Hospital. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
