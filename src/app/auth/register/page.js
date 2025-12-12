'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function RegisterPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        referralCode: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [message, setMessage] = useState(null)
    const [referrerName, setReferrerName] = useState(null)

    useEffect(() => {
        // Check for referral code in URL (e.g., /auth/register?ref=ABC123)
        const refCode = searchParams.get('ref')
        if (refCode) {
            setFormData(prev => ({ ...prev, referralCode: refCode }))
            lookupReferrer(refCode)
        }
    }, [searchParams])

    const lookupReferrer = async (code) => {
        try {
            const { data } = await supabase
                .from('users')
                .select('username, first_name')
                .eq('referral_id', code)
                .single()

            if (data) {
                setReferrerName(data.first_name || data.username)
            }
        } catch (error) {
            // Referral code not found, that's okay
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value
        })

        // Look up referrer when code is entered
        if (name === 'referralCode' && value.length >= 6) {
            lookupReferrer(value)
        }
    }

    const findMatrixSpotForUser = async (newUserId, referrerId) => {
        try {
            // If user has a referrer, try to place them in referrer's matrix
            if (referrerId) {
                // Find referrer's active matrix
                const { data: referrerMatrix } = await supabase
                    .from('matrix_entries')
                    .select('*')
                    .eq('user_id', referrerId)
                    .eq('is_active', true)
                    .eq('is_completed', false)
                    .single()

                if (referrerMatrix) {
                    // Try to place in spot 2 or 3 (direct referral spots)
                    if (!referrerMatrix.spot_2) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_2: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)
                        return { placed: true, matrixOwnerId: referrerId, spot: 2 }
                    } else if (!referrerMatrix.spot_3) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_3: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)
                        return { placed: true, matrixOwnerId: referrerId, spot: 3 }
                    }
                }
            }

            // If no referrer OR referrer's spots 2-3 are full, find oldest waiting matrix
            // Look for matrices that have empty spots (prioritize spots 2-3, then 4-7)
            const { data: waitingMatrices } = await supabase
                .from('matrix_entries')
                .select('*, users!matrix_entries_user_id_fkey (username)')
                .eq('is_active', true)
                .eq('is_completed', false)
                .order('created_at', { ascending: true })

            if (waitingMatrices && waitingMatrices.length > 0) {
                for (const matrix of waitingMatrices) {
                    // Check spots 2-3 first
                    if (!matrix.spot_2) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_2: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)

                        // Send notification to matrix owner
                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: matrix.user_id,
                                type: 'free_referral',
                                title: '🎉 You got a free referral!',
                                message: 'Someone was auto-placed in your matrix. Keep growing your team!'
                            }])

                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 2, wasAutoPlaced: true }
                    }
                    if (!matrix.spot_3) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_3: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)

                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: matrix.user_id,
                                type: 'free_referral',
                                title: '🎉 You got a free referral!',
                                message: 'Someone was auto-placed in your matrix. Keep growing your team!'
                            }])

                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 3, wasAutoPlaced: true }
                    }

                    // Check spots 4-7 (these come from referrals of spots 2-3)
                    // For now, we'll fill these when the direct referrer's spots are full
                    if (!matrix.spot_4) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_4: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)

                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: matrix.user_id,
                                type: 'matrix_growth',
                                title: '🔷 Your matrix is growing!',
                                message: 'A new person joined your matrix in the second level!'
                            }])

                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 4 }
                    }
                    if (!matrix.spot_5) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_5: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)
                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 5 }
                    }
                    if (!matrix.spot_6) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_6: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)
                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 6 }
                    }
                    if (!matrix.spot_7) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_7: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', matrix.id)

                        // Matrix is now complete!
                        await supabase
                            .from('matrix_entries')
                            .update({
                                is_completed: true,
                                completed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', matrix.id)

                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: matrix.user_id,
                                type: 'matrix_complete',
                                title: '🎉 Matrix Complete!',
                                message: 'Congratulations! Your matrix is full! You\'ve earned $200!'
                            }])

                        return { placed: true, matrixOwnerId: matrix.user_id, spot: 7, matrixCompleted: true }
                    }
                }
            }

            return { placed: false }
        } catch (error) {
            console.error('Error placing user in matrix:', error)
            return { placed: false }
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            // Generate unique referral ID for new user
            const referralId = `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`

            // Find referrer if code provided
            let referrerId = null
            if (formData.referralCode) {
                const { data: referrer } = await supabase
                    .from('users')
                    .select('id')
                    .eq('referral_id', formData.referralCode)
                    .single()

                if (referrer) {
                    referrerId = referrer.id
                }
            }

            // Create user record
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
                    referred_by: referrerId,
                    email_verified: false
                }])

            if (dbError) throw dbError

            // Update referrer's count if they exist
            if (referrerId) {
                await supabase.rpc('increment_referral_count', { user_id: referrerId })

                // Notify the referrer
                await supabase
                    .from('notifications')
                    .insert([{
                        user_id: referrerId,
                        type: 'new_referral',
                        title: '🎉 New Referral!',
                        message: `${formData.firstName || formData.username} just signed up using your referral code!`
                    }])
            }

            // Try to place user in a matrix (this only matters once they become an advertiser)
            // For now, just track the referral relationship
            // Matrix placement will happen when they purchase an ad campaign

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
                        {/* Referral Code */}
                        <div>
                            <label htmlFor="referralCode" className="block text-sm font-medium text-slate-300 mb-1">
                                Referral Code (Optional)
                            </label>
                            <input
                                id="referralCode"
                                name="referralCode"
                                type="text"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="Enter referral code if you have one"
                                value={formData.referralCode}
                                onChange={handleChange}
                            />
                            {referrerName && (
                                <p className="text-green-400 text-sm mt-1">
                                    ✓ Referred by {referrerName}
                                </p>
                            )}
                        </div>

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