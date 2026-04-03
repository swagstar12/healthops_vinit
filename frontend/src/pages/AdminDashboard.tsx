import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Doctor = {
  id: number
  user: { id: number; email: string; fullName: string; enabled: boolean }
  specialization?: string
  phone?: string
  consultationFee?: number
}

type Receptionist = {
  id: number
  email: string
  fullName: string
  enabled: boolean
}

type DashboardStats = {
  totalDoctors: number
  totalReceptionists: number
  totalPatients: number
  totalAppointments: number
  totalVisits: number
  todayAppointments: number
  pendingAppointments: number
  completedAppointments: number
}

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as any).response
    if (res?.data?.message) return res.data.message
    if (res?.data?.error) return res.data.error
    if (res?.status === 403) return 'You do not have permission for this action'
    if (res?.status === 404) return 'Resource not found'
    if (res?.status === 409) return 'A conflict occurred — email may already be in use'
    if (res?.status === 400) return 'Invalid request — check the form fields'
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred'
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
            pointer-events-auto min-w-[260px] max-w-xs
            ${t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error'   ? 'bg-red-600 text-white'     :
                                     'bg-slate-700 text-white'}`}
        >
          <span className="text-base flex-shrink-0">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100 text-lg leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel
}: {
  open: boolean; title: string; message: string
  confirmLabel?: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4
          ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          {danger ? '🗑️' : '⚠️'}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700
              hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-xl text-white font-semibold text-sm transition-colors
              ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: number | string; icon: string; color: string; sub?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white ${color} shadow-lg`}>
      <div className="absolute right-3 top-3 text-4xl opacity-20 select-none">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">{label}</p>
      <p className="text-3xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spin({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <div className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0`} />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  const [busy, setBusy] = useState<Record<string, boolean>>({})

  // Doctor form — added consultationFee
  const [doctorForm, setDoctorForm] = useState(
    { email: '', fullName: '', password: '', specialization: '', phone: '', consultationFee: '' }
  )
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const doctorFormRef = useRef<HTMLDivElement>(null)

  // Receptionist form
  const [recForm, setRecForm] = useState(
    { email: '', fullName: '', password: '', enabled: true }
  )
  const [editingRec, setEditingRec] = useState<Receptionist | null>(null)
  const recFormRef = useRef<HTMLDivElement>(null)

  // Confirm dialog state
  const [dialog, setDialog] = useState<{
    open: boolean; title: string; message: string
    confirmLabel: string; danger: boolean; onConfirm: () => void
  }>({ open: false, title: '', message: '', confirmLabel: 'Confirm', danger: true, onConfirm: () => {} })

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextToastId = useRef(0)

  // Search
  const [docSearch, setDocSearch] = useState('')
  const [recSearch, setRecSearch] = useState('')

  // ─── Toast helpers ──────────────────────────────────────────────────────────

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = ++nextToastId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  function startBusy(key: string) { setBusy(b => ({ ...b, [key]: true })) }
  function stopBusy(key: string)  { setBusy(b => { const n = { ...b }; delete n[key]; return n }) }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [dRes, rRes, sRes] = await Promise.all([
        api.get('/admin/doctors'),
        api.get('/admin/receptionists'),
        api.get('/admin/dashboard/stats'),
      ])
      setDoctors(dRes.data)
      setReceptionists(rRes.data)
      setStats(sRes.data)
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  function openConfirm(opts: {
    title: string; message: string; confirmLabel?: string
    danger?: boolean; onConfirm: () => void
  }) {
    setDialog({
      open: true,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      danger: opts.danger ?? true,
      onConfirm: () => {
        setDialog(d => ({ ...d, open: false }))
        opts.onConfirm()
      }
    })
  }

  function closeDialog() { setDialog(d => ({ ...d, open: false })) }

  // ════════════════════════════════════════════════════════════════════════════
  // DOCTOR ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  async function submitDoctor(e: React.FormEvent) {
    e.preventDefault()
    const key = 'doctorForm'
    startBusy(key)
    try {
      if (editingDoctor) {
        await api.put(`/admin/doctors/${editingDoctor.id}`, {
          email: doctorForm.email,
          fullName: doctorForm.fullName,
          specialization: doctorForm.specialization,
          phone: doctorForm.phone,
          consultationFee: doctorForm.consultationFee ? Number(doctorForm.consultationFee) : null,
        })
        showToast(`Dr. ${doctorForm.fullName} updated successfully`)
        resetDoctorForm()
      } else {
        await api.post('/admin/doctors', {
          ...doctorForm,
          consultationFee: doctorForm.consultationFee ? Number(doctorForm.consultationFee) : null,
        })
        showToast(`Dr. ${doctorForm.fullName} added`)
        setDoctorForm({ email: '', fullName: '', password: '', specialization: '', phone: '', consultationFee: '' })
      }
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  function editDoctor(doc: Doctor) {
    setEditingDoctor(doc)
    setDoctorForm({
      email: doc.user.email,
      fullName: doc.user.fullName,
      password: '',
      specialization: doc.specialization ?? '',
      phone: doc.phone ?? '',
      consultationFee: doc.consultationFee != null ? String(doc.consultationFee) : '',
    })
    setActiveTab('doctors')
    setTimeout(() =>
      doctorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  function resetDoctorForm() {
    setEditingDoctor(null)
    setDoctorForm({ email: '', fullName: '', password: '', specialization: '', phone: '', consultationFee: '' })
  }

  function handleToggleDoctor(doc: Doctor) {
    const action = doc.user.enabled ? 'disable' : 'enable'
    openConfirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Dr. ${doc.user.fullName}`,
      message: doc.user.enabled
        ? `Dr. ${doc.user.fullName} will no longer be able to log in.`
        : `Dr. ${doc.user.fullName} will regain access to the system.`,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      danger: doc.user.enabled,
      onConfirm: () => doToggleDoctor(doc),
    })
  }

  async function doToggleDoctor(doc: Doctor) {
    const key = `toggleDoc_${doc.id}`
    startBusy(key)
    try {
      await api.put(`/admin/users/${doc.user.id}/toggle-status`)
      const verb = doc.user.enabled ? 'disabled' : 'enabled'
      showToast(`Dr. ${doc.user.fullName} ${verb}`)
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  function handleDeleteDoctor(doc: Doctor) {
    openConfirm({
      title: 'Delete Doctor',
      message: `Permanently delete Dr. ${doc.user.fullName}? All their visits and appointments will be unlinked. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => doDeleteDoctor(doc),
    })
  }

  async function doDeleteDoctor(doc: Doctor) {
    const key = `deleteDoc_${doc.id}`
    startBusy(key)
    try {
      await api.delete(`/admin/doctors/${doc.id}`)
      showToast(`Dr. ${doc.user.fullName} deleted`)
      if (editingDoctor?.id === doc.id) resetDoctorForm()
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RECEPTIONIST ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  async function submitRec(e: React.FormEvent) {
    e.preventDefault()
    const key = 'recForm'
    startBusy(key)
    try {
      if (editingRec) {
        await api.put(`/admin/receptionists/${editingRec.id}`, {
          fullName: recForm.fullName,
          email: recForm.email,
          enabled: recForm.enabled,
        })
        showToast(`${recForm.fullName} updated successfully`)
        resetRecForm()
      } else {
        await api.post('/admin/receptionists', {
          email: recForm.email,
          fullName: recForm.fullName,
          password: recForm.password,
        })
        showToast(`${recForm.fullName} added`)
        setRecForm({ email: '', fullName: '', password: '', enabled: true })
      }
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  function editRec(rec: Receptionist) {
    setEditingRec(rec)
    setRecForm({
      email: rec.email,
      fullName: rec.fullName,
      password: '',
      enabled: rec.enabled,
    })
    setActiveTab('receptionists')
    setTimeout(() =>
      recFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  function resetRecForm() {
    setEditingRec(null)
    setRecForm({ email: '', fullName: '', password: '', enabled: true })
  }

  function handleToggleRec(rec: Receptionist) {
    const action = rec.enabled ? 'disable' : 'enable'
    openConfirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${rec.fullName}`,
      message: rec.enabled
        ? `${rec.fullName} will no longer be able to log in.`
        : `${rec.fullName} will regain access to the system.`,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      danger: rec.enabled,
      onConfirm: () => doToggleRec(rec),
    })
  }

  async function doToggleRec(rec: Receptionist) {
    const key = `toggleRec_${rec.id}`
    startBusy(key)
    try {
      await api.put(`/admin/users/${rec.id}/toggle-status`)
      const verb = rec.enabled ? 'disabled' : 'enabled'
      showToast(`${rec.fullName} ${verb}`)
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  function handleDeleteRec(rec: Receptionist) {
    openConfirm({
      title: 'Delete Receptionist',
      message: `Permanently delete ${rec.fullName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => doDeleteRec(rec),
    })
  }

  async function doDeleteRec(rec: Receptionist) {
    const key = `deleteRec_${rec.id}`
    startBusy(key)
    try {
      await api.delete(`/admin/receptionists/${rec.id}`)
      showToast(`${rec.fullName} deleted`)
      if (editingRec?.id === rec.id) resetRecForm()
      await loadAll()
    } catch (err) {
      showToast(extractError(err), 'error')
    } finally {
      stopBusy(key)
    }
  }

  // ─── Filtered lists ─────────────────────────────────────────────────────────

  const filteredDocs = doctors.filter(d =>
    [d.user.fullName, d.user.email, d.specialization ?? ''].some(f =>
      f.toLowerCase().includes(docSearch.toLowerCase())
    )
  )

  const filteredRecs = receptionists.filter(r =>
    [r.fullName, r.email].some(f => f.toLowerCase().includes(recSearch.toLowerCase()))
  )

  // ─── Shared styles ───────────────────────────────────────────────────────────

  const inp = `w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`

  const tabs = [
    { key: 'dashboard',     label: '📊 Dashboard' },
    { key: 'doctors',       label: '👨‍⚕️ Doctors' },
    { key: 'receptionists', label: '👩‍💼 Receptionists' },
    { key: 'users',         label: '👥 All Users' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} remove={id => setToasts(t => t.filter(x => x.id !== id))} />
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        danger={dialog.danger}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />

      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Meera Multispecialty Hospital — Control Panel</p>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200
              rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════ DASHBOARD ══════════ */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Doctors"       value={stats.totalDoctors}       icon="👨‍⚕️" color="bg-gradient-to-br from-blue-600 to-blue-700" />
              <StatCard label="Receptionists" value={stats.totalReceptionists} icon="👩‍💼" color="bg-gradient-to-br from-violet-600 to-violet-700" />
              <StatCard label="Patients"      value={stats.totalPatients}      icon="🧑‍🤝‍🧑" color="bg-gradient-to-br from-teal-600 to-teal-700" />
              <StatCard label="Total Visits"  value={stats.totalVisits}        icon="🏥" color="bg-gradient-to-br from-indigo-600 to-indigo-700" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Appointments"  value={stats.totalAppointments}     icon="📅" color="bg-gradient-to-br from-orange-500 to-orange-600" />
              <StatCard label="Today"         value={stats.todayAppointments}     icon="📋" color="bg-gradient-to-br from-sky-500 to-sky-600" sub="today's appointments" />
              <StatCard label="Pending"       value={stats.pendingAppointments}   icon="⏳" color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <StatCard label="Completed"     value={stats.completedAppointments} icon="✅" color="bg-gradient-to-br from-emerald-600 to-emerald-700" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">Medical Staff</h3>
                  <button onClick={() => setActiveTab('doctors')}
                    className="text-xs text-blue-600 hover:underline font-semibold">Manage →</button>
                </div>
                {doctors.slice(0, 6).map(d => (
                  <div key={d.id}
                    className="px-5 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center
                        justify-center text-xs font-bold">{d.user.fullName.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">Dr. {d.user.fullName}</p>
                        <p className="text-xs text-gray-400">{d.specialization || 'General'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.consultationFee != null && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          ₹{d.consultationFee}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${d.user.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {d.user.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
                {doctors.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-sm">No doctors yet</div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">Reception Staff</h3>
                  <button onClick={() => setActiveTab('receptionists')}
                    className="text-xs text-violet-600 hover:underline font-semibold">Manage →</button>
                </div>
                {receptionists.slice(0, 6).map(r => (
                  <div key={r.id}
                    className="px-5 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center
                        justify-center text-xs font-bold">{r.fullName.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.fullName}</p>
                        <p className="text-xs text-gray-400">{r.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                      ${r.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {r.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
                {receptionists.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-sm">No receptionists yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ DOCTORS ══════════ */}
        {activeTab === 'doctors' && (
          <div className="space-y-5">
            <div
              ref={doctorFormRef}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
                ${editingDoctor ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between
                ${editingDoctor ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">
                    {editingDoctor ? `✏️ Editing Dr. ${editingDoctor.user.fullName}` : '➕ Add New Doctor'}
                  </h2>
                  {editingDoctor && (
                    <p className="text-xs text-blue-500 mt-0.5">Doctor ID #{editingDoctor.id}</p>
                  )}
                </div>
                {editingDoctor && (
                  <button onClick={resetDoctorForm}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5
                      rounded-lg border border-gray-200 hover:bg-white transition-colors">
                    ✕ Cancel
                  </button>
                )}
              </div>

              <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitDoctor}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <input className={inp} placeholder="Dr. Jane Smith"
                    value={doctorForm.fullName}
                    onChange={e => setDoctorForm(f => ({ ...f, fullName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Email *</label>
                  <input className={inp} type="email" placeholder="doctor@hospital.com"
                    value={doctorForm.email}
                    onChange={e => setDoctorForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                {!editingDoctor && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Password *</label>
                    <input className={inp} type="password" placeholder="Min. 8 characters"
                      value={doctorForm.password}
                      onChange={e => setDoctorForm(f => ({ ...f, password: e.target.value }))} required />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Specialization *</label>
                  <input className={inp} placeholder="e.g. Cardiology"
                    value={doctorForm.specialization}
                    onChange={e => setDoctorForm(f => ({ ...f, specialization: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Phone *</label>
                  <input className={inp} placeholder="+91 98765 43210"
                    value={doctorForm.phone}
                    onChange={e => setDoctorForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>

                {/* ── Consultation Fee (NEW) ── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Consultation Fee (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm select-none">
                      ₹
                    </span>
                    <input
                      className={`${inp} pl-7`}
                      type="number"
                      min="0"
                      step="50"
                      placeholder="e.g. 500"
                      value={doctorForm.consultationFee}
                      onChange={e => setDoctorForm(f => ({ ...f, consultationFee: e.target.value }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Per appointment charge shown to patients</p>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={busy.doctorForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                      disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                    {busy.doctorForm && <Spin />}
                    {editingDoctor ? 'Save Changes' : 'Add Doctor'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <h2 className="font-bold text-gray-800">
                  Doctors <span className="text-gray-400 font-normal text-sm">({filteredDocs.length})</span>
                </h2>
                <input
                  className="w-56 px-3 py-2 border border-gray-200 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  placeholder="🔍 Search doctors…"
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                />
              </div>

              {filteredDocs.length === 0
                ? <div className="py-12 text-center text-gray-400"><p className="text-4xl mb-2">👨‍⚕️</p><p className="font-medium">No doctors found</p></div>
                : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left font-semibold">Doctor</th>
                        <th className="px-4 py-3 text-left font-semibold">Specialization</th>
                        <th className="px-4 py-3 text-left font-semibold">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold">Fee</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDocs.map(doc => (
                        <tr key={doc.id}
                          className={`hover:bg-gray-50 transition-colors
                            ${editingDoctor?.id === doc.id ? 'bg-blue-50 hover:bg-blue-50' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                text-sm font-bold flex-shrink-0
                                ${doc.user.enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                {doc.user.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">Dr. {doc.user.fullName}</p>
                                <p className="text-xs text-gray-400">{doc.user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-600">{doc.specialization || '—'}</td>
                          <td className="px-4 py-4 text-gray-600">{doc.phone || '—'}</td>
                          <td className="px-4 py-4">
                            {doc.consultationFee != null
                              ? <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs border border-emerald-100">
                                  ₹{doc.consultationFee}
                                </span>
                              : <span className="text-gray-400 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                              text-xs font-semibold
                              ${doc.user.enabled
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full
                                ${doc.user.enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {doc.user.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => editDoctor(doc)}
                                className="px-3 py-1.5 text-xs font-semibold text-blue-600
                                  hover:bg-blue-50 rounded-lg border border-blue-100
                                  hover:border-blue-300 transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleToggleDoctor(doc)}
                                disabled={!!busy[`toggleDoc_${doc.id}`]}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border
                                  flex items-center gap-1.5 transition-colors disabled:opacity-40
                                  ${doc.user.enabled
                                    ? 'text-amber-600 border-amber-100 hover:bg-amber-50 hover:border-amber-300'
                                    : 'text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300'}`}
                              >
                                {busy[`toggleDoc_${doc.id}`]
                                  ? <Spin className="w-3 h-3" />
                                  : doc.user.enabled ? '🔒 Disable' : '🔓 Enable'}
                              </button>
                              <button
                                onClick={() => handleDeleteDoctor(doc)}
                                disabled={!!busy[`deleteDoc_${doc.id}`]}
                                className="px-3 py-1.5 text-xs font-semibold text-red-600
                                  hover:bg-red-50 rounded-lg border border-red-100 hover:border-red-300
                                  flex items-center gap-1.5 transition-colors disabled:opacity-40"
                              >
                                {busy[`deleteDoc_${doc.id}`]
                                  ? <Spin className="w-3 h-3" />
                                  : '🗑️ Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ RECEPTIONISTS ══════════ */}
        {activeTab === 'receptionists' && (
          <div className="space-y-5">
            <div
              ref={recFormRef}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
                ${editingRec ? 'border-violet-300 ring-2 ring-violet-100' : 'border-gray-100'}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between
                ${editingRec ? 'bg-violet-50 border-violet-100' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <h2 className="font-bold text-gray-800">
                    {editingRec ? `✏️ Editing ${editingRec.fullName}` : '➕ Add New Receptionist'}
                  </h2>
                  {editingRec && (
                    <p className="text-xs text-violet-500 mt-0.5">User ID #{editingRec.id}</p>
                  )}
                </div>
                {editingRec && (
                  <button onClick={resetRecForm}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5
                      rounded-lg border border-gray-200 hover:bg-white transition-colors">
                    ✕ Cancel
                  </button>
                )}
              </div>

              <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitRec}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <input className={inp} placeholder="Jane Doe"
                    value={recForm.fullName}
                    onChange={e => setRecForm(f => ({ ...f, fullName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Email *</label>
                  <input className={inp} type="email" placeholder="reception@hospital.com"
                    value={recForm.email}
                    onChange={e => setRecForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                {!editingRec ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Password *</label>
                    <input className={inp} type="password" placeholder="Min. 8 characters"
                      value={recForm.password}
                      onChange={e => setRecForm(f => ({ ...f, password: e.target.value }))} required />
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer"
                        checked={recForm.enabled}
                        onChange={e => setRecForm(f => ({ ...f, enabled: e.target.checked }))} />
                      <div className="w-11 h-6 bg-gray-300 rounded-full peer
                        peer-checked:bg-violet-600 relative
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                        after:bg-white after:rounded-full after:h-5 after:w-5
                        after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {recForm.enabled ? 'Account Active' : 'Account Disabled'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {recForm.enabled ? 'User can log in' : 'Login is blocked'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={busy.recForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700
                      disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
                    {busy.recForm && <Spin />}
                    {editingRec ? 'Save Changes' : 'Add Receptionist'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <h2 className="font-bold text-gray-800">
                  Receptionists <span className="text-gray-400 font-normal text-sm">({filteredRecs.length})</span>
                </h2>
                <input
                  className="w-56 px-3 py-2 border border-gray-200 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                  placeholder="🔍 Search…"
                  value={recSearch}
                  onChange={e => setRecSearch(e.target.value)}
                />
              </div>

              {filteredRecs.length === 0
                ? <div className="py-12 text-center text-gray-400"><p className="text-4xl mb-2">👩‍💼</p><p className="font-medium">No receptionists found</p></div>
                : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRecs.map(rec => (
                        <tr key={rec.id}
                          className={`hover:bg-gray-50 transition-colors
                            ${editingRec?.id === rec.id ? 'bg-violet-50 hover:bg-violet-50' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                text-sm font-bold flex-shrink-0
                                ${rec.enabled ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'}`}>
                                {rec.fullName.charAt(0)}
                              </div>
                              <span className="font-semibold text-gray-900">{rec.fullName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-500">{rec.email}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                              text-xs font-semibold
                              ${rec.enabled
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full
                                ${rec.enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {rec.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => editRec(rec)}
                                className="px-3 py-1.5 text-xs font-semibold text-blue-600
                                  hover:bg-blue-50 rounded-lg border border-blue-100
                                  hover:border-blue-300 transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleToggleRec(rec)}
                                disabled={!!busy[`toggleRec_${rec.id}`]}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border
                                  flex items-center gap-1.5 transition-colors disabled:opacity-40
                                  ${rec.enabled
                                    ? 'text-amber-600 border-amber-100 hover:bg-amber-50 hover:border-amber-300'
                                    : 'text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300'}`}
                              >
                                {busy[`toggleRec_${rec.id}`]
                                  ? <Spin className="w-3 h-3" />
                                  : rec.enabled ? '🔒 Disable' : '🔓 Enable'}
                              </button>
                              <button
                                onClick={() => handleDeleteRec(rec)}
                                disabled={!!busy[`deleteRec_${rec.id}`]}
                                className="px-3 py-1.5 text-xs font-semibold text-red-600
                                  hover:bg-red-50 rounded-lg border border-red-100 hover:border-red-300
                                  flex items-center gap-1.5 transition-colors disabled:opacity-40"
                              >
                                {busy[`deleteRec_${rec.id}`]
                                  ? <Spin className="w-3 h-3" />
                                  : '🗑️ Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ALL USERS ══════════ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-blue-700">{doctors.length}</div>
                <div className="text-xs text-blue-500 font-medium mt-0.5">Doctors</div>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-violet-700">{receptionists.length}</div>
                <div className="text-xs text-violet-500 font-medium mt-0.5">Receptionists</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-emerald-700">
                  {doctors.filter(d => d.user.enabled).length +
                   receptionists.filter(r => r.enabled).length}
                </div>
                <div className="text-xs text-emerald-500 font-medium mt-0.5">Active Accounts</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                <h3 className="font-bold text-blue-800 text-sm">👨‍⚕️ Medical Staff ({doctors.length})</h3>
                <button onClick={() => setActiveTab('doctors')}
                  className="text-xs text-blue-600 font-semibold hover:underline">Manage →</button>
              </div>
              {doctors.map(d => (
                <div key={d.id}
                  className="px-6 py-3 flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center
                      justify-center text-xs font-bold">{d.user.fullName.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Dr. {d.user.fullName}</p>
                      <p className="text-xs text-gray-400">{d.user.email} · {d.specialization || 'General'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.consultationFee != null && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        ₹{d.consultationFee}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold
                      ${d.user.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {d.user.enabled ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => editDoctor(d)}
                      className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-sm">No doctors</div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-violet-50 border-b border-violet-100 flex justify-between items-center">
                <h3 className="font-bold text-violet-800 text-sm">👩‍💼 Reception Staff ({receptionists.length})</h3>
                <button onClick={() => setActiveTab('receptionists')}
                  className="text-xs text-violet-600 font-semibold hover:underline">Manage →</button>
              </div>
              {receptionists.map(r => (
                <div key={r.id}
                  className="px-6 py-3 flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-100 text-violet-700 rounded-full flex items-center
                      justify-center text-xs font-bold">{r.fullName.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{r.fullName}</p>
                      <p className="text-xs text-gray-400">{r.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold
                      ${r.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {r.enabled ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => editRec(r)}
                      className="text-xs text-violet-600 hover:underline font-medium">Edit</button>
                  </div>
                </div>
              ))}
              {receptionists.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-sm">No receptionists</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
