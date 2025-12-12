'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAILS = ['admin@imaginethat.com'] // Add your admin email(s) here

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) throw authError

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('is_admin, email')
                .eq('id', authData.user.id)
                .single()

            if (userError) throw userError

            const isAdminUser = userData?.is_admin || ADMIN_EMAILS.includes(userData?.email)

            if (!isAdminUser) {
                await supabase.auth.signOut()
                throw new Error('Access denied. Admin privileges required.')
            }

            router.push('/admin/dashboard')
        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-4 shadow-lg shadow-amber-500/25">
                        <span className="text-2xl font-bold text-slate-900">IT</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">ImagineThat Admin</h1>
                    <p className="text-slate-400 mt-1">Sign in to access the admin panel</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                placeholder="admin@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-semibold rounded-lg hover:from-amber-400 hover:to-orange-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <p className="text-center text-slate-400 text-sm">
                            Not an admin?{' '}
                            <a href="/dashboard" className="text-amber-400 hover:text-amber-300 transition-colors">
                                Go to user dashboard
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                    © 2024 ImagineThat. All rights reserved.
                </p>
            </div>
        </div>
    )
}