import { Navigate, Outlet, useLocation } from 'react-router-dom'

// Guards any route that requires authentication.
// Works as a layout route (renders <Outlet />) or as a wrapper (renders children).
// Currently reads a token from localStorage. Later, swap this check for your
// real auth state (Context, Zustand, etc).
export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('solvex_token')
  const location = useLocation()

  if (!token) {
    // Send visitors to login and remember where they were heading
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ?? <Outlet />
}