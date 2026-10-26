// src/components/Inside/Navconfig.js
import { Download, Landmark, LayoutDashboard, Settings, TrendingUp, Upload, Users } from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Trade', to: '/dashboard/trade', icon: TrendingUp },
  { label: 'Deposit', to: '/dashboard/deposit', icon: Download },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: Upload },
  { label: 'Loan', to: '/dashboard/loan', icon: Landmark },
  { label: 'Referrals', to: '/dashboard/referrals', icon: Users },
]

export const SETTINGS_ITEM = { label: 'Settings', to: '/dashboard/settings', icon: Settings }
export const KYC_URL = '/dashboard/kyc'

export const firstNameOf = (user) => (user?.full_name || '').trim().split(/\s+/)[0] || ''

export const initialsOf = (user) => {
  const parts = (user?.full_name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}