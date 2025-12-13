'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
    const router = useRouter()
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

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            // Check if username is taken
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

            // Sign up the user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            if (authData.user) {
                // Create user record
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

                setMessage('Account created successfully! Please check your email to verify your account, then log in.')
            }
        } catch (error) {
            setError(error.message || 'Error creating account')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-4">
                        <span className="text-2xl font-bold text-slate-900">IT</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                        Create your account
                    </h2>
                    <p className="text-slate-400 mt-2">Join ImagineThat and start winning!</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
                            {message}
                        </div>
                    )}

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1">
                                    First Name
                                </label>
                                <input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="First name"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1">
                                    Last Name
                                </label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Last name"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="Choose a username"
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                                Email Address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="your.email@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
                                Phone Number
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                required
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="(555) 123-4567"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="At least 6 characters"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <p className="text-center text-slate-400">
                        Already have an account?{' '}
                        <a href="/auth/login" className="text-amber-400 hover:text-amber-300">
                            Sign in
                        </a>
                    </p>
                </form>
            </div>
        </div>
    )
}