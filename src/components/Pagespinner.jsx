// Reusable loading spinner.
// - <PageSpinner />                 full-screen (used for lazy page loading)
// - <PageSpinner fullScreen={false} /> inline, for use inside a card or section
//   while data is loading (deposits, withdrawals, KYC checks, etc).
export default function PageSpinner({ fullScreen = true, label = 'Loading' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#080D12]'
          : 'flex w-full flex-col items-center justify-center py-16'
      }
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Faint track */}
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />

        {/* Outer ring: clockwise */}
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#3DDC97] [animation-duration:1.2s] motion-reduce:animate-none" />

        {/* Inner ring: counter-clockwise */}
        <div className="absolute inset-3 animate-spin rounded-full border-2 border-transparent border-b-[#3DDC97]/50 [animation-direction:reverse] [animation-duration:1.8s] motion-reduce:animate-none" />

        {/* Logo */}
        <img
          src="/Logo_nbg.png"
          alt=""
          className="h-9 w-9 object-contain"
          draggable="false"
        />
      </div>

      <p className="mt-5 text-sm font-medium tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}