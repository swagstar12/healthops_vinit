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

type Doctor = { 
  id: number
  user: { fullName: string, email: string }
  specialization?: string
  phone?: string
}

type Appointment = {
  id: number
  patient: Patient
  doctor: Doctor
  scheduledAt: string
  status: string
  reason?: string
}

type Visit = {
  id: number
  patient: Patient
  doctor: Doctor
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
  totalDoctors: number
  totalAppointments: number
  todayAppointments: number
  scheduledAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  totalVisits: number
}

const DAYS_OF_WEEK = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ReceptionDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  // Forms state
  const [patientForm, setPatientForm] = useState({
    code: '', fullName: '', dob: '', phone: '', address: ''
  })
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)

  const [doctorForm, setDoctorForm] = useState({
    email: '', fullName: '', password: '', specialization: '', phone: ''
  })

  const [appointmentForm, setAppointmentForm] = useState({
    patientId: 0, doctorId: 0, scheduledAt: '', reason: ''
  })
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

  const [availabilityForm, setAvailabilityForm] = useState({
    doctorId: 0, dayOfWeek: 1, startTime: '09:00', endTime: '17:00'
  })

  const [holidayForm, setHolidayForm] = useState({
    doctorId: 0, date: '', reason: ''
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPatientVisits, setSelectedPatientVisits] = useState<Visit[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(0)
  const [doctorAvailability, setDoctorAvailability] = useState<Availability[]>([])
  const [doctorHolidays, setDoctorHolidays] = useState<Holiday[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [patientsRes, doctorsRes, appointmentsRes, visitsRes, statsRes] = await Promise.all([
        api.get('/reception/patients'),
        api.get('/reception/doctors'),
        api.get('/reception/appointments'),
        api.get('/reception/visits'),
        api.get('/reception/dashboard/stats')
      ])
      setPatients(patientsRes.data)
      setDoctors(doctorsRes.data)
      setAppointments(appointmentsRes.data)
      setVisits(visitsRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Patient Management
  async function handlePatientSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingPatient) {
        await api.put(`/reception/patients/${editingPatient.id}`, {
          fullName: patientForm.fullName,
          dob: patientForm.dob || null,
          phone: patientForm.phone,
          address: patientForm.address
        })
        setEditingPatient(null)
      } else {
        await api.post('/reception/patients', patientForm)
      }
      setPatientForm({ code: '', fullName: '', dob: '', phone: '', address: '' })
      loadData()
    } catch (error) {
      console.error('Failed to save patient:', error)
    }
  }

  function startEditingPatient(patient: Patient) {
    setEditingPatient(patient)
    setPatientForm({
      code: patient.code,
      fullName: patient.fullName,
      dob: patient.dob || '',
      phone: patient.phone || '',
      address: patient.address || ''
    })
  }

  async function deletePatient(id: number) {
    if (confirm('Are you sure you want to delete this patient?')) {
      try {
        await api.delete(`/reception/patients/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete patient:', error)
      }
    }
  }

  // Doctor Management
  async function handleDoctorSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/reception/doctors', doctorForm)
      setDoctorForm({ email: '', fullName: '', password: '', specialization: '', phone: '' })
      loadData()
    } catch (error) {
      console.error('Failed to save doctor:', error)
    }
  }

  async function deleteDoctor(id: number) {
    if (confirm('Are you sure you want to delete this doctor?')) {
      try {
        await api.delete(`/reception/doctors/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete doctor:', error)
      }
    }
  }

  // Appointment Management
  async function handleAppointmentSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingAppointment) {
        await api.put(`/reception/appointments/${editingAppointment.id}`, {
          scheduledAt: appointmentForm.scheduledAt,
          reason: appointmentForm.reason,
          status: 'SCHEDULED'
        })
        setEditingAppointment(null)
      } else {
        await api.post('/reception/appointments', {
          ...appointmentForm,
          scheduledAt: new Date(appointmentForm.scheduledAt).toISOString()
        })
      }
      setAppointmentForm({ patientId: 0, doctorId: 0, scheduledAt: '', reason: '' })
      loadData()
    } catch (error) {
      console.error('Failed to save appointment:', error)
    }
  }

  function startEditingAppointment(appointment: Appointment) {
    setEditingAppointment(appointment)
    setAppointmentForm({
      patientId: appointment.patient.id,
      doctorId: appointment.doctor.id,
      scheduledAt: appointment.scheduledAt.slice(0, 16), // Format for datetime-local input
      reason: appointment.reason || ''
    })
  }

  async function updateAppointmentStatus(id: number, status: string) {
    try {
      await api.put(`/reception/appointments/${id}/status`, { status })
      loadData()
    } catch (error) {
      console.error('Failed to update appointment status:', error)
    }
  }

  async function deleteAppointment(id: number) {
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        await api.delete(`/reception/appointments/${id}`)
        loadData()
      } catch (error) {
        console.error('Failed to delete appointment:', error)
      }
    }
  }

  // Doctor Availability & Holiday Management
  async function handleAvailabilitySubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post(`/reception/doctors/${availabilityForm.doctorId}/availability`, {
        dayOfWeek: availabilityForm.dayOfWeek,
        startTime: availabilityForm.startTime,
        endTime: availabilityForm.endTime
      })
      setAvailabilityForm({ doctorId: 0, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
      loadDoctorSchedule(availabilityForm.doctorId)
    } catch (error) {
      console.error('Failed to save availability:', error)
    }
  }

  async function handleHolidaySubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post(`/reception/doctors/${holidayForm.doctorId}/holidays`, {
        date: holidayForm.date,
        reason: holidayForm.reason
      })
      setHolidayForm({ doctorId: 0, date: '', reason: '' })
      loadDoctorSchedule(holidayForm.doctorId)
    } catch (error) {
      console.error('Failed to save holiday:', error)
    }
  }

  async function loadDoctorSchedule(doctorId: number) {
    if (!doctorId) return
    try {
      const [availRes, holidayRes] = await Promise.all([
        api.get(`/reception/doctors/${doctorId}/availability`),
        api.get(`/reception/doctors/${doctorId}/holidays`)
      ])
      setDoctorAvailability(availRes.data)
      setDoctorHolidays(holidayRes.data)
      setSelectedDoctorId(doctorId)
    } catch (error) {
      console.error('Failed to load doctor schedule:', error)
    }
  }

  async function deleteAvailability(id: number) {
    if (confirm('Are you sure you want to delete this availability?')) {
      try {
        await api.delete(`/reception/availability/${id}`)
        loadDoctorSchedule(selectedDoctorId)
      } catch (error) {
        console.error('Failed to delete availability:', error)
      }
    }
  }

  async function deleteHoliday(id: number) {
    if (confirm('Are you sure you want to delete this holiday?')) {
      try {
        await api.delete(`/reception/holidays/${id}`)
        loadDoctorSchedule(selectedDoctorId)
      } catch (error) {
        console.error('Failed to delete holiday:', error)
      }
    }
  }

  // Visit History
  async function loadPatientVisits(patientId: number) {
    try {
      const response = await api.get(`/reception/patients/${patientId}/visits`)
      setSelectedPatientVisits(response.data)
    } catch (error) {
      console.error('Failed to load patient visits:', error)
    }
  }

  // Search functionality
  const filteredPatients = patients.filter(patient =>
    patient.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredAppointments = appointments.filter(appointment =>
    appointment.patient.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.patient.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.doctor.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Report Downloads
  function downloadPatientsReport() {
    window.location.href = '/api/reception/reports/patients.csv'
  }

  function downloadPatientVisitsReport(patientId: number) {
    window.location.href = `/api/reception/reports/patient/${patientId}/visits.csv`
  }

  function downloadAppointmentsReport() {
    window.location.href = '/api/reception/reports/appointments.csv'
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
        <h1 className="text-3xl font-bold text-gray-800">Reception Dashboard</h1>
        <div className="text-sm text-gray-500">
          Manage patients, appointments and schedules
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'patients', label: 'Patients' },
            { key: 'appointments', label: 'Appointments' },
            { key: 'doctors', label: 'Doctors' },
            { key: 'schedule', label: 'Doctor Schedule' },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats && [
            { label: 'Total Patients', value: stats.totalPatients, color: 'bg-blue-500', icon: '👥' },
            { label: 'Total Doctors', value: stats.totalDoctors, color: 'bg-green-500', icon: '👨‍⚕️' },
            { label: 'Today\'s Appointments', value: stats.todayAppointments, color: 'bg-purple-500', icon: '📅' },
            { label: 'Scheduled Appointments', value: stats.scheduledAppointments, color: 'bg-yellow-500', icon: '⏳' },
            { label: 'Completed Appointments', value: stats.completedAppointments, color: 'bg-green-600', icon: '✅' },
            { label: 'Cancelled Appointments', value: stats.cancelledAppointments, color: 'bg-red-500', icon: '❌' },
            { label: 'Total Appointments', value: stats.totalAppointments, color: 'bg-orange-500', icon: '📋' },
            { label: 'Total Visits', value: stats.totalVisits, color: 'bg-indigo-500', icon: '🏥' }
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
            <h2 className="text-xl font-semibold mb-4">
              {editingPatient ? 'Edit Patient' : 'Add New Patient'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handlePatientSubmit}>
              <input
                className="input"
                placeholder="Patient Code"
                value={patientForm.code}
                onChange={e => setPatientForm({ ...patientForm, code: e.target.value })}
                required
                disabled={!!editingPatient}
              />
              <input
                className="input"
                placeholder="Full Name"
                value={patientForm.fullName}
                onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
                required
              />
              <input
                className="input"
                type="date"
                placeholder="Date of Birth"
                value={patientForm.dob}
                onChange={e => setPatientForm({ ...patientForm, dob: e.target.value })}
              />
              <input
                className="input"
                placeholder="Phone"
                value={patientForm.phone}
                onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
              />
              <textarea
                className="input md:col-span-2"
                placeholder="Address"
                rows={3}
                value={patientForm.address}
                onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
              />
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingPatient ? 'Update Patient' : 'Add Patient'}
                </button>
                {editingPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPatient(null)
                      setPatientForm({ code: '', fullName: '', dob: '', phone: '', address: '' })
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Patients List</h2>
              <div className="flex space-x-2">
                <input
                  className="input w-64"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={downloadPatientsReport}
                  className="btn"
                >
                  Download CSV
                </button>
              </div>
            </div>
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
                  {filteredPatients.map(patient => (
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
                            onClick={() => downloadPatientVisitsReport(patient.id)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                          >
                            Download Report
                          </button>
                          <button
                            onClick={() => deletePatient(patient.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patient Visits Modal */}
          {selectedPatientVisits.length > 0 && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Patient Visit History</h3>
                  <button
                    onClick={() => setSelectedPatientVisits([])}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedPatientVisits.map(visit => (
                    <div key={visit.id} className="border p-3 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {new Date(visit.visitAt).toLocaleDateString()} - Dr. {visit.doctor.user.fullName}
                          </p>
                          <p className="text-sm text-gray-600">Diagnosis: {visit.diagnosis || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Prescription: {visit.prescription || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Notes: {visit.notes || 'N/A'}</p>
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

      {/* Appointments Tab */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingAppointment ? 'Edit Appointment' : 'Create New Appointment'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleAppointmentSubmit}>
              <select
                className="input"
                value={appointmentForm.patientId}
                onChange={e => setAppointmentForm({ ...appointmentForm, patientId: Number(e.target.value) })}
                required
              >
                <option value={0}>Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.fullName}</option>
                ))}
              </select>
              <select
                className="input"
                value={appointmentForm.doctorId}
                onChange={e => setAppointmentForm({ ...appointmentForm, doctorId: Number(e.target.value) })}
                required
              >
                <option value={0}>Select Doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.user?.fullName} - {d.specialization}</option>
                ))}
              </select>
              <input
                className="input"
                type="datetime-local"
                value={appointmentForm.scheduledAt}
                onChange={e => setAppointmentForm({ ...appointmentForm, scheduledAt: e.target.value })}
                required
              />
              <textarea
                className="input"
                placeholder="Reason for visit"
                value={appointmentForm.reason}
                onChange={e => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
              />
              <div className="flex space-x-2 md:col-span-2">
                <button type="submit" className="btn">
                  {editingAppointment ? 'Update Appointment' : 'Create Appointment'}
                </button>
                {editingAppointment && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAppointment(null)
                      setAppointmentForm({ patientId: 0, doctorId: 0, scheduledAt: '', reason: '' })
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Appointments List</h2>
              <div className="flex space-x-2">
                <input
                  className="input w-64"
                  placeholder="Search appointments..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={downloadAppointmentsReport}
                  className="btn"
                >
                  Download CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Patient</th>
                    <th className="px-4 py-2 text-left">Doctor</th>
                    <th className="px-4 py-2 text-left">Date & Time</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map(appointment => (
                    <tr key={appointment.id} className="border-b">
                      <td className="px-4 py-2">{appointment.id}</td>
                      <td className="px-4 py-2">
                        {appointment.patient.code} - {appointment.patient.fullName}
                      </td>
                      <td className="px-4 py-2">
                        Dr. {appointment.doctor.user?.fullName}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(appointment.scheduledAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          appointment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditingAppointment(appointment)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <select
                            className="text-xs border rounded px-2 py-1"
                            value={appointment.status}
                            onChange={e => updateAppointmentStatus(appointment.id, e.target.value)}
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                          <button
                            onClick={() => deleteAppointment(appointment.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Add New Doctor</h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleDoctorSubmit}>
              <input
                className="input"
                placeholder="Email"
                type="email"
                value={doctorForm.email}
                onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Full Name"
                value={doctorForm.fullName}
                onChange={e => setDoctorForm({ ...doctorForm, fullName: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Password"
                type="password"
                value={doctorForm.password}
                onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Specialization"
                value={doctorForm.specialization}
                onChange={e => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Phone"
                value={doctorForm.phone}
                onChange={e => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                required
              />
              <button type="submit" className="btn">
                Add Doctor
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Doctors List</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Specialization</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map(doctor => (
                    <tr key={doctor.id} className="border-b">
                      <td className="px-4 py-2">{doctor.id}</td>
                      <td className="px-4 py-2">Dr. {doctor.user?.fullName}</td>
                      <td className="px-4 py-2">{doctor.user?.email}</td>
                      <td className="px-4 py-2">{doctor.specialization}</td>
                      <td className="px-4 py-2">{doctor.phone}</td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => loadDoctorSchedule(doctor.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Manage Schedule
                          </button>
                          <button
                            onClick={() => deleteDoctor(doctor.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Manage Doctor Schedule</h2>
            <div className="mb-4">
              <select
                className="input w-64"
                value={selectedDoctorId}
                onChange={e => {
                  const doctorId = Number(e.target.value)
                  if (doctorId) loadDoctorSchedule(doctorId)
                }}
              >
                <option value={0}>Select Doctor</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.user?.fullName} - {doctor.specialization}
                  </option>
                ))}
              </select>
            </div>

            {selectedDoctorId > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Availability Management */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Add Availability</h3>
                  <form onSubmit={handleAvailabilitySubmit} className="space-y-3">
                    <select
                      className="input"
                      value={availabilityForm.dayOfWeek}
                      onChange={e => setAvailabilityForm({ ...availabilityForm, dayOfWeek: Number(e.target.value) })}
                      required
                    >
                      {DAYS_OF_WEEK.slice(1).map((day, index) => (
                        <option key={index + 1} value={index + 1}>{day}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input"
                        type="time"
                        value={availabilityForm.startTime}
                        onChange={e => setAvailabilityForm({ ...availabilityForm, startTime: e.target.value })}
                        required
                      />
                      <input
                        className="input"
                        type="time"
                        value={availabilityForm.endTime}
                        onChange={e => setAvailabilityForm({ ...availabilityForm, endTime: e.target.value })}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn w-full"
                      onClick={() => setAvailabilityForm({ ...availabilityForm, doctorId: selectedDoctorId })}
                    >
                      Add Availability
                    </button>
                  </form>

                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Current Availability</h4>
                    <div className="space-y-2">
                      {doctorAvailability.map(avail => (
                        <div key={avail.id} className="flex justify-between items-center border p-2 rounded">
                          <span>
                            {DAYS_OF_WEEK[avail.dayOfWeek]}: {avail.startTime} - {avail.endTime}
                          </span>
                          <button
                            onClick={() => deleteAvailability(avail.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Holiday Management */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Add Holiday</h3>
                  <form onSubmit={handleHolidaySubmit} className="space-y-3">
                    <input
                      className="input"
                      type="date"
                      value={holidayForm.date}
                      onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      required
                    />
                    <input
                      className="input"
                      placeholder="Reason"
                      value={holidayForm.reason}
                      onChange={e => setHolidayForm({ ...holidayForm, reason: e.target.value })}
                      required
                    />
                    <button
                      type="submit"
                      className="btn w-full"
                      onClick={() => setHolidayForm({ ...holidayForm, doctorId: selectedDoctorId })}
                    >
                      Add Holiday
                    </button>
                  </form>

                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Upcoming Holidays</h4>
                    <div className="space-y-2">
                      {doctorHolidays.map(holiday => (
                        <div key={holiday.id} className="flex justify-between items-center border p-2 rounded">
                          <div>
                            <span className="font-medium">
                              {new Date(holiday.date).toLocaleDateString()}
                            </span>
                            <p className="text-sm text-gray-600">{holiday.reason}</p>
                          </div>
                          <button
                            onClick={() => deleteHoliday(holiday.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Download Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border p-4 rounded-lg">
                <h3 className="font-medium mb-2">Patients Report</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download a comprehensive list of all patients with their details
                </p>
                <button
                  onClick={downloadPatientsReport}
                  className="btn w-full"
                >
                  Download Patients CSV
                </button>
              </div>

              <div className="border p-4 rounded-lg">
                <h3 className="font-medium mb-2">Appointments Report</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all appointments with patient and doctor information
                </p>
                <button
                  onClick={downloadAppointmentsReport}
                  className="btn w-full"
                >
                  Download Appointments CSV
                </button>
              </div>

              <div className="border p-4 rounded-lg">
                <h3 className="font-medium mb-2">Patient Visit History</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select a patient to download their complete visit history
                </p>
                <select
                  className="input mb-2"
                  onChange={e => {
                    const patientId = Number(e.target.value)
                    if (patientId) downloadPatientVisitsReport(patientId)
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
            <h2 className="text-xl font-semibold mb-4">Quick Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{patients.length}</div>
                <div className="text-sm text-gray-600">Total Patients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{doctors.length}</div>
                <div className="text-sm text-gray-600">Total Doctors</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{appointments.length}</div>
                <div className="text-sm text-gray-600">Total Appointments</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{visits.length}</div>
                <div className="text-sm text-gray-600">Total Visits</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}