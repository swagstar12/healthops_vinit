import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────
type Patient = { id: number; code: string; fullName: string; phone?: string; dob?: string; address?: string }
type Visit = {
  id: number
  patient: Patient
  doctor?: { id: number; user: { fullName: string } }
  appointment?: { id: number }
  visitAt: string
  notes?: string
  diagnosis?: string
  prescription?: string
}
type Avail = { id: number; dayOfWeek: number; startTime: string; endTime: string }
type Holiday = { id: number; date: string; reason: string }
type Stats = {
  totalPatients: number
  myVisitsCount: number
  todayVisits: number
  myAppointments: number
  availabilitySlots: number
  upcomingHolidays: number
}
type Toast = { id: number; msg: string; type: 'ok' | 'err' | 'info' | 'warn' }
type Errs = Record<string, string>

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiErr(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as any).response
    if (r?.data?.message) return r.data.message
    if (r?.status === 404) return 'Not found'
    if (r?.status === 400) return 'Invalid data — check your inputs'
    if (r?.status === 500) return 'Server error'
  }
  return (e as any)?.message ?? 'Unknown error'
}

function getToken(): string {
  try { return JSON.parse(localStorage.getItem('healthops_user') || '{}')?.token || '' } catch { return '' }
}

async function dlBlob(url: string, filename: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!r.ok) throw new Error('Download failed: ' + r.status)
  const blob = await r.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toasts({ list, remove }: { list: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none w-80">
      {list.map(t => (
        <div key={t.id} style={{ animation: 'slideIn .2s ease' }}
          className={`flex gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto border
          ${t.type === 'ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            t.type === 'err'  ? 'bg-red-50 border-red-200 text-red-800' :
            t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                'bg-sky-50 border-sky-200 text-sky-800'}`}>
          <span className="text-base flex-shrink-0 mt-0.5">
            {t.type==='ok'?'✓':t.type==='err'?'✕':t.type==='warn'?'⚠':'ℹ'}
          </span>
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button className="opacity-40 hover:opacity-100 text-lg" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm ──────────────────────────────────────────────────────────────────
function Confirm({ title, msg, onYes, onNo }: { title: string; msg: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
        <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mb-3 text-xl">🗑️</div>
        <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">{msg}</p>
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onYes} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold text-white transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spin({ sm }: { sm?: boolean }) {
  const cls = sm ? 'w-3 h-3 border' : 'w-4 h-4 border-2'
  return <div className={`${cls} border-current border-t-transparent rounded-full animate-spin flex-shrink-0`} />
}

// ─── Field ────────────────────────────────────────────────────────────────────
function F({ label, err, req, children, half }: { label: string; err?: string; req?: boolean; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : ''}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {err && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{err}</p>}
    </div>
  )
}

const I  = `w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400`
const IE = `w-full px-3.5 py-2.5 border border-red-300 rounded-xl text-sm bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all`

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, grad, sub, onClick }: {
  label: string; value: number | string; icon: string; grad: string; sub?: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${grad} shadow-lg ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
      <div className="absolute -right-3 -top-3 text-6xl opacity-10 select-none">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function Empty({ icon, msg, sub }: { icon: string; msg: string; sub?: string }) {
  return (
    <div className="py-16 text-center text-gray-400">
      <p className="text-5xl mb-3">{icon}</p>
      <p className="font-semibold text-gray-500">{msg}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const [tab, setTab]           = useState('dashboard')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visits, setVisits]     = useState<Visit[]>([])
  const [avails, setAvails]     = useState<Avail[]>([])
  const [hols, setHols]         = useState<Holiday[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState<Record<string, boolean>>({})

  // search states
  const [pSearch, setPSearch] = useState('')
  const [vSearch, setVSearch] = useState('')

  // patient edit modal
  const [editPatModal, setEditPatModal] = useState<Patient | null>(null)
  const [patForm, setPatForm] = useState({ fullName: '', dob: '', phone: '', address: '' })
  const [patErr, setPatErr]   = useState<Errs>({})

  // patient visits modal
  const [patVisitsModal, setPatVisitsModal] = useState<{ patient: Patient; list: Visit[] } | null>(null)

  // visit form
  const [vForm, setVForm] = useState({ patientId: 0, appointmentId: '', diagnosis: '', prescription: '', notes: '' })
  const [vErr, setVErr]   = useState<Errs>({})
  const [editV, setEditV] = useState<Visit | null>(null)
  const vRef = useRef<HTMLDivElement>(null)

  // availability form
  const [avForm, setAvForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
  const [avErr, setAvErr]   = useState<Errs>({})
  const [editAv, setEditAv] = useState<Avail | null>(null)

  // holiday form
  const [hForm, setHForm] = useState({ date: '', reason: '' })
  const [hErr, setHErr]   = useState<Errs>({})
  const [editH, setEditH] = useState<Holiday | null>(null)

  // confirm dialog
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null)

  // toasts
  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)

  const toast = (msg: string, type: Toast['type'] = 'ok') => {
    const id = ++tid.current
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500)
  }
  const go  = (k: string) => setBusy(b => ({ ...b, [k]: true }))
  const end = (k: string) => setBusy(b => { const n = { ...b }; delete n[k]; return n })
  const ask = (title: string, msg: string, fn: () => void) => setConfirm({ title, msg, fn })

  // ─── Load all data ─────────────────────────────────────────────────────────
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [pR, vR, aR, hR, sR] = await Promise.all([
        api.get('/doctor/patients'),
        api.get('/doctor/visits'),
        api.get('/doctor/availability'),
        api.get('/doctor/holidays'),
        api.get('/doctor/dashboard/stats'),
      ])
      setPatients(pR.data); setVisits(vR.data)
      setAvails(aR.data);   setHols(hR.data)
      setStats(sR.data)
    } catch (e) { toast(apiErr(e), 'err') }
    finally { setLoading(false) }
  }

  // ══ PATIENT EDIT ══════════════════════════════════════════════════════════
  function openEditPat(p: Patient) {
    setEditPatModal(p)
    setPatErr({})
    setPatForm({ fullName: p.fullName, dob: p.dob || '', phone: p.phone || '', address: p.address || '' })
  }

  async function submitPatEdit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Errs = {}
    if (!patForm.fullName.trim()) errs.fullName = 'Name required'
    if (Object.keys(errs).length) { setPatErr(errs); return }
    go('patEdit')
    try {
      await api.put(`/doctor/patients/${editPatModal!.id}`, {
        fullName: patForm.fullName.trim(),
        dob:      patForm.dob || null,
        phone:    patForm.phone.trim(),
        address:  patForm.address.trim(),
      })
      toast(`Patient "${patForm.fullName}" updated`)
      setEditPatModal(null)
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end('patEdit') }
  }

  async function viewPatientVisits(p: Patient) {
    go(`pv_${p.id}`)
    try {
      const r = await api.get(`/doctor/visits/patient/${p.id}`)
      setPatVisitsModal({ patient: p, list: r.data })
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end(`pv_${p.id}`) }
  }

  async function dlPatientReport(p: Patient) {
    go(`dl_${p.id}`)
    try {
      await dlBlob(`/api/doctor/reports/patient/${p.id}/visits.csv`, `patient-${p.code}-visits.csv`)
      toast('Report downloaded', 'info')
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end(`dl_${p.id}`) }
  }

  // ══ VISITS ════════════════════════════════════════════════════════════════
  function valV(f: typeof vForm): Errs {
    const e: Errs = {}
    if (!f.patientId) e.patientId = 'Select a patient'
    return e
  }

  async function submitV(e: React.FormEvent) {
    e.preventDefault()
    const errs = valV(vForm)
    if (Object.keys(errs).length) { setVErr(errs); return }
    setVErr({})
    go('vForm')
    try {
      if (editV) {
        await api.put(`/doctor/visits/${editV.id}`, {
          notes: vForm.notes, diagnosis: vForm.diagnosis, prescription: vForm.prescription,
        })
        toast('Visit updated successfully')
        resetV()
      } else {
        await api.post('/doctor/visits', {
          patientId:     vForm.patientId,
          appointmentId: vForm.appointmentId ? Number(vForm.appointmentId) : null,
          notes:         vForm.notes,
          diagnosis:     vForm.diagnosis,
          prescription:  vForm.prescription,
        })
        toast('Visit recorded')
        setVForm({ patientId: 0, appointmentId: '', diagnosis: '', prescription: '', notes: '' })
      }
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end('vForm') }
  }

  function resetV() {
    setEditV(null); setVErr({})
    setVForm({ patientId: 0, appointmentId: '', diagnosis: '', prescription: '', notes: '' })
  }

  function startEditV(v: Visit) {
    setEditV(v); setVErr({})
    setVForm({
      patientId:     v.patient.id,
      appointmentId: v.appointment?.id?.toString() || '',
      diagnosis:     v.diagnosis || '',
      prescription:  v.prescription || '',
      notes:         v.notes || '',
    })
    setTab('visits')
    setTimeout(() => vRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function deleteV(v: Visit) {
    go(`dv_${v.id}`)
    try {
      await api.delete(`/doctor/visits/${v.id}`)
      toast('Visit deleted', 'info')
      if (editV?.id === v.id) resetV()
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end(`dv_${v.id}`) }
  }

  async function dlAllVisits() {
    go('dlAll')
    try {
      await dlBlob('/api/doctor/reports/visits.csv', 'my-visits-report.csv')
      toast('All visits downloaded', 'info')
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end('dlAll') }
  }

  // ══ AVAILABILITY ══════════════════════════════════════════════════════════
  async function submitAv(e: React.FormEvent) {
    e.preventDefault()
    const errs: Errs = {}
    if (avForm.startTime >= avForm.endTime) errs.endTime = 'End must be after start'
    if (Object.keys(errs).length) { setAvErr(errs); return }
    setAvErr({})
    go('avForm')
    try {
      if (editAv) {
        await api.put(`/doctor/availability/${editAv.id}`, avForm)
        toast(`${DAYS[avForm.dayOfWeek]} slot updated`)
        resetAv()
      } else {
        await api.post('/doctor/availability', avForm)
        toast('Availability slot added')
        setAvForm({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
      }
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end('avForm') }
  }

  function resetAv() {
    setEditAv(null); setAvErr({})
    setAvForm({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
  }

  function startEditAv(a: Avail) {
    setEditAv(a); setAvErr({})
    setAvForm({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })
  }

  async function deleteAv(a: Avail) {
    go(`dav_${a.id}`)
    try {
      await api.delete(`/doctor/availability/${a.id}`)
      toast(`${DAYS[a.dayOfWeek]} slot removed`, 'info')
      if (editAv?.id === a.id) resetAv()
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end(`dav_${a.id}`) }
  }

  // ══ HOLIDAYS ══════════════════════════════════════════════════════════════
  async function submitH(e: React.FormEvent) {
    e.preventDefault()
    const errs: Errs = {}
    if (!hForm.date)          errs.date   = 'Date required'
    if (!hForm.reason.trim()) errs.reason = 'Reason required'
    if (Object.keys(errs).length) { setHErr(errs); return }
    setHErr({})
    go('hForm')
    try {
      if (editH) {
        await api.put(`/doctor/holidays/${editH.id}`, hForm)
        toast('Holiday updated')
        resetH()
      } else {
        await api.post('/doctor/holidays', hForm)
        toast('Holiday added')
        setHForm({ date: '', reason: '' })
      }
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end('hForm') }
  }

  function resetH() { setEditH(null); setHErr({}); setHForm({ date: '', reason: '' }) }

  function startEditH(h: Holiday) {
    setEditH(h); setHErr({})
    setHForm({ date: h.date, reason: h.reason })
  }

  async function deleteH(h: Holiday) {
    go(`dh_${h.id}`)
    try {
      await api.delete(`/doctor/holidays/${h.id}`)
      toast(`Holiday removed`, 'info')
      if (editH?.id === h.id) resetH()
      await load()
    } catch (e) { toast(apiErr(e), 'err') }
    finally { end(`dh_${h.id}`) }
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filtP = patients.filter(p =>
    p.fullName.toLowerCase().includes(pSearch.toLowerCase()) ||
    p.code.includes(pSearch) ||
    (p.phone || '').includes(pSearch)
  )
  const filtV = visits.filter(v =>
    v.patient.fullName.toLowerCase().includes(vSearch.toLowerCase()) ||
    v.patient.code.includes(vSearch) ||
    (v.diagnosis || '').toLowerCase().includes(vSearch.toLowerCase())
  )

  const todayVisitsList = visits.filter(v => {
    const d = new Date(v.visitAt)
    const t = new Date()
    return d.toDateString() === t.toDateString()
  })

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading your dashboard…</p>
    </div>
  )

  // ─── Button styles ─────────────────────────────────────────────────────────
  const bEdit  = `px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors`
  const bDel   = `px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40`
  const bGreen = `px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40`
  const bPurp  = `px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40`

  const TABS = [
    { k: 'dashboard',    l: '📊', label: 'Dashboard'    },
    { k: 'patients',     l: '🧑', label: 'Patients'     },
    { k: 'visits',       l: '🏥', label: 'Visits'       },
    { k: 'availability', l: '🕐', label: 'Availability' },
    { k: 'holidays',     l: '🏖️', label: 'Holidays'     },
    { k: 'reports',      l: '📄', label: 'Reports'      },
  ]

  return (
    <>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(1rem)}to{opacity:1;transform:translateX(0)}}`}</style>
      <Toasts list={toasts} remove={id => setToasts(t => t.filter(x => x.id !== id))} />

      {confirm && (
        <Confirm title={confirm.title} msg={confirm.msg}
          onYes={() => { const fn = confirm.fn; setConfirm(null); fn() }}
          onNo={() => setConfirm(null)} />
      )}

      {/* ── Patient Edit Modal ─────────────────────────────────────────────── */}
      {editPatModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100" style={{ animation: 'slideIn .2s ease' }}>
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">✏️ Edit Patient</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editPatModal.fullName} · Code {editPatModal.code}</p>
              </div>
              <button onClick={() => setEditPatModal(null)} className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 text-lg transition-colors">×</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={submitPatEdit}>
              <F label="Full Name" req err={patErr.fullName}>
                <input className={patErr.fullName ? IE : I} placeholder="Full name" value={patForm.fullName}
                  onChange={e => { setPatForm(f => ({ ...f, fullName: e.target.value })); setPatErr(x => ({ ...x, fullName: '' })) }} />
              </F>
              <div className="grid grid-cols-2 gap-4">
                <F label="Date of Birth">
                  <input className={I} type="date" value={patForm.dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setPatForm(f => ({ ...f, dob: e.target.value }))} />
                </F>
                <F label="Phone">
                  <input className={I} placeholder="Phone number" value={patForm.phone}
                    onChange={e => setPatForm(f => ({ ...f, phone: e.target.value }))} />
                </F>
              </div>
              <F label="Address">
                <textarea className={I} rows={2} placeholder="Address (optional)" value={patForm.address}
                  onChange={e => setPatForm(f => ({ ...f, address: e.target.value }))} />
              </F>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditPatModal(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={!!busy.patEdit}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                  {busy.patEdit && <Spin />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Patient Visits Modal ───────────────────────────────────────────── */}
      {patVisitsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] border border-gray-100" style={{ animation: 'slideIn .2s ease' }}>
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900">Visit History</h3>
                <p className="text-xs text-gray-500 mt-0.5">{patVisitsModal.patient.fullName} · Code {patVisitsModal.patient.code}</p>
              </div>
              <button onClick={() => setPatVisitsModal(null)} className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 text-lg transition-colors">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {patVisitsModal.list.length === 0
                ? <Empty icon="📋" msg="No visits recorded yet" sub="This patient hasn't been seen yet" />
                : <div className="space-y-3">
                    {patVisitsModal.list.map(v => (
                      <div key={v.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{fmtDate(v.visitAt)}</p>
                            <p className="text-xs text-gray-400">{fmtTime(v.visitAt)}</p>
                          </div>
                          <button onClick={() => { setPatVisitsModal(null); startEditV(v) }}
                            className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors">
                            ✏️ Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { l: 'Diagnosis',     v: v.diagnosis    },
                            { l: 'Prescription',  v: v.prescription },
                            { l: 'Notes',         v: v.notes        },
                          ].map(item => (
                            <div key={item.l} className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{item.l}</p>
                              <p className="text-sm text-gray-700">{item.v || <span className="italic text-gray-300">None</span>}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
            <div className="px-6 py-4 border-t flex justify-between items-center flex-shrink-0 bg-gray-50 rounded-b-2xl">
              <span className="text-sm text-gray-400">{patVisitsModal.list.length} visit(s) on record</span>
              <div className="flex gap-2">
                <button onClick={() => dlPatientReport(patVisitsModal.patient)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                  ↓ Download CSV
                </button>
                <button onClick={() => setPatVisitsModal(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-white transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="space-y-5 pb-16">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Doctor Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Meera Multispecialty Hospital · Patient care hub</p>
          </div>
          <button onClick={load}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm flex items-center gap-2 transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl flex-wrap">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${tab === t.k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.l} {t.label}
            </button>
          ))}
        </div>

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-5">
            {/* Stats row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Patients"     value={stats.totalPatients}     icon="🧑" grad="from-blue-600 to-blue-700"     onClick={() => setTab('patients')} />
              <StatCard label="Total My Visits"    value={stats.myVisitsCount}     icon="🏥" grad="from-emerald-600 to-emerald-700" onClick={() => setTab('visits')} />
              <StatCard label="Today's Visits"     value={stats.todayVisits}       icon="📋" grad="from-violet-600 to-violet-700"  sub="recorded today" />
            </div>
            {/* Stats row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="My Appointments"    value={stats.myAppointments}    icon="📅" grad="from-amber-500 to-orange-500" />
              <StatCard label="Availability Slots" value={stats.availabilitySlots} icon="🕐" grad="from-sky-500 to-sky-600"       onClick={() => setTab('availability')} />
              <StatCard label="Upcoming Holidays"  value={stats.upcomingHolidays}  icon="🏖️" grad="from-rose-500 to-pink-600"    onClick={() => setTab('holidays')} />
            </div>

            {/* Today's Visits panel */}
            {todayVisitsList.length > 0 && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">📋 Today's Visits ({todayVisitsList.length})</h3>
                  <button onClick={() => setTab('visits')} className="text-xs text-white/80 hover:text-white underline">View all →</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayVisitsList.slice(0, 4).map(v => (
                    <div key={v.id} className="bg-white/10 backdrop-blur rounded-xl p-3">
                      <p className="font-semibold text-sm">{v.patient.fullName}</p>
                      <p className="text-xs text-white/70">{fmtTime(v.visitAt)} · {v.diagnosis || 'No diagnosis'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Two-column panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recent Visits */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-sm">🏥 Recent Visits</h3>
                  <button onClick={() => setTab('visits')} className="text-xs text-blue-600 font-semibold hover:underline">View all →</button>
                </div>
                {visits.slice(0, 5).map(v => (
                  <div key={v.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0 hover:bg-gray-50 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{v.patient.fullName[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{v.patient.fullName}</p>
                        <p className="text-xs text-gray-400">{fmtDate(v.visitAt)} · {v.diagnosis || 'No diagnosis'}</p>
                      </div>
                    </div>
                    <button onClick={() => startEditV(v)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:underline transition-opacity">
                      Edit
                    </button>
                  </div>
                ))}
                {!visits.length && <Empty icon="🏥" msg="No visits yet" />}
              </div>

              {/* My Schedule */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-sm">🕐 Weekly Schedule</h3>
                  <button onClick={() => setTab('availability')} className="text-xs text-blue-600 font-semibold hover:underline">Manage →</button>
                </div>
                {avails.length > 0 ? (
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {avails.map(a => (
                      <div key={a.id} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">{DAY_SHORT[a.dayOfWeek]}</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{DAYS[a.dayOfWeek]}</p>
                          <p className="text-xs text-gray-500">{a.startTime}–{a.endTime}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty icon="🕐" msg="No schedule set" sub="Add your availability slots" />}
              </div>
            </div>

            {/* Patients quick panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-sm">🧑 My Patients ({patients.length})</h3>
                <button onClick={() => setTab('patients')} className="text-xs text-blue-600 font-semibold hover:underline">View all →</button>
              </div>
              {patients.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                  {patients.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 hover:bg-blue-50 transition-colors cursor-pointer group"
                      onClick={() => { setTab('patients'); }}>
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{p.fullName[0]}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.fullName}</p>
                        <p className="text-xs text-gray-400">Code: {p.code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty icon="🧑" msg="No patients assigned" />}
            </div>
          </div>
        )}

        {/* ══ PATIENTS ══════════════════════════════════════════════════════ */}
        {tab === 'patients' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold text-gray-800">Patients List <span className="text-gray-400 font-normal text-sm">({filtP.length})</span></h2>
                <input className="w-56 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="🔍 Search patients…" value={pSearch} onChange={e => setPSearch(e.target.value)} />
              </div>
              {filtP.length === 0
                ? <Empty icon="🧑" msg={pSearch ? 'No patients match your search' : 'No patients assigned yet'} />
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-5 py-3 text-left font-semibold">Code</th>
                          <th className="px-4 py-3 text-left font-semibold">Name</th>
                          <th className="px-4 py-3 text-left font-semibold">Phone</th>
                          <th className="px-4 py-3 text-left font-semibold">DOB</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtP.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-semibold">{p.code}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.fullName[0]}</div>
                                <div>
                                  <p className="font-semibold text-gray-900">{p.fullName}</p>
                                  {p.address && <p className="text-xs text-gray-400 truncate max-w-[150px]">{p.address}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-500">{p.phone || '—'}</td>
                            <td className="px-4 py-3.5 text-gray-500">{p.dob ? fmtDate(p.dob) : '—'}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button onClick={() => openEditPat(p)} className={bEdit}>✏️ Edit</button>
                                <button onClick={() => viewPatientVisits(p)} disabled={!!busy[`pv_${p.id}`]} className={bGreen}>
                                  {busy[`pv_${p.id}`] ? <Spin sm /> : '👁'} Visits
                                </button>
                                <button onClick={() => dlPatientReport(p)} disabled={!!busy[`dl_${p.id}`]} className={bPurp}>
                                  {busy[`dl_${p.id}`] ? <Spin sm /> : '↓'} Report
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ══ VISITS ════════════════════════════════════════════════════════ */}
        {tab === 'visits' && (
          <div className="space-y-5">
            {/* Visit form */}
            <div ref={vRef} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${editV ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${editV ? 'bg-blue-50 border-blue-100' : 'bg-gray-50'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">{editV ? `✏️ Editing Visit — ${editV.patient.fullName}` : '➕ Record New Visit'}</h2>
                  {editV && <p className="text-xs text-blue-500 mt-0.5">Visit #{editV.id} · {fmtDate(editV.visitAt)} at {fmtTime(editV.visitAt)}</p>}
                </div>
                {editV && (
                  <button onClick={resetV} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                    ✕ Cancel Edit
                  </button>
                )}
              </div>
              <form className="p-6 space-y-4" onSubmit={submitV}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <F label="Patient" req err={vErr.patientId}>
                    <select className={vErr.patientId ? IE : I} value={vForm.patientId} disabled={!!editV}
                      onChange={e => { setVForm(f => ({ ...f, patientId: Number(e.target.value) })); setVErr(x => ({ ...x, patientId: '' })) }}>
                      <option value={0}>Select Patient</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.code} – {p.fullName}</option>)}
                    </select>
                  </F>
                  <F label="Appointment ID (optional)">
                    <input className={I} type="number" placeholder="Link to appointment ID (optional)"
                      value={vForm.appointmentId} disabled={!!editV}
                      onChange={e => setVForm(f => ({ ...f, appointmentId: e.target.value }))} />
                  </F>
                </div>
                <F label="Diagnosis">
                  <textarea className={I} rows={2} placeholder="Primary diagnosis, findings…" value={vForm.diagnosis}
                    onChange={e => setVForm(f => ({ ...f, diagnosis: e.target.value }))} />
                </F>
                <F label="Prescription">
                  <textarea className={I} rows={2} placeholder="Medicines, dosage, frequency…" value={vForm.prescription}
                    onChange={e => setVForm(f => ({ ...f, prescription: e.target.value }))} />
                </F>
                <F label="Notes & Follow-up">
                  <textarea className={I} rows={2} placeholder="Additional notes, follow-up instructions…" value={vForm.notes}
                    onChange={e => setVForm(f => ({ ...f, notes: e.target.value }))} />
                </F>
                <div className="flex justify-end gap-3">
                  {editV && (
                    <button type="button" onClick={resetV}
                      className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={!!busy.vForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                    {busy.vForm && <Spin />}
                    {editV ? 'Save Changes' : '+ Record Visit'}
                  </button>
                </div>
              </form>
            </div>

            {/* Visits list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold text-gray-800">My Visits <span className="text-gray-400 font-normal text-sm">({filtV.length})</span></h2>
                <div className="flex gap-3 flex-wrap">
                  <input className="w-52 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="🔍 Search visits…" value={vSearch} onChange={e => setVSearch(e.target.value)} />
                  <button onClick={dlAllVisits} disabled={!!busy.dlAll}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors">
                    {busy.dlAll ? <Spin /> : '↓'} Download CSV
                  </button>
                </div>
              </div>
              {filtV.length === 0
                ? <Empty icon="🏥" msg={vSearch ? 'No visits match' : 'No visits recorded yet'} sub="Use the form above to record a visit" />
                : <div className="divide-y divide-gray-50">
                    {filtV.map(v => (
                      <div key={v.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${editV?.id === v.id ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''}`}>
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                            {v.patient.fullName[0]}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                              <span className="font-bold text-gray-900">{v.patient.fullName}</span>
                              <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{v.patient.code}</span>
                              <span className="text-xs text-gray-400">{fmtDate(v.visitAt)} at {fmtTime(v.visitAt)}</span>
                              {v.appointment && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Appt #{v.appointment.id}</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {[
                                { l: '🔬 Diagnosis',    val: v.diagnosis    },
                                { l: '💊 Prescription', val: v.prescription },
                                { l: '📝 Notes',        val: v.notes        },
                              ].map(item => (
                                <div key={item.l} className={`rounded-xl px-3 py-2 text-sm ${item.val ? 'bg-gray-50' : 'bg-gray-50 opacity-50'}`}>
                                  <p className="text-xs font-semibold text-gray-400 mb-0.5">{item.l}</p>
                                  <p className="text-gray-700 text-xs leading-relaxed">{item.val || <span className="italic text-gray-300">Not recorded</span>}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => startEditV(v)} className={bEdit}>✏️</button>
                            <button onClick={() => ask('Delete Visit', `Delete visit for ${v.patient.fullName} on ${fmtDate(v.visitAt)}? This cannot be undone.`, () => deleteV(v))}
                              disabled={!!busy[`dv_${v.id}`]} className={bDel}>
                              {busy[`dv_${v.id}`] ? <Spin sm /> : '🗑️'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}

        {/* ══ AVAILABILITY ══════════════════════════════════════════════════ */}
        {tab === 'availability' && (
          <div className="space-y-5">
            {/* Form */}
            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${editAv ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${editAv ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">{editAv ? `✏️ Editing — ${DAYS[editAv.dayOfWeek]}` : '➕ Add Availability Slot'}</h2>
                  {editAv && <p className="text-xs text-emerald-600 mt-0.5">Current: {editAv.startTime} – {editAv.endTime}</p>}
                </div>
                {editAv && (
                  <button onClick={resetAv} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition-colors">✕ Cancel</button>
                )}
              </div>
              <form className="p-6" onSubmit={submitAv}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <F label="Day of Week" req>
                    <select className={I} value={avForm.dayOfWeek} onChange={e => setAvForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
                      {DAYS.slice(1).map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                    </select>
                  </F>
                  <F label="Start Time" req err={avErr.startTime}>
                    <input className={avErr.startTime ? IE : I} type="time" value={avForm.startTime}
                      onChange={e => { setAvForm(f => ({ ...f, startTime: e.target.value })); setAvErr({}) }} />
                  </F>
                  <F label="End Time" req err={avErr.endTime}>
                    <input className={avErr.endTime ? IE : I} type="time" value={avForm.endTime}
                      onChange={e => { setAvForm(f => ({ ...f, endTime: e.target.value })); setAvErr({}) }} />
                  </F>
                  <button type="submit" disabled={!!busy.avForm}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                    {busy.avForm && <Spin />}
                    {editAv ? 'Save Changes' : 'Add Slot'}
                  </button>
                </div>
              </form>
            </div>

            {/* Schedule overview — week grid */}
            {avails.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm">Weekly Overview</h3>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.slice(1).map((day, idx) => {
                    const daySlots = avails.filter(a => a.dayOfWeek === idx + 1)
                    return (
                      <div key={day} className={`rounded-xl p-2 text-center ${daySlots.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'}`}>
                        <p className={`text-xs font-bold mb-1 ${daySlots.length > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>{DAY_SHORT[idx + 1]}</p>
                        {daySlots.length > 0 ? (
                          daySlots.map(s => <p key={s.id} className="text-xs text-emerald-600 leading-tight">{s.startTime}</p>)
                        ) : (
                          <p className="text-xs text-gray-300">Off</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Slots list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-gray-800">My Availability <span className="text-gray-400 font-normal text-sm">({avails.length} slots)</span></h2>
              </div>
              {avails.length === 0
                ? <Empty icon="🕐" msg="No availability slots set" sub="Add your weekly schedule above" />
                : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                    {[...avails].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(a => (
                      <div key={a.id} className={`border rounded-2xl p-4 hover:shadow-md transition-all ${editAv?.id === a.id ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex flex-col items-center justify-center leading-tight">
                            <span className="text-xs font-bold">{DAY_SHORT[a.dayOfWeek]}</span>
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{DAYS[a.dayOfWeek]}</p>
                            <p className="text-xs text-gray-500">{a.startTime} – {a.endTime}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEditAv(a)}
                            className="flex-1 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1 transition-colors">
                            ✏️ Edit
                          </button>
                          <button onClick={() => ask('Delete Slot', `Remove ${DAYS[a.dayOfWeek]} ${a.startTime}–${a.endTime}?`, () => deleteAv(a))}
                            disabled={!!busy[`dav_${a.id}`]}
                            className="flex-1 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-40">
                            {busy[`dav_${a.id}`] ? <Spin sm /> : '🗑️'} Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}

        {/* ══ HOLIDAYS ══════════════════════════════════════════════════════ */}
        {tab === 'holidays' && (
          <div className="space-y-5">
            {/* Form */}
            <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${editH ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${editH ? 'bg-amber-50 border-amber-100' : 'bg-gray-50'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">{editH ? `✏️ Editing Holiday — ${editH.date}` : '➕ Add Holiday / Leave'}</h2>
                  {editH && <p className="text-xs text-amber-600 mt-0.5">Current: {editH.reason}</p>}
                </div>
                {editH && (
                  <button onClick={resetH} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white transition-colors">✕ Cancel</button>
                )}
              </div>
              <form className="p-6" onSubmit={submitH}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <F label="Date" req err={hErr.date}>
                    <input className={hErr.date ? IE : I} type="date" value={hForm.date}
                      onChange={e => { setHForm(f => ({ ...f, date: e.target.value })); setHErr({}) }} />
                  </F>
                  <div>
                    <F label="Reason" req err={hErr.reason}>
                      <input className={hErr.reason ? IE : I} placeholder="e.g. Personal leave, Conference, Festival"
                        value={hForm.reason}
                        onChange={e => { setHForm(f => ({ ...f, reason: e.target.value })); setHErr({}) }} />
                    </F>
                  </div>
                  <button type="submit" disabled={!!busy.hForm}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                    {busy.hForm && <Spin />}
                    {editH ? 'Save Changes' : 'Add Holiday'}
                  </button>
                </div>
              </form>
            </div>

            {/* Holidays grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-gray-800">My Holidays / Leave <span className="text-gray-400 font-normal text-sm">({hols.length})</span></h2>
              </div>
              {hols.length === 0
                ? <Empty icon="🏖️" msg="No holidays scheduled" sub="Add leave dates above" />
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                    {[...hols].sort((a, b) => a.date.localeCompare(b.date)).map(h => {
                      const d = new Date(h.date)
                      const isPast = d < new Date()
                      const isToday = d.toDateString() === new Date().toDateString()
                      return (
                        <div key={h.id}
                          className={`border rounded-2xl p-4 hover:shadow-md transition-all ${
                            editH?.id === h.id ? 'border-amber-300 bg-amber-50' :
                            isToday          ? 'border-blue-300 bg-blue-50' :
                            isPast           ? 'border-gray-100 bg-gray-50 opacity-60' :
                                               'border-amber-100 bg-amber-50/40'
                          }`}>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex flex-col items-center justify-center leading-tight flex-shrink-0">
                              <span className="text-xs font-semibold">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                              <span className="text-xl font-black leading-none">{d.getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-800 text-sm">{d.toLocaleDateString('en-IN', { weekday: 'long' })}</p>
                                {isToday && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">Today</span>}
                                {isPast && !isToday && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Past</span>}
                                {!isPast && !isToday && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Upcoming</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{fmtDate(h.date)}</p>
                              <p className="text-sm text-gray-700 mt-1 font-medium">{h.reason}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEditH(h)}
                              className="flex-1 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-1 transition-colors">
                              ✏️ Edit
                            </button>
                            <button onClick={() => ask('Delete Holiday', `Remove holiday on ${h.date}? (${h.reason})`, () => deleteH(h))}
                              disabled={!!busy[`dh_${h.id}`]}
                              className="flex-1 py-1.5 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-40">
                              {busy[`dh_${h.id}`] ? <Spin sm /> : '🗑️'} Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          </div>
        )}

        {/* ══ REPORTS ══════════════════════════════════════════════════════ */}
        {tab === 'reports' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* All Visits */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl mb-4">🏥</div>
                <h3 className="font-bold text-gray-800 mb-1">All My Visits</h3>
                <p className="text-sm text-gray-500 mb-1">All visits you have conducted</p>
                <p className="text-xs text-gray-400 mb-5">Includes: Patient, Date, Diagnosis, Prescription, Notes</p>
                <button onClick={dlAllVisits} disabled={!!busy.dlAll}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                  {busy.dlAll ? <Spin /> : '↓'} Download All Visits CSV
                </button>
              </div>

              {/* Patient-specific */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl mb-4">📋</div>
                <h3 className="font-bold text-gray-800 mb-1">Patient Visit Report</h3>
                <p className="text-sm text-gray-500 mb-1">Complete visit history for one patient</p>
                <p className="text-xs text-gray-400 mb-3">Select a patient to download their full report</p>
                <select className={`${I} mb-0`} defaultValue=""
                  onChange={e => {
                    const p = patients.find(x => x.id === Number(e.target.value))
                    if (p) dlPatientReport(p)
                  }}>
                  <option value="">— Select a patient to download —</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.code} – {p.fullName}</option>)}
                </select>
              </div>
            </div>

            {/* Stats summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-5">Performance Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[
                  { l: 'Total Visits',      v: visits.length,    c: 'text-blue-600',    bg: 'bg-blue-50'    },
                  { l: 'Patients Seen',     v: patients.length,  c: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { l: 'Today\'s Visits',   v: todayVisitsList.length, c: 'text-violet-600', bg: 'bg-violet-50' },
                  { l: 'Avail. Slots',      v: avails.length,    c: 'text-sky-600',     bg: 'bg-sky-50'     },
                ].map(s => (
                  <div key={s.l} className={`${s.bg} rounded-2xl py-4 px-2`}>
                    <div className={`text-3xl font-black ${s.c}`}>{s.v}</div>
                    <div className="text-sm text-gray-500 mt-1 font-medium">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visits breakdown by patient */}
            {patients.length > 0 && visits.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-bold text-gray-800">Visits by Patient</h3>
                </div>
                <div className="p-5 space-y-2">
                  {patients.map(p => {
                    const count = visits.filter(v => v.patient.id === p.id).length
                    const pct = visits.length ? Math.round((count / visits.length) * 100) : 0
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.fullName[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-800 truncate">{p.fullName}</span>
                            <span className="text-gray-500 flex-shrink-0 ml-2">{count} visit{count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
