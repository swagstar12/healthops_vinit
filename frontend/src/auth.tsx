import React, { createContext, useContext, useEffect, useState } from 'react'
import { setAuthToken } from './api'

type User = { fullName: string, role: 'ADMIN'|'DOCTOR'|'RECEPTIONIST', token: string }
type AuthCtx = {
  user: User | null
  login: (u: User) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({user:null, login:()=>{}, logout:()=>{}})

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User|null>(() => {
    const raw = localStorage.getItem('healthops_user')
    return raw ? JSON.parse(raw) : null
  })
  useEffect(() => { setAuthToken(user?.token ?? null) }, [user])
  const login = (u: User) => { setUser(u); localStorage.setItem('healthops_user', JSON.stringify(u)) }
  const logout = () => { setUser(null); localStorage.removeItem('healthops_user'); setAuthToken(null) }
  return <Ctx.Provider value={{user, login, logout}}>{children}</Ctx.Provider>
}

export function useAuth(){ return useContext(Ctx) }
