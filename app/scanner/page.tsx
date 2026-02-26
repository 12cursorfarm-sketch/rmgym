'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getMembershipLabel,
  getEffectiveStatus,
  formatDate,
  getTodayStr,
} from '@/lib/utils'
import type { Member, CheckInResult } from '@/lib/utils'

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
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

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      startScanning()
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('Failed to access camera. Please allow camera permissions and try again.')
    }
  }

  function startScanning() {
    // Use BarcodeDetector API if available, otherwise fall back to manual input
    if ('BarcodeDetector' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || processing) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx || video.videoWidth === 0) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        try {
          const barcodes = await detector.detect(canvas)
          if (barcodes.length > 0) {
            const value = barcodes[0].rawValue
            const now = Date.now()
            // Prevent duplicate scans of the same QR within 5 seconds
            if (value === lastScannedRef.current && now - lastScannedTimeRef.current < 5000) {
              return
            }
            lastScannedRef.current = value
            lastScannedTimeRef.current = now
            handleScan(value)
          }
        } catch {
          // Ignore detection errors
        }
      }, 500)
    } else {
      // BarcodeDetector not available - show manual input
      setCameraError('QR scanning via camera is not supported in this browser. Use the manual input below, or try Chrome on Android.')
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

      <div style={{ display: 'grid', gridTemplateColumns: result?.member ? '1fr 1fr' : '1fr', gap: 24, maxWidth: 900 }}>
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
              <div style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    display: 'block',
                  }}
                  playsInline
                  muted
                />
                {/* Scanning overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      border: '2px solid var(--accent)',
                      borderRadius: 16,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <button className="btn btn-danger" onClick={stopCamera} style={{ width: '100%' }}>
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

        {/* Result Display */}
        {result && (
          <div className={`scan-result ${result.status}`}>
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
              style={{ marginTop: 20, width: '100%' }}
            >
              Clear & Scan Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
