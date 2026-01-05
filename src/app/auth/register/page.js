'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function RegisterPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        username: '',
        password: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [registrationComplete, setRegistrationComplete] = useState(false)
    const [countdown, setCountdown] = useState(5)
    const [showPassword, setShowPassword] = useState(false)

    // Countdown and redirect after successful registration
    useEffect(() => {
        if (registrationComplete && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (registrationComplete && countdown === 0) {
            router.push('/auth/login')
        }
    }, [registrationComplete, countdown, router])

    const formatPhone = (value) => {
        const numbers = value.replace(/\D/g, '')
        if (numbers.length <= 3) return numbers
        if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
        return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: name === 'phone' ? formatPhone(value) : value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data: existingUser } = await supabase
                .from('users')
                .select('username')
                .ilike('username', formData.username)
                .single()

            if (existingUser) {
                setError('Username is already taken. Please choose another.')
                setLoading(false)
                return
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            if (authData.user) {
                const { error: userError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        email: formData.email,
                        username: formData.username,
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone: formData.phone,
                        referral_id: formData.username.toUpperCase(),
                        simple_referral_count: 0
                    }])

                if (userError) throw userError

                try {
                    await fetch('/api/log-ip', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: authData.user.id,
                            eventType: 'register'
                        })
                    })
                } catch (ipError) {
                    console.log('IP logging error:', ipError)
                }

                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'welcome',
                            to: formData.email,
                            data: { username: formData.username }
                        })
                    })
                } catch (emailError) {
                    console.error('Welcome email error:', emailError)
                }

                // Sign out so they can't access anything until verified
                await supabase.auth.signOut()

                setRegistrationComplete(true)
            }
        } catch (error) {
            setError(error.message || 'Error creating account')
        } finally {
            setLoading(false)
        }
    }

    // Success screen after registration
    if (registrationComplete) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-md w-full text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4`}>
                        <span className="text-4xl">✉️</span>
                    </div>
                    <h2 className={`text-2xl font-bold text-${currentTheme.text} mb-2`}>Check Your Email!</h2>
                    <p className={`text-${currentTheme.textMuted} mb-6`}>
                        We sent a verification link to <span className={`text-${currentTheme.accent} font-medium`}>{formData.email}</span>
                        <br /><br />
                        Click the link in that email to verify your account, then you can log in.
                    </p>

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 mb-4`}>
                        <p className={`text-${currentTheme.textMuted} text-sm`}>
                            Redirecting to login in <span className={`text-${currentTheme.accent} font-bold`}>{countdown}</span> seconds...
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/auth/login')}
                        className={`w-full py-2.5 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all`}
                    >
                        Go to Login Now
                    </button>

                    <p className={`text-${currentTheme.textMuted} text-xs mt-4`}>
                        Didn't get the email? Check your spam folder.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg} py-6 px-4`}>
            <div className="max-w-md w-full">
                <div className="text-center mb-4">
                    <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-${currentTheme.accentHover} to-orange-500 rounded-xl mb-2`}>
                        <span className={`text-lg font-bold text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`}>IT</span>
                    </div>
                    <h2 className={`text-2xl font-bold text-${currentTheme.text}`}>Create your account</h2>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>Join ImagineThat and start winning!</p>
                </div>

                <form onSubmit={handleSubmit} autoComplete="off">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm mb-3">
                            {error}
                        </div>
                    )}

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 space-y-3`}>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>First Name</label>
                                <input
                                    name="firstName"
                                    type="text"
                                    required
                                    autoComplete="off"
                                    className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="First"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Last Name</label>
                                <input
                                    name="lastName"
                                    type="text"
                                    required
                                    autoComplete="off"
                                    className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="Last"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Username</label>
                                <input
                                    name="username"
                                    type="text"
                                    required
                                    autoComplete="off"
                                    className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Phone</label>
                                <input
                                    name="phone"
                                    type="tel"
                                    required
                                    autoComplete="off"
                                    className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="(555) 123-4567"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                autoComplete="off"
                                className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="your.email@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Password</label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="new-password"
                                    className={`w-full px-3 py-2 pr-10 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                    placeholder="At least 6 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-${currentTheme.textMuted} hover:text-${currentTheme.text} transition-colors`}
                                    tabIndex={-1}
                                >
                                    {showPassword ? '🙈' : '👁'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full mt-4 py-2.5 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                    >
                        {loading ? 'Creating...' : 'Create Account'}
                    </button>

                    <p className={`text-center text-${currentTheme.textMuted} text-sm mt-3`}>
                        Already have an account?{' '}
                        <a href="/auth/login" className={`text-${currentTheme.accent} hover:text-${currentTheme.accentHover}`}>Sign in</a>
                    </p>
                </form>
            </div>
        </div>
    )
}