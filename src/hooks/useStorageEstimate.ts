import { useState, useEffect, useCallback } from 'react'
import { getStorageEstimate, requestStoragePersistence } from '../services/storageService'
import type { StorageEstimateInfo } from '../types'

export function useStorageEstimate() {
  const [estimate, setEstimate] = useState<StorageEstimateInfo>({
    usageBytes: 0,
    quotaBytes: 0,
    persisted: false,
    isSupported: false
  })
  const [loading, setLoading] = useState(true)

  const refreshEstimate = useCallback(async () => {
    try {
      const data = await getStorageEstimate()
      setEstimate(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshEstimate()
  }, [refreshEstimate])

  const requestPersistence = useCallback(async (): Promise<boolean> => {
    const granted = await requestStoragePersistence()
    await refreshEstimate()
    return granted
  }, [refreshEstimate])

  return {
    estimate,
    loading,
    refreshEstimate,
    requestPersistence,
  }
}
