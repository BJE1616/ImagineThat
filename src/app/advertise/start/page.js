'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function AdvertisePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200'
    })
    const [paymentMethod, setPaymentMethod] = useState('')
    const [paymentHandle, setPaymentHandle] = useState('')
    const [payoutMethod, setPayoutMethod] = useState('')
    const [payoutHandle, setPayoutHandle] = useState('')
    const [message, setMessage] = useState('')

    const [businessCards, setBusinessCards] = useState([])
    const [selectedCardId, setSelectedCardId] = useState(null)

    const [step, setStep] = useState(1)
    const [campaignId, setCampaignId] = useState(null)
    const [joinMatrix, setJoinMatrix] = useState(false)
    const [referredBy, setReferredBy] = useState('')
    const [referrerName, setReferrerName] = useState(null)
    const [referrerNotFound, setReferrerNotFound] = useState(false)
    const [previewCard, setPreviewCard] = useState(null)

    useEffect(() => {
        checkUser()
    }, [])

    const selectedCard = businessCards.find(c => c.id === selectedCardId)

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

            // Pre-fill payout method from profile if exists
            if (userDataResult?.payout_method) {
                setPayoutMethod(userDataResult.payout_method)
                setPayoutHandle(userDataResult.payout_handle || '')
            }

            const { data: cardData } = await supabase
                .from('business_cards')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })

            setBusinessCards(cardData || [])

            if (cardData && cardData.length > 0) {
                setSelectedCardId(cardData[0].id)
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

    const lookupReferrer = async (username) => {
        if (!username || username.length < 2) {
            setReferrerName(null)
            setReferrerNotFound(false)
            return
        }

        if (username.toLowerCase() === userData?.username?.toLowerCase()) {
            setReferrerName(null)
            setReferrerNotFound(true)
            return
        }

        try {
            const { data: userResult, error: userError } = await supabase
                .from('users')
                .select('id, username, first_name')
                .ilike('username', username)
                .maybeSingle()

            if (userError || !userResult) {
                setReferrerName(null)
                setReferrerNotFound(true)
                return
            }

            setReferrerName(userResult.first_name || userResult.username)
            setReferrerNotFound(false)
        } catch (error) {
            console.error('Referrer lookup error:', error)
            setReferrerName(null)
            setReferrerNotFound(true)
        }
    }

    const handleReferralChange = (e) => {
        const value = e.target.value
        setReferredBy(value)
        if (value.length >= 2) {
            lookupReferrer(value)
        } else {
            setReferrerName(null)
            setReferrerNotFound(false)
        }
    }

    // Helper function to send spot filled email
    const sendSpotFilledEmail = async (matrixOwnerId, newUserId, spotNumber, matrix) => {
        try {
            // Get matrix owner info
            const { data: ownerData } = await supabase
                .from('users')
                .select('email, first_name, username')
                .eq('id', matrixOwnerId)
                .single()

            // Get new member info
            const { data: newMemberData } = await supabase
                .from('users')
                .select('first_name, username')
                .eq('id', newUserId)
                .single()

            if (ownerData && newMemberData) {
                // Count filled spots
                const filledCount = [matrix.spot_2, matrix.spot_3, matrix.spot_4, matrix.spot_5, matrix.spot_6, matrix.spot_7]
                    .filter(spot => spot !== null).length + 1 // +1 for the spot we just filled

                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'matrix_spot_filled',
                        to: ownerData.email,
                        data: {
                            first_name: ownerData.first_name || ownerData.username,
                            new_member_name: newMemberData.first_name || newMemberData.username,
                            spot_number: spotNumber,
                            filled_count: filledCount,
                            spots_remaining: 6 - filledCount,
                            payout_amount: matrix.payout_amount || settings.matrix_payout
                        }
                    })
                })
            }
        } catch (emailError) {
            console.error('Spot filled email error:', emailError)
        }
    }

    const findMatrixSpotForUser = async (newUserId, referrerUsername) => {
        try {
            let referrerId = null

            if (referrerUsername) {
                const { data: referrer } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('username', referrerUsername)
                    .single()

                if (referrer) {
                    referrerId = referrer.id
                }
            }

            if (referrerId) {
                const { data: referrerMatrix } = await supabase
                    .from('matrix_entries')
                    .select('*')
                    .eq('user_id', referrerId)
                    .eq('is_active', true)
                    .eq('is_completed', false)
                    .single()

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
                                title: '🎉 Your referral became an advertiser!',
                                message: 'They\'ve been added to your matrix in spot 2!'
                            }])

                        // Send email to matrix owner
                        await sendSpotFilledEmail(referrerId, newUserId, 2, referrerMatrix)

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
                                title: '🎉 Your referral became an advertiser!',
                                message: 'They\'ve been added to your matrix in spot 3!'
                            }])

                        // Send email to matrix owner
                        await sendSpotFilledEmail(referrerId, newUserId, 3, referrerMatrix)

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
                for (const matrix of waitingMatrices) {
                    if (matrix.user_id === newUserId) continue

                    const spots = [
                        { key: 'spot_2', num: 2 },
                        { key: 'spot_3', num: 3 },
                        { key: 'spot_4', num: 4 },
                        { key: 'spot_5', num: 5 },
                        { key: 'spot_6', num: 6 },
                        { key: 'spot_7', num: 7 }
                    ]

                    for (const spot of spots) {
                        if (!matrix[spot.key]) {
                            await supabase
                                .from('matrix_entries')
                                .update({ [spot.key]: newUserId, updated_at: new Date().toISOString() })
                                .eq('id', matrix.id)

                            if (spot.num <= 3) {
                                await supabase
                                    .from('notifications')
                                    .insert([{
                                        user_id: matrix.user_id,
                                        type: 'free_referral',
                                        title: '🎉 You got a free referral!',
                                        message: `Someone was auto-placed in your matrix spot ${spot.num}!`
                                    }])
                            } else {
                                await supabase
                                    .from('notifications')
                                    .insert([{
                                        user_id: matrix.user_id,
                                        type: 'matrix_growth',
                                        title: '🔷 Your matrix is growing!',
                                        message: `Spot ${spot.num} has been filled in your matrix!`
                                    }])
                            }

                            // Send email to matrix owner
                            await sendSpotFilledEmail(matrix.user_id, newUserId, spot.num, matrix)

                            await checkMatrixCompletion(matrix.id)
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
            const { data: matrix } = await supabase
                .from('matrix_entries')
                .select('*')
                .eq('id', matrixId)
                .single()

            if (matrix && matrix.spot_2 && matrix.spot_3 && matrix.spot_4 &&
                matrix.spot_5 && matrix.spot_6 && matrix.spot_7) {
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
                        user_id: matrix.user_id,
                        type: 'matrix_complete',
                        title: '🎉 Matrix Complete!',
                        message: `Congratulations! Your matrix is complete. Your payout of $${matrix.payout_amount || settings.matrix_payout} is being processed!`
                    }])

                try {
                    const { data: matrixUser } = await supabase
                        .from('users')
                        .select('email, first_name')
                        .eq('id', matrix.user_id)
                        .single()

                    // Count user's completed matrices
                    const { count: matrixCount } = await supabase
                        .from('matrix_entries')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', matrix.user_id)
                        .eq('is_completed', true)

                    if (matrixUser) {
                        await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'matrix_completed',
                                to: matrixUser.email,
                                data: {
                                    first_name: matrixUser.first_name || 'there',
                                    matrix_number: matrixCount || 1,
                                    payout: matrix.payout_amount || settings.matrix_payout
                                }
                            })
                        })
                    }
                } catch (emailError) {
                    console.error('Matrix complete email error:', emailError)
                }
            }
        } catch (error) {
            console.error('Error checking matrix completion:', error)
        }
    }

    const handlePurchase = async () => {
        setProcessing(true)
        setMessage('')

        try {
            // Save payout preferences to user profile
            await supabase
                .from('users')
                .update({
                    payout_method: payoutMethod,
                    payout_handle: payoutHandle
                })
                .eq('id', user.id)

            const { data: existingCampaigns } = await supabase
                .from('ad_campaigns')
                .select('id')
                .eq('user_id', user.id)
                .in('status', ['active', 'queued'])

            const hasExisting = existingCampaigns && existingCampaigns.length > 0
            const newStatus = hasExisting ? 'queued' : 'active'

            const { data: campaign, error: campaignError } = await supabase
                .from('ad_campaigns')
                .insert([{
                    user_id: user.id,
                    business_card_id: selectedCardId,
                    payment_method: paymentMethod,
                    amount_paid: parseInt(settings.ad_price),
                    views_guaranteed: parseInt(settings.guaranteed_views),
                    views_from_game: 0,
                    views_from_flips: 0,
                    bonus_views: 0,
                    status: newStatus
                }])
                .select()
                .single()

            if (campaignError) throw campaignError

            setCampaignId(campaign.id)

            // Send receipt email for all purchases
            try {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'ad_campaign_receipt',
                        to: userData.email,
                        data: {
                            first_name: userData.username,
                            campaign_tier: 'Standard',
                            amount: settings.ad_price,
                            payment_method: paymentMethod,
                            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                            order_number: campaign.id.slice(0, 8).toUpperCase(),
                            views_guaranteed: parseInt(settings.guaranteed_views).toLocaleString()
                        }
                    })
                })
            } catch (emailError) {
                console.error('Ad campaign receipt email error:', emailError)
            }

            if (newStatus === 'active') {
                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'campaign_activated',
                            to: userData.email,
                            data: {
                                username: userData.username,
                                views: parseInt(settings.guaranteed_views)
                            }
                        })
                    })
                } catch (emailError) {
                    console.error('Campaign activated email error:', emailError)
                }
            }

            setStep(5) // Go to matrix choice

        } catch (error) {
            setMessage('Error: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    const handleMatrixChoice = (wantsMatrix) => {
        setJoinMatrix(wantsMatrix)
        if (wantsMatrix) {
            setStep(6)
        } else {
            finishWithoutMatrix()
        }
    }

    const finishWithoutMatrix = () => {
        setMessage('✓ Campaign created! Redirecting to dashboard...')
        setTimeout(() => router.push('/dashboard'), 2000)
    }

    const handleJoinMatrix = async () => {
        setProcessing(true)

        try {
            const { error: matrixError } = await supabase
                .from('matrix_entries')
                .insert([{
                    user_id: user.id,
                    campaign_id: campaignId,
                    spot_1: user.id,
                    is_active: true,
                    is_completed: false,
                    payout_amount: parseInt(settings.matrix_payout),
                    payout_status: 'pending'
                }])

            if (matrixError) throw matrixError

            // Send matrix_joined email to user
            try {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'matrix_joined',
                        to: userData.email,
                        data: {
                            first_name: userData.first_name || userData.username,
                            username: userData.username,
                            payout_amount: settings.matrix_payout
                        }
                    })
                })
            } catch (emailError) {
                console.error('Matrix joined email error:', emailError)
            }

            await findMatrixSpotForUser(user.id, referredBy)

            setMessage('✓ You joined the matrix! Redirecting to dashboard...')
            setTimeout(() => router.push('/dashboard'), 2000)

        } catch (error) {
            setMessage('Error: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    // Calculate dynamic font size based on text length
    const getDynamicFontSize = (text, maxSize, minSize, maxLength) => {
        if (!text) return maxSize
        const length = text.length
        if (length <= maxLength * 0.5) return maxSize
        if (length >= maxLength) return minSize
        const ratio = (length - maxLength * 0.5) / (maxLength * 0.5)
        return maxSize - (ratio * (maxSize - minSize))
    }

    // Render card preview (works for both image and text-based cards)
    const renderCardPreview = (card, size = 'large') => {
        if (card.image_url) {
            return (
                <img
                    src={card.image_url}
                    alt={card.business_name}
                    className={`${size === 'large' ? 'w-full h-full' : 'w-full h-full'} object-cover rounded-lg`}
                    style={{ transform: `rotate(${card.image_rotation || 0}deg)` }}
                />
            )
        }

        // Text-based card
        const displayName = card.display_name || card.business_name || card.title || 'Card'
        return (
            <div
                className={`${size === 'large' ? 'w-full h-full p-4' : 'w-full h-full p-1'} rounded-lg flex flex-col justify-center items-center`}
                style={{
                    backgroundColor: card.card_color || '#1e293b',
                    color: card.text_color || '#ffffff'
                }}
            >
                {size === 'large' ? (
                    <>
                        {card.full_business_name || card.business_name ? (
                            <h4 className="font-bold text-lg mb-1 text-center">{card.full_business_name || card.business_name}</h4>
                        ) : null}
                        {card.tagline || card.message ? (
                            <p className="text-sm opacity-80 mb-2 text-center">{card.tagline || card.message}</p>
                        ) : null}
                        <div className="mt-3 text-xs opacity-70 space-y-1 text-center">
                            {card.phone && <p>📞 {card.phone}</p>}
                            {card.email && <p>✉️ {card.email}</p>}
                            {card.website_url && <p>🌐 {card.website_url}</p>}
                        </div>
                    </>
                ) : (
                    <span
                        className="font-bold text-center leading-tight"
                        style={{ fontSize: `${getDynamicFontSize(displayName, 11, 7, 20)}px` }}
                    >
                        {displayName}
                    </span>
                )}
            </div>
        )
    }

    // Step indicator component
    const StepIndicator = () => {
        const steps = [
            { num: 1, label: 'Card' },
            { num: 2, label: 'Pay' },
            { num: 3, label: 'Payout' },
            { num: 4, label: 'Review' }
        ]

        return (
            <div className="flex items-center justify-center gap-1 mb-6">
                {steps.map((s, idx) => (
                    <div key={s.num} className="flex items-center">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${step === s.num
                            ? `bg-${currentTheme.accent} text-white`
                            : step > s.num
                                ? 'bg-green-500 text-white'
                                : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                            }`}>
                            {step > s.num ? '✓' : s.num}
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 ${step > s.num ? 'bg-green-500' : `bg-${currentTheme.border}`}`} />
                        )}
                    </div>
                ))}
            </div>
        )
    }

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className={`w-10 h-10 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
            </div>
        )
    }

    // No cards - prompt to create one
    if (businessCards.length === 0) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto text-center">
                    <span className="text-5xl mb-4 block">🃏</span>
                    <h2 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>Create Your Business Card First</h2>
                    <p className={`text-${currentTheme.textMuted} mb-6`}>
                        Before you can start advertising, you need to create your business card.
                    </p>
                    <button
                        onClick={() => router.push('/cards?returnTo=campaign')}
                        className={`px-6 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg`}
                    >
                        Create Business Card
                    </button>
                </div>
            </div>
        )
    }

    // ==================== STEP 1: SELECT CARD ====================
    if (step === 1) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 1: Select Your Card</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            Choose which business card to use for this campaign.
                        </p>

                        {/* Selected Card Preview */}
                        <div className="mb-4">
                            <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Selected Card:</p>
                            <div
                                className={`aspect-[3/2] max-w-xs mx-auto rounded-lg overflow-hidden border-2 border-${currentTheme.accent} cursor-pointer hover:opacity-90 transition-opacity`}
                                onClick={() => selectedCard && setPreviewCard(selectedCard)}
                            >
                                {selectedCard ? renderCardPreview(selectedCard, 'large') : (
                                    <div className={`w-full h-full bg-${currentTheme.border} flex items-center justify-center`}>
                                        <span className="text-4xl">🃏</span>
                                    </div>
                                )}
                            </div>
                            {selectedCard && (
                                <p className={`text-center text-${currentTheme.accent} text-xs mt-2 cursor-pointer hover:underline`} onClick={() => setPreviewCard(selectedCard)}>
                                    👁 Click to preview full card
                                </p>
                            )}
                        </div>

                        {/* Card Selector (if multiple) */}
                        {businessCards.length > 1 && (
                            <div className="mb-4">
                                <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Your Cards ({businessCards.length}/5):</p>
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {businessCards.map((card) => (
                                        <button
                                            key={card.id}
                                            onClick={() => setSelectedCardId(card.id)}
                                            className={`w-16 h-12 rounded-lg border-2 overflow-hidden transition-all ${selectedCardId === card.id
                                                ? `border-${currentTheme.accent} ring-2 ring-${currentTheme.accent}/50`
                                                : `border-${currentTheme.border} opacity-60 hover:opacity-100`
                                                }`}
                                        >
                                            {renderCardPreview(card, 'small')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info text */}
                        <div className={`bg-${currentTheme.bg} rounded-lg p-3 mb-4`}>
                            <p className={`text-xs text-${currentTheme.textMuted}`}>
                                📝 You can have up to <strong>5 card designs</strong>. You can delete inactive cards to make room for new ones.
                            </p>
                        </div>

                        {/* Create new card option */}
                        <button
                            onClick={() => router.push('/cards?returnTo=campaign')}
                            className={`w-full py-2 mb-4 border border-dashed border-${currentTheme.border} rounded-lg text-${currentTheme.textMuted} text-sm hover:border-${currentTheme.accent} hover:text-${currentTheme.text} transition-all`}
                        >
                            + Create New Card
                        </button>

                        {/* Continue button */}
                        <button
                            onClick={() => setStep(2)}
                            disabled={!selectedCardId}
                            className={`w-full py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                        >
                            Use This Card →
                        </button>
                    </div>
                </div>

                {/* Card Preview Modal */}
                {previewCard && (
                    <div
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => setPreviewCard(null)}
                    >
                        <div
                            className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-sm w-full`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className={`font-bold text-${currentTheme.text}`}>Full Card Preview</h3>
                                <button
                                    onClick={() => setPreviewCard(null)}
                                    className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-xl`}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="aspect-[3/2] rounded-lg overflow-hidden">
                                {renderCardPreview(previewCard, 'large')}
                            </div>
                            <button
                                onClick={() => { setSelectedCardId(previewCard.id); setPreviewCard(null); }}
                                className={`w-full mt-4 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg text-sm`}
                            >
                                Use This Card
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ==================== STEP 2: PAYMENT METHOD ====================
    if (step === 2) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 2: Payment Method</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            How would you like to pay for this campaign?
                        </p>

                        {/* Package Summary */}
                        <div className={`bg-gradient-to-br from-${currentTheme.accent}/20 to-orange-500/20 border border-${currentTheme.accent}/30 rounded-lg p-3 mb-4`}>
                            <div className="flex justify-between items-center">
                                <span className={`text-${currentTheme.text} font-medium`}>Standard Campaign</span>
                                <span className={`text-${currentTheme.accent} font-bold text-xl`}>${settings.ad_price}</span>
                            </div>
                            <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>
                                {parseInt(settings.guaranteed_views).toLocaleString()} guaranteed views
                            </p>
                        </div>

                        {/* Payment Options */}
                        <div className="space-y-2 mb-4">
                            <button
                                onClick={() => { setPaymentMethod('stripe'); setPaymentHandle(''); }}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${paymentMethod === 'stripe'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <span className="text-2xl">💳</span>
                                <div>
                                    <p className={`font-medium text-${currentTheme.text}`}>Credit Card</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Pay securely with Stripe</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setPaymentMethod('venmo')}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${paymentMethod === 'venmo'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <span className="text-2xl">📱</span>
                                <div>
                                    <p className={`font-medium text-${currentTheme.text}`}>Venmo</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Pay with your Venmo account</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setPaymentMethod('cashapp')}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${paymentMethod === 'cashapp'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <span className="text-2xl">💵</span>
                                <div>
                                    <p className={`font-medium text-${currentTheme.text}`}>CashApp</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Pay with your CashApp account</p>
                                </div>
                            </button>
                        </div>

                        {/* Handle input for Venmo/CashApp */}
                        {(paymentMethod === 'venmo' || paymentMethod === 'cashapp') && (
                            <div className="mb-4">
                                <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                    Your {paymentMethod === 'venmo' ? '@username' : '$cashtag'}
                                </label>
                                <input
                                    type="text"
                                    value={paymentHandle}
                                    onChange={(e) => setPaymentHandle(e.target.value)}
                                    placeholder={paymentMethod === 'venmo' ? '@username' : '$cashtag'}
                                    className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text}`}
                                />
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg`}
                            >
                                ← Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!paymentMethod || ((paymentMethod === 'venmo' || paymentMethod === 'cashapp') && !paymentHandle)}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==================== STEP 3: PAYOUT PREFERENCE ====================
    if (step === 3) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 3: Payout Preference</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            How do you want to receive prize winnings or matrix earnings?
                        </p>

                        {/* Info */}
                        <div className={`bg-${currentTheme.bg} rounded-lg p-3 mb-4`}>
                            <p className={`text-xs text-${currentTheme.textMuted}`}>
                                💵 We only pay out via <strong>Venmo</strong> or <strong>CashApp</strong>. You can update this anytime in your Profile.
                            </p>
                        </div>

                        {/* Payout Options */}
                        <div className="space-y-2 mb-4">
                            <button
                                onClick={() => setPayoutMethod('venmo')}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${payoutMethod === 'venmo'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <span className="text-2xl">📱</span>
                                <div>
                                    <p className={`font-medium text-${currentTheme.text}`}>Venmo</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Receive payments to your Venmo</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setPayoutMethod('cashapp')}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${payoutMethod === 'cashapp'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <span className="text-2xl">💵</span>
                                <div>
                                    <p className={`font-medium text-${currentTheme.text}`}>CashApp</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Receive payments to your CashApp</p>
                                </div>
                            </button>
                        </div>

                        {/* Handle input */}
                        {payoutMethod && (
                            <div className="mb-4">
                                <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-1`}>
                                    Your {payoutMethod === 'venmo' ? '@username' : '$cashtag'}
                                </label>
                                <input
                                    type="text"
                                    value={payoutHandle}
                                    onChange={(e) => setPayoutHandle(e.target.value)}
                                    placeholder={payoutMethod === 'venmo' ? '@username' : '$cashtag'}
                                    className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text}`}
                                />
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(2)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg`}
                            >
                                ← Back
                            </button>
                            <button
                                onClick={() => setStep(4)}
                                disabled={!payoutMethod || !payoutHandle}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==================== STEP 4: REVIEW & PAY ====================
    if (step === 4) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-6 px-4`}>
                <div className="max-w-lg mx-auto">
                    <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-2`}>Start a Campaign</h1>
                    <StepIndicator />

                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1`}>Step 4: Review & Pay</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                            Please confirm your campaign details.
                        </p>

                        {/* Card Preview */}
                        <div className="mb-4">
                            <p className={`text-xs text-${currentTheme.textMuted} mb-2`}>Your Card (as shown in games):</p>
                            <div
                                className={`w-24 h-16 mx-auto rounded-lg overflow-hidden border border-${currentTheme.border} cursor-pointer hover:opacity-80`}
                                onClick={() => selectedCard && setPreviewCard(selectedCard)}
                            >
                                {selectedCard && renderCardPreview(selectedCard, 'small')}
                            </div>
                            <p className={`text-center text-${currentTheme.accent} text-xs mt-1 cursor-pointer hover:underline`} onClick={() => selectedCard && setPreviewCard(selectedCard)}>
                                👁 Click to preview full card
                            </p>
                        </div>

                        {/* Summary */}
                        <div className={`bg-${currentTheme.bg} rounded-lg p-4 mb-4 space-y-3`}>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Package</span>
                                <span className={`text-${currentTheme.text} font-medium`}>Standard Campaign</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Guaranteed Views</span>
                                <span className={`text-${currentTheme.text} font-medium`}>{parseInt(settings.guaranteed_views).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Payment Method</span>
                                <span className={`text-${currentTheme.text} font-medium capitalize`}>
                                    {paymentMethod === 'stripe' ? 'Credit Card' : paymentMethod}
                                    {paymentHandle && ` (${paymentHandle})`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className={`text-${currentTheme.textMuted}`}>Payout Method</span>
                                <span className={`text-${currentTheme.text} font-medium capitalize`}>
                                    {payoutMethod} ({payoutHandle})
                                </span>
                            </div>
                            <div className={`border-t border-${currentTheme.border} pt-3 flex justify-between`}>
                                <span className={`text-${currentTheme.text} font-bold`}>Total</span>
                                <span className={`text-${currentTheme.accent} font-bold text-xl`}>${settings.ad_price}</span>
                            </div>
                        </div>

                        {/* Error message */}
                        {message && (
                            <div className={`mb-4 px-4 py-2 rounded-lg text-center text-sm ${message.includes('Error')
                                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                : 'bg-green-500/10 border border-green-500/30 text-green-400'
                                }`}>
                                {message}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(3)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg`}
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handlePurchase}
                                disabled={processing}
                                className={`flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50`}
                            >
                                {processing ? 'Processing...' : `Pay $${settings.ad_price}`}
                            </button>
                        </div>

                        <p className={`text-${currentTheme.textMuted} text-xs text-center mt-3`}>
                            By purchasing, you agree to our terms of service.
                        </p>
                    </div>
                </div>

                {/* Card Preview Modal */}
                {previewCard && (
                    <div
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => setPreviewCard(null)}
                    >
                        <div
                            className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-sm w-full`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className={`font-bold text-${currentTheme.text}`}>Full Card Preview</h3>
                                <button
                                    onClick={() => setPreviewCard(null)}
                                    className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-xl`}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="aspect-[3/2] rounded-lg overflow-hidden">
                                {renderCardPreview(previewCard, 'large')}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ==================== STEP 5: JOIN MATRIX? ====================
    if (step === 5) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 text-center`}>
                        <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">✓</span>
                        </div>
                        <h2 className="text-xl font-bold text-green-400 mb-1">Payment Successful!</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-5`}>Your ad campaign is now active.</p>

                        <div className={`bg-${currentTheme.bg} rounded-lg p-4 mb-5 text-left`}>
                            <h3 className={`font-bold text-${currentTheme.text} mb-2 text-center`}>🔷 Want to Earn ${settings.matrix_payout} Back?</h3>
                            <p className={`text-${currentTheme.textMuted} text-sm mb-3`}>
                                Join the <strong>Referral Matrix</strong> and fill 6 spots to earn ${settings.matrix_payout}!
                            </p>

                            {/* Matrix Visual */}
                            <div className="flex flex-col items-center gap-1 mb-3">
                                <div className={`w-12 h-8 bg-${currentTheme.accent}/30 border border-${currentTheme.accent} rounded text-xs flex items-center justify-center text-${currentTheme.accent} font-bold`}>You</div>
                                <div className="flex gap-1">
                                    <div className={`w-10 h-6 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>2</div>
                                    <div className={`w-10 h-6 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>3</div>
                                </div>
                                <div className="flex gap-1">
                                    <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>4</div>
                                    <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>5</div>
                                    <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>6</div>
                                    <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>7</div>
                                </div>
                            </div>
                            <p className={`text-${currentTheme.textMuted} text-xs text-center`}>
                                Refer friends or get auto-filled by new advertisers!
                            </p>
                        </div>

                        {message && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-center text-sm">
                                {message}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleMatrixChoice(false)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg`}
                            >
                                No Thanks
                            </button>
                            <button
                                onClick={() => handleMatrixChoice(true)}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg`}
                            >
                                Yes, Join!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==================== STEP 6: REFERRER ====================
    if (step === 6) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1 text-center`}>Who Referred You?</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4 text-center`}>
                            Enter their username to be placed under them.
                        </p>

                        <div className="mb-4">
                            <input
                                type="text"
                                value={referredBy}
                                onChange={handleReferralChange}
                                className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text}`}
                                placeholder="Referrer's username (optional)"
                            />
                            {referrerName && (
                                <p className="text-green-400 text-sm mt-2">✓ You'll be placed under {referrerName}</p>
                            )}
                            {referrerNotFound && referredBy.length >= 2 && (
                                <p className="text-orange-400 text-sm mt-2">⚠ User not found</p>
                            )}
                        </div>

                        <div className={`bg-${currentTheme.bg} rounded-lg p-3 mb-4`}>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>
                                💡 You'll be placed under this person. If no Referrer, no problem, you'll be placed in the next available spot.
                            </p>
                        </div>

                        {message && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-center text-sm">
                                {message}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg disabled:opacity-50`}
                            >
                                {processing ? '...' : 'Skip (Auto-place me)'}
                            </button>
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing || (referredBy && !referrerName)}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg disabled:opacity-50`}
                            >
                                {processing ? '...' : 'Join Matrix'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Fallback (shouldn't reach here)
    return null
}