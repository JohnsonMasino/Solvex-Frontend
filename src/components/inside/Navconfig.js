// src/components/Inside/Navconfig.js
import {
  ArrowLeftRight,
  Download,
  Landmark,
  LayoutDashboard,
  Settings,
  Signal,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'

// Used by the mobile Sidebar (unchanged)
export const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Trade', to: '/dashboard/trade', icon: TrendingUp },
  { label: 'Deposit', to: '/dashboard/deposit', icon: Download },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: Upload },
  { label: 'History', to: '/dashboard/transactions', icon: ArrowLeftRight },
  { label: 'Loan', to: '/dashboard/loan', icon: Landmark },
  { label: 'Referrals', to: '/dashboard/referrals', icon: Users },
]

// Used by the desktop header only. An item with `children` renders as a dropdown.
// An item with `badge` shows a small animated tag on top of its link.
export const DESKTOP_NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Trade', to: '/dashboard/trade', icon: TrendingUp },
  {
    label: 'Wallet',
    icon: Wallet,
    children: [
      { label: 'Deposit', to: '/dashboard/deposit', icon: Download },
      { label: 'Withdraw', to: '/dashboard/withdraw', icon: Upload },
      { label: 'History', to: '/dashboard/transactions', icon: ArrowLeftRight },
    ],
  },
  { label: 'Loan', to: '/dashboard/loan', icon: Landmark },
  { label: 'Referrals', to: '/dashboard/referrals', icon: Users },
  { label: 'Signals', to: '/dashboard/signals', icon: Signal, badge: 'Plus +' },
]

export const SETTINGS_ITEM = { label: 'Settings', to: '/dashboard/settings', icon: Settings }
export const KYC_URL = '/dashboard/kyc'

export const firstNameOf = (user) => (user?.full_name || '').trim().split(/\s+/)[0] || ''

export const initialsOf = (user) => {
  const parts = (user?.full_name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}