'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function ForgotPasswordPage() {
    const { currentTheme } = useTheme()
    const [emailOrUsername, setEmailOrUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            let email = emailOrUsername.trim()

            // If not an email, look up by username
            if (!email.includes('@')) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('email')
                    .ilike('username', email)
                    .single()

                if (userError || !userData) {
                    throw new Error('Username not found')
                }

                email = userData.email
            }

            // Send password reset email
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`
            })

            if (resetError) throw resetError

            setSuccess(true)

        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg} py-12 px-4`}>
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className={`mt-6 text-center text-3xl font-bold text-${currentTheme.text}`}>
                        Reset your password
                    </h2>
                    <p className={`mt-2 text-center text-${currentTheme.textMuted}`}>
                        Enter your email or username and we'll send you a reset link.
                    </p>
                </div>

                {success ? (
                    <div className="space-y-6">
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-4 rounded-lg text-center">
                            <p className="font-medium mb-2">✓ Reset link sent!</p>
                            <p className="text-sm">Check your email for the password reset link. It may take a few minutes to arrive.</p>
                        </div>
                        <div className="text-center">
                            <a
                                href="/auth/login"
                                className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover}`}
                            >
                                ← Back to Sign In
                            </a>
                        </div>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="emailOrUsername" className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                Email or Username
                            </label>
                            <input
                                id="emailOrUsername"
                                name="emailOrUsername"
                                type="text"
                                required
                                className={`w-full px-3 py-2 border border-${currentTheme.border} rounded-md bg-${currentTheme.card} text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="your.email@example.com or username"
                                value={emailOrUsername}
                                onChange={(e) => setEmailOrUsername(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-2 px-4 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-semibold rounded-md hover:bg-${currentTheme.accentHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <div className="text-center">
                            <a
                                href="/auth/login"
                                className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover}`}
                            >
                                ← Back to Sign In
                            </a>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}