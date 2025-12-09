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
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            const referralId = `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`

            const { error: dbError } = await supabase
                .from('users')
                .insert([{
                    id: authData.user.id,
                    email: formData.email,
                    phone: formData.phone,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    username: formData.username,
                    referral_id: referralId,
                    email_verified: false
                }])

            if (dbError) throw dbError

            setMessage('Registration successful! Redirecting to login...')

            setTimeout(() => {
                router.push('/auth/login')
            }, 3000)

        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
                        Create your account
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                            {message}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                First Name
                            </label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="Enter your first name"
                                value={formData.firstName}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                Last Name
                            </label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="Enter your last name"
                                value={formData.lastName}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="your.email@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="(555) 123-4567"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="Choose a username"
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                                placeholder="At least 6 characters"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    )
}