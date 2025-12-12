'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [campaign, setCampaign] = useState(null)
    const [matrix, setMatrix] = useState(null)
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState({
        guaranteed_views: 1000,
        ad_price: 100
    })

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/auth/login')
                return
            }

            setUser(authUser)

            // Get user data
            const { data: userDataResult } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            setUserData(userDataResult)

            // Get active campaign
            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('status', 'active')
                .single()

            setCampaign(campaignData)

            // Get matrix
            const { data: matrixData } = await supabase
                .from('matrix_entries')
                .select(`
                    *,
                    spot1:users!matrix_entries_spot_1_fkey (id, username),
                    spot2:users!matrix_entries_spot_2_fkey (id, username),
                    spot3:users!matrix_entries_spot_3_fkey (id, username),
                    spot4:users!matrix_entries_spot_4_fkey (id, username),
                    spot5:users!matrix_entries_spot_5_fkey (id, username),
                    spot6:users!matrix_entries_spot_6_fkey (id, username),
                    spot7:users!matrix_entries_spot_7_fkey (id, username)
                `)
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .single()

            setMatrix(matrixData)

            // Get unread notifications
            const { data: notifData } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5)

            setNotifications(notifData || [])

            // Get settings
            const { data: settingsData } = await supabase
                .from('admin_settings')
                .select('*')

            if (settingsData) {
                const settingsObj = {}
                settingsData.forEach(item => {
                    settingsObj[item.setting_key] = item.setting_value
                })
                setSettings(prev => ({ ...prev, ...settingsObj }))
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const markNotificationRead = async (notifId) => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notifId)

            setNotifications(prev => prev.filter(n => n.id !== notifId))
        } catch (error) {
            console.error('Error marking notification read:', error)
        }
    }

    const getTotalViews = () => {
        if (!campaign) return 0
        return (campaign.views_from_game || 0) + (campaign.views_from_flips || 0)
    }

    const getBonusViews = () => {
        if (!campaign) return 0
        return campaign.bonus_views || 0
    }

    const getViewProgress = () => {
        if (!campaign) return 0
        const total = getTotalViews()
        const guaranteed = campaign.views_guaranteed || parseInt(settings.guaranteed_views)
        return Math.min((total / guaranteed) * 100, 100)
    }

    const getFilledSpots = () => {
        if (!matrix) return 0
        let count = 0
        if (matrix.spot_1) count++
        if (matrix.spot_2) count++
        if (matrix.spot_3) count++
        if (matrix.spot_4) count++
        if (matrix.spot_5) count++
        if (matrix.spot_6) count++
        if (matrix.spot_7) count++
        return count
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Welcome Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">
                        Welcome back, {userData?.first_name || userData?.username || 'User'}!
                    </h1>
                    <p className="text-slate-400 mt-1">Here's your dashboard overview</p>
                </div>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="mb-6 space-y-3">
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-amber-400 font-medium">{notif.title}</p>
                                    <p className="text-slate-300 text-sm">{notif.message}</p>
                                </div>
                                <button
                                    onClick={() => markNotificationRead(notif.id)}
                                    className="text-slate-400 hover:text-white px-3 py-1"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <p className="text-slate-400 text-sm font-medium">Your Referral Code</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">{userData?.referral_id || 'N/A'}</p>
                        <p className="text-slate-500 text-sm mt-2">Share this to earn referrals</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <p className="text-slate-400 text-sm font-medium">Total Referrals</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{userData?.simple_referral_count || 0}</p>
                        <p className="text-slate-500 text-sm mt-2">People who used your code</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <p className="text-slate-400 text-sm font-medium">Account Status</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">
                            {campaign ? 'Advertiser' : 'Free'}
                        </p>
                        <p className="text-slate-500 text-sm mt-2">
                            {campaign ? 'Ad campaign active' : 'No active campaign'}
                        </p>
                    </div>
                </div>

                {/* Ad Campaign Section */}
                {campaign ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-6">📢 Your Ad Campaign</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-slate-400 text-sm mb-2">Views Progress</p>
                                <div className="mb-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-white font-medium">
                                            {getTotalViews().toLocaleString()} / {campaign.views_guaranteed?.toLocaleString()} views
                                        </span>
                                        <span className="text-slate-400">
                                            {Math.round(getViewProgress())}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getViewProgress() >= 100 ? 'bg-green-500' : 'bg-amber-500'
                                                }`}
                                            style={{ width: `${getViewProgress()}%` }}
                                        ></div>
                                    </div>
                                </div>
                                {getBonusViews() > 0 && (
                                    <p className="text-green-400 text-sm">
                                        🎁 +{getBonusViews().toLocaleString()} bonus views!
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-700/50 rounded-lg p-4">
                                    <p className="text-slate-400 text-xs">Game Views</p>
                                    <p className="text-white font-bold text-lg">{campaign.views_from_game || 0}</p>
                                </div>
                                <div className="bg-slate-700/50 rounded-lg p-4">
                                    <p className="text-slate-400 text-xs">Card Flips</p>
                                    <p className="text-white font-bold text-lg">{campaign.views_from_flips || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">🚀 Start Advertising!</h2>
                        <p className="text-slate-300 mb-4">
                            Get your business card seen by thousands of players. Only ${settings.ad_price} for {parseInt(settings.guaranteed_views).toLocaleString()} guaranteed views!
                        </p>
                        <button
                            onClick={() => router.push('/advertise')}
                            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                        >
                            Start Your Campaign
                        </button>
                    </div>
                )}

                {/* Matrix Section */}
                {matrix ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">🔷 Your Referral Matrix</h2>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${matrix.is_completed
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                {matrix.is_completed ? 'Completed!' : `${getFilledSpots()}/7 Filled`}
                            </span>
                        </div>

                        {/* Matrix Visualization */}
                        <div className="bg-slate-700/50 rounded-lg p-6 mb-4">
                            {/* Spot 1 - You */}
                            <div className="flex justify-center mb-4">
                                <div className="w-24 h-14 bg-amber-500/20 border-2 border-amber-500 rounded-lg flex items-center justify-center">
                                    <span className="text-amber-400 font-bold">YOU</span>
                                </div>
                            </div>

                            {/* Lines */}
                            <div className="flex justify-center mb-2">
                                <div className="w-px h-4 bg-slate-500"></div>
                            </div>
                            <div className="flex justify-center mb-2">
                                <div className="w-32 h-px bg-slate-500"></div>
                            </div>

                            {/* Spots 2-3 */}
                            <div className="flex justify-center gap-16 mb-4">
                                {[2, 3].map(spot => {
                                    const spotKey = `spot_${spot}`
                                    const spotData = matrix[`spot${spot}`]
                                    return (
                                        <div
                                            key={spot}
                                            className={`w-24 h-14 rounded-lg flex items-center justify-center ${spotData
                                                    ? 'bg-green-500/20 border-2 border-green-500'
                                                    : 'bg-slate-600/50 border-2 border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-sm font-medium ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username || 'Empty'}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Lines */}
                            <div className="flex justify-center gap-16 mb-2">
                                <div className="w-px h-4 bg-slate-500"></div>
                                <div className="w-px h-4 bg-slate-500"></div>
                            </div>
                            <div className="flex justify-center gap-8 mb-2">
                                <div className="w-16 h-px bg-slate-500"></div>
                                <div className="w-8"></div>
                                <div className="w-16 h-px bg-slate-500"></div>
                            </div>

                            {/* Spots 4-7 */}
                            <div className="flex justify-center gap-4">
                                {[4, 5, 6, 7].map(spot => {
                                    const spotData = matrix[`spot${spot}`]
                                    return (
                                        <div
                                            key={spot}
                                            className={`w-20 h-12 rounded-lg flex items-center justify-center ${spotData
                                                    ? 'bg-green-500/20 border-2 border-green-500'
                                                    : 'bg-slate-600/50 border-2 border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-xs font-medium ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username || 'Empty'}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {matrix.is_completed ? (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                                <p className="text-green-400 font-bold text-lg">🎉 Congratulations!</p>
                                <p className="text-slate-300">
                                    Your matrix is complete! You've earned ${matrix.payout_amount}.
                                    {matrix.payout_status === 'paid'
                                        ? ' Payment has been sent!'
                                        : ' Payment is being processed.'}
                                </p>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-center">
                                Fill all 7 spots with paid advertisers to earn ${matrix.payout_amount}!
                            </p>
                        )}
                    </div>
                ) : campaign ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-4">🔷 Join the Referral Matrix</h2>
                        <p className="text-slate-300 mb-4">
                            As an advertiser, you can join our referral matrix! Fill 7 spots with other advertisers and earn $200!
                        </p>
                        <button
                            onClick={() => router.push('/matrix/join')}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-lg hover:from-blue-400 hover:to-purple-400 transition-all"
                        >
                            Join Matrix (Free)
                        </button>
                    </div>
                ) : null}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => router.push('/game')}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-3xl mb-2 block">🎮</span>
                        <p className="text-white font-medium">Play Game</p>
                        <p className="text-slate-400 text-sm">Win prizes and have fun</p>
                    </button>
                    <button
                        onClick={() => router.push('/cards')}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-3xl mb-2 block">🃏</span>
                        <p className="text-white font-medium">My Cards</p>
                        <p className="text-slate-400 text-sm">Manage your business cards</p>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-left hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-3xl mb-2 block">🚪</span>
                        <p className="text-white font-medium">Logout</p>
                        <p className="text-slate-400 text-sm">Sign out of your account</p>
                    </button>
                </div>
            </div>
        </div>
    )
}