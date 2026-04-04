import React, { createContext, useContext, useEffect, useState } from 'react'
import { setAuthToken } from './api'

type User = { fullName: string, role: 'ADMIN'|'DOCTOR'|'RECEPTIONIST', token: string }
type AuthCtx = {
  user: User | null
  login: (u: User) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({user:null, login:()=>{}, logout:()=>{}})

// ✅ FIX: Set token SYNCHRONOUSLY at module load time
// This ensures axios has the token before any component fires a request
const stored = localStorage.getItem('healthops_user')
const initialUser: User | null = stored ? JSON.parse(stored) : null
if (initialUser?.token) {
  setAuthToken(initialUser.token)
}

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User|null>(initialUser)

  useEffect(() => { setAuthToken(user?.token ?? null) }, [user])

  const login = (u: User) => {
    setUser(u)
    localStorage.setItem('healthops_user', JSON.stringify(u))
    setAuthToken(u.token)
  }
  const logout = () => {
    setUser(null)
    localStorage.removeItem('healthops_user')
    setAuthToken(null)
  }
  return <Ctx.Provider value={{user, login, logout}}>{children}</Ctx.Provider>
}

export function useAuth(){ return useContext(Ctx) }