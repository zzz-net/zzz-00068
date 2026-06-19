import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ToastProvider } from "@/components/Toast"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Appointments from "@/pages/Appointments"
import NewAppointment from "@/pages/NewAppointment"
import Config from "@/pages/Config"
import History from "@/pages/History"
import NotFound from "@/pages/NotFound"
import { useAppStore } from "@/store"
import type { ReactNode } from "react"

function RequireAuth({ children }: { children: ReactNode }) {
  const currentUser = useAppStore((s) => s.currentUser)
  const currentNurse = useAppStore((s) => s.currentNurse as any)
  if (!currentUser && !currentNurse) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/appointments"
            element={
              <RequireAuth>
                <Appointments />
              </RequireAuth>
            }
          />
          <Route
            path="/appointments/new"
            element={
              <RequireAuth>
                <NewAppointment />
              </RequireAuth>
            }
          />
          <Route
            path="/config"
            element={
              <RequireAuth>
                <Config />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <History />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
