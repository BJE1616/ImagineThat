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
    const [paymentMethod, setPaymentMethod] = useState('stripe')
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
                        .select('email, username')
                        .eq('id', matrix.user_id)
                        .single()

                    if (matrixUser) {
                        await fetch('/api/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'matrix_completed',
                                to: matrixUser.email,
                                data: {
                                    username: matrixUser.username,
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
        if (!selectedCardId) {
            setMessage('Error: Please select a card for this campaign')
            return
        }

        const finalPayoutMethod = paymentMethod === 'stripe' ? payoutMethod : paymentMethod
        const finalPayoutHandle = paymentMethod === 'stripe' ? payoutHandle : paymentHandle

        if (!finalPayoutMethod) {
            setMessage('Error: Please select a payout method')
            return
        }
        if (!finalPayoutHandle) {
            setMessage('Error: Please enter your payout handle')
            return
        }

        setProcessing(true)
        setMessage('')

        try {
            await supabase
                .from('users')
                .update({
                    payout_method: finalPayoutMethod,
                    payout_handle: finalPayoutHandle
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

            setStep(2)

        } catch (error) {
            setMessage('Error: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    const handleMatrixChoice = (wantsMatrix) => {
        setJoinMatrix(wantsMatrix)
        if (wantsMatrix) {
            setStep(3)
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

            await findMatrixSpotForUser(user.id, referredBy)

            setMessage('✓ You joined the matrix! Redirecting to dashboard...')
            setTimeout(() => router.push('/dashboard'), 2000)

        } catch (error) {
            setMessage('Error: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    // Render card preview (works for both image and text-based cards)
    const renderCardPreview = (card, size = 'large') => {
        if (card.image_url) {
            return (
                <img
                    src={card.image_url}
                    alt={card.business_name}
                    className={`${size === 'large' ? 'w-full' : 'w-full h-full'} object-cover rounded-lg`}
                />
            )
        }

        // Text-based card
        return (
            <div
                className={`${size === 'large' ? 'w-full p-4' : 'w-full h-full p-2'} rounded-lg flex flex-col justify-center`}
                style={{
                    backgroundColor: card.card_color || '#1e293b',
                    color: card.text_color || '#ffffff'
                }}
            >
                {size === 'large' ? (
                    <>
                        {card.business_name && (
                            <h4 className="font-bold text-lg mb-1">{card.business_name}</h4>
                        )}
                        {card.tagline && (
                            <p className="text-sm opacity-80 mb-2">{card.tagline}</p>
                        )}
                        {card.title && (
                            <p className="font-medium">{card.title}</p>
                        )}
                        {card.message && (
                            <p className="text-sm opacity-90 mt-2">{card.message}</p>
                        )}
                        <div className="mt-3 text-xs opacity-70 space-y-1">
                            {card.phone && <p>📞 {card.phone}</p>}
                            {card.email && <p>✉️ {card.email}</p>}
                            {card.website_url && <p>🌐 {card.website_url}</p>}
                        </div>
                    </>
                ) : (
                    <span className="text-xs font-bold text-center truncate">{card.business_name || card.title || '🃏'}</span>
                )}
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
                        onClick={() => router.push('/cards')}
                        className={`px-6 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg`}
                    >
                        Create Business Card
                    </button>
                </div>
            </div>
        )
    }

    if (step === 2) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 text-center`}>
                        <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">✓</span>
                        </div>
                        <h2 className="text-xl font-bold text-green-400 mb-1">Payment Verified!</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>Your ad campaign is now active.</p>

                        <div className={`bg-${currentTheme.border}/50 rounded-lg p-3 mb-4`}>
                            <h3 className={`font-bold text-${currentTheme.text} mb-1`}>🔷 Join the Referral Matrix?</h3>
                            <p className={`text-${currentTheme.textMuted} text-xs mb-3`}>
                                Fill 6 spots → earn <span className="text-green-400 font-bold">${settings.matrix_payout}</span> back!
                            </p>
                            <div className="flex justify-center gap-1 mb-1">
                                <div className={`w-10 h-6 bg-${currentTheme.accent}/30 border border-${currentTheme.accent} rounded text-xs flex items-center justify-center text-${currentTheme.accent}`}>You</div>
                            </div>
                            <div className="flex justify-center gap-1 mb-1">
                                <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>2</div>
                                <div className={`w-8 h-5 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>3</div>
                            </div>
                            <div className="flex justify-center gap-1">
                                <div className={`w-6 h-4 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>4</div>
                                <div className={`w-6 h-4 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>5</div>
                                <div className={`w-6 h-4 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>6</div>
                                <div className={`w-6 h-4 bg-${currentTheme.border} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>7</div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleMatrixChoice(false)}
                                className={`flex-1 py-2 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg text-sm`}
                            >
                                No Thanks
                            </button>
                            <button
                                onClick={() => handleMatrixChoice(true)}
                                className={`flex-1 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg text-sm`}
                            >
                                Yes, Join!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 3) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-8 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5`}>
                        <h2 className={`text-lg font-bold text-${currentTheme.text} mb-1 text-center`}>Who Referred You?</h2>
                        <p className={`text-${currentTheme.textMuted} text-xs mb-4 text-center`}>
                            Enter their username or skip to be auto-placed.
                        </p>

                        <div className="mb-4">
                            <input
                                type="text"
                                value={referredBy}
                                onChange={handleReferralChange}
                                className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} text-sm`}
                                placeholder="Referrer's username (optional)"
                            />
                            {referrerName && (
                                <p className="text-green-400 text-xs mt-1">✓ Placing under {referrerName}</p>
                            )}
                            {referrerNotFound && referredBy.length >= 2 && (
                                <p className="text-orange-400 text-xs mt-1">⚠ User not found</p>
                            )}
                        </div>

                        {message && (
                            <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-center text-sm">
                                {message}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing}
                                className={`flex-1 py-2 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg text-sm disabled:opacity-50`}
                            >
                                {processing ? '...' : 'Skip'}
                            </button>
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing || (referredBy && !referrerName)}
                                className={`flex-1 py-2 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold rounded-lg text-sm disabled:opacity-50`}
                            >
                                {processing ? '...' : 'Join Matrix'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-4 px-4`}>
            <div className="max-w-4xl mx-auto">
                <h1 className={`text-xl font-bold text-${currentTheme.text} text-center mb-4`}>Start Advertising</h1>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                    {/* Left: Card Selection */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className={`text-sm font-bold text-${currentTheme.text}`}>🃏 Your Ad Card</h2>
                            <button
                                onClick={() => router.push('/cards')}
                                className={`px-3 py-1 bg-${currentTheme.accent} text-white text-xs font-medium rounded-lg hover:opacity-90`}
                            >
                                + New Card
                            </button>
                        </div>

                        {/* Selected Card Preview */}
                        <div
                            className={`p-3 bg-${currentTheme.bg} rounded-lg mb-3 cursor-pointer hover:opacity-80`}
                            onClick={() => selectedCard && setPreviewCard(selectedCard)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                                    {selectedCard ? renderCardPreview(selectedCard, 'small') : (
                                        <div className={`w-full h-full bg-${currentTheme.border} flex items-center justify-center`}>
                                            <span className="text-2xl">🃏</span>
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-${currentTheme.text} font-medium truncate`}>{selectedCard?.business_name || selectedCard?.title || 'No card selected'}</p>
                                    <p className={`text-${currentTheme.textMuted} text-sm truncate`}>{selectedCard?.tagline || ''}</p>
                                    <p className={`text-${currentTheme.accent} text-xs mt-1`}>👁 Click to preview</p>
                                </div>
                            </div>
                        </div>

                        {/* Card Selector (if multiple) */}
                        {businessCards.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {businessCards.map((card) => (
                                    <div key={card.id} className="relative flex-shrink-0">
                                        <button
                                            onClick={() => setSelectedCardId(card.id)}
                                            className={`w-12 h-12 rounded-lg border-2 overflow-hidden ${selectedCardId === card.id
                                                ? `border-${currentTheme.accent}`
                                                : `border-${currentTheme.border} opacity-60`
                                                }`}
                                        >
                                            {renderCardPreview(card, 'small')}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPreviewCard(card); }}
                                            className={`absolute -top-1 -right-1 w-5 h-5 bg-${currentTheme.card} border border-${currentTheme.border} rounded-full flex items-center justify-center text-xs hover:bg-${currentTheme.accent} transition-all`}
                                            title="Preview card"
                                        >
                                            👁
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className={`text-${currentTheme.textMuted} text-xs mt-2`}>
                            {businessCards.length}/5 cards • <span className={`text-${currentTheme.accent} cursor-pointer hover:underline`} onClick={() => router.push('/cards')}>Click Here to Manage Cards</span>
                        </p>
                    </div>

                    {/* Right: Ad Package */}
                    <div className={`bg-gradient-to-br from-${currentTheme.accent}/20 to-orange-500/20 border border-${currentTheme.accent}/30 rounded-xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className={`text-sm font-bold text-${currentTheme.text}`}>📦 Ad Package</h2>
                            <span className={`text-${currentTheme.accent} font-bold text-xl`}>${settings.ad_price}</span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                            <div className={`flex justify-between text-${currentTheme.textMuted}`}>
                                <span>Guaranteed Views</span>
                                <span className={`text-${currentTheme.text} font-medium`}>{parseInt(settings.guaranteed_views).toLocaleString()}</span>
                            </div>
                            <div className={`flex justify-between text-${currentTheme.textMuted}`}>
                                <span>Card in Memory Game</span>
                                <span className="text-green-400">✓</span>
                            </div>
                            <div className={`flex justify-between text-${currentTheme.textMuted}`}>
                                <span>Bonus Views Possible</span>
                                <span className="text-green-400">✓</span>
                            </div>
                            <div className={`flex justify-between text-${currentTheme.textMuted}`}>
                                <span>View Tracking</span>
                                <span className="text-green-400">✓</span>
                            </div>
                            <div className={`flex justify-between text-${currentTheme.textMuted}`}>
                                <span>Referral Matrix</span>
                                <span className="text-green-400">✓</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Method */}
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 mb-4`}>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`text-sm font-bold text-${currentTheme.text}`}>💳 Pay with:</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setPaymentMethod('stripe'); setPaymentHandle(''); }}
                                className={`px-3 py-1.5 rounded-lg border-2 text-sm ${paymentMethod === 'stripe'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10 text-${currentTheme.text}`
                                    : `border-${currentTheme.border} text-${currentTheme.textMuted}`
                                    }`}
                            >
                                💳 Card
                            </button>
                            <button
                                onClick={() => { setPaymentMethod('venmo'); setPayoutMethod(''); setPayoutHandle(''); }}
                                className={`px-3 py-1.5 rounded-lg border-2 text-sm ${paymentMethod === 'venmo'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10 text-${currentTheme.text}`
                                    : `border-${currentTheme.border} text-${currentTheme.textMuted}`
                                    }`}
                            >
                                📱 Venmo
                            </button>
                            <button
                                onClick={() => { setPaymentMethod('cashapp'); setPayoutMethod(''); setPayoutHandle(''); }}
                                className={`px-3 py-1.5 rounded-lg border-2 text-sm ${paymentMethod === 'cashapp'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10 text-${currentTheme.text}`
                                    : `border-${currentTheme.border} text-${currentTheme.textMuted}`
                                    }`}
                            >
                                💵 CashApp
                            </button>
                        </div>
                    </div>

                    {/* Venmo/CashApp handle */}
                    {(paymentMethod === 'venmo' || paymentMethod === 'cashapp') && (
                        <input
                            type="text"
                            value={paymentHandle}
                            onChange={(e) => setPaymentHandle(e.target.value)}
                            placeholder={paymentMethod === 'cashapp' ? 'Your $cashtag (for payment & payouts)' : 'Your @username (for payment & payouts)'}
                            className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} text-sm`}
                        />
                    )}

                    {/* Stripe payout selection */}
                    {paymentMethod === 'stripe' && (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`text-sm text-${currentTheme.textMuted}`}>💰 Get Paid via:</span>
                            <button
                                type="button"
                                onClick={() => setPayoutMethod('venmo')}
                                className={`px-3 py-1.5 rounded-lg border-2 text-sm ${payoutMethod === 'venmo'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10 text-${currentTheme.text}`
                                    : `border-${currentTheme.border} text-${currentTheme.textMuted}`
                                    }`}
                            >
                                📱 Venmo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPayoutMethod('cashapp')}
                                className={`px-3 py-1.5 rounded-lg border-2 text-sm ${payoutMethod === 'cashapp'
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10 text-${currentTheme.text}`
                                    : `border-${currentTheme.border} text-${currentTheme.textMuted}`
                                    }`}
                            >
                                💵 CashApp
                            </button>
                            {payoutMethod && (
                                <input
                                    type="text"
                                    value={payoutHandle}
                                    onChange={(e) => setPayoutHandle(e.target.value)}
                                    placeholder={payoutMethod === 'cashapp' ? '$cashtag' : '@username'}
                                    className={`flex-1 min-w-[150px] px-3 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} text-sm`}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Purchase Button */}
                {message && (
                    <div className={`mb-3 px-4 py-2 rounded-lg text-center text-sm ${message.includes('Error')
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border border-green-500/30 text-green-400'
                        }`}>
                        {message}
                    </div>
                )}

                <button
                    onClick={handlePurchase}
                    disabled={processing || !selectedCardId}
                    className={`w-full py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-white font-bold text-lg rounded-xl hover:opacity-90 transition-all disabled:opacity-50`}
                >
                    {processing ? 'Processing...' : `Pay $${settings.ad_price} & Start Campaign`}
                </button>

                <p className={`text-${currentTheme.textMuted} text-xs text-center mt-2`}>
                    By purchasing, you agree to our terms of service.
                </p>
            </div>

            {/* Card Preview Modal */}
            {previewCard && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setPreviewCard(null)}
                >
                    <div
                        className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-4 max-w-sm w-full max-h-[90vh] overflow-auto`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <h3 className={`font-bold text-${currentTheme.text}`}>Card Preview</h3>
                            <button
                                onClick={() => setPreviewCard(null)}
                                className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-xl leading-none`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-3">
                            {renderCardPreview(previewCard, 'large')}
                        </div>

                        {previewCard.image_url && (
                            <>
                                <h4 className={`font-bold text-${currentTheme.text} text-lg`}>{previewCard.business_name}</h4>
                                {previewCard.tagline && (
                                    <p className={`text-${currentTheme.textMuted} text-sm mb-2`}>{previewCard.tagline}</p>
                                )}
                            </>
                        )}

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