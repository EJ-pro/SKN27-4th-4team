import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Footer from './components/Footer'
import ExercisePage from './pages/ExercisePage'
import RoutinePage from './pages/RoutinePage'
import ConsultPage from './pages/ConsultPage'

export default function App() {
  const [page, setPage] = useState('home')

  const renderPage = () => {
    switch (page) {
      case 'exercises': return <ExercisePage />
      case 'routine':   return <RoutinePage />
      case 'consult':   return <ConsultPage onNavigate={setPage} />
      default:          return <><Hero /><Footer /></>
    }
  }

  const isFullscreen = page === 'consult'

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      {!isFullscreen && <Navbar currentPage={page} onNavigate={setPage} />}
      {renderPage()}
    </div>
  )
}
