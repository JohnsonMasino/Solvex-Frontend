import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'

// Helpers
import ScrollToTop from './components/ScrollToTop'
import PrivateRoute from './components/PrivateRoute'
import PageSpinner from './components/Pagespinner'

// Legal Pages
import PrivacyPolicy from './pages/legal/Privacy'
import RiskDisclosure from './pages/legal/Risk'
import TermsOfService from './pages/legal/Terms'
import Aml from './pages/legal/Aml'
import Certificate from './pages/legal/Cert'
import CookiePolicy from './pages/legal/Cookie'

// ── Home is loaded straight away so the first paint has no spinner ──
import Home from './pages/outside/HomePage'
import AboutUs from './pages/outside/AboutPage'

// ── Authenticated pages
// const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const Login = lazy(() => import('./pages/auth/Login'))
const ResetPass = lazy(() => import('./pages/auth/ResetPass'))
const ResetPassConfirm = lazy(() => import('./pages/auth/ResetPassConfirm'))


// 404 Page
const NotFound = lazy(() => import('./pages/outside/NotFound'))

// // ── Protected pages (lazy) ──
const Dashboard = lazy(() => import('./pages/inside/DashHome'))
const Deposit = lazy(() => import('./pages/inside/DepositPage'))
const Withdraw = lazy(() => import('./pages/inside/WithdrawPage'))
const Referral = lazy(() => import('./pages/inside/ReferralPage'))
const Trade = lazy(() => import('./pages/inside/TradePage'))
const TradeHistory = lazy(() => import('./pages/inside/TradeHistory'))
const Kyc = lazy(() => import('./pages/inside/Kyc'))
const Transactions = lazy(() => import('./pages/inside/Transactions'))
const Profile = lazy(() => import('./pages/inside/Profile'))
const ProfileEdit = lazy(() => import('./pages/inside/ProfileEdit'))
const Settings = lazy(() => import('./pages/inside/SettingsPage'))

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
          <Route path="/about-us" element={<AboutUs />} />

          {/* ── Auth routes ── */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ResetPass />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassConfirm />} />


          {/* ── Legal routes ── */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/risk-disclosure" element={<RiskDisclosure />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/aml-policy" element={<Aml />} />
          <Route path="/certificates" element={<Certificate />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />


          {/* ── PROTECTED routes: everything inside needs a login ── */}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/deposit" element={<Deposit />} />
            <Route path="/dashboard/withdraw" element={<Withdraw />} />
            <Route path="/dashboard/referrals" element={<Referral />} />
            <Route path="/dashboard/trade" element={<Trade />} />
            <Route path="/dashboard/trade-history" element={<TradeHistory />} />
            <Route path="/dashboard/kyc" element={<Kyc />} />
            <Route path="/dashboard/transactions" element={<Transactions />} />
            <Route path="/dashboard/profile" element={<Profile />} />
            <Route path="/dashboard/profile/edit" element={<ProfileEdit />} />
            <Route path="/dashboard/settings" element={<Settings />} />
          </Route>

          {/* ── 404: any unknown URL ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  )
}