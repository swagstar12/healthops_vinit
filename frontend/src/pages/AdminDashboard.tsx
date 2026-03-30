import React, { useEffect, useState } from 'react'
import { api } from '../api'

type Doctor = { 
  id: number
  user: { id: number, email: string, fullName: string, enabled: boolean }
  specialization?: string
  phone?: string 
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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  // Doctor form state
  const [doctorForm, setDoctorForm] = useState({
    email: '', fullName: '', password: '', specialization: '', phone: ''
  })
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)

  // Receptionist form state
  const [receptionistForm, setReceptionistForm] = useState({
    email: '', fullName: '', password: ''
  })
  const [editingReceptionist, setEditingReceptionist] = useState<Receptionist | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [doctorsRes, receptionistsRes, statsRes] = await Promise.all([
        api.get('/admin/doctors'),
        api.get('/admin/receptionists'),
        api.get('/admin/dashboard/stats')
      ])
      setDoctors(doctorsRes.data)
      setReceptionists(receptionistsRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
      alert('Failed to load data. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  // Doctor Management Functions
  async function handleDoctorSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingDoctor) {
        await api.put(`/admin/doctors/${editingDoctor.id}`, {
          email: doctorForm.email,
          fullName: doctorForm.fullName,
          specialization: doctorForm.specialization,
          phone: doctorForm.phone
        })
        setEditingDoctor(null)
      } else {
        await api.post('/admin/doctors', doctorForm)
      }
      setDoctorForm({ email: '', fullName: '', password: '', specialization: '', phone: '' })
      await loadData()
    } catch (error) {
      console.error('Failed to save doctor:', error)
      alert('Failed to save doctor. Please try again.')
    }
  }

  function startEditingDoctor(doctor: Doctor) {
    setEditingDoctor(doctor)
    setDoctorForm({
      email: doctor.user.email,
      fullName: doctor.user.fullName,
      password: '',
      specialization: doctor.specialization || '',
      phone: doctor.phone || ''
    })
  }

  async function deleteDoctor(id: number) {
    if (confirm('Are you sure you want to delete this doctor?')) {
      try {
        await api.delete(`/admin/doctors/${id}`)
        await loadData()
      } catch (error) {
        console.error('Failed to delete doctor:', error)
        alert('Failed to delete doctor. Please try again.')
      }
    }
  }

  // Receptionist Management Functions
  async function handleReceptionistSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingReceptionist) {
        await api.put(`/admin/receptionists/${editingReceptionist.id}`, {
          fullName: receptionistForm.fullName,
          email: receptionistForm.email,
          enabled: true
        })
        setEditingReceptionist(null)
      } else {
        await api.post('/admin/receptionists', receptionistForm)
      }
      setReceptionistForm({ email: '', fullName: '', password: '' })
      await loadData()
    } catch (error) {
      console.error('Failed to save receptionist:', error)
      alert('Failed to save receptionist. Please try again.')
    }
  }

  function startEditingReceptionist(receptionist: Receptionist) {
    setEditingReceptionist(receptionist)
    setReceptionistForm({
      email: receptionist.email,
      fullName: receptionist.fullName,
      password: ''
    })
  }

  async function deleteReceptionist(id: number) {
    if (confirm('Are you sure you want to delete this receptionist?')) {
      try {
        await api.delete(`/admin/receptionists/${id}`)
        await loadData()
      } catch (error) {
        console.error('Failed to delete receptionist:', error)
        alert('Failed to delete receptionist. Please try again.')
      }
    }
  }

  async function toggleUserStatus(userId: number, userType: 'doctor' | 'receptionist') {
    try {
      await api.put(`/admin/users/${userId}/toggle-status`)
      await loadData()
    } catch (error) {
      console.error('Failed to toggle user status:', error)
      alert('Failed to toggle user status. Please try again.')
    }
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
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <div className="text-sm text-gray-500">
          Welcome to the Hospital Management System
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'doctors', label: 'Doctors' },
            { key: 'receptionists', label: 'Receptionists' },
            { key: 'users', label: 'All Users' }
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
            { label: 'Total Doctors', value: stats.totalDoctors, color: 'bg-blue-500', icon: '👨‍⚕️' },
            { label: 'Total Receptionists', value: stats.totalReceptionists, color: 'bg-green-500', icon: '👩‍💼' },
            { label: 'Total Patients', value: stats.totalPatients, color: 'bg-purple-500', icon: '👥' },
            { label: 'Total Appointments', value: stats.totalAppointments, color: 'bg-orange-500', icon: '📅' },
            { label: 'Today\'s Appointments', value: stats.todayAppointments, color: 'bg-red-500', icon: '📋' },
            { label: 'Pending Appointments', value: stats.pendingAppointments, color: 'bg-yellow-500', icon: '⏳' },
            { label: 'Completed Appointments', value: stats.completedAppointments, color: 'bg-green-600', icon: '✅' },
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

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
            </h2>
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
              {!editingDoctor && (
                <input
                  className="input"
                  placeholder="Password"
                  type="password"
                  value={doctorForm.password}
                  onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })}
                  required
                />
              )}
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
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
                </button>
                {editingDoctor && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoctor(null)
                      setDoctorForm({ email: '', fullName: '', password: '', specialization: '', phone: '' })
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
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map(doctor => (
                    <tr key={doctor.id} className="border-b">
                      <td className="px-4 py-2">{doctor.id}</td>
                      <td className="px-4 py-2">{doctor.user?.fullName}</td>
                      <td className="px-4 py-2">{doctor.user?.email}</td>
                      <td className="px-4 py-2">{doctor.specialization}</td>
                      <td className="px-4 py-2">{doctor.phone}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          doctor.user?.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {doctor.user?.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditingDoctor(doctor)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleUserStatus(doctor.user.id, 'doctor')}
                            className="text-yellow-600 hover:text-yellow-800 text-sm"
                          >
                            {doctor.user?.enabled ? 'Disable' : 'Enable'}
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

      {/* Receptionists Tab */}
      {activeTab === 'receptionists' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              {editingReceptionist ? 'Edit Receptionist' : 'Add New Receptionist'}
            </h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleReceptionistSubmit}>
              <input
                className="input"
                placeholder="Email"
                type="email"
                value={receptionistForm.email}
                onChange={e => setReceptionistForm({ ...receptionistForm, email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Full Name"
                value={receptionistForm.fullName}
                onChange={e => setReceptionistForm({ ...receptionistForm, fullName: e.target.value })}
                required
              />
              {!editingReceptionist && (
                <input
                  className="input"
                  placeholder="Password"
                  type="password"
                  value={receptionistForm.password}
                  onChange={e => setReceptionistForm({ ...receptionistForm, password: e.target.value })}
                  required
                />
              )}
              <div className="flex space-x-2">
                <button type="submit" className="btn">
                  {editingReceptionist ? 'Update Receptionist' : 'Add Receptionist'}
                </button>
                {editingReceptionist && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReceptionist(null)
                      setReceptionistForm({ email: '', fullName: '', password: '' })
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
            <h2 className="text-xl font-semibold mb-4">Receptionists List</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receptionists.map(receptionist => (
                    <tr key={receptionist.id} className="border-b">
                      <td className="px-4 py-2">{receptionist.id}</td>
                      <td className="px-4 py-2">{receptionist.fullName}</td>
                      <td className="px-4 py-2">{receptionist.email}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          receptionist.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {receptionist.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditingReceptionist(receptionist)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleUserStatus(receptionist.id, 'receptionist')}
                            className="text-yellow-600 hover:text-yellow-800 text-sm"
                          >
                            {receptionist.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => deleteReceptionist(receptionist.id)}
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

      {/* All Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">All System Users</h2>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800">Doctors ({doctors.length})</h3>
              <div className="mt-2 space-y-2">
                {doctors.map(doctor => (
                  <div key={`doctor-${doctor.id}`} className="flex justify-between items-center bg-white p-3 rounded">
                    <div>
                      <span className="font-medium">{doctor.user?.fullName}</span>
                      <span className="ml-2 text-gray-500">({doctor.user?.email})</span>
                      <span className="ml-2 text-blue-600">{doctor.specialization}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      doctor.user?.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {doctor.user?.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800">Receptionists ({receptionists.length})</h3>
              <div className="mt-2 space-y-2">
                {receptionists.map(receptionist => (
                  <div key={`receptionist-${receptionist.id}`} className="flex justify-between items-center bg-white p-3 rounded">
                    <div>
                      <span className="font-medium">{receptionist.fullName}</span>
                      <span className="ml-2 text-gray-500">({receptionist.email})</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      receptionist.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {receptionist.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}