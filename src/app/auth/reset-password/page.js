'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function ResetPasswordPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const [sessionChecked, setSessionChecked] = useState(false)

    useEffect(() => {
        // Check if user has a valid session from the reset link
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setError('Invalid or expired reset link. Please request a new one.')
            }
            setSessionChecked(true)
        }
        checkSession()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            setLoading(false)
            return
        }

        // Validate password length
        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            setLoading(false)
            return
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            })

            if (updateError) throw updateError

            setSuccess(true)

            // Sign out and redirect to login after 3 seconds
            setTimeout(async () => {
                await supabase.auth.signOut()
                router.push('/auth/login')
            }, 3000)

        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!sessionChecked) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-10 h-10 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted}`}>Verifying reset link...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg} py-12 px-4`}>
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className={`mt-6 text-center text-3xl font-bold text-${currentTheme.text}`}>
                        Set new password
                    </h2>
                    <p className={`mt-2 text-center text-${currentTheme.textMuted}`}>
                        Enter your new password below.
                    </p>
                </div>

                {success ? (
                    <div className="space-y-6">
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-4 rounded-lg text-center">
                            <p className="font-medium mb-2">✓ Password updated!</p>
                            <p className="text-sm">Redirecting you to sign in...</p>
                        </div>
                    </div>
                ) : error && !password ? (
                    <div className="space-y-6">
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
                            {error}
                        </div>
                        <div className="text-center">
                            <a
                                href="/auth/forgot-password"
                                className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover}`}
                            >
                                Request a new reset link
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

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="password" className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                    New Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    className={`w-full px-3 py-2 border border-${currentTheme.border} rounded-md bg-${currentTheme.card} text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="At least 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    minLength={6}
                                    className={`w-full px-3 py-2 border border-${currentTheme.border} rounded-md bg-${currentTheme.card} text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-2 px-4 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-semibold rounded-md hover:bg-${currentTheme.accentHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}