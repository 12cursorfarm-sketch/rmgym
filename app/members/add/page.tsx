'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  MembershipType,
  getMembershipLabel,
  computeEndDate,
  getTodayStr,
  formatDate,
} from '@/lib/utils'
import QRCode from 'qrcode'

export default function AddMemberPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [membershipType, setMembershipType] = useState<MembershipType | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [payment, setPayment] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const today = getTodayStr()
  const endDate = membershipType ? computeEndDate(today, membershipType) : ''

  const is1Day = membershipType === '1day'

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!membershipType || !name || !payment) return
    setSaving(true)

    try {
      const { data, error } = await supabase
        .from('members')
        .insert({
          name,
          email: is1Day ? null : email || null,
          photo: is1Day ? null : photo,
          membership_type: membershipType,
          start_date: today,
          end_date: endDate,
          status: 'active',
          payment: parseFloat(payment),
        })
        .select()
        .single()

      if (error) throw error

      const memberId = data.id
      setCreatedId(memberId)

      // Generate QR code
      const qr = await QRCode.toDataURL(memberId, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      setQrDataUrl(qr)
      setStep(3)
    } catch (err) {
      console.error('Error creating member:', err)
      alert('Failed to create member. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function downloadQR() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `${name.replace(/\s+/g, '_')}_QR.png`
    link.href = qrDataUrl
    link.click()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Add Member</h1>
        <p className="page-subtitle">Register a new gym member</p>
      </div>

      {/* Steps */}
      <div className="steps">
        <div className="step">
          <div className={`step-number ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <span className={`step-label ${step === 1 ? 'active' : ''}`}>Plan</span>
        </div>
        <div className={`step-line ${step > 1 ? 'done' : ''}`} />
        <div className="step">
          <div className={`step-number ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
            {step > 2 ? '✓' : '2'}
          </div>
          <span className={`step-label ${step === 2 ? 'active' : ''}`}>Details</span>
        </div>
        <div className={`step-line ${step > 2 ? 'done' : ''}`} />
        <div className="step">
          <div className={`step-number ${step === 3 ? 'active' : ''}`}>3</div>
          <span className={`step-label ${step === 3 ? 'active' : ''}`}>Done</span>
        </div>
      </div>

      {/* Step 1: Choose Membership Type */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
            Choose Membership Type
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, maxWidth: 640 }}>
            {(['1day', 'weekly', 'monthly'] as MembershipType[]).map((type) => (
              <div
                key={type}
                className={`type-card ${membershipType === type ? 'selected' : ''}`}
                onClick={() => setMembershipType(type)}
              >
                <div className="type-icon">
                  {type === '1day' ? '⚡' : type === 'weekly' ? '📅' : '📆'}
                </div>
                <div className="type-name">{getMembershipLabel(type)}</div>
                <div className="type-duration">
                  {type === '1day' ? 'Single day access' : type === 'weekly' ? '7 days access' : '30 days access'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <button
              className="btn btn-primary"
              disabled={!membershipType}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Fill Details */}
      {step === 2 && (
        <div style={{ maxWidth: 480 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
            Member Details
          </h2>

          {/* Photo (not required for 1-day) */}
          {!is1Day && (
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
              <div
                className="photo-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                {photo ? (
                  <img src={photo} alt="Member photo" />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 4 }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <div>Upload Photo</div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="label">Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {!is1Day && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="label">Payment (PHP) *</label>
            <input
              type="number"
              className="input"
              placeholder="Enter amount"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Membership Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
              <div style={{ color: 'var(--muted)' }}>Type:</div>
              <div>{getMembershipLabel(membershipType!)}</div>
              <div style={{ color: 'var(--muted)' }}>Start Date:</div>
              <div>{formatDate(today)}</div>
              <div style={{ color: 'var(--muted)' }}>End Date:</div>
              <div>{formatDate(endDate)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={!name || !payment || (!is1Day && !email) || saving}
              onClick={handleSubmit}
            >
              {saving ? 'Creating...' : 'Create Member'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(0, 184, 148, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
              color: 'var(--success)',
            }}
          >
            ✓
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Member Created!
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
            {name} has been registered with a {getMembershipLabel(membershipType!)} membership.
          </p>

          {qrDataUrl && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  background: 'white',
                  borderRadius: 16,
                  padding: 24,
                  display: 'inline-block',
                  marginBottom: 16,
                }}
              >
                <img src={qrDataUrl} alt="Member QR Code" style={{ width: 200, height: 200 }} />
              </div>
              <div>
                <button className="btn btn-outline" onClick={downloadQR} style={{ marginBottom: 8 }}>
                  Download QR Code
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className="btn btn-outline"
              onClick={() => router.push(`/members/${createdId}`)}
            >
              View Profile
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setStep(1)
                setMembershipType(null)
                setName('')
                setEmail('')
                setPhoto(null)
                setPayment('')
                setCreatedId(null)
                setQrDataUrl(null)
              }}
            >
              Add Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
