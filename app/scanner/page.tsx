'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import {
  getMembershipLabel,
  getEffectiveStatus,
  formatDate,
  getTodayStr,
} from '@/lib/utils'
import type { Member, CheckInResult } from '@/lib/utils'

export default function ScannerPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)

  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    member: Member | null
    status: CheckInResult
    message: string
    totalVisits: number
  } | null>(null)
  const [processing, setProcessing] = useState(false)

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        // ignore errors on stop
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  async function startCamera() {
    try {
      setCameraError(null)
      // We must set scanning to true so the #reader div mounts
      setScanning(true)

      // Allow nominal time for React to render the div
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader")
          scannerRef.current = html5QrCode

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                return {
                  width: Math.max(250, Math.floor(minEdge * 0.85)),
                  height: Math.max(250, Math.floor(minEdge * 0.85))
                };
              }
            },
            (decodedText) => {
              if (processing) return
              const now = Date.now()
              if (decodedText === lastScannedRef.current && now - lastScannedTimeRef.current < 5000) {
                return
              }
              lastScannedRef.current = decodedText
              lastScannedTimeRef.current = now
              handleScan(decodedText)
            },
            () => {
              // ignore parse errors
            }
          )
        } catch (err) {
          console.error('Camera error:', err)
          setCameraError('Failed to access camera. Please allow permissions.')
          setScanning(false)
        }
      }, 100)
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('Failed to start camera.')
      setScanning(false)
    }
  }

  async function handleScan(memberId: string) {
    if (processing) return
    setProcessing(true)

    try {
      // Look up member
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single()

      if (memberError || !member) {
        setResult({
          member: null,
          status: 'not_found',
          message: 'Member not found. Invalid QR code.',
          totalVisits: 0,
        })
        setProcessing(false)
        return
      }

      const memberData = member as Member

      // Get total visits
      const { count: visitCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberId)

      const totalVisits = visitCount || 0

      // Check status
      const effectiveStatus = getEffectiveStatus(memberData)

      if (effectiveStatus === 'suspended') {
        setResult({
          member: memberData,
          status: 'suspended',
          message: 'This membership is suspended.',
          totalVisits,
        })
        setProcessing(false)
        return
      }

      if (effectiveStatus === 'expired') {
        setResult({
          member: memberData,
          status: 'expired',
          message: 'This membership has expired.',
          totalVisits,
        })
        setProcessing(false)
        return
      }

      // Check if already checked in today
      const today = getTodayStr()
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('member_id', memberId)
        .eq('date', today)
        .single()

      if (existing) {
        setResult({
          member: memberData,
          status: 'already_used',
          message: 'Already checked in today.',
          totalVisits,
        })
        setProcessing(false)
        return
      }

      // Create attendance record
      await supabase.from('attendance').insert({
        member_id: memberId,
        date: today,
      })

      setResult({
        member: memberData,
        status: 'valid',
        message: 'Check-in successful!',
        totalVisits: totalVisits + 1,
      })
    } catch (err) {
      console.error('Scan error:', err)
      setResult({
        member: null,
        status: 'not_found',
        message: 'An error occurred. Please try again.',
        totalVisits: 0,
      })
    } finally {
      setProcessing(false)
    }
  }

  // Manual ID input for browsers without BarcodeDetector
  const [manualId, setManualId] = useState('')

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null)
        setManualId('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [result])

  function handleManualScan() {
    if (!manualId.trim()) return
    handleScan(manualId.trim())
  }

  const resultColors: Record<CheckInResult, string> = {
    valid: 'var(--success)',
    already_used: 'var(--warning)',
    expired: 'var(--danger)',
    suspended: 'var(--danger)',
    not_found: 'var(--danger)',
  }

  const resultIcons: Record<CheckInResult, string> = {
    valid: '✓',
    already_used: '!',
    expired: '✕',
    suspended: '⊘',
    not_found: '?',
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scanner</h1>
        <p className="page-subtitle">Scan member QR code for check-in</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, maxWidth: 640, margin: '0 auto' }}>
        {/* Scanner */}
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {!scanning ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ marginBottom: 20 }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ opacity: 0.6 }}>
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                  </svg>
                </div>
                <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>
                  Position the QR code in front of the camera
                </p>
                <button className="btn btn-primary" onClick={startCamera}>
                  Start Scanner
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
                <div id="reader" style={{ flexGrow: 1, width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000' }}></div>
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <button className="btn btn-danger" onClick={() => { void stopCamera() }} style={{ width: '100%' }}>
                    Stop Scanner
                  </button>
                </div>
              </div>
            )}

            {cameraError && (
              <div style={{ padding: '12px 20px', color: 'var(--warning)', fontSize: 13, textAlign: 'center' }}>
                {cameraError}
              </div>
            )}
          </div>

          {/* Manual input */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12, color: 'var(--muted)' }}>
              Manual Check-in
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="input"
                placeholder="Enter member ID..."
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
              />
              <button
                className="btn btn-primary"
                onClick={handleManualScan}
                disabled={processing || !manualId.trim()}
                style={{ flexShrink: 0 }}
              >
                {processing ? '...' : 'Check In'}
              </button>
            </div>
          </div>
        </div>

        {/* Result Display Modal */}
        {result && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => {
              setResult(null)
              setManualId('')
            }}
          >
            <div
              className={`scan-result ${result.status}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                margin: 0,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Status Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: `${resultColors[result.status]}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 32,
                fontWeight: 700,
                color: resultColors[result.status],
              }}
            >
              {resultIcons[result.status]}
            </div>

            {/* Status Message */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: resultColors[result.status],
                marginBottom: 20,
              }}
            >
              {result.message}
            </div>

            {/* Member Info */}
            {result.member && (
              <div style={{ textAlign: 'left' }}>
                {/* Photo + Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  {result.member.photo ? (
                    <img
                      src={result.member.photo}
                      alt={result.member.name}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `3px solid ${resultColors[result.status]}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'var(--surface-hover)',
                        border: `3px solid ${resultColors[result.status]}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        fontSize: 28,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {result.member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {result.member.name}
                    </div>
                    {result.member.email && (
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {result.member.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Member Details */}
                <div
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Membership
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {getMembershipLabel(result.member.membership_type)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Status
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: resultColors[result.status] }}>
                      {getEffectiveStatus(result.member).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Start Date
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatDate(result.member.start_date)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      End Date
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatDate(result.member.end_date)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Total Visits
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                      {result.totalVisits}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      Payment
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      P{Number(result.member.payment).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Clear button */}
            <button
              className="btn btn-outline"
              onClick={() => {
                setResult(null)
                setManualId('')
              }}
              style={{ marginTop: 24, width: '100%' }}
            >
              Close
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
