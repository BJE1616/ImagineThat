'use client'

import { useState } from 'react'
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
    const [message, setMessage] = useState(null)

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
        setMessage(null)

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

                setMessage('Account created! Check your email to verify, then log in.')
            }
        } catch (error) {
            setError(error.message || 'Error creating account')
        } finally {
            setLoading(false)
        }
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

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm mb-3">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-2 rounded-lg text-sm mb-3">
                            {message}
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
                                className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="your.email@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                className={`w-full px-3 py-2 text-sm bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="At least 6 characters"
                                value={formData.password}
                                onChange={handleChange}
                            />
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