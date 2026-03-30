import React, { useEffect, useState } from 'react'
import { api } from '../api'

type Patient = { 
  id: number
  code: string
  fullName: string
  phone?: string
  dob?: string
  address?: string
}

type Visit = {
  id: number
  patient: Patient
  visitAt: string
  notes?: string
  diagnosis?: string
  prescription?: string
}

type Availability = { 
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string 
}

type Holiday = {
  id: number
  date: string
  reason: string
}

type DashboardStats = {
  totalPatients: number
  myVisitsCount: number
  todayVisits: number
  myAppointments: number
  availabilitySlots: number
  upcomingHolidays: number
}

const DAYS_OF_WEEK = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [patients, setPatients] = useState<Patient[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  // Forms state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientEditForm, setPatientEditForm] = useState({
    fullName: '', dob: '', phone: '', address: ''
  })
  
  const [visitForm, setVisitForm] = useState({
    patientId: 0, appointmentId: 0, notes: '', diagnosis: '', prescription: ''
  })
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)

  const [availForm, setAvailForm] = useState({ 
    dayOfWeek: 1, startTime: "09:00", endTime: "17:00" 
  })
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null)

  const [holidayForm, setHolidayForm] = useState({ 
    date: "", reason: "" 
  })
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)

  const [patientVisits, setPatientVisits] = useState<Visit[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [patientsRes, visitsRes, availRes, holidaysRes, statsRes] = await Promise.all([
        api.get('/doctor/patients'),
        api.get('/doctor/visits'),
        api.get('/doctor/availability'),
        api.get('/doctor/holidays'),
        api.get('/doctor/dashboard/stats')
      ])
      setPatients(patientsRes.data)
      setVisits(visitsRes.data)
      setAvailability(availRes.data)
      setHolidays(holidaysRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Patient Management
  function startEditingPatient(patient: Patient) {
    setSelectedPatient(patient)
    setPatientEditForm({
      fullName: patient.fullName,
      dob: patient.dob || '',
      phone: patient.phone || '',
      address: patient.address || ''
    })
  }

  async function handlePatientEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPatient) return
    
    try {
      await api.put(`/doctor/patients/${selectedPatient.id}`, patientEditForm)
      setSelectedPatient(null)
      loadData()
    } catch (error) {
      console.error('Failed to update patient:', error)
    }
  }

  // Visit Management
  async function handleVisitSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingVisit) {
        await api.put(`/doctor/visits/${editingVisit.id}`, {
          notes: visitForm.notes,
          diagnosis: visitForm.diagnosis,
          prescription: visitForm.prescription
        })
        setEditingVisit(null)
      } else {
        await api.post('/doctor/visits', visitForm)
      }
      setVisitForm({ patientId: 0, appointmentId: 0, notes: '', diagnosis: '', prescription: '' })
      loadData()
    } catch (error) {
      console.error('Failed to save visit:', error)
    }
  }

  function startEditingVisit(visit: Visit) {
    setEditingVisit(visit)
    setVisitForm({
      patientId: visit.patient.id,
      appointmentId: 0,
      notes: visit.notes || '',
      diagnosis: visit.diagnosis || '',
      prescription: visit.prescription || ''
    })
  }

  async function deleteVisit(id: number) {
    if (confirm('Are you sure you want to delete this visit?')) {
      try {
        await api.delete(`/doctor/visits/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete visit:', error)
      }
    }
  }

  async function loadPatientVisits(patientId: number) {
    try {
      const response = await api.get(`/doctor/visits/patient/${patientId}`)
      setPatientVisits(response.data)
    } catch (error) {
      console.error('Failed to load patient visits:', error)
    }
  }

  // Availability Management
  async function handleAvailabilitySubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingAvailability) {
        await api.put(`/doctor/availability/${editingAvailability.id}`, availForm)
        setEditingAvailability(null)
      } else {
        await api.post('/doctor/availability', availForm)
      }
      setAvailForm({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" })
      loadData()
    } catch (error) {
      console.error('Failed to save availability:', error)
    }
  }

  function startEditingAvailability(avail: Availability) {
    setEditingAvailability(avail)
    setAvailForm({
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime
    })
  }

  async function deleteAvailability(id: number) {
    if (confirm('Are you sure you want to delete this availability?')) {
      try {
        await api.delete(`/doctor/availability/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete availability:', error)
      }
    }
  }

  // Holiday Management
  async function handleHolidaySubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingHoliday) {
        await api.put(`/doctor/holidays/${editingHoliday.id}`, holidayForm)
        setEditingHoliday(null)
      } else {
        await api.post('/doctor/holidays', holidayForm)
      }
      setHolidayForm({ date: "", reason: "" })
      loadData()
    } catch (error) {
      console.error('Failed to save holiday:', error)
    }
  }

  function startEditingHoliday(holiday: Holiday) {
    setEditingHoliday(holiday)
    setHolidayForm({
      date: holiday.date,
      reason: holiday.reason
    })
  }

  async function deleteHoliday(id: number) {
    if (confirm('Are you sure you want to delete this holiday?')) {
      try {
        await api.delete(`/doctor/holidays/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete holiday:', error)
      }
    }
  }

  // Reports
  function downloadAllVisitsReport() {
    window.location.href = '/api/doctor/reports/visits.csv'
  }

  function downloadPatientReport(patientId: number) {
    window.location.href = `/api/doctor/reports/patient/${patientId}/visits.csv`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Doctor Dashboard</h1>
        <div className="text-sm text-gray-500">
          Manage your patients and appointments
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'patients', label: 'Patients' },
            { key: 'visits', label: 'Visits' },
            { key: 'availability', label: 'Availability' },
            { key: 'holidays', label: 'Holidays' },
            { key: 'reports', label: 'Reports' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats && [
            { label: 'Total Patients', value: stats.totalPatients, color: 'bg-blue-500', icon: '👥' },
            { label: 'My Visits', value: stats.myVisitsCount, color: 'bg-green-500', icon: '🏥' },
            { label: 'Today\'s Visits', value: stats.todayVisits, color: 'bg-purple-500', icon: '📋' },
            { label: 'My Appointments', value: stats.myAppointments, color: 'bg-orange-500', icon: '📅' },
            { label: 'Availability Slots', value: stats.availabilitySlots, color: 'bg-cyan-500', icon: '🕒' },
            { label: 'Upcoming Holidays', value: stats.upcomingHolidays, color: 'bg-red-500', icon: '🏖️' }
          ].map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${stat.color} text-white text-2xl`}>
                  {stat.icon}
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patients Tab */}
      {activeTab === 'patients' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Patients List</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">DOB</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(patient => (
                    <tr key={patient.id} className="border-b">
                      <td className="px-4 py-2 font-medium">{patient.code}</td>
                      <td className="px-4 py-2">{patient.fullName}</td>
                      <td className="px-4 py-2">{patient.phone}</td>
                      <td className="px-4 py-2">{patient.dob}</td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditingPatient(patient)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => loadPatientVisits(patient.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            View Visits
                          </button>
                          <button
                            onClick={() => downloadPatientReport(patient.id)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                          >
                            Download Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patient Edit Modal */}
          {selectedPatient && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Edit Patient: {selectedPatient.fullName}</h3>
                <form onSubmit={handlePatientEdit} className="space-y-4">
                  <input
                    className="input"
                    placeholder="Full Name"
                    value={patientEditForm.fullName}
                    onChange={e => setPatientEditForm({ ...patientEditForm, fullName: e.target.value })}
                    required
                  />
                  <input
                    className="input"
                    type="date"
                    placeholder="Date of Birth"
                    value={patientEditForm.dob}
                    onChange={e => setPatientEditForm({ ...patientEditForm, dob: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Phone"
                    value={patientEditForm.phone}
                    onChange={e => setPatientEditForm({ ...patientEditForm, phone: e.target.value })}
                  />
                  <textarea
                    className="input"
                    placeholder="Address"
                    rows={3}
                    value={patientEditForm.address}
                    onChange={e => setPatientEditForm({ ...patientEditForm, address: e.target.value })}
                  />
                  <div className="flex space-x-2">
                    <button type="submit" className="btn">Update Patient</button>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Patient Visits Modal */}
          {patientVisits.length > 0 && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Patient Visit History</h3>
                  <button
                    onClick={() => setPatientVisits([])}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  {patientVisits.map(visit => (
                    <div key={visit.id} className="border p-3 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{new Date(visit.visitAt).toLocaleDateString()}</p>
                          <p className="text-sm text-gray-600">Diagnosis: {visit.diagnosis}</p>
                          <p className="text-sm text-gray-600">Prescription: {visit.prescription}</p>
                          <p className="text-sm text-gray-600">Notes: {visit.notes}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visits Tab */}
      {activeTab === 'visits' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingVisit ? 'Edit Visit' : 'Create New Visit'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleVisitSubmit}>
              <select
                className="input"
                value={visitForm.patientId}
                onChange={e => setVisitForm({ ...visitForm, patientId: Number(e.target.value) })}
                required
                disabled={!!editingVisit}
              >
                <option value={0}>Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.fullName}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Appointment ID (optional)"
                type="number"
                value={visitForm.appointmentId || ''}
                onChange={e => setVisitForm({ ...visitForm, appointmentId: Number(e.target.value) || 0 })}
                disabled={!!editingVisit}
              />
              <textarea
                className="input md:col-span-2"
                placeholder="Diagnosis"
                rows={2}
                value={visitForm.diagnosis}
                onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })}
              />
              <textarea
                className="input md:col-span-2"
                placeholder="Prescription"
                rows={2}
                value={visitForm.prescription}
                onChange={e => setVisitForm({ ...visitForm, prescription: e.target.value })}
              />
              <textarea
                className="input md:col-span-2"
                placeholder="Notes"
                rows={3}
                value={visitForm.notes}
                onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })}
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingVisit ? 'Update Visit' : 'Create Visit'}
                </button>
                {editingVisit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVisit(null)
                      setVisitForm({ patientId: 0, appointmentId: 0, notes: '', diagnosis: '', prescription: '' })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Recent Visits</h2>
            <div className="space-y-3">
              {visits.map(visit => (
                <div key={visit.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">{visit.patient.code} - {visit.patient.fullName}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(visit.visitAt).toLocaleDateString()} at {new Date(visit.visitAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Diagnosis:</span>
                          <p className="text-sm">{visit.diagnosis || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Prescription:</span>
                          <p className="text-sm">{visit.prescription || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Notes:</span>
                          <p className="text-sm">{visit.notes || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => startEditingVisit(visit)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVisit(visit.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingAvailability ? 'Edit Availability' : 'Add Availability'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleAvailabilitySubmit}>
              <select
                className="input"
                value={availForm.dayOfWeek}
                onChange={e => setAvailForm({ ...availForm, dayOfWeek: Number(e.target.value) })}
                required
              >
                {DAYS_OF_WEEK.slice(1).map((day, index) => (
                  <option key={index + 1} value={index + 1}>{day}</option>
                ))}
              </select>
              <input
                className="input"
                type="time"
                value={availForm.startTime}
                onChange={e => setAvailForm({ ...availForm, startTime: e.target.value })}
                required
              />
              <input
                className="input"
                type="time"
                value={availForm.endTime}
                onChange={e => setAvailForm({ ...availForm, endTime: e.target.value })}
                required
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingAvailability ? 'Update' : 'Add'}
                </button>
                {editingAvailability && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAvailability(null)
                      setAvailForm({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">My Availability Schedule</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availability.map(avail => (
                <div key={avail.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{DAYS_OF_WEEK[avail.dayOfWeek]}</h3>
                      <p className="text-sm text-gray-600">
                        {avail.startTime} - {avail.endTime}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditingAvailability(avail)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAvailability(avail.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holidays Tab */}
      {activeTab === 'holidays' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleHolidaySubmit}>
              <input
                className="input"
                type="date"
                value={holidayForm.date}
                onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                required
              />
              <input
                className="input md:col-span-2"
                placeholder="Reason"
                value={holidayForm.reason}
                onChange={e => setHolidayForm({ ...holidayForm, reason: e.target.value })}
                required
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                </button>
                {editingHoliday && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHoliday(null)
                      setHolidayForm({ date: "", reason: "" })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">My Holidays</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holidays.map(holiday => (
                <div key={holiday.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{new Date(holiday.date).toLocaleDateString()}</h3>
                      <p className="text-sm text-gray-600">{holiday.reason}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditingHoliday(holiday)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHoliday(holiday.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Download Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border p-4 rounded-lg">
                <h3 className="font-medium mb-2">All My Visits Report</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download a CSV report of all visits you have conducted
                </p>
                <button
                  onClick={downloadAllVisitsReport}
                  className="btn w-full"
                >
                  Download All Visits CSV
                </button>
              </div>

              <div className="border p-4 rounded-lg">
                <h3 className="font-medium mb-2">Patient-Specific Reports</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select a patient to download their visit history
                </p>
                <select
                  className="input mb-2"
                  onChange={e => {
                    const patientId = Number(e.target.value)
                    if (patientId) downloadPatientReport(patientId)
                  }}
                  defaultValue=""
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.code} - {patient.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{visits.length}</div>
                <div className="text-sm text-gray-600">Total Visits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{patients.length}</div>
                <div className="text-sm text-gray-600">Total Patients</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{availability.length}</div>
                <div className="text-sm text-gray-600">Availability Slots</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{holidays.length}</div>
                <div className="text-sm text-gray-600">Holidays Set</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}