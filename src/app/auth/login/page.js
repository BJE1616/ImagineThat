'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function LoginPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [formData, setFormData] = useState({
        emailOrUsername: '',
        password: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            let email = formData.emailOrUsername.trim()

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

            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: formData.password,
            })

            if (signInError) throw signInError

            router.push('/dashboard')

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
                        Sign in to your account
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
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
                                value={formData.emailOrUsername}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className={`w-full px-3 py-2 border border-${currentTheme.border} rounded-md bg-${currentTheme.card} text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="Your password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 px-4 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-semibold rounded-md hover:bg-${currentTheme.accentHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div className="text-center">
                        <a href="/auth/register" className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover}`}>
                            Don't have an account? Create one
                        </a>
                    </div>
                </form>
            </div>
        </div>
    )
}