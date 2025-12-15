'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [campaigns, setCampaigns] = useState([])
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
    const [bonusHistory, setBonusHistory] = useState([])

    // Cancel campaign state
    const [cancellingCampaign, setCancellingCampaign] = useState(null)
    const [cancelStep, setCancelStep] = useState(1)
    const [cancelReason, setCancelReason] = useState('')
    const [cancelConfirmText, setCancelConfirmText] = useState('')
    const [cancelAgreed, setCancelAgreed] = useState(false)
    const [cancelProcessing, setCancelProcessing] = useState(false)

    // Card swapping state
    const [businessCards, setBusinessCards] = useState([])
    const [swappingCampaign, setSwappingCampaign] = useState(null)
    const [swapProcessing, setSwapProcessing] = useState(false)

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

            // Fetch campaigns with linked business card info
            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select(`
                    *,
                    business_card:business_cards (
                        id,
                        title,
                        business_name,
                        tagline,
                        image_url,
                        card_color,
                        text_color,
                        card_type
                    )
                `)
                .eq('user_id', authUser.id)
                .in('status', ['active', 'queued', 'completed', 'cancelled'])
                .order('created_at', { ascending: true })

            setCampaigns(campaignData || [])

            // Fetch user's business cards for swapping
            const { data: cardsData } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })

            setBusinessCards(cardsData || [])

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

            const { data: bonusData } = await supabase
                .from('bonus_views_history')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })

            setBonusHistory(bonusData || [])

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

    const getTotalViews = (camp) => {
        if (!camp) return 0
        return (camp.views_from_game || 0) + (camp.views_from_flips || 0)
    }

    const getBonusViews = (camp) => {
        if (!camp) return 0
        return camp.bonus_views || 0
    }

    const getViewProgress = (camp) => {
        if (!camp) return 0
        const total = getTotalViews(camp)
        const guaranteed = camp.views_guaranteed || parseInt(settings.guaranteed_views)
        return Math.min((total / guaranteed) * 100, 100)
    }

    const getActiveCampaign = () => {
        return campaigns.find(c => c.status === 'active') || null
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'active': return '🟢'
            case 'queued': return '🟡'
            case 'completed': return '✅'
            case 'cancelled': return '❌'
            default: return '⚪'
        }
    }

    const getStatusLabel = (status) => {
        switch (status) {
            case 'active': return 'ACTIVE'
            case 'queued': return 'QUEUED'
            case 'completed': return 'COMPLETED'
            case 'cancelled': return 'CANCELLED'
            default: return status.toUpperCase()
        }
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

    // Cancel campaign functions
    const openCancelModal = (campaign) => {
        setCancellingCampaign(campaign)
        setCancelStep(1)
        setCancelReason('')
        setCancelConfirmText('')
        setCancelAgreed(false)
    }

    const closeCancelModal = () => {
        setCancellingCampaign(null)
        setCancelStep(1)
        setCancelReason('')
        setCancelConfirmText('')
        setCancelAgreed(false)
    }

    const handleCancelCampaign = async () => {
        if (cancelConfirmText !== 'END CAMPAIGN' || !cancelAgreed) return

        setCancelProcessing(true)

        try {
            const viewsRemaining = cancellingCampaign.views_guaranteed - getTotalViews(cancellingCampaign)

            const { error } = await supabase
                .from('ad_campaigns')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    cancelled_reason: cancelReason || 'No reason provided',
                    views_remaining_at_cancel: viewsRemaining,
                    cancelled_confirmation: 'END CAMPAIGN',
                    updated_at: new Date().toISOString()
                })
                .eq('id', cancellingCampaign.id)

            if (error) throw error

            await checkUser()
            closeCancelModal()

        } catch (error) {
            console.error('Error cancelling campaign:', error)
            alert('Error cancelling campaign: ' + error.message)
        } finally {
            setCancelProcessing(false)
        }
    }

    // Card swapping functions
    const openSwapModal = (campaign) => {
        setSwappingCampaign(campaign)
    }

    const closeSwapModal = () => {
        setSwappingCampaign(null)
    }

    const handleSwapCard = async (newCardId) => {
        if (!swappingCampaign || !newCardId) return

        setSwapProcessing(true)

        try {
            const { error } = await supabase
                .from('ad_campaigns')
                .update({
                    business_card_id: newCardId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', swappingCampaign.id)

            if (error) throw error

            await checkUser()
            closeSwapModal()

        } catch (error) {
            console.error('Error swapping card:', error)
            alert('Error swapping card: ' + error.message)
        } finally {
            setSwapProcessing(false)
        }
    }

    const findMatrixSpotForUser = async (newUserId, referrerUsername) => {
        console.log('=== findMatrixSpotForUser START ===')
        console.log('newUserId:', newUserId)
        console.log('referrerUsername:', referrerUsername)

        try {
            let referrerId = null

            if (referrerUsername) {
                console.log('Looking up referrer...')
                const { data: users, error: lookupError } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('username', referrerUsername)
                    .limit(1)

                console.log('Referrer lookup result:', users)
                console.log('Referrer lookup error:', lookupError)

                if (users && users.length > 0) {
                    referrerId = users[0].id
                    console.log('Found referrerId:', referrerId)
                }
            }

            console.log('referrerId before matrix lookup:', referrerId)

            if (referrerId) {
                console.log('Looking for referrer matrix...')
                const { data: referrerMatrix, error: matrixError } = await supabase
                    .from('matrix_entries')
                    .select('*')
                    .eq('user_id', referrerId)
                    .eq('is_active', true)
                    .eq('is_completed', false)
                    .maybeSingle()

                console.log('Referrer matrix:', referrerMatrix)
                console.log('Matrix lookup error:', matrixError)

                if (referrerMatrix) {
                    if (!referrerMatrix.spot_2) {
                        console.log('Attempting to place in spot_2...')
                        const { error: updateError } = await supabase
                            .from('matrix_entries')
                            .update({ spot_2: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

                        console.log('Update error:', updateError)

                        if (!updateError) {
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
                            console.log('Successfully placed in spot_2')
                            return { placed: true, spot: 2 }
                        }
                    } else if (!referrerMatrix.spot_3) {
                        console.log('Attempting to place in spot_3...')
                        const { error: updateError } = await supabase
                            .from('matrix_entries')
                            .update({ spot_3: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

                        console.log('Update error:', updateError)

                        if (!updateError) {
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
                            console.log('Successfully placed in spot_3')
                            return { placed: true, spot: 3 }
                        }
                    } else {
                        console.log('Spots 2 and 3 are full, trying spots 4-7...')
                        const spots = [
                            { key: 'spot_4', num: 4 },
                            { key: 'spot_5', num: 5 },
                            { key: 'spot_6', num: 6 },
                            { key: 'spot_7', num: 7 }
                        ]

                        for (const spot of spots) {
                            if (!referrerMatrix[spot.key]) {
                                console.log(`Attempting to place in ${spot.key}...`)
                                const { error: updateError } = await supabase
                                    .from('matrix_entries')
                                    .update({ [spot.key]: newUserId, updated_at: new Date().toISOString() })
                                    .eq('id', referrerMatrix.id)

                                if (!updateError) {
                                    await supabase
                                        .from('notifications')
                                        .insert([{
                                            user_id: referrerId,
                                            type: 'matrix_growth',
                                            title: '🔷 Your matrix is growing!',
                                            message: `Spot ${spot.num} has been filled in your matrix!`
                                        }])

                                    await checkMatrixCompletion(referrerMatrix.id)
                                    console.log(`Successfully placed in ${spot.key}`)
                                    return { placed: true, spot: spot.num }
                                }
                            }
                        }
                    }
                }
            }

            // Auto-place in oldest waiting matrix
            console.log('Auto-placing in oldest waiting matrix...')
            const { data: waitingMatrices } = await supabase
                .from('matrix_entries')
                .select('*')
                .eq('is_active', true)
                .eq('is_completed', false)
                .order('created_at', { ascending: true })

            console.log('Waiting matrices found:', waitingMatrices?.length)

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
                            console.log(`Auto-placing in matrix ${matrixEntry.id}, ${spot.key}...`)
                            const { error: updateError } = await supabase
                                .from('matrix_entries')
                                .update({ [spot.key]: newUserId, updated_at: new Date().toISOString() })
                                .eq('id', matrixEntry.id)

                            if (!updateError) {
                                if (spot.num <= 3) {
                                    await supabase
                                        .from('notifications')
                                        .insert([{
                                            user_id: matrixEntry.user_id,
                                            type: 'free_referral',
                                            title: '🎉 You got a free referral!',
                                            message: `Someone was auto-placed in your matrix spot ${spot.num}!`
                                        }])
                                }
                                await checkMatrixCompletion(matrixEntry.id)
                                console.log('Auto-placement successful')
                                return { placed: true, spot: spot.num, wasAutoPlaced: true }
                            }
                        }
                    }
                }
            }

            console.log('No placement made')
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
            const activeCampaign = getActiveCampaign()

            if (!activeCampaign) {
                setReferralError('You need an active campaign to join the matrix.')
                setJoiningMatrix(false)
                return
            }

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
                    campaign_id: activeCampaign.id,
                    spot_1: user.id,
                    is_active: true,
                    is_completed: false,
                    payout_amount: parseInt(settings.matrix_payout),
                    payout_status: 'pending'
                }])

            if (matrixError) throw matrixError

            console.log('Calling findMatrixSpotForUser with:', user.id, referredBy.trim())
            const result = await findMatrixSpotForUser(user.id, referredBy.trim())
            console.log('findMatrixSpotForUser result:', result)

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

            {/* Cancel Campaign Modal */}
            {cancellingCampaign && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
                        {cancelStep === 1 ? (
                            <>
                                <div className="text-center mb-4">
                                    <span className="text-4xl">⚠️</span>
                                    <h2 className="text-xl font-bold text-white mt-2">End Campaign Early?</h2>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                                    <p className="text-red-400 text-sm">
                                        You have <span className="font-bold">{(cancellingCampaign.views_guaranteed - getTotalViews(cancellingCampaign)).toLocaleString()}</span> views remaining.
                                        These will be forfeited.
                                    </p>
                                    <p className="text-red-400 text-sm mt-2">
                                        <span className="font-bold">No refund</span> will be given.
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Why are you ending this campaign?
                                    </label>
                                    <select
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                    >
                                        <option value="">Select a reason...</option>
                                        <option value="I want to create a new ad.">I want to create a new ad.</option>
                                        <option value="My advertising needs have changed.">My advertising needs have changed.</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={closeCancelModal}
                                        className="flex-1 py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => setCancelStep(2)}
                                        disabled={!cancelReason}
                                        className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        I Understand, Continue
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <span className="text-4xl">⚠️</span>
                                    <h2 className="text-xl font-bold text-white mt-2">Final Confirmation</h2>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Type "END CAMPAIGN" to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={cancelConfirmText}
                                        onChange={(e) => setCancelConfirmText(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                                        placeholder="END CAMPAIGN"
                                    />
                                </div>

                                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={cancelAgreed}
                                        onChange={(e) => setCancelAgreed(e.target.checked)}
                                        className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="text-slate-300 text-sm">
                                        I understand this action cannot be undone and no refund will be given.
                                    </span>
                                </label>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCancelStep(1)}
                                        className="flex-1 py-2 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleCancelCampaign}
                                        disabled={cancelConfirmText !== 'END CAMPAIGN' || !cancelAgreed || cancelProcessing}
                                        className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {cancelProcessing ? 'Processing...' : 'End Campaign'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Swap Card Modal */}
            {swappingCampaign && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">🔄 Swap Card</h2>
                            <button
                                onClick={closeSwapModal}
                                className="text-slate-400 hover:text-white text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-slate-400 text-sm mb-4">
                            Select a different card to use for this campaign:
                        </p>

                        {businessCards.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-slate-400 mb-4">You don't have any business cards.</p>
                                <button
                                    onClick={() => {
                                        closeSwapModal()
                                        router.push('/cards')
                                    }}
                                    className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg"
                                >
                                    Create a Card
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {businessCards.map((card) => {
                                    const isCurrentCard = card.id === swappingCampaign.business_card_id
                                    return (
                                        <button
                                            key={card.id}
                                            onClick={() => !isCurrentCard && handleSwapCard(card.id)}
                                            disabled={isCurrentCard || swapProcessing}
                                            className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${isCurrentCard
                                                ? 'border-green-500 bg-green-500/10 cursor-default'
                                                : 'border-slate-600 hover:border-amber-500 hover:bg-amber-500/10'
                                                } ${swapProcessing ? 'opacity-50' : ''}`}
                                        >
                                            {card.card_type === 'uploaded' && card.image_url ? (
                                                <img
                                                    src={card.image_url}
                                                    alt={card.business_name || card.title}
                                                    className="w-16 h-12 object-cover rounded"
                                                />
                                            ) : (
                                                <div
                                                    className="w-16 h-12 rounded flex items-center justify-center"
                                                    style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                                >
                                                    <span className="text-xs font-bold truncate px-1" style={{ color: card.text_color || '#FFFFFF' }}>
                                                        {(card.business_name || card.title || '').substring(0, 8)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">
                                                    {card.business_name || card.title}
                                                </p>
                                                <p className="text-slate-400 text-xs truncate">
                                                    {card.tagline || card.message || 'No tagline'}
                                                </p>
                                            </div>
                                            {isCurrentCard && (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full whitespace-nowrap">
                                                    Current
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <button
                                onClick={() => router.push('/cards')}
                                className="w-full py-2 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600"
                            >
                                + Create New Card
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6">
                <div className="mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                        Welcome, {userData?.username || 'User'}!
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
                        <p className="text-slate-400 text-xs">Campaign Status</p>
                        {getActiveCampaign() ? (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]">Active</span>
                            </p>
                        ) : campaigns.some(c => c.status === 'queued') ? (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">Queued</span>
                            </p>
                        ) : (
                            <p className="font-bold text-xs sm:text-sm">
                                <span className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]">Not Active</span>
                            </p>
                        )}
                    </div>
                </div>

                {campaigns.length > 0 ? (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-white">📢 Your Ad Campaigns</h2>
                            <button
                                onClick={() => router.push('/advertise')}
                                className="px-3 py-1 bg-amber-500 text-slate-900 font-bold text-xs rounded-lg hover:bg-amber-400"
                            >
                                + Buy Another
                            </button>
                        </div>
                        <div className="space-y-3">
                            {campaigns.map((camp, index) => (
                                <div key={camp.id} className={`bg-slate-800 border rounded-lg p-4 ${camp.status === 'active' ? 'border-green-500/50' :
                                    camp.status === 'queued' ? 'border-yellow-500/50' :
                                        camp.status === 'cancelled' ? 'border-red-500/50' :
                                            'border-slate-700'
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span>{getStatusIcon(camp.status)}</span>
                                            <span className="text-white font-medium text-sm">Campaign {index + 1}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${camp.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            camp.status === 'queued' ? 'bg-yellow-500/20 text-yellow-400' :
                                                camp.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                                    camp.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {getStatusLabel(camp.status)}
                                        </span>
                                    </div>

                                    {/* Show linked card */}
                                    {camp.business_card && (camp.status === 'active' || camp.status === 'queued') && (
                                        <div className="mb-3 p-2 bg-slate-700/50 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {camp.business_card.card_type === 'uploaded' && camp.business_card.image_url ? (
                                                    <img
                                                        src={camp.business_card.image_url}
                                                        alt="Card"
                                                        className="w-10 h-8 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-10 h-8 rounded flex items-center justify-center"
                                                        style={{ backgroundColor: camp.business_card.card_color || '#4F46E5' }}
                                                    >
                                                        <span className="text-xs" style={{ color: camp.business_card.text_color || '#FFF' }}>🃏</span>
                                                    </div>
                                                )}
                                                <span className="text-slate-300 text-xs truncate max-w-[120px]">
                                                    {camp.business_card.business_name || camp.business_card.title}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => openSwapModal(camp)}
                                                className="text-xs text-amber-400 hover:text-amber-300 underline"
                                            >
                                                Swap Card
                                            </button>
                                        </div>
                                    )}

                                    {camp.status === 'cancelled' ? (
                                        <div className="text-xs text-slate-400">
                                            <p>{getTotalViews(camp).toLocaleString()} / {camp.views_guaranteed?.toLocaleString()} views ({camp.views_remaining_at_cancel?.toLocaleString() || (camp.views_guaranteed - getTotalViews(camp)).toLocaleString()} forfeited)</p>
                                            <p className="mt-1">Cancelled: {new Date(camp.cancelled_at).toLocaleDateString()}</p>
                                            {camp.cancelled_reason && (
                                                <p className="mt-1 text-slate-500">Reason: {camp.cancelled_reason}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-2">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-400">
                                                        {getTotalViews(camp).toLocaleString()} / {camp.views_guaranteed?.toLocaleString()} views
                                                    </span>
                                                    <span className="text-slate-400">{Math.round(getViewProgress(camp))}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${camp.status === 'completed' ? 'bg-green-500' :
                                                            camp.status === 'queued' ? 'bg-yellow-500' :
                                                                'bg-amber-500'
                                                            }`}
                                                        style={{ width: `${getViewProgress(camp)}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {camp.status === 'active' && (
                                                <div className="flex gap-4 text-xs text-slate-400">
                                                    <span>Game: {camp.views_from_game || 0}</span>
                                                    <span>Flips: {camp.views_from_flips || 0}</span>
                                                    <span>Card Backs: {camp.views_from_card_back || 0}</span>
                                                </div>
                                            )}

                                            {camp.status === 'queued' && (
                                                <p className="text-xs text-yellow-400/70 mt-1">
                                                    Waiting for current campaign to complete
                                                </p>
                                            )}

                                            {getBonusViews(camp) > 0 && (
                                                <span className="inline-block mt-2 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-green-400 text-xs font-bold">
                                                    🎁 +{getBonusViews(camp)} bonus views!
                                                </span>
                                            )}

                                            {/* End Campaign Button */}
                                            {(camp.status === 'active' || camp.status === 'queued') && (
                                                <button
                                                    onClick={() => openCancelModal(camp)}
                                                    className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
                                                >
                                                    End Campaign Early
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {bonusHistory.length > 0 && (
                            <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-4">
                                <p className="text-sm font-medium text-white mb-2">🎁 Bonus Views History</p>
                                <div className="space-y-2">
                                    {bonusHistory.map((bonus) => (
                                        <div key={bonus.id} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                                            <div>
                                                <p className="text-green-400 font-bold text-sm">+{bonus.amount} views</p>
                                                {bonus.message && (
                                                    <p className="text-slate-300 text-xs">{bonus.message}</p>
                                                )}
                                            </div>
                                            <span className="text-slate-500 text-xs">
                                                {new Date(bonus.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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

                {getActiveCampaign() && !matrix && !showJoinMatrix && (
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
                                            className={`w-24 h-7 rounded flex items-center justify-center ${spotData
                                                ? 'bg-green-500/20 border border-green-500'
                                                : 'bg-slate-600/50 border border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-xs ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username || spot}
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
                                            className={`w-24 h-6 rounded flex items-center justify-center ${spotData
                                                ? 'bg-green-500/20 border border-green-500'
                                                : 'bg-slate-600/50 border border-dashed border-slate-500'
                                                }`}
                                        >
                                            <span className={`text-xs ${spotData ? 'text-green-400' : 'text-slate-500'}`}>
                                                {spotData?.username || spot}
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