// src/components/Inside/signalNoticeStore.js
// Holds the last known banner state so moving between dashboard pages doesn't flash the bar in and out.
// 'prompt' = eligible, not purchased | 'purchased' = eligible and purchased | 'none' = show nothing

let cachedStatus = null

export const getCachedStatus = () => cachedStatus

export const setCachedStatus = (status) => {
  cachedStatus = status
}

// Call this on logout so the next account never sees the previous account's banner
export const resetSignalNotice = () => {
  cachedStatus = null
}