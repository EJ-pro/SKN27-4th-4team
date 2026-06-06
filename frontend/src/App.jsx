import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Footer from './components/Footer'
import AlgorithmSection from './components/AlgorithmSection'
import ChatSection from './components/ChatSection'
import ExerciseSection from './components/ExerciseSection'

const ExercisePage = lazy(() => import('./pages/ExercisePage'))
const RoutinePage = lazy(() => import('./pages/RoutinePage'))
const ConsultPage = lazy(() => import('./pages/ConsultPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

function HomePage() {
  return (
    <>
      <Hero />
      <AlgorithmSection />
      <ChatSection />
      <ExerciseSection />
      <Footer />
    </>
  )
}

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Loading...</div>
    </div>
  )
}

function AppRoutes() {
  const { pathname } = useLocation()
  const isFullscreen = pathname === '/consult' || pathname === '/login' || pathname === '/register'

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      {!isFullscreen && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/exercise" element={<ExercisePage />} />
          <Route path="/exercises" element={<Navigate to="/exercise" replace />} />
          <Route path="/routine" element={<RoutinePage />} />
          <Route path="/consult" element={<ConsultPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
