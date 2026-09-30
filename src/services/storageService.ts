import type { StorageEstimateInfo } from '../types'

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  const isSupported = typeof navigator !== 'undefined' && 'storage' in navigator

  if (!isSupported) {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      persisted: false,
      isSupported: false
    }
  }

  let usageBytes = 0
  let quotaBytes = 0
  let persisted = false

  try {
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      usageBytes = estimate.usage || 0
      quotaBytes = estimate.quota || 0
    }
  } catch (err) {
    console.warn('Storage estimate failed:', err)
  }

  try {
    if (navigator.storage.persisted) {
      persisted = await navigator.storage.persisted()
    }
  } catch (err) {
    console.warn('Checking storage persistence failed:', err)
  }

  return {
    usageBytes,
    quotaBytes,
    persisted,
    isSupported: true
  }
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist()
    } catch (err) {
      console.error('Requesting persistence failed:', err)
      return false
    }
  }
  return false
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
