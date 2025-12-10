'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/auth/login')
                return
            }

            setUser(user)

            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) throw error

            setUserData(userData)
        } catch (error) {
            console.error('Error loading user:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    const copyReferralLink = () => {
        const link = window.location.origin + '/auth/register?ref=' + userData.referral_id
        navigator.clipboard.writeText(link)
        alert('Referral link copied!')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-gray-600">Loading...</div>
            </div>
        )
    }

    if (!userData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-red-600">Error loading user data</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Creative Advertising Platform
                    </h1>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        Welcome back, {userData.first_name}!
                    </h2>
                    <p className="text-gray-600">
                        Username: {userData.username} | Email: {userData.email}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-sm font-medium text-gray-500 mb-1">Total Campaigns</div>
                        <div className="text-3xl font-bold text-indigo-600">
                            {userData.total_campaigns_run || 0}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-sm font-medium text-gray-500 mb-1">Referrals</div>
                        <div className="text-3xl font-bold text-green-600">
                            {userData.simple_referral_count || 0}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-sm font-medium text-gray-500 mb-1">Matrices Completed</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {userData.total_matrices_completed || 0}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Your Referral Link</h3>
                    <p className="text-gray-600 mb-3">
                        Share this link to earn referral bonuses:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={window.location.origin + '/auth/register?ref=' + userData.referral_id}
                            readOnly
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        />
                        <button
                            onClick={copyReferralLink}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            Copy
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        Your Referral ID: {userData.referral_id}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Business Card</h3>
                        <p className="text-gray-600 mb-4">
                            Create and upload your business card to start advertising
                        </p>
                        <button
                            onClick={() => router.push('/cards')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            Get Started
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Play Memory Game</h3>
                        <p className="text-gray-600 mb-4">
                            Match cards and discover businesses while earning rewards
                        </p>
                        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            Play Now
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">View My Campaigns</h3>
                        <p className="text-gray-600 mb-4">
                            Track your active advertising campaigns
                        </p>
                        <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                            View Campaigns
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">My Referrals</h3>
                        <p className="text-gray-600 mb-4">
                            View your referral network and matrix positions
                        </p>
                        <button className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
                            View Network
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}