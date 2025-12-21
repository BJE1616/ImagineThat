'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

function SuccessContent() {
    const { currentTheme } = useTheme()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')
    const [loading, setLoading] = useState(true)
    const [verified, setVerified] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (sessionId) {
            verifyPayment()
        } else {
            setLoading(false)
        }
    }, [sessionId])

    const verifyPayment = async () => {
        try {
            const response = await fetch('/api/stripe/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            })

            const data = await response.json()

            if (data.success) {
                setVerified(true)
            } else {
                setError(data.error || 'Could not verify payment')
            }
        } catch (err) {
            console.error('Verification error:', err)
            setError('Could not verify payment')
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className={`text-${currentTheme.textMuted}`}>Verifying payment...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} flex items-center justify-center p-4`}>
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-8 max-w-md w-full text-center`}>
                {/* Success Icon */}
                <div className={`w-20 h-20 ${error ? 'bg-yellow-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                    <span className="text-5xl">{error ? '⚠️' : '✅'}</span>
                </div>

                {/* Title */}
                <h1 className={`text-2xl font-bold text-${currentTheme.text} mb-2`}>
                    {error ? 'Payment Received' : 'Payment Successful!'}
                </h1>

                {/* Message */}
                <p className={`text-${currentTheme.textMuted} mb-6`}>
                    {error
                        ? 'Your payment was received but we had trouble updating our records. Our team will process your order shortly.'
                        : 'Thank you for your purchase! Your order has been received and is being processed.'
                    }
                </p>

                {/* Order Info */}
                <div className={`bg-${currentTheme.border}/30 rounded-lg p-4 mb-6`}>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>
                        You'll receive an email confirmation shortly with your order details.
                    </p>
                </div>

                {/* What's Next */}
                <div className={`text-left mb-6`}>
                    <p className={`text-${currentTheme.text} font-medium mb-2`}>What's next?</p>
                    <ul className={`text-${currentTheme.textMuted} text-sm space-y-1`}>
                        <li>📧 Check your email for confirmation</li>
                        <li>📦 Physical items ship within 3-5 business days</li>
                        <li>🎁 Digital items delivered within 24 hours</li>
                    </ul>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/merch"
                        className={`w-full py-3 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} rounded-lg font-medium hover:opacity-90 transition-all`}
                    >
                        Continue Shopping
                    </Link>
                    <Link
                        href="/game"
                        className={`w-full py-3 bg-${currentTheme.border} text-${currentTheme.text} rounded-lg font-medium hover:bg-${currentTheme.border}/80 transition-all`}
                    >
                        Back to Games
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function MerchSuccessPage() {
    const { currentTheme } = useTheme()

    return (
        <Suspense fallback={
            <div className={`min-h-screen bg-${currentTheme.bg} flex items-center justify-center`}>
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <SuccessContent />
        </Suspense>
    )
}