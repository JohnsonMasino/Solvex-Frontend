import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'

import ScrollToTop from './components/ScrollToTop'
import PrivateRoute from './components/PrivateRoute'
import PageSpinner from './components/Pagespinner'

// ── Home is loaded straight away so the first paint has no spinner ──
import Home from './pages/outside/HomePage'

// ── Public pages (lazy) ──
// // NOTE: adjust these import paths to match your folders.
// const Login = lazy(() => import('./pages/outside/Login'))
// const Signup = lazy(() => import('./pages/outside/Signup'))
// const AboutUs = lazy(() => import('./pages/outside/AboutUs'))
// const Certificates = lazy(() => import('./pages/outside/Certificates'))
const NotFound = lazy(() => import('./pages/outside/NotFound'))

// // ── Protected pages (lazy) ──
// const Dashboard = lazy(() => import('./pages/inside/Dashboard'))
// const Deposit = lazy(() => import('./pages/inside/Deposit'))
// const Withdraw = lazy(() => import('./pages/inside/Withdraw'))
// const Trade = lazy(() => import('./pages/inside/Trade'))
// const Kyc = lazy(() => import('./pages/inside/Kyc'))
// const Transactions = lazy(() => import('./pages/inside/Transactions'))
// const Profile = lazy(() => import('./pages/inside/Profile'))

export default function App() {
  return (
    <div className="App">
      {/* Scrolls to the top on every route change */}
      <ScrollToTop />

      {/* Shows the spinner while any lazy page is loading */}
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* ── PUBLIC routes ── */}
          <Route path="/" element={<Home />} />
          {/* <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/certificates" element={<Certificates />} /> */}

          {/* ── PROTECTED routes: everything inside needs a login ── */}
          <Route element={<PrivateRoute />}>
            {/* <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/deposit" element={<Deposit />} />
            <Route path="/dashboard/withdraw" element={<Withdraw />} />
            <Route path="/dashboard/trade" element={<Trade />} />
            <Route path="/dashboard/kyc" element={<Kyc />} />
            <Route path="/dashboard/transactions" element={<Transactions />} />
            <Route path="/dashboard/profile" element={<Profile />} /> */}
          </Route>

          {/* ── 404: any unknown URL ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  )
}