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

            const { data: userDataResult } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            setUserData(userDataResult)

            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('status', 'active')
                .single()

            setCampaign(campaignData)

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

            const { data: notifData } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5)

            setNotifications(notifData || [])

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
        if (matrix.spot_2) count++
        if (matrix.spot_3) count++
        if (matrix.spot_4) count++
        if (matrix.spot_5) count++
        if (matrix.spot_6) count++
        if (matrix.spot_7) count++
        return count
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            <style jsx>{`
                @keyframes flashGreen {
                    0%, 100% { color: white; text-shadow: none; }
                    50% { color: #4ade80; text-shadow: 0 0 10px rgba(74, 222, 128, 0.8); }
                }
                .flash-green {
                    animation: flashGreen 1s ease-in-out infinite;
                }
            `}</style>
            <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6">
                {/* Compact Welcome */}
                <div className="mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                        Welcome, {userData?.first_name || userData?.username || 'User'}!
                    </h1>
                </div>

                {/* Notifications - Compact with flash animation */}
                {notifications.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {notifications.map(notif => {
                            const notifDate = new Date(notif.created_at)
                            const dateStr = notifDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            const timeStr = notifDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

                            return (
                                <div
                                    key={notif.id}
                                    className="bg-slate-800 border border-green-500/50 rounded-lg px-3 py-2 flex items-center justify-between"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">
                                            <span className="mr-1">🎉</span>
                                            <span className="flash-green">You got a free referral!</span>
                                        </p>
                                        <p className="text-white text-xs">
                                            {notif.type === 'free_referral'
                                                ? `Someone was auto-placed in your matrix on ${dateStr} at ${timeStr}.`
                                                : notif.message
                                            }
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => markNotificationRead(notif.id)}
                                        className="text-green-400 hover:text-white px-2 ml-2 text-lg font-bold"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Compact Stats Row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Referral Code</p>
                        <p className="text-amber-400 font-bold text-sm sm:text-base truncate">{userData?.referral_id || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Referrals</p>
                        <p className="text-green-400 font-bold text-lg">{userData?.simple_referral_count || 0}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Status</p>
                        {campaign ? (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]">Active</span>
                                <span className="text-white"> Ad Campaign</span>
                            </p>
                        ) : (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]">Non Active</span>
                                <span className="text-white"> Ad Campaign</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Ad Campaign Section - Compact */}
                {campaign ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-white">📢 Your Ad Campaign</h2>
                            {getBonusViews() > 0 && (
                                <span className="text-green-400 text-xs">+{getBonusViews()} bonus</span>
                            )}
                        </div>

                        <div className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">
                                    {getTotalViews().toLocaleString()} / {campaign.views_guaranteed?.toLocaleString()} views
                                </span>
                                <span className="text-slate-400">{Math.round(getViewProgress())}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${getViewProgress() >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                                    style={{ width: `${getViewProgress()}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex gap-4 text-xs text-slate-400">
                            <span>Game: {campaign.views_from_game || 0}</span>
                            <span>Flips: {campaign.views_from_flips || 0}</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">🚀 Start Advertising!</h2>
                                <p className="text-slate-300 text-xs mt-1">
                                    ${settings.ad_price} for {parseInt(settings.guaranteed_views).toLocaleString()} views
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/advertise')}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-sm rounded-lg"
                            >
                                Start
                            </button>
                        </div>
                    </div>
                )}

                {/* Matrix Section - Compact */}
                {matrix && (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-white">🔷 Your Matrix</h2>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matrix.is_completed
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                {matrix.is_completed ? 'Complete!' : `${getFilledSpots()}/6`}
                            </span>
                        </div>

                        {/* Compact Matrix Visualization */}
                        <div className="bg-slate-700/30 rounded-lg p-3">
                            {/* Row 1 - You */}
                            <div className="flex justify-center mb-2">
                                <div className="w-16 h-8 bg-amber-500/20 border border-amber-500 rounded flex items-center justify-center">
                                    <span className="text-amber-400 font-bold text-xs">YOU</span>
                                </div>
                            </div>

                            {/* Row 2 - Spots 2-3 */}
                            <div className="flex justify-center gap-6 mb-2">
                                {[2, 3].map(spot => {
                                    const spotData = matrix[`spot${spot}`]
                                    return (
                                        <div
                                            key={spot}
                                            className={`w-14 h-7 rounded flex items-center justify-center ${spotData
                                                ? 'bg-green-500/20 border border-green-500'
                                                : 'bg-slate-600/50 border border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-xs ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username?.slice(0, 6) || spot}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Row 3 - Spots 4-7 */}
                            <div className="flex justify-center gap-2">
                                {[4, 5, 6, 7].map(spot => {
                                    const spotData = matrix[`spot${spot}`]
                                    return (
                                        <div
                                            key={spot}
                                            className={`w-12 h-6 rounded flex items-center justify-center ${spotData
                                                ? 'bg-green-500/20 border border-green-500'
                                                : 'bg-slate-600/50 border border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-xs ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username?.slice(0, 4) || spot}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {matrix.is_completed && (
                            <div className="mt-3 text-center">
                                <p className="text-green-400 text-sm font-medium">🎉 You earned ${matrix.payout_amount}!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Actions - Compact */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => router.push('/game')}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-2xl block">🎮</span>
                        <p className="text-white text-xs mt-1">Play</p>
                    </button>
                    <button
                        onClick={() => router.push('/cards')}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-2xl block">🃏</span>
                        <p className="text-white text-xs mt-1">Cards</p>
                    </button>
                    <button
                        onClick={() => router.push('/advertise')}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center hover:bg-slate-700/50 transition-all"
                    >
                        <span className="text-2xl block">📢</span>
                        <p className="text-white text-xs mt-1">Advertise</p>
                    </button>
                </div>
            </div>
        </div>
    )
}