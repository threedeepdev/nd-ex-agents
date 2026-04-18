'use client'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard/wine'

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9f6f1' }}>
      <div className="text-center">
        <div className="mb-8">
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '48px', fontWeight: 300, color: '#1a1210', letterSpacing: '-0.02em' }}>
            nd-ex
          </h1>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#888', marginTop: '4px', letterSpacing: '0.1em' }}>
            AGENT CONSOLE
          </p>
        </div>

        <div style={{
          background: 'white',
          border: '0.5px solid #e8e0d8',
          borderRadius: '16px',
          padding: '40px',
          width: '320px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍷</div>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '16px', fontWeight: 500, color: '#1a1210' }}>
              Welcome back
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: '#888', marginTop: '4px' }}>
              Sign in to access your agents
            </p>
          </div>

          <button
            onClick={() => signIn('google', { callbackUrl })}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: '#6B1414',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="white"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="white" opacity=".8"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="white" opacity=".6"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="white" opacity=".9"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
