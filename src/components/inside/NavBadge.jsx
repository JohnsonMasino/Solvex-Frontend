// src/components/Inside/NavBadge.jsx
import { motion } from 'framer-motion'

// Seconds of rest between each vibration of the nav badge
const BADGE_SHAKE_PAUSE = 3

// Default placement: floats on the top-right corner of a desktop nav link.
// Pass your own `className` to place it elsewhere (e.g. inline in the mobile sidebar).
const FLOATING =
  'pointer-events-none absolute -right-1 -top-2.5 z-10 xl:-right-0.5 xl:-top-3'

/* Small tag on top of a nav link: pops in once, then vibrates every few seconds */
export default function NavBadge({ label, reduce, className = FLOATING }) {
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 14, delay: 0.35 }}
    >
      {/* soft pulsing glow behind the tag */}
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-[#3DDC97]"
          animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* the vibration */}
      <motion.span
        className="relative block origin-bottom rounded-full bg-gradient-to-r from-[#3DDC97] to-[#5BEBAD] px-1.5 py-px font-mono text-[9px] font-extrabold uppercase leading-tight tracking-wide text-[#06140E] shadow-lg shadow-[#3DDC97]/30 xl:px-2 xl:text-[10px]"
        animate={
          reduce
            ? undefined
            : {
                x: [0, -2.5, 2.5, -2, 2, -1, 1, 0],
                rotate: [0, -12, 12, -9, 9, -4, 4, 0],
                scale: [1, 1.18, 1.18, 1.12, 1.12, 1.05, 1.05, 1],
              }
        }
        transition={{
          duration: 0.7,
          ease: 'easeInOut',
          delay: 0.9,
          repeat: Infinity,
          repeatDelay: BADGE_SHAKE_PAUSE,
        }}
      >
        {label}
      </motion.span>
    </motion.span>
  )
}