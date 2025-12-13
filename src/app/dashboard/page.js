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
        ad_price: 100,
        matrix_payout: 200
    })

    const [showJoinMatrix, setShowJoinMatrix] = useState(false)
    const [referredBy, setReferredBy] = useState('')
    const [referralError, setReferralError] = useState(null)
    const [joiningMatrix, setJoiningMatrix] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)

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
                .maybeSingle()

            setCampaign(campaignData)

            const { data: matrixData } = await supabase
                .from('matrix_entries')
                .select(`
                    *,
                    spot2:users!matrix_entries_spot_2_fkey (id, username),
                    spot3:users!matrix_entries_spot_3_fkey (id, username),
                    spot4:users!matrix_entries_spot_4_fkey (id, username),
                    spot5:users!matrix_entries_spot_5_fkey (id, username),
                    spot6:users!matrix_entries_spot_6_fkey (id, username),
                    spot7:users!matrix_entries_spot_7_fkey (id, username)
                `)
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .maybeSingle()

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

    const findMatrixSpotForUser = async (newUserId, referrerUsername) => {
        try {
            let referrerId = null

            if (referrerUsername) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('username', referrerUsername)
                    .limit(1)

                if (users && users.length > 0) {
                    referrerId = users[0].id
                }
            }

            if (referrerId) {
                const { data: referrerMatrix } = await supabase
                    .from('matrix_entries')
                    .select('*')
                    .eq('user_id', referrerId)
                    .eq('is_active', true)
                    .eq('is_completed', false)
                    .maybeSingle()

                if (referrerMatrix) {
                    if (!referrerMatrix.spot_2) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_2: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: referrerId,
                                type: 'referral_joined',
                                title: '🎉 Your referral joined!',
                                message: 'They\'ve been added to your matrix in spot 2!'
                            }])

                        await supabase.rpc('increment_referral_count', { user_id: referrerId })
                        await checkMatrixCompletion(referrerMatrix.id)
                        return { placed: true, spot: 2 }
                    } else if (!referrerMatrix.spot_3) {
                        await supabase
                            .from('matrix_entries')
                            .update({ spot_3: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

                        await supabase
                            .from('notifications')
                            .insert([{
                                user_id: referrerId,
                                type: 'referral_joined',
                                title: '🎉 Your referral joined!',
                                message: 'They\'ve been added to your matrix in spot 3!'
                            }])

                        await supabase.rpc('increment_referral_count', { user_id: referrerId })
                        await checkMatrixCompletion(referrerMatrix.id)
                        return { placed: true, spot: 3 }
                    }
                }
            }

            const { data: waitingMatrices } = await supabase
                .from('matrix_entries')
                .select('*')
                .eq('is_active', true)
                .eq('is_completed', false)
                .order('created_at', { ascending: true })

            if (waitingMatrices && waitingMatrices.length > 0) {
                for (const matrixEntry of waitingMatrices) {
                    if (matrixEntry.user_id === newUserId) continue

                    const spots = [
                        { key: 'spot_2', num: 2 },
                        { key: 'spot_3', num: 3 },
                        { key: 'spot_4', num: 4 },
                        { key: 'spot_5', num: 5 },
                        { key: 'spot_6', num: 6 },
                        { key: 'spot_7', num: 7 }
                    ]

                    for (const spot of spots) {
                        if (!matrixEntry[spot.key]) {
                            await supabase
                                .from('matrix_entries')
                                .update({ [spot.key]: newUserId, updated_at: new Date().toISOString() })
                                .eq('id', matrixEntry.id)

                            if (spot.num <= 3) {
                                await supabase
                                    .from('notifications')
                                    .insert([{
                                        user_id: matrixEntry.user_id,
                                        type: 'free_referral',
                                        title: '🎉 You got a free referral!',
                                        message: `Someone was auto-placed in your matrix spot ${spot.num}!`
                                    }])
                            } else {
                                await supabase
                                    .from('notifications')
                                    .insert([{
                                        user_id: matrixEntry.user_id,
                                        type: 'matrix_growth',
                                        title: '🔷 Your matrix is growing!',
                                        message: `Spot ${spot.num} has been filled in your matrix!`
                                    }])
                            }

                            await checkMatrixCompletion(matrixEntry.id)
                            return { placed: true, spot: spot.num, wasAutoPlaced: true }
                        }
                    }
                }
            }

            return { placed: false }
        } catch (error) {
            console.error('Error finding matrix spot:', error)
            return { placed: false }
        }
    }

    const checkMatrixCompletion = async (matrixId) => {
        try {
            const { data: matrixData } = await supabase
                .from('matrix_entries')
                .select('*')
                .eq('id', matrixId)
                .single()

            if (matrixData && matrixData.spot_2 && matrixData.spot_3 && matrixData.spot_4 &&
                matrixData.spot_5 && matrixData.spot_6 && matrixData.spot_7) {
                await supabase
                    .from('matrix_entries')
                    .update({
                        is_completed: true,
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', matrixId)

                await supabase
                    .from('notifications')
                    .insert([{
                        user_id: matrixData.user_id,
                        type: 'matrix_complete',
                        title: '🎉 Matrix Complete!',
                        message: `Congratulations! Your matrix is complete. Your payout of $${matrixData.payout_amount || settings.matrix_payout} is being processed!`
                    }])
            }
        } catch (error) {
            console.error('Error checking matrix completion:', error)
        }
    }

    const handleJoinMatrix = async () => {
        setJoiningMatrix(true)
        setReferralError(null)

        try {
            if (referredBy.trim()) {
                if (referredBy.trim().toLowerCase() === userData?.username?.toLowerCase()) {
                    setReferralError('You cannot refer yourself.')
                    setJoiningMatrix(false)
                    return
                }

                const { data: users } = await supabase
                    .from('users')
                    .select('id, username')
                    .ilike('username', referredBy.trim())
                    .neq('id', user.id)
                    .limit(1)

                if (!users || users.length === 0) {
                    setReferralError('Username not found. Check spelling or leave blank.')
                    setJoiningMatrix(false)
                    return
                }
            }

            const { error: matrixError } = await supabase
                .from('matrix_entries')
                .insert([{
                    user_id: user.id,
                    campaign_id: campaign.id,
                    spot_1: user.id,
                    is_active: true,
                    is_completed: false,
                    payout_amount: parseInt(settings.matrix_payout),
                    payout_status: 'pending'
                }])

            if (matrixError) throw matrixError

            console.log('Calling findMatrixSpotForUser with:', user.id, referredBy.trim())
            await findMatrixSpotForUser(user.id, referredBy.trim())

            await checkUser()
            setShowJoinMatrix(false)
            setReferredBy('')
            setAgreedToTerms(false)

        } catch (error) {
            console.error('Error joining matrix:', error)
            alert('Error joining matrix: ' + error.message)
        } finally {
            setJoiningMatrix(false)
        }
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
                <div className="mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                        Welcome, {userData?.first_name || userData?.username || 'User'}!
                    </h1>
                </div>

                {notifications.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`bg-slate-800 border rounded-lg p-3 flex items-center justify-between ${notif.type === 'free_referral'
                                    ? 'border-green-500/50'
                                    : 'border-slate-700'
                                    }`}
                            >
                                <div className="flex-1">
                                    <p className={`font-medium text-sm ${notif.type === 'free_referral' ? 'flash-green' : 'text-white'
                                        }`}>
                                        {notif.title}
                                    </p>
                                    <p className="text-slate-400 text-xs">{notif.message}</p>
                                </div>
                                <button
                                    onClick={() => markNotificationRead(notif.id)}
                                    className="text-slate-500 hover:text-white ml-2 text-lg"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Your Referral Name</p>
                        <p className="text-amber-400 font-bold text-sm sm:text-base truncate">{userData?.username || 'N/A'}</p>
                        <p className="text-slate-500 text-xs mt-1">Share this!</p>
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
                            </p>
                        ) : (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]">No Campaign</span>
                            </p>
                        )}
                    </div>
                </div>

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

                {campaign && !matrix && !showJoinMatrix && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">🔷 FREE Bonus: Referral Matrix</h2>
                                <p className="text-slate-300 text-xs mt-1">
                                    Optional thank-you program for referring other advertisers.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowJoinMatrix(true)}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-sm rounded-lg"
                            >
                                Learn More
                            </button>
                        </div>
                    </div>
                )}

                {showJoinMatrix && (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
                        <h2 className="text-base font-bold text-white mb-2">🔷 FREE Bonus: Referral Matrix</h2>

                        <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-sm">
                            <p className="text-slate-300 mb-2">
                                As a <span className="text-amber-400 font-medium">thank you</span> for advertising with us, you can optionally join our referral matrix program at <span className="text-green-400 font-medium">no additional cost</span>.
                            </p>
                            <p className="text-slate-300 mb-2">
                                <strong className="text-white">How it works:</strong> You get your own matrix with 6 spots. When other advertisers join (through your referral or auto-placement), they fill your spots.
                            </p>
                            <p className="text-slate-300">
                                <strong className="text-white">Potential bonus:</strong> If all 6 spots are filled while your campaign is active, you <span className="text-slate-400 italic">may</span> be eligible for a bonus of up to ${settings.matrix_payout}.
                            </p>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto text-xs text-slate-400">
                            <p className="font-bold text-slate-300 mb-2">Terms & Conditions:</p>
                            <p className="mb-2">1. The Referral Matrix is a FREE optional bonus program for advertisers. There is no additional cost to join.</p>
                            <p className="mb-2">2. Participation does NOT guarantee any payout. Bonuses are discretionary and subject to program availability.</p>
                            <p className="mb-2">3. Matrix spots are filled by other paying advertisers. Spot placement depends on referrals and auto-placement availability.</p>
                            <p className="mb-2">4. To be eligible for any potential bonus, your ad campaign must remain active and in good standing.</p>
                            <p className="mb-2">5. ImagineThat reserves the right to modify, suspend, or terminate this program at any time without notice.</p>
                            <p className="mb-2">6. Any bonuses paid are considered promotional rewards and may be subject to applicable taxes.</p>
                            <p>7. By joining, you acknowledge this is a bonus program and not a guaranteed income opportunity.</p>
                        </div>

                        <label className="flex items-start gap-3 mb-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-slate-300 text-sm">
                                By checking this box, I acknowledge that I have read, understood, and agree to the Terms & Conditions. I further acknowledge that this is a voluntary, free bonus program and that payouts are not guaranteed until all specified criteria, including the completion of the matrix, are met.
                            </span>
                        </label>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Who referred you? (Optional)
                            </label>
                            <input
                                type="text"
                                value={referredBy}
                                onChange={(e) => {
                                    setReferredBy(e.target.value)
                                    setReferralError(null)
                                }}
                                className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${referralError ? 'border-red-500' : 'border-slate-600'
                                    }`}
                                placeholder="Enter their exact username"
                            />
                            {referralError && (
                                <p className="text-red-400 text-sm mt-2">
                                    ✗ {referralError}
                                </p>
                            )}
                            <p className="text-slate-400 text-xs mt-2">
                                Enter the exact username of who referred you, or leave blank to be auto-placed.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowJoinMatrix(false)
                                    setReferredBy('')
                                    setAgreedToTerms(false)
                                    setReferralError(null)
                                }}
                                className="flex-1 py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleJoinMatrix}
                                disabled={joiningMatrix || !agreedToTerms}
                                className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {joiningMatrix ? 'Joining...' : 'Join Matrix'}
                            </button>
                        </div>

                        {!agreedToTerms && (
                            <p className="text-amber-400 text-xs text-center mt-2">
                                Please agree to the terms to continue
                            </p>
                        )}
                    </div>
                )}

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

                        <div className="bg-slate-700/30 rounded-lg p-3">
                            <div className="flex justify-center mb-2">
                                <div className="w-16 h-8 bg-amber-500/20 border border-amber-500 rounded flex items-center justify-center">
                                    <span className="text-amber-400 font-bold text-xs">YOU</span>
                                </div>
                            </div>

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