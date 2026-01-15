'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function DashboardPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [campaigns, setCampaigns] = useState([])
    const [matrices, setMatrices] = useState([])
    const [placedUnder, setPlacedUnder] = useState(null)
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
    const [referrerFound, setReferrerFound] = useState(null)
    const [joiningMatrix, setJoiningMatrix] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [bonusHistory, setBonusHistory] = useState([])
    const [tokenBalance, setTokenBalance] = useState({ balance: 0, lifetime_earned: 0, lifetime_spent: 0 })
    const [statsExpanded, setStatsExpanded] = useState(false)
    const [campaignsExpanded, setCampaignsExpanded] = useState(false)
    const [activeExpanded, setActiveExpanded] = useState(true)
    const [historyExpanded, setHistoryExpanded] = useState(false)

    // Collapse/Expand state
    const [expandedCampaigns, setExpandedCampaigns] = useState({})
    const [collapsedMatrices, setCollapsedMatrices] = useState({})

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
    const [swapStep, setSwapStep] = useState(1)
    const [selectedSwapCard, setSelectedSwapCard] = useState(null)

    useEffect(() => {
        checkUser()
    }, [])

    // Auto-open matrix form if coming from success page
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('joinMatrix') === 'true') {
                setShowJoinMatrix(true)
            }
        }
    }, [])

    // Live referrer lookup
    useEffect(() => {
        const lookupReferrer = async () => {
            if (!referredBy.trim()) {
                setReferrerFound(null)
                return
            }

            try {
                const { data: users } = await supabase
                    .from('users')
                    .select('username')
                    .ilike('username', referredBy.trim())
                    .limit(1)

                if (users && users.length > 0) {
                    setReferrerFound(users[0].username)
                    setReferralError(null)
                } else {
                    setReferrerFound(null)
                }
            } catch (error) {
                console.error('Error looking up referrer:', error)
            }
        }

        const timeoutId = setTimeout(lookupReferrer, 500)
        return () => clearTimeout(timeoutId)
    }, [referredBy])

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

            const { data: cardsData } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })

            setBusinessCards(cardsData || [])

            // Fixed: Changed from .maybeSingle() to support multiple matrices
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
                .eq('is_completed', false)
                .order('created_at', { ascending: true })

            setMatrices(matrixData || [])

            // Find who the user is placed under (which matrix they're IN as a spot)
            const { data: placedUnderData } = await supabase
                .from('matrix_entries')
                .select(`
                    id,
                    owner:users!matrix_entries_user_id_fkey (id, username)
                `)
                .or(`spot_2.eq.${authUser.id},spot_3.eq.${authUser.id},spot_4.eq.${authUser.id},spot_5.eq.${authUser.id},spot_6.eq.${authUser.id},spot_7.eq.${authUser.id}`)
                .neq('user_id', authUser.id)
                .limit(1)
                .maybeSingle()

            if (placedUnderData?.owner) {
                setPlacedUnder(placedUnderData.owner.username)
            }

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

            // Fetch token balance
            const { data: tokenData } = await supabase
                .from('bb_balances')
                .select('balance, lifetime_earned, lifetime_spent')
                .eq('user_id', authUser.id)
                .maybeSingle()

            if (tokenData) {
                setTokenBalance(tokenData)
            }

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

    // Updated to accept matrix parameter
    const getFilledSpots = (matrix) => {
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

    // Toggle campaign expand/collapse
    const toggleCampaign = (campaignId) => {
        setExpandedCampaigns(prev => ({
            ...prev,
            [campaignId]: !prev[campaignId]
        }))
    }

    // Toggle matrix collapse/expand
    const toggleMatrix = (matrixId) => {
        setCollapsedMatrices(prev => ({
            ...prev,
            [matrixId]: !prev[matrixId]
        }))
    }

    // Render card thumbnail - shows actual card preview, not emoji
    const renderCardThumbnail = (card) => {
        if (!card) return null

        if (card.card_type === 'uploaded' && card.image_url) {
            return (
                <img
                    src={card.image_url}
                    alt={card.business_name || card.title || 'Card'}
                    className="w-10 h-7 object-cover rounded"
                />
            )
        }

        // Text-based card preview
        return (
            <div
                className="w-10 h-7 rounded flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: card.card_color || '#4F46E5' }}
            >
                <span
                    className="text-[6px] font-bold px-0.5 truncate text-center leading-tight"
                    style={{ color: card.text_color || '#FFFFFF' }}
                >
                    {(card.business_name || card.title || '').substring(0, 10)}
                </span>
            </div>
        )
    }

    // Get campaign number (permanent, based on creation order)
    const getCampaignNumber = (campaignId) => {
        const index = campaigns.findIndex(c => c.id === campaignId)
        return index + 1
    }

    // Split campaigns into active/queued vs history
    const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'queued')
    const historyCampaigns = campaigns.filter(c => c.status === 'completed' || c.status === 'cancelled')

    // Calculate stats
    const totalSpent = campaigns.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0)
    const totalEarned = (parseFloat(userData?.total_earned_matrices) || 0) + (parseFloat(userData?.total_earned_referrals) || 0)
    const profit = Math.max(0, totalEarned - totalSpent)
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length

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

    const openSwapModal = (campaign) => {
        setSwappingCampaign(campaign)
        setSwapStep(1)
        setSelectedSwapCard(null)
    }

    const closeSwapModal = () => {
        setSwappingCampaign(null)
        setSwapStep(1)
        setSelectedSwapCard(null)
    }

    const selectCardForSwap = (card) => {
        setSelectedSwapCard(card)
        setSwapStep(2)
    }

    const handleSwapCard = async () => {
        if (!swappingCampaign || !selectedSwapCard) return

        setSwapProcessing(true)

        try {
            const { error } = await supabase
                .from('ad_campaigns')
                .update({
                    business_card_id: selectedSwapCard.id,
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
                        const { error: updateError } = await supabase
                            .from('matrix_entries')
                            .update({ spot_2: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

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
                            return { placed: true, spot: 2 }
                        }
                    } else if (!referrerMatrix.spot_3) {
                        const { error: updateError } = await supabase
                            .from('matrix_entries')
                            .update({ spot_3: newUserId, updated_at: new Date().toISOString() })
                            .eq('id', referrerMatrix.id)

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
                            return { placed: true, spot: 3 }
                        }
                    } else {
                        const spots = [
                            { key: 'spot_4', num: 4 },
                            { key: 'spot_5', num: 5 },
                            { key: 'spot_6', num: 6 },
                            { key: 'spot_7', num: 7 }
                        ]

                        for (const spot of spots) {
                            if (!referrerMatrix[spot.key]) {
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
                                    return { placed: true, spot: spot.num }
                                }
                            }
                        }
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
                                return { placed: true, spot: spot.num, wasAutoPlaced: true }
                            }
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

    // Render a single campaign row (used for both active and history)
    const renderCampaignRow = (camp, showActions = true) => {
        const isExpanded = expandedCampaigns[camp.id]
        const isActive = camp.status === 'active'
        const campaignNum = getCampaignNumber(camp.id)

        return (
            <div
                key={camp.id}
                className={`bg-${currentTheme.card} border rounded-lg overflow-hidden transition-all ${isActive ? 'border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.3)]' :
                    camp.status === 'queued' ? 'border-yellow-500/50' :
                        camp.status === 'cancelled' ? 'border-red-500/30' :
                            camp.status === 'completed' ? 'border-green-500/30' :
                                `border-${currentTheme.border}`
                    }`}
            >
                {/* Collapsed Header - Always visible */}
                <button
                    onClick={() => toggleCampaign(camp.id)}
                    className="w-full p-2.5 flex items-center gap-2 text-left"
                >
                    <span className="text-sm">{getStatusIcon(camp.status)}</span>

                    {/* Card Thumbnail */}
                    {camp.business_card && renderCardThumbnail(camp.business_card)}

                    {/* Progress bar */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-${currentTheme.text} font-medium text-xs`}>
                                Campaign #{campaignNum}
                            </span>
                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>
                                {Math.round(getViewProgress(camp))}%
                            </span>
                        </div>
                        <div className={`h-1.5 bg-${currentTheme.border} rounded-full overflow-hidden`}>
                            <div
                                className={`h-full rounded-full transition-all ${camp.status === 'completed' ? 'bg-green-500' :
                                    camp.status === 'queued' ? 'bg-yellow-500' :
                                        camp.status === 'cancelled' ? 'bg-red-500' :
                                            'bg-blue-500'
                                    }`}
                                style={{ width: `${getViewProgress(camp)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Expand arrow */}
                    <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className={`px-3 pb-3 border-t border-${currentTheme.border}/50`}>
                        {/* Status badge and view count */}
                        <div className="flex items-center justify-between mt-2 mb-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${camp.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                camp.status === 'queued' ? 'bg-yellow-500/20 text-yellow-400' :
                                    camp.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        camp.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                            `bg-${currentTheme.textMuted}/20 text-${currentTheme.textMuted}`
                                }`}>
                                {getStatusLabel(camp.status)}
                            </span>
                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>
                                {getTotalViews(camp).toLocaleString()} / {camp.views_guaranteed?.toLocaleString()} views
                            </span>
                        </div>

                        {camp.status === 'cancelled' ? (
                            <div className={`text-[10px] text-${currentTheme.textMuted}`}>
                                <p>{camp.views_remaining_at_cancel?.toLocaleString() || (camp.views_guaranteed - getTotalViews(camp)).toLocaleString()} views forfeited</p>
                                <p className="mt-0.5">Cancelled: {new Date(camp.cancelled_at).toLocaleDateString()}</p>
                            </div>
                        ) : (
                            <>
                                {/* View sources - for active and completed */}
                                {(camp.status === 'active' || camp.status === 'completed') && (
                                    <div className={`p-1.5 bg-${currentTheme.border}/30 rounded-lg mb-2`}>
                                        <p className={`text-[10px] text-${currentTheme.textMuted} mb-1`}>Views by source:</p>
                                        <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                                            <div className={`bg-${currentTheme.card} rounded p-1`}>
                                                <p className={`text-${currentTheme.text} font-bold`}>{camp.views_from_game || 0}</p>
                                                <p className={`text-${currentTheme.textMuted}`}>🎮 Games</p>
                                            </div>
                                            <div className={`bg-${currentTheme.card} rounded p-1`}>
                                                <p className={`text-${currentTheme.text} font-bold`}>{camp.views_from_flips || 0}</p>
                                                <p className={`text-${currentTheme.textMuted}`}>👁 Gallery</p>
                                            </div>
                                            <div className={`bg-${currentTheme.card} rounded p-1`}>
                                                <p className={`text-${currentTheme.text} font-bold`}>{camp.views_from_card_back || 0}</p>
                                                <p className={`text-${currentTheme.textMuted}`}>🎰 Slots</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {camp.status === 'queued' && (
                                    <p className="text-[10px] text-yellow-400/70 mb-2">
                                        Waiting for current campaign to complete
                                    </p>
                                )}

                                {/* Action buttons - only for active/queued */}
                                {showActions && (camp.status === 'active' || camp.status === 'queued') && (
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openSwapModal(camp)
                                            }}
                                            className={`flex-1 px-2 py-1 bg-${currentTheme.border} text-${currentTheme.text} text-[10px] rounded hover:bg-${currentTheme.border}/70`}
                                        >
                                            🔄 Swap Card
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                openCancelModal(camp)
                                            }}
                                            className="flex-1 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-[10px] text-red-400 hover:bg-red-500/30"
                                        >
                                            End Early
                                        </button>
                                    </div>
                                )}

                                {getBonusViews(camp) > 0 && (
                                    <div className="mt-2 text-center">
                                        <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/50 rounded-full text-green-400 text-[10px] font-bold">
                                            🎁 +{getBonusViews(camp)} bonus views!
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-3">
                    <div className={`w-8 h-8 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>
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
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-md w-full`}>
                        {cancelStep === 1 ? (
                            <>
                                <div className="text-center mb-3">
                                    <span className="text-3xl">⚠️</span>
                                    <h2 className={`text-lg font-bold text-${currentTheme.text} mt-1`}>End Campaign Early?</h2>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                                    <p className="text-red-400 text-sm">
                                        You have <span className="font-bold">{(cancellingCampaign.views_guaranteed - getTotalViews(cancellingCampaign)).toLocaleString()}</span> views remaining.
                                        These will be forfeited.
                                    </p>
                                    <p className="text-red-400 text-sm mt-1">
                                        <span className="font-bold">No refund</span> will be given.
                                    </p>
                                </div>

                                <div className="mb-3">
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>
                                        Why are you ending this campaign?
                                    </label>
                                    <select
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} text-sm`}
                                    >
                                        <option value="">Select a reason...</option>
                                        <option value="I want to create a new ad.">I want to create a new ad.</option>
                                        <option value="My advertising needs have changed.">My advertising needs have changed.</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={closeCancelModal}
                                        className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.text} font-bold text-sm rounded-lg hover:bg-${currentTheme.card}`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => setCancelStep(2)}
                                        disabled={!cancelReason}
                                        className="flex-1 py-1.5 bg-red-500 text-white font-bold text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-3">
                                    <span className="text-3xl">⚠️</span>
                                    <h2 className={`text-lg font-bold text-${currentTheme.text} mt-1`}>Final Confirmation</h2>
                                </div>

                                <div className="mb-3">
                                    <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>
                                        Type "END CAMPAIGN" to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={cancelConfirmText}
                                        onChange={(e) => setCancelConfirmText(e.target.value.toUpperCase())}
                                        className={`w-full px-2 py-1.5 bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} font-mono text-sm`}
                                        placeholder="END CAMPAIGN"
                                    />
                                </div>

                                <label className="flex items-start gap-2 mb-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={cancelAgreed}
                                        onChange={(e) => setCancelAgreed(e.target.checked)}
                                        className={`w-4 h-4 mt-0.5 rounded border-${currentTheme.border} bg-${currentTheme.border} text-red-500 focus:ring-red-500`}
                                    />
                                    <span className={`text-${currentTheme.textMuted} text-xs`}>
                                        I understand this action cannot be undone and no refund will be given.
                                    </span>
                                </label>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCancelStep(1)}
                                        className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.text} font-bold text-sm rounded-lg hover:bg-${currentTheme.card}`}
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleCancelCampaign}
                                        disabled={cancelConfirmText !== 'END CAMPAIGN' || !cancelAgreed || cancelProcessing}
                                        className="flex-1 py-1.5 bg-red-500 text-white font-bold text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-lg w-full max-h-[80vh] overflow-y-auto`}>
                        {swapStep === 1 ? (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-lg font-bold text-${currentTheme.text}`}>🔄 Swap Card</h2>
                                    <button
                                        onClick={closeSwapModal}
                                        className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-lg`}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <p className={`text-${currentTheme.textMuted} text-xs mb-3`}>
                                    Select a different card to use for this campaign:
                                </p>

                                {businessCards.length === 0 ? (
                                    <div className="text-center py-6">
                                        <p className={`text-${currentTheme.textMuted} text-sm mb-3`}>You don't have any business cards.</p>
                                        <button
                                            onClick={() => {
                                                closeSwapModal()
                                                router.push('/cards')
                                            }}
                                            className={`px-3 py-1.5 bg-${currentTheme.accent} text-white font-bold text-sm rounded-lg`}
                                        >
                                            Create a Card
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {businessCards.map((card) => {
                                            const isCurrentCard = card.id === swappingCampaign.business_card_id
                                            return (
                                                <button
                                                    key={card.id}
                                                    onClick={() => !isCurrentCard && selectCardForSwap(card)}
                                                    disabled={isCurrentCard}
                                                    className={`w-full p-2 rounded-lg border-2 transition-all text-left flex items-center gap-2 ${isCurrentCard
                                                        ? 'border-green-500 bg-green-500/10 cursor-default'
                                                        : `border-${currentTheme.border} hover:border-${currentTheme.accent} hover:bg-${currentTheme.accent}/10`
                                                        }`}
                                                >
                                                    {card.card_type === 'uploaded' && card.image_url ? (
                                                        <img
                                                            src={card.image_url}
                                                            alt={card.business_name || card.title}
                                                            className="w-12 h-9 object-cover rounded"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-12 h-9 rounded flex items-center justify-center"
                                                            style={{ backgroundColor: card.card_color || '#4F46E5' }}
                                                        >
                                                            <span className="text-[10px] font-bold truncate px-1" style={{ color: card.text_color || '#FFFFFF' }}>
                                                                {(card.business_name || card.title || '').substring(0, 8)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-${currentTheme.text} font-medium text-sm truncate`}>
                                                            {card.business_name || card.title}
                                                        </p>
                                                        <p className={`text-${currentTheme.textMuted} text-xs truncate`}>
                                                            {card.tagline || card.message || 'No tagline'}
                                                        </p>
                                                    </div>
                                                    {isCurrentCard && (
                                                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full whitespace-nowrap">
                                                            Current
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                <div className={`mt-3 pt-3 border-t border-${currentTheme.border}`}>
                                    <button
                                        onClick={() => {
                                            closeSwapModal()
                                            router.push('/cards')
                                        }}
                                        className={`w-full py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} font-medium text-sm rounded-lg hover:bg-${currentTheme.card}`}
                                    >
                                        + Create New Card
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-3">
                                    <span className="text-3xl">🔄</span>
                                    <h2 className={`text-lg font-bold text-${currentTheme.text} mt-1`}>Confirm Card Swap</h2>
                                </div>

                                <div className={`bg-${currentTheme.border}/50 rounded-lg p-3 mb-3`}>
                                    <p className={`text-${currentTheme.textMuted} text-xs mb-2`}>You are about to change your campaign's card to:</p>

                                    <div className={`flex items-center gap-2 p-2 bg-${currentTheme.card} rounded-lg border border-${currentTheme.accent}/50`}>
                                        {selectedSwapCard?.card_type === 'uploaded' && selectedSwapCard?.image_url ? (
                                            <img
                                                src={selectedSwapCard.image_url}
                                                alt={selectedSwapCard.business_name || selectedSwapCard.title}
                                                className="w-12 h-9 object-cover rounded"
                                            />
                                        ) : (
                                            <div
                                                className="w-12 h-9 rounded flex items-center justify-center"
                                                style={{ backgroundColor: selectedSwapCard?.card_color || '#4F46E5' }}
                                            >
                                                <span className="text-[10px] font-bold truncate px-1" style={{ color: selectedSwapCard?.text_color || '#FFFFFF' }}>
                                                    {(selectedSwapCard?.business_name || selectedSwapCard?.title || '').substring(0, 8)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-${currentTheme.text} font-medium text-sm truncate`}>
                                                {selectedSwapCard?.business_name || selectedSwapCard?.title}
                                            </p>
                                            <p className={`text-${currentTheme.textMuted} text-xs truncate`}>
                                                {selectedSwapCard?.tagline || selectedSwapCard?.message || 'No tagline'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mb-3">
                                    <p className="text-blue-400 text-xs">
                                        <strong>Note:</strong> This will immediately change which card is displayed. Your view count won't be affected.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSwapStep(1)
                                            setSelectedSwapCard(null)
                                        }}
                                        className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.text} font-bold text-sm rounded-lg hover:bg-${currentTheme.card}`}
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleSwapCard}
                                        disabled={swapProcessing}
                                        className={`flex-1 py-1.5 bg-${currentTheme.accent} text-white font-bold text-sm rounded-lg hover:bg-${currentTheme.accentHover} disabled:opacity-50`}
                                    >
                                        {swapProcessing ? 'Swapping...' : 'Confirm Swap'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-3 py-3 sm:px-4">
                <div className="mb-3">
                    <h1 className={`text-lg sm:text-xl font-bold text-${currentTheme.text}`}>
                        Welcome, {userData?.username || 'User'}!
                    </h1>
                </div>

                {notifications.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`bg-${currentTheme.card} border rounded-lg p-2 flex items-center justify-between ${notif.type === 'free_referral'
                                    ? 'border-green-500/50'
                                    : `border-${currentTheme.border}`
                                    }`}
                            >
                                <div className="flex-1">
                                    <p className={`font-medium text-xs ${notif.type === 'free_referral' ? 'flash-green' : `text-${currentTheme.text}`
                                        }`}>
                                        {notif.title}
                                    </p>
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>{notif.message}</p>
                                </div>
                                <button
                                    onClick={() => markNotificationRead(notif.id)}
                                    className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} ml-2`}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Top Stats Row */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Your Referral Name</p>
                        <p className={`text-${currentTheme.accent} font-bold text-xs truncate`}>{userData?.username || 'N/A'}</p>
                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Share this!</p>
                    </div>
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>Referrals</p>
                        <p className="text-green-400 font-bold text-base">{userData?.simple_referral_count || 0}</p>
                    </div>
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2`}>
                        <p className={`text-${currentTheme.textMuted} text-[10px]`}>🪙 Tokens</p>
                        <p className={`text-yellow-400 font-bold text-base`}>{tokenBalance.balance?.toLocaleString() || 0}</p>
                    </div>
                </div>

                {/* Your Stats Section - Collapsible */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg mb-3 overflow-hidden`}>
                    <button
                        onClick={() => setStatsExpanded(!statsExpanded)}
                        className="w-full p-2.5 flex items-center justify-between text-left"
                    >
                        <span className={`text-${currentTheme.text} font-bold text-sm`}>📊 Your Stats</span>
                        <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${statsExpanded ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>

                    {statsExpanded && (
                        <div className={`px-2.5 pb-2.5 border-t border-${currentTheme.border}/50 pt-2`}>
                            {/* Money Row */}
                            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-2 text-center`}>
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Spent on Ads</p>
                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>${totalSpent.toFixed(0)}</p>
                                </div>
                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-2 text-center`}>
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Referral Profits</p>
                                    <p className="text-green-400 font-bold text-sm">${parseFloat(userData?.total_earned_matrices || 0).toFixed(0)}</p>
                                </div>
                            </div>

                            {/* Campaigns & Matrices Row */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-2 text-center`}>
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Campaigns</p>
                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{completedCampaigns} of {userData?.total_campaigns_run || campaigns.length}</p>
                                </div>
                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-2 text-center`}>
                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Matrices Completed</p>
                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{userData?.total_matrices_completed || 0}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* CAMPAIGNS SECTION - One dropdown with sub-dropdowns */}
                {campaigns.length > 0 ? (
                    <div className="mb-3">
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                            {/* Main Campaigns Header */}
                            <div className="flex items-center justify-between p-2.5">
                                <button
                                    onClick={() => setCampaignsExpanded(!campaignsExpanded)}
                                    className="flex items-center gap-2 text-left flex-1"
                                >
                                    <span className={`text-${currentTheme.text} font-bold text-sm`}>📢 Your Campaigns ({campaigns.length})</span>
                                    <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${campaignsExpanded ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </button>
                                <button
                                    onClick={() => router.push('/advertise')}
                                    className={`px-2 py-1 bg-${currentTheme.accent} text-white font-bold text-[10px] rounded-lg hover:bg-${currentTheme.accentHover}`}
                                >
                                    + Buy Another
                                </button>
                            </div>

                            {campaignsExpanded && (
                                <div className={`border-t border-${currentTheme.border}/50`}>
                                    {/* Active/Queued Sub-dropdown */}
                                    {activeCampaigns.length > 0 && (
                                        <div className={`border-b border-${currentTheme.border}/30`}>
                                            <button
                                                onClick={() => setActiveExpanded(!activeExpanded)}
                                                className="w-full px-3 py-2 flex items-center justify-between text-left"
                                            >
                                                <span className={`text-${currentTheme.text} font-medium text-xs flex items-center gap-2`}>
                                                    🟢 Active ({activeCampaigns.length})
                                                </span>
                                                <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${activeExpanded ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </span>
                                            </button>

                                            {activeExpanded && (
                                                <div className="px-2 pb-2 space-y-2">
                                                    {activeCampaigns.map(camp => renderCampaignRow(camp, true))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* History Sub-dropdown */}
                                    {historyCampaigns.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => setHistoryExpanded(!historyExpanded)}
                                                className="w-full px-3 py-2 flex items-center justify-between text-left"
                                            >
                                                <span className={`text-${currentTheme.text} font-medium text-xs flex items-center gap-2`}>
                                                    📁 History ({historyCampaigns.length})
                                                </span>
                                                <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${historyExpanded ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </span>
                                            </button>

                                            {historyExpanded && (
                                                <div className="px-2 pb-2 space-y-2">
                                                    {historyCampaigns.map(camp => renderCampaignRow(camp, false))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {bonusHistory.length > 0 && (
                            <div className={`mt-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                                <p className={`text-xs font-medium text-${currentTheme.text} mb-2`}>🎁 Bonus Views History</p>
                                <div className="space-y-1.5">
                                    {bonusHistory.map((bonus) => (
                                        <div key={bonus.id} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1.5">
                                            <div>
                                                <p className="text-green-400 font-bold text-xs">+{bonus.amount} views</p>
                                                {bonus.message && (
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>{bonus.message}</p>
                                                )}
                                            </div>
                                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>
                                                {new Date(bonus.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`bg-gradient-to-r from-${currentTheme.accent}/10 to-orange-500/10 border border-${currentTheme.accent}/30 rounded-lg p-3 mb-3`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className={`text-sm font-bold text-${currentTheme.text}`}>🚀 Start Advertising!</h2>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mt-0.5`}>
                                    ${settings.ad_price} for {parseInt(settings.guaranteed_views).toLocaleString()} views
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/advertise')}
                                className={`px-3 py-1.5 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold text-xs rounded-lg`}
                            >
                                Start
                            </button>
                        </div>
                    </div>
                )}

                {/* Join Matrix Banner */}
                {getActiveCampaign() && matrices.length === 0 && !showJoinMatrix && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className={`text-sm font-bold text-${currentTheme.text}`}>🔷 FREE Bonus: Referral Matrix</h2>
                                <p className={`text-${currentTheme.textMuted} text-[10px] mt-0.5`}>
                                    Optional thank-you program for referring advertisers.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowJoinMatrix(true)}
                                className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-xs rounded-lg"
                            >
                                Learn More
                            </button>
                        </div>
                    </div>
                )}

                {/* Join Matrix Form */}
                {showJoinMatrix && (
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-3`}>
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>🔷 FREE Bonus: Referral Matrix</h2>

                        <div className={`bg-${currentTheme.border}/50 rounded-lg p-2 mb-3 text-xs`}>
                            <p className={`text-${currentTheme.textMuted} mb-1.5`}>
                                As a <span className={`text-${currentTheme.accent} font-medium`}>thank you</span> for advertising with us, you can optionally join our referral matrix program at <span className="text-green-400 font-medium">no additional cost</span>.
                            </p>
                            <p className={`text-${currentTheme.textMuted} mb-1.5`}>
                                <strong className={`text-${currentTheme.text}`}>How it works:</strong> You get your own matrix with 6 spots. When other advertisers join, they fill your spots.
                            </p>
                            <p className={`text-${currentTheme.textMuted}`}>
                                <strong className={`text-${currentTheme.text}`}>Potential bonus:</strong> If all 6 spots are filled while your campaign is active, you <span className={`text-${currentTheme.textMuted} italic`}>may</span> be eligible for up to ${settings.matrix_payout}.
                            </p>
                        </div>

                        <div className={`bg-${currentTheme.bg}/50 border border-${currentTheme.border} rounded-lg p-2 mb-3 max-h-24 overflow-y-auto text-[10px] text-${currentTheme.textMuted}`}>
                            <p className={`font-bold text-${currentTheme.textMuted} mb-1`}>Terms & Conditions:</p>
                            <p className="mb-1">1. The Referral Matrix is a FREE optional bonus program. No additional cost to join.</p>
                            <p className="mb-1">2. Participation does NOT guarantee any payout. Bonuses are discretionary.</p>
                            <p className="mb-1">3. Matrix spots are filled by other paying advertisers.</p>
                            <p className="mb-1">4. Your ad campaign must remain active to be eligible.</p>
                            <p className="mb-1">5. ImagineThat reserves the right to modify or terminate this program.</p>
                            <p className="mb-1">6. Any bonuses paid may be subject to applicable taxes.</p>
                            <p>7. This is a bonus program, not a guaranteed income opportunity.</p>
                        </div>

                        <label className="flex items-start gap-2 mb-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className={`w-4 h-4 mt-0.5 rounded border-${currentTheme.border} bg-${currentTheme.border} text-${currentTheme.accent} focus:ring-${currentTheme.accent}`}
                            />
                            <span className={`text-${currentTheme.textMuted} text-[10px]`}>
                                I have read, understood, and agree to the Terms & Conditions. I acknowledge this is a voluntary, free bonus program and payouts are not guaranteed.
                            </span>
                        </label>

                        <div className="mb-3">
                            <label className={`block text-xs font-medium text-${currentTheme.textMuted} mb-1`}>
                                Who referred you? (Optional)
                            </label>
                            <input
                                type="text"
                                value={referredBy}
                                onChange={(e) => {
                                    setReferredBy(e.target.value)
                                    setReferralError(null)
                                    setReferrerFound(null)
                                }}
                                className={`w-full px-2 py-1.5 bg-${currentTheme.border} border rounded-lg text-${currentTheme.text} text-sm placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent} ${referralError ? 'border-red-500' : `border-${currentTheme.border}`
                                    }`}
                                placeholder="Enter their exact username"
                            />
                            {referralError && (
                                <p className="text-red-400 text-xs mt-1">
                                    ✗ {referralError}
                                </p>
                            )}
                            {referrerFound && !referralError && (
                                <p className="text-green-400 text-xs mt-1">
                                    ✓ {referrerFound} found!
                                </p>
                            )}
                            {referredBy.trim() && !referrerFound && !referralError && (
                                <p className="text-yellow-400 text-xs mt-1">
                                    Checking...
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowJoinMatrix(false)
                                    setReferredBy('')
                                    setAgreedToTerms(false)
                                    setReferralError(null)
                                }}
                                className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.text} font-bold text-sm rounded-lg hover:bg-${currentTheme.card} transition-all`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleJoinMatrix}
                                disabled={joiningMatrix || !agreedToTerms}
                                className={`flex-1 py-1.5 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold text-sm rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {joiningMatrix ? 'Joining...' : 'Join Matrix'}
                            </button>
                        </div>

                        {!agreedToTerms && (
                            <p className={`text-${currentTheme.accent} text-[10px] text-center mt-1.5`}>
                                Please agree to the terms to continue
                            </p>
                        )}
                    </div>
                )}

                {/* MATRICES SECTION - Expanded by default, supports multiple */}
                {matrices.length > 0 && (
                    <div className="mb-3">
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-2`}>🔷 Your Matrices</h2>
                        <div className="space-y-2">
                            {matrices.map((matrix, index) => {
                                const isCollapsed = collapsedMatrices[matrix.id]
                                const filledCount = getFilledSpots(matrix)

                                return (
                                    <div
                                        key={matrix.id}
                                        className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}
                                    >
                                        {/* Header - Always visible */}
                                        <button
                                            onClick={() => toggleMatrix(matrix.id)}
                                            className="w-full p-3 flex items-center justify-between text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`text-${currentTheme.text} font-bold text-sm`}>
                                                    Matrix #{index + 1}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matrix.is_completed
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {matrix.is_completed ? '✅ Complete!' : `${filledCount}/6`}
                                                </span>
                                            </div>
                                            <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                                                ▼
                                            </span>
                                        </button>

                                        {/* Expanded Content - Matrix diagram */}
                                        {!isCollapsed && (
                                            <div className={`px-3 pb-3 border-t border-${currentTheme.border}/50`}>
                                                {placedUnder && index === 0 && (
                                                    <p className={`text-${currentTheme.textMuted} text-xs mt-2 mb-2`}>
                                                        You were placed under: <span className={`text-${currentTheme.accent} font-medium`}>{placedUnder}</span>
                                                    </p>
                                                )}

                                                <div className={`bg-${currentTheme.border}/30 rounded-lg p-3 mt-2`}>
                                                    {/* YOU at top */}
                                                    <div className="flex justify-center mb-2">
                                                        <div className={`w-16 h-8 bg-${currentTheme.accent}/20 border border-${currentTheme.accent} rounded flex items-center justify-center`}>
                                                            <span className={`text-${currentTheme.accent} font-bold text-xs`}>YOU</span>
                                                        </div>
                                                    </div>

                                                    {/* Spots 2-3 */}
                                                    <div className="flex justify-center gap-6 mb-2">
                                                        {[2, 3].map(spot => {
                                                            const spotData = matrix[`spot${spot}`]
                                                            return (
                                                                <div
                                                                    key={spot}
                                                                    className={`w-24 h-7 rounded flex items-center justify-center overflow-hidden ${spotData
                                                                        ? 'bg-green-500/20 border border-green-500'
                                                                        : `bg-${currentTheme.border}/50 border border-dashed border-${currentTheme.textMuted}`
                                                                        }`}
                                                                >
                                                                    <span className={`text-xs px-1 truncate ${spotData ? 'text-green-400' : `text-${currentTheme.textMuted}`}`}>
                                                                        {spotData?.username || spot}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    {/* Spots 4-7 */}
                                                    <div className="flex justify-center gap-2">
                                                        {[4, 5, 6, 7].map(spot => {
                                                            const spotData = matrix[`spot${spot}`]
                                                            return (
                                                                <div
                                                                    key={spot}
                                                                    className={`w-20 h-6 rounded flex items-center justify-center overflow-hidden ${spotData
                                                                        ? 'bg-green-500/20 border border-green-500'
                                                                        : `bg-${currentTheme.border}/50 border border-dashed border-${currentTheme.textMuted}`
                                                                        }`}
                                                                >
                                                                    <span className={`text-[10px] px-1 truncate ${spotData ? 'text-green-400' : `text-${currentTheme.textMuted}`}`}>
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
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}