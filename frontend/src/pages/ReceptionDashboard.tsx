import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'

type Patient = { id: number; code: string; fullName: string; phone?: string; dob?: string; address?: string }
type Doctor  = { id: number; user: { fullName: string; email: string }; specialization?: string; phone?: string }
type Appointment = { id: number; patient: Patient; doctor: Doctor; scheduledAt: string; status: string; reason?: string }
type Visit  = { id: number; patient: Patient; doctor?: Doctor | null; visitAt: string; notes?: string; diagnosis?: string; prescription?: string }
type Avail  = { id: number; dayOfWeek: number; startTime: string; endTime: string }
type Holiday = { id: number; date: string; reason: string }
type Stats  = { totalPatients: number; totalDoctors: number; totalAppointments: number; todayAppointments: number; scheduledAppointments: number; completedAppointments: number; cancelledAppointments: number; totalVisits: number }
type Toast  = { id: number; msg: string; type: 'ok' | 'err' | 'info' }
type Errs   = Record<string, string>

const DAYS = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function apiErr(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as any).response
    if (r?.data?.message) return r.data.message
    if (r?.status === 409) return 'Duplicate entry — code or email already exists'
    if (r?.status === 400) return 'Bad request — check your inputs'
    if (r?.status === 404) return 'Not found'
    if (r?.status === 500) return 'Server error'
  }
  return (e as any)?.message ?? 'Unknown error'
}

function getToken(): string {
  try { return JSON.parse(localStorage.getItem('healthops_user') || '{}')?.token || '' } catch { return '' }
}

async function dlBlob(url: string, filename: string): Promise<void> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!r.ok) throw new Error('Download failed: ' + r.status)
  const blob = await r.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function Toasts({ list, remove }: { list: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none w-80">
      {list.map(t => (
        <div key={t.id} className={`flex gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto border
          ${t.type==='ok'  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            t.type==='err' ? 'bg-red-50 border-red-200 text-red-800' :
                             'bg-blue-50 border-blue-200 text-blue-800'}`}>
          <span className="mt-0.5 flex-shrink-0">{t.type==='ok'?'✓':t.type==='err'?'✕':'ℹ'}</span>
          <span className="flex-1">{t.msg}</span>
          <button className="opacity-50 hover:opacity-100" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

function Confirm({ title, msg, onYes, onNo }: { title: string; msg: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3 text-xl">🗑️</div>
        <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">{msg}</p>
        <div className="flex gap-3">
          <button onClick={onNo}  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onYes} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold text-white">Delete</button>
        </div>
      </div>
    </div>
  )
}

function Spin() { return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" /> }

function F({ label, err, req, children }: { label: string; err?: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {err && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><span>⚠</span>{err}</p>}
    </div>
  )
}

const I  = `w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all`
const IE = `w-full px-3.5 py-2.5 border border-red-300 rounded-xl text-sm bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all`

function Badge({ s }: { s: string }) {
  const m: Record<string,string> = {
    SCHEDULED: 'bg-amber-100 text-amber-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${m[s]??'bg-gray-100 text-gray-700'}`}>{s}</span>
}

// Safe helper to get doctor name
function doctorName(doctor?: Doctor | null): string {
  return doctor?.user?.fullName ?? '—'
}

export default function ReceptionDashboard() {
  const [tab, setTab]           = useState('dashboard')
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [appts, setAppts]       = useState<Appointment[]>([])
  const [visits, setVisits]     = useState<Visit[]>([])
  const [stats, setStats]       = useState<Stats|null>(null)
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState<Record<string,boolean>>({})

  const [pSearch, setPSearch] = useState('')
  const [aSearch, setASearch] = useState('')

  const [pForm, setPForm] = useState({ code:'', fullName:'', dob:'', phone:'', address:'', doctorId:'' })
  const [pErr, setPErr]   = useState<Errs>({})
  const [editP, setEditP] = useState<Patient|null>(null)
  const pRef = useRef<HTMLDivElement>(null)

  const [dForm, setDForm] = useState({ email:'', fullName:'', password:'', specialization:'', phone:'' })
  const [dErr, setDErr]   = useState<Errs>({})

  const [aForm, setAForm] = useState({ patientId:0, doctorId:0, scheduledAt:'', reason:'' })
  const [aErr, setAErr]   = useState<Errs>({})
  const [editA, setEditA] = useState<Appointment|null>(null)
  const aRef = useRef<HTMLDivElement>(null)

  const [selDoc, setSelDoc] = useState(0)
  const [avails, setAvails] = useState<Avail[]>([])
  const [hols, setHols]     = useState<Holiday[]>([])
  const [avForm, setAvForm] = useState({ dayOfWeek:1, startTime:'09:00', endTime:'17:00' })
  const [avErr, setAvErr]   = useState<Errs>({})
  const [hForm, setHForm]   = useState({ date:'', reason:'' })
  const [hErr, setHErr]     = useState<Errs>({})

  const [visitsModal, setVisitsModal] = useState<{patient:Patient;list:Visit[]}|null>(null)
  const [confirm, setConfirm]         = useState<{title:string;msg:string;fn:()=>void}|null>(null)

  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)

  const toast = (msg: string, type: Toast['type'] = 'ok') => {
    const id = ++tid.current
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500)
  }
  const go  = (k: string) => setBusy(b => ({ ...b, [k]: true }))
  const end = (k: string) => setBusy(b => { const n={...b}; delete n[k]; return n })
  const ask = (title: string, msg: string, fn: () => void) => setConfirm({ title, msg, fn })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [p,d,a,v,s] = await Promise.all([
        api.get('/reception/patients'),
        api.get('/reception/doctors'),
        api.get('/reception/appointments'),
        api.get('/reception/visits'),
        api.get('/reception/dashboard/stats'),
      ])
      setPatients(p.data ?? [])
      setDoctors(d.data ?? [])
      setAppts(a.data ?? [])
      setVisits(v.data ?? [])
      setStats(s.data)
    } catch(e) { toast(apiErr(e),'err') }
    finally { setLoading(false) }
  }

  // ── PATIENTS ──────────────────────────────────────────────────────────────

  function valP(f: typeof pForm, isEdit: boolean): Errs {
    const e: Errs = {}
    if (!isEdit) {
      if (!f.code.trim())             e.code = 'Patient code is required'
      else if (!/^\d+$/.test(f.code)) e.code = 'Code must be numbers only (e.g. 1001)'
    }
    if (!f.fullName.trim())           e.fullName = 'Full name is required'
    else if (f.fullName.trim().length < 2) e.fullName = 'At least 2 characters'
    if (!f.dob)                       e.dob = 'Date of birth is required'
    else if (new Date(f.dob) >= new Date()) e.dob = 'Must be a past date'
    if (f.phone && !/^\+?[\d\s\-()+]{6,15}$/.test(f.phone)) e.phone = 'Invalid phone number'
    return e
  }

  async function submitP(e: React.FormEvent) {
    e.preventDefault()
    const errs = valP(pForm, !!editP)
    if (Object.keys(errs).length) { setPErr(errs); return }
    setPErr({})
    go('pForm')
    try {
      if (editP) {
        await api.put(`/reception/patients/${editP.id}`, {
          fullName: pForm.fullName.trim(),
          dob:      pForm.dob || null,
          phone:    pForm.phone.trim(),
          address:  pForm.address.trim(),
        })
        toast(`"${pForm.fullName}" updated`)
        resetP()
      } else {
        await api.post('/reception/patients', {
          code:     pForm.code.trim(),
          fullName: pForm.fullName.trim(),
          dob:      pForm.dob || null,
          phone:    pForm.phone.trim(),
          address:  pForm.address.trim(),
          doctorId: pForm.doctorId ? Number(pForm.doctorId) : null,
        })
        toast(`Patient "${pForm.fullName}" added`)
        setPForm({ code:'', fullName:'', dob:'', phone:'', address:'', doctorId:'' })
      }
      await load()
    } catch(err) { toast(apiErr(err),'err') }
    finally { end('pForm') }
  }

  function resetP() {
    setEditP(null); setPErr({})
    setPForm({ code:'', fullName:'', dob:'', phone:'', address:'', doctorId:'' })
  }

  function startEditP(p: Patient) {
    setEditP(p)
    setPErr({})
    setPForm({ code:p.code, fullName:p.fullName, dob:p.dob||'', phone:p.phone||'', address:p.address||'', doctorId:'' })
    setTab('patients')
    setTimeout(() => pRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80)
  }

  async function deleteP(p: Patient) {
    go(`dp_${p.id}`)
    try {
      await api.delete(`/reception/patients/${p.id}`)
      toast(`"${p.fullName}" deleted`,'info')
      if (editP?.id === p.id) resetP()
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`dp_${p.id}`) }
  }

  async function viewVisits(p: Patient) {
    go(`vv_${p.id}`)
    try {
      const r = await api.get(`/reception/patients/${p.id}/visits`)
      setVisitsModal({ patient:p, list:r.data ?? [] })
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`vv_${p.id}`) }
  }

  async function dlReport(patientId: number, patientCode: string) {
    go(`dl_${patientId}`)
    try {
      await dlBlob(`/api/reception/reports/patient/${patientId}/visits.csv`, `patient-${patientCode}-visits.csv`)
      toast('Report downloaded','info')
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`dl_${patientId}`) }
  }

  async function dlCSV(url: string, filename: string) {
    try {
      await dlBlob(`/api${url}`, filename)
      toast('Download started','info')
    } catch(e) { toast(apiErr(e),'err') }
  }

  // ── DOCTORS ───────────────────────────────────────────────────────────────

  function valD(f: typeof dForm): Errs {
    const e: Errs = {}
    if (!f.email.trim())          e.email = 'Email required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Invalid email'
    if (!f.fullName.trim())       e.fullName = 'Name required'
    if (!f.password.trim())       e.password = 'Password required'
    else if (f.password.length<6) e.password = 'Min 6 characters'
    if (!f.specialization.trim()) e.specialization = 'Specialization required'
    if (!f.phone.trim())          e.phone = 'Phone required'
    return e
  }

  async function submitD(e: React.FormEvent) {
    e.preventDefault()
    const errs = valD(dForm)
    if (Object.keys(errs).length) { setDErr(errs); return }
    setDErr({})
    go('dForm')
    try {
      await api.post('/reception/doctors', dForm)
      toast(`Dr. ${dForm.fullName} added`)
      setDForm({ email:'', fullName:'', password:'', specialization:'', phone:'' })
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end('dForm') }
  }

  async function deleteD(d: Doctor) {
    go(`dd_${d.id}`)
    try {
      await api.delete(`/reception/doctors/${d.id}`)
      toast(`Dr. ${d.user?.fullName ?? '?'} removed`,'info')
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`dd_${d.id}`) }
  }

  // ── APPOINTMENTS ──────────────────────────────────────────────────────────

  function valA(f: typeof aForm): Errs {
    const e: Errs = {}
    if (!f.patientId)   e.patientId  = 'Select a patient'
    if (!f.doctorId)    e.doctorId   = 'Select a doctor'
    if (!f.scheduledAt) e.scheduledAt = 'Date & time required'
    return e
  }

  async function submitA(e: React.FormEvent) {
    e.preventDefault()
    const errs = valA(aForm)
    if (Object.keys(errs).length) { setAErr(errs); return }
    setAErr({})
    go('aForm')
    try {
      if (editA) {
        await api.put(`/reception/appointments/${editA.id}`, {
          scheduledAt: new Date(aForm.scheduledAt).toISOString(),
          reason:      aForm.reason,
          status:      'SCHEDULED',
        })
        toast('Appointment updated')
        resetA()
      } else {
        await api.post('/reception/appointments', {
          patientId:   aForm.patientId,
          doctorId:    aForm.doctorId,
          scheduledAt: new Date(aForm.scheduledAt).toISOString(),
          reason:      aForm.reason,
        })
        toast('Appointment created')
        setAForm({ patientId:0, doctorId:0, scheduledAt:'', reason:'' })
      }
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end('aForm') }
  }

  function resetA() { setEditA(null); setAErr({}); setAForm({ patientId:0, doctorId:0, scheduledAt:'', reason:'' }) }

  function startEditA(a: Appointment) {
    setEditA(a)
    setAErr({})
    const dt = new Date(a.scheduledAt)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16)
    setAForm({ patientId:a.patient.id, doctorId:a.doctor.id, scheduledAt:local, reason:a.reason||'' })
    setTab('appointments')
    setTimeout(() => aRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80)
  }

  async function updateStatus(id: number, status: string) {
    go(`st_${id}`)
    try {
      await api.put(`/reception/appointments/${id}/status`, { status })
      toast(`Status → ${status}`,'info')
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`st_${id}`) }
  }

  async function deleteA(a: Appointment) {
    go(`da_${a.id}`)
    try {
      await api.delete(`/reception/appointments/${a.id}`)
      toast(`Appointment #${a.id} deleted`,'info')
      if (editA?.id === a.id) resetA()
      await load()
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`da_${a.id}`) }
  }

  // ── SCHEDULE ──────────────────────────────────────────────────────────────

  async function loadSched(id: number) {
    if (!id) return
    go('sched')
    try {
      const [ar, hr] = await Promise.all([
        api.get(`/reception/doctors/${id}/availability`),
        api.get(`/reception/doctors/${id}/holidays`),
      ])
      setAvails(ar.data ?? []); setHols(hr.data ?? []); setSelDoc(id)
    } catch(e) { toast(apiErr(e),'err') }
    finally { end('sched') }
  }

  async function submitAv(e: React.FormEvent) {
    e.preventDefault()
    if (!selDoc) { toast('Select a doctor first','err'); return }
    const errs: Errs = {}
    if (avForm.startTime >= avForm.endTime) errs.endTime = 'End must be after start'
    if (Object.keys(errs).length) { setAvErr(errs); return }
    setAvErr({})
    go('avForm')
    try {
      await api.post(`/reception/doctors/${selDoc}/availability`, avForm)
      toast('Availability slot added')
      setAvForm({ dayOfWeek:1, startTime:'09:00', endTime:'17:00' })
      await loadSched(selDoc)
    } catch(e) { toast(apiErr(e),'err') }
    finally { end('avForm') }
  }

  async function deleteAv(id: number) {
    go(`dav_${id}`)
    try {
      await api.delete(`/reception/availability/${id}`)
      toast('Slot removed','info')
      await loadSched(selDoc)
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`dav_${id}`) }
  }

  async function submitH(e: React.FormEvent) {
    e.preventDefault()
    if (!selDoc) { toast('Select a doctor first','err'); return }
    const errs: Errs = {}
    if (!hForm.date)          errs.date   = 'Date required'
    if (!hForm.reason.trim()) errs.reason = 'Reason required'
    if (Object.keys(errs).length) { setHErr(errs); return }
    setHErr({})
    go('hForm')
    try {
      await api.post(`/reception/doctors/${selDoc}/holidays`, hForm)
      toast('Holiday added')
      setHForm({ date:'', reason:'' })
      await loadSched(selDoc)
    } catch(e) { toast(apiErr(e),'err') }
    finally { end('hForm') }
  }

  async function deleteH(id: number) {
    go(`dh_${id}`)
    try {
      await api.delete(`/reception/holidays/${id}`)
      toast('Holiday removed','info')
      await loadSched(selDoc)
    } catch(e) { toast(apiErr(e),'err') }
    finally { end(`dh_${id}`) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtP = patients.filter(p =>
    p.fullName.toLowerCase().includes(pSearch.toLowerCase()) ||
    p.code.includes(pSearch) ||
    (p.phone||'').includes(pSearch)
  )
  const filtA = appts.filter(a =>
    a.patient?.fullName?.toLowerCase().includes(aSearch.toLowerCase()) ||
    a.patient?.code?.includes(aSearch) ||
    (a.doctor?.user?.fullName ?? '').toLowerCase().includes(aSearch.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const bEdit  = `px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1`
  const bDel   = `px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed`
  const bGreen = `px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40`
  const bPurp  = `px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40`

  const TABS = [
    { k:'dashboard',    l:'📊 Dashboard'      },
    { k:'patients',     l:'🧑 Patients'        },
    { k:'appointments', l:'📅 Appointments'    },
    { k:'doctors',      l:'👨‍⚕️ Doctors'       },
    { k:'schedule',     l:'🗓 Doctor Schedule' },
    { k:'reports',      l:'📄 Reports'         },
  ]

  return (
    <>
      <Toasts list={toasts} remove={id => setToasts(t => t.filter(x => x.id!==id))} />

      {confirm && (
        <Confirm title={confirm.title} msg={confirm.msg}
          onYes={() => { const fn=confirm.fn; setConfirm(null); fn() }}
          onNo={() => setConfirm(null)} />
      )}

      {/* Visit History Modal */}
      {visitsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] border border-gray-100">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-2xl flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900">Visit History</h3>
                <p className="text-xs text-gray-500 mt-0.5">{visitsModal.patient.fullName} · Code {visitsModal.patient.code}</p>
              </div>
              <button onClick={() => setVisitsModal(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {visitsModal.list.length === 0
                ? <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-2">📋</p><p>No visits recorded yet</p></div>
                : <div className="space-y-3">
                    {visitsModal.list.map(v => (
                      <div key={v.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                        <p className="font-semibold text-gray-800 text-sm">{new Date(v.visitAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
                        <p className="text-xs text-violet-600 mt-0.5 mb-3">Dr. {doctorName(v.doctor)}</p>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div><p className="text-xs font-semibold text-gray-400 uppercase mb-1">Diagnosis</p><p className="text-gray-700">{v.diagnosis||'—'}</p></div>
                          <div><p className="text-xs font-semibold text-gray-400 uppercase mb-1">Prescription</p><p className="text-gray-700">{v.prescription||'—'}</p></div>
                          <div><p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p><p className="text-gray-700">{v.notes||'—'}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
            <div className="px-6 py-4 border-t flex justify-between items-center flex-shrink-0">
              <span className="text-sm text-gray-400">{visitsModal.list.length} visit(s)</span>
              <div className="flex gap-2">
                <button onClick={() => dlReport(visitsModal.patient.id, visitsModal.patient.code)}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl">
                  ↓ Download CSV
                </button>
                <button onClick={() => setVisitsModal(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Reception Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage patients, appointments and schedules</p>
          </div>
          <button onClick={load} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm">↻ Refresh</button>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl flex-wrap">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab===t.k ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ══ DASHBOARD ══ */}
        {tab==='dashboard' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l:'Total Patients',  v:stats.totalPatients,        g:'from-violet-600 to-violet-700', i:'🧑' },
                { l:'Total Doctors',   v:stats.totalDoctors,         g:'from-blue-600 to-blue-700',     i:'👨‍⚕️' },
                { l:"Today's Appts",   v:stats.todayAppointments,    g:'from-sky-500 to-sky-600',       i:'📅' },
                { l:'Total Visits',    v:stats.totalVisits,          g:'from-teal-600 to-teal-700',     i:'🏥' },
              ].map(s=>(
                <div key={s.l} className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${s.g} shadow-lg`}>
                  <div className="absolute -right-2 -top-2 text-5xl opacity-20">{s.i}</div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">{s.l}</p>
                  <p className="text-3xl font-black">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l:'All Appointments', v:stats.totalAppointments,     g:'from-indigo-500 to-indigo-600', i:'📋' },
                { l:'Scheduled',        v:stats.scheduledAppointments, g:'from-amber-500 to-amber-600',   i:'⏳' },
                { l:'Completed',        v:stats.completedAppointments, g:'from-emerald-600 to-emerald-700',i:'✅' },
                { l:'Cancelled',        v:stats.cancelledAppointments, g:'from-red-500 to-red-600',       i:'❌' },
              ].map(s=>(
                <div key={s.l} className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${s.g} shadow-lg`}>
                  <div className="absolute -right-2 -top-2 text-5xl opacity-20">{s.i}</div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">{s.l}</p>
                  <p className="text-3xl font-black">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex justify-between"><h3 className="font-bold text-sm text-gray-800">Recent Patients</h3><button onClick={()=>setTab('patients')} className="text-xs text-violet-600 font-semibold">View all →</button></div>
                {patients.slice(0,5).map(p=>(
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">{p.fullName[0]}</div>
                      <div><p className="text-sm font-medium text-gray-800">{p.fullName}</p><p className="text-xs text-gray-400">Code: {p.code}</p></div>
                    </div>
                  </div>
                ))}
                {!patients.length && <div className="py-8 text-center text-gray-400 text-sm">No patients yet</div>}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex justify-between"><h3 className="font-bold text-sm text-gray-800">Upcoming Appointments</h3><button onClick={()=>setTab('appointments')} className="text-xs text-violet-600 font-semibold">View all →</button></div>
                {appts.filter(a=>a.status==='SCHEDULED').slice(0,5).map(a=>(
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.patient?.fullName ?? '—'}</p>
                      <p className="text-xs text-gray-400">Dr. {doctorName(a.doctor)} · {new Date(a.scheduledAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <Badge s={a.status}/>
                  </div>
                ))}
                {!appts.filter(a=>a.status==='SCHEDULED').length && <div className="py-8 text-center text-gray-400 text-sm">No upcoming appointments</div>}
              </div>
            </div>
          </div>
        )}

        {/* ══ PATIENTS ══ */}
        {tab==='patients' && (
          <div className="space-y-5">
            <div ref={pRef} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${editP?'border-violet-300 ring-2 ring-violet-100':'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${editP?'bg-violet-50 border-violet-100':'bg-gray-50'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">{editP?`✏️ Editing: ${editP.fullName}`:'➕ Add New Patient'}</h2>
                  {editP && <p className="text-xs text-violet-500 mt-0.5">Code: {editP.code} · ID: {editP.id}</p>}
                </div>
                {editP && <button onClick={resetP} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white">✕ Cancel</button>}
              </div>
              <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitP}>
                {!editP && (
                  <F label="Patient Code" req err={pErr.code}>
                    <input className={pErr.code?IE:I} placeholder="Numeric only — e.g. 1001" value={pForm.code} inputMode="numeric"
                      onChange={e => { const v=e.target.value.replace(/\D/g,''); setPForm(f=>({...f,code:v})); setPErr(x=>({...x,code:''})) }} />
                  </F>
                )}
                <F label="Full Name" req err={pErr.fullName}>
                  <input className={pErr.fullName?IE:I} placeholder="e.g. Ramesh Sharma" value={pForm.fullName}
                    onChange={e => { setPForm(f=>({...f,fullName:e.target.value})); setPErr(x=>({...x,fullName:''})) }} />
                </F>
                <F label="Date of Birth" req err={pErr.dob}>
                  <input className={pErr.dob?IE:I} type="date" value={pForm.dob} max={new Date().toISOString().split('T')[0]}
                    onChange={e => { setPForm(f=>({...f,dob:e.target.value})); setPErr(x=>({...x,dob:''})) }} />
                </F>
                <F label="Phone" err={pErr.phone}>
                  <input className={pErr.phone?IE:I} placeholder="e.g. 9876543210" value={pForm.phone}
                    onChange={e => { setPForm(f=>({...f,phone:e.target.value})); setPErr(x=>({...x,phone:''})) }} />
                </F>
                <div className="md:col-span-2">
                  <F label="Address">
                    <textarea className={I} rows={2} placeholder="Full address (optional)" value={pForm.address}
                      onChange={e => setPForm(f=>({...f,address:e.target.value}))} />
                  </F>
                </div>
                {!editP && (
                  <div className="md:col-span-2">
                    <F label="Consulting Doctor">
                      <select className={I} value={pForm.doctorId} onChange={e => setPForm(f=>({...f, doctorId: e.target.value}))}>
                        <option value="">— Select consulting doctor (optional) —</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>Dr. {d.user?.fullName ?? '?'} – {d.specialization || 'General'}</option>
                        ))}
                      </select>
                    </F>
                    <p className="text-xs text-gray-400 mt-1">💡 The selected doctor will see this patient in their dashboard</p>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={!!busy.pForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                    {busy.pForm && <Spin/>}{editP?'Save Changes':'Add Patient'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold text-gray-800">Patients List <span className="text-gray-400 font-normal text-sm">({filtP.length})</span></h2>
                <div className="flex gap-3 flex-wrap">
                  <input className="w-52 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="🔍 Search…" value={pSearch} onChange={e=>setPSearch(e.target.value)} />
                  <button onClick={() => dlCSV('/reception/reports/patients.csv','patients.csv')}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl">↓ Download CSV</button>
                </div>
              </div>
              {filtP.length===0
                ? <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">🧑</p><p>{pSearch?'No matches':'No patients yet'}</p></div>
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
                          <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${editP?.id===p.id?'bg-violet-50':''}`}>
                            <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-semibold">{p.code}</span></td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.fullName[0]}</div>
                                <span className="font-semibold text-gray-900">{p.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-500">{p.phone||'—'}</td>
                            <td className="px-4 py-3.5 text-gray-500">{p.dob?new Date(p.dob).toLocaleDateString('en-IN'):'—'}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button onClick={() => startEditP(p)} className={bEdit}>✏️ Edit</button>
                                <button onClick={() => viewVisits(p)} disabled={!!busy[`vv_${p.id}`]} className={bGreen}>
                                  {busy[`vv_${p.id}`]?<Spin/>:'👁'} Visits
                                </button>
                                <button onClick={() => dlReport(p.id, p.code)} disabled={!!busy[`dl_${p.id}`]} className={bPurp}>
                                  {busy[`dl_${p.id}`]?<Spin/>:'↓'} Report
                                </button>
                                <button onClick={() => ask('Delete Patient',`Delete "${p.fullName}" (Code: ${p.code})? This cannot be undone.`,()=>deleteP(p))}
                                  disabled={!!busy[`dp_${p.id}`]} className={bDel}>
                                  {busy[`dp_${p.id}`]?<Spin/>:'🗑️'} Delete
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

        {/* ══ APPOINTMENTS ══ */}
        {tab==='appointments' && (
          <div className="space-y-5">
            <div ref={aRef} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${editA?'border-blue-300 ring-2 ring-blue-100':'border-gray-100'}`}>
              <div className={`px-6 py-4 border-b flex items-center justify-between ${editA?'bg-blue-50 border-blue-100':'bg-gray-50'}`}>
                <h2 className="font-bold text-gray-800">{editA?`✏️ Editing Appointment #${editA.id}`:'➕ Create New Appointment'}</h2>
                {editA && <button onClick={resetA} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white">✕ Cancel</button>}
              </div>
              <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitA}>
                <F label="Patient" req err={aErr.patientId}>
                  <select className={aErr.patientId?IE:I} value={aForm.patientId}
                    onChange={e=>{setAForm(f=>({...f,patientId:Number(e.target.value)}));setAErr(x=>({...x,patientId:''}))}} >
                    <option value={0}>Select Patient</option>
                    {patients.map(p=><option key={p.id} value={p.id}>{p.code} – {p.fullName}</option>)}
                  </select>
                </F>
                <F label="Doctor" req err={aErr.doctorId}>
                  <select className={aErr.doctorId?IE:I} value={aForm.doctorId}
                    onChange={e=>{setAForm(f=>({...f,doctorId:Number(e.target.value)}));setAErr(x=>({...x,doctorId:''}))}} >
                    <option value={0}>Select Doctor</option>
                    {doctors.map(d=><option key={d.id} value={d.id}>Dr. {d.user?.fullName ?? '?'} – {d.specialization||'General'}</option>)}
                  </select>
                </F>
                <F label="Date & Time" req err={aErr.scheduledAt}>
                  <input className={aErr.scheduledAt?IE:I} type="datetime-local" value={aForm.scheduledAt}
                    onChange={e=>{setAForm(f=>({...f,scheduledAt:e.target.value}));setAErr(x=>({...x,scheduledAt:''}))}} />
                </F>
                <F label="Reason for Visit">
                  <textarea className={I} rows={2} placeholder="Brief reason (optional)" value={aForm.reason}
                    onChange={e=>setAForm(f=>({...f,reason:e.target.value}))} />
                </F>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={!!busy.aForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                    {busy.aForm&&<Spin/>}{editA?'Save Changes':'Create Appointment'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-bold text-gray-800">Appointments <span className="text-gray-400 font-normal text-sm">({filtA.length})</span></h2>
                <div className="flex gap-3 flex-wrap">
                  <input className="w-52 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="🔍 Search…" value={aSearch} onChange={e=>setASearch(e.target.value)} />
                  <button onClick={() => dlCSV('/reception/reports/appointments.csv','appointments.csv')}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl">↓ Download CSV</button>
                </div>
              </div>
              {filtA.length===0
                ? <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📅</p><p>{aSearch?'No matches':'No appointments yet'}</p></div>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-5 py-3 text-left font-semibold">ID</th>
                          <th className="px-4 py-3 text-left font-semibold">Patient</th>
                          <th className="px-4 py-3 text-left font-semibold">Doctor</th>
                          <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtA.map(a => (
                          <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${editA?.id===a.id?'bg-blue-50':''}`}>
                            <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-600">#{a.id}</span></td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-gray-900">{a.patient?.fullName ?? '—'}</p>
                              <p className="text-xs text-gray-400">Code: {a.patient?.code ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-gray-700">Dr. {doctorName(a.doctor)}</p>
                              <p className="text-xs text-gray-400">{a.doctor?.specialization ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-gray-700">{new Date(a.scheduledAt).toLocaleDateString('en-IN')}</p>
                              <p className="text-xs text-gray-400">{new Date(a.scheduledAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
                            </td>
                            <td className="px-4 py-3.5"><Badge s={a.status}/></td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button onClick={() => startEditA(a)} className={bEdit}>✏️ Edit</button>
                                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer"
                                  value={a.status} disabled={!!busy[`st_${a.id}`]}
                                  onChange={e => updateStatus(a.id, e.target.value)}>
                                  <option value="SCHEDULED">Scheduled</option>
                                  <option value="COMPLETED">Completed</option>
                                  <option value="CANCELLED">Cancelled</option>
                                </select>
                                <button onClick={() => ask('Delete Appointment',`Delete appointment #${a.id} for ${a.patient?.fullName ?? '?'}?`,()=>deleteA(a))}
                                  disabled={!!busy[`da_${a.id}`]} className={bDel}>
                                  {busy[`da_${a.id}`]?<Spin/>:'🗑️'} Delete
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

        {/* ══ DOCTORS ══ */}
        {tab==='doctors' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50"><h2 className="font-bold text-gray-800">➕ Add New Doctor</h2></div>
              <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitD}>
                <F label="Email" req err={dErr.email}>
                  <input className={dErr.email?IE:I} type="email" placeholder="doctor@hospital.com" value={dForm.email}
                    onChange={e=>{setDForm(f=>({...f,email:e.target.value}));setDErr(x=>({...x,email:''}))}} />
                </F>
                <F label="Full Name" req err={dErr.fullName}>
                  <input className={dErr.fullName?IE:I} placeholder="Dr. Jane Smith" value={dForm.fullName}
                    onChange={e=>{setDForm(f=>({...f,fullName:e.target.value}));setDErr(x=>({...x,fullName:''}))}} />
                </F>
                <F label="Password" req err={dErr.password}>
                  <input className={dErr.password?IE:I} type="password" placeholder="Min 6 chars" value={dForm.password}
                    onChange={e=>{setDForm(f=>({...f,password:e.target.value}));setDErr(x=>({...x,password:''}))}} />
                </F>
                <F label="Specialization" req err={dErr.specialization}>
                  <input className={dErr.specialization?IE:I} placeholder="e.g. Cardiology" value={dForm.specialization}
                    onChange={e=>{setDForm(f=>({...f,specialization:e.target.value}));setDErr(x=>({...x,specialization:''}))}} />
                </F>
                <F label="Phone" req err={dErr.phone}>
                  <input className={dErr.phone?IE:I} placeholder="e.g. 9876543210" value={dForm.phone}
                    onChange={e=>{setDForm(f=>({...f,phone:e.target.value}));setDErr(x=>({...x,phone:''}))}} />
                </F>
                <div className="flex items-end">
                  <button type="submit" disabled={!!busy.dForm}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm">
                    {busy.dForm&&<Spin/>} Add Doctor
                  </button>
                </div>
              </form>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b"><h2 className="font-bold text-gray-800">Doctors List <span className="text-gray-400 font-normal text-sm">({doctors.length})</span></h2></div>
              {!doctors.length
                ? <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">👨‍⚕️</p><p>No doctors yet</p></div>
                : <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-5 py-3 text-left font-semibold">ID</th>
                          <th className="px-4 py-3 text-left font-semibold">Name</th>
                          <th className="px-4 py-3 text-left font-semibold">Email</th>
                          <th className="px-4 py-3 text-left font-semibold">Specialization</th>
                          <th className="px-4 py-3 text-left font-semibold">Phone</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {doctors.map(d => (
                          <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5 text-xs font-mono text-gray-400">#{d.id}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{(d.user?.fullName ?? '?')[0]}</div>
                                <span className="font-semibold text-gray-900">Dr. {d.user?.fullName ?? '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-500">{d.user?.email ?? '—'}</td>
                            <td className="px-4 py-3.5"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">{d.specialization||'—'}</span></td>
                            <td className="px-4 py-3.5 text-gray-500">{d.phone||'—'}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => { loadSched(d.id); setTab('schedule') }} className={bGreen}>📅 Manage Schedule</button>
                                <button onClick={() => ask('Delete Doctor',`Remove Dr. ${d.user?.fullName ?? '?'}?`,()=>deleteD(d))}
                                  disabled={!!busy[`dd_${d.id}`]} className={bDel}>
                                  {busy[`dd_${d.id}`]?<Spin/>:'🗑️'} Delete
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

        {/* ══ SCHEDULE ══ */}
        {tab==='schedule' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-3">Select Doctor</h2>
              <select className={`${I} max-w-sm`} value={selDoc}
                onChange={e=>{const id=Number(e.target.value);if(id)loadSched(id);else{setSelDoc(0);setAvails([]);setHols([])}}}>
                <option value={0}>— Select a doctor —</option>
                {doctors.map(d=><option key={d.id} value={d.id}>Dr. {d.user?.fullName ?? '?'} – {d.specialization||'General'}</option>)}
              </select>
              {busy.sched && <p className="text-sm text-gray-400 mt-2">Loading schedule…</p>}
            </div>

            {selDoc>0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b bg-emerald-50"><h3 className="font-bold text-emerald-800">🕐 Add Availability Slot</h3></div>
                    <form className="p-5 space-y-3" onSubmit={submitAv}>
                      <F label="Day of Week" req>
                        <select className={I} value={avForm.dayOfWeek} onChange={e=>setAvForm(f=>({...f,dayOfWeek:Number(e.target.value)}))}>
                          {DAYS.slice(1).map((d,i)=><option key={i+1} value={i+1}>{d}</option>)}
                        </select>
                      </F>
                      <div className="grid grid-cols-2 gap-3">
                        <F label="Start Time" req err={avErr.startTime}>
                          <input className={avErr.startTime?IE:I} type="time" value={avForm.startTime}
                            onChange={e=>{setAvForm(f=>({...f,startTime:e.target.value}));setAvErr({})}} />
                        </F>
                        <F label="End Time" req err={avErr.endTime}>
                          <input className={avErr.endTime?IE:I} type="time" value={avForm.endTime}
                            onChange={e=>{setAvForm(f=>({...f,endTime:e.target.value}));setAvErr({})}} />
                        </F>
                      </div>
                      <button type="submit" disabled={!!busy.avForm}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
                        {busy.avForm&&<Spin/>} Add Slot
                      </button>
                    </form>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b"><h3 className="font-semibold text-gray-700 text-sm">Current Slots ({avails.length})</h3></div>
                    {!avails.length ? <div className="py-8 text-center text-gray-400 text-sm">No slots set</div>
                      : avails.map(a=>(
                          <div key={a.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0 hover:bg-gray-50">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{DAYS[a.dayOfWeek]}</p>
                              <p className="text-xs text-gray-400">{a.startTime} – {a.endTime}</p>
                            </div>
                            <button onClick={() => ask('Remove Slot',`Remove ${DAYS[a.dayOfWeek]} ${a.startTime}-${a.endTime}?`,()=>deleteAv(a.id))}
                              disabled={!!busy[`dav_${a.id}`]}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40">
                              {busy[`dav_${a.id}`]?'…':'Remove'}
                            </button>
                          </div>
                        ))
                    }
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b bg-amber-50"><h3 className="font-bold text-amber-800">🏖️ Add Holiday / Leave</h3></div>
                    <form className="p-5 space-y-3" onSubmit={submitH}>
                      <F label="Date" req err={hErr.date}>
                        <input className={hErr.date?IE:I} type="date" value={hForm.date}
                          onChange={e=>{setHForm(f=>({...f,date:e.target.value}));setHErr({})}} />
                      </F>
                      <F label="Reason" req err={hErr.reason}>
                        <input className={hErr.reason?IE:I} placeholder="e.g. Personal leave" value={hForm.reason}
                          onChange={e=>{setHForm(f=>({...f,reason:e.target.value}));setHErr({})}} />
                      </F>
                      <button type="submit" disabled={!!busy.hForm}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
                        {busy.hForm&&<Spin/>} Add Holiday
                      </button>
                    </form>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b"><h3 className="font-semibold text-gray-700 text-sm">Holidays ({hols.length})</h3></div>
                    {!hols.length ? <div className="py-8 text-center text-gray-400 text-sm">No holidays</div>
                      : hols.map(h=>(
                          <div key={h.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0 hover:bg-gray-50">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{new Date(h.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
                              <p className="text-xs text-gray-400">{h.reason}</p>
                            </div>
                            <button onClick={() => ask('Remove Holiday',`Remove holiday on ${h.date}?`,()=>deleteH(h.id))}
                              disabled={!!busy[`dh_${h.id}`]}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40">
                              {busy[`dh_${h.id}`]?'…':'Remove'}
                            </button>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ REPORTS ══ */}
        {tab==='reports' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl mb-4">🧑</div>
                <h3 className="font-bold text-gray-800 mb-1">Patients Report</h3>
                <p className="text-sm text-gray-500 mb-5">All patients with details and visit counts</p>
                <button onClick={() => dlCSV('/reception/reports/patients.csv','patients.csv')}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm">↓ Download CSV</button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl mb-4">📅</div>
                <h3 className="font-bold text-gray-800 mb-1">Appointments Report</h3>
                <p className="text-sm text-gray-500 mb-5">All appointments with status, patient and doctor</p>
                <button onClick={() => dlCSV('/reception/reports/appointments.csv','appointments.csv')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm">↓ Download CSV</button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl mb-4">📋</div>
                <h3 className="font-bold text-gray-800 mb-1">Patient Visit History</h3>
                <p className="text-sm text-gray-500 mb-3">Download visits report for a specific patient</p>
                <select className={`${I} mb-0`} defaultValue=""
                  onChange={e=>{const id=Number(e.target.value);const p=patients.find(x=>x.id===id);if(p)dlReport(p.id,p.code)}}>
                  <option value="">— Select patient —</option>
                  {patients.map(p=><option key={p.id} value={p.id}>{p.code} – {p.fullName}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[
                  {l:'Patients',     v:patients.length, c:'text-violet-600'},
                  {l:'Doctors',      v:doctors.length,  c:'text-blue-600'  },
                  {l:'Appointments', v:appts.length,    c:'text-amber-600' },
                  {l:'Visits',       v:visits.length,   c:'text-emerald-600'},
                ].map(s=>(
                  <div key={s.l}><div className={`text-3xl font-black ${s.c}`}>{s.v}</div><div className="text-sm text-gray-500 mt-1">{s.l}</div></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
