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
    const [message, setMessage] = useState('')

    const [businessCards, setBusinessCards] = useState([])
    const [selectedCardId, setSelectedCardId] = useState(null)

    const [step, setStep] = useState(1)
    const [campaignId, setCampaignId] = useState(null)
    const [joinMatrix, setJoinMatrix] = useState(false)
    const [referredBy, setReferredBy] = useState('')
    const [referrerName, setReferrerName] = useState(null)
    const [referrerNotFound, setReferrerNotFound] = useState(false)

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

            const { data: matrixData } = await supabase
                .from('matrix_entries')
                .select('id')
                .eq('user_id', userResult.id)
                .eq('is_active', true)
                .eq('is_completed', false)
                .maybeSingle()

            if (matrixData) {
                setReferrerName(userResult.first_name || userResult.username)
                setReferrerNotFound(false)
            } else {
                setReferrerName(userResult.first_name || userResult.username)
                setReferrerNotFound(false)
            }
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
                                type: 'matrix_complete',
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

        setProcessing(true)
        setMessage('')

        try {
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

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-10 h-10 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted} text-sm`}>Loading...</p>
                </div>
            </div>
        )
    }

    if (businessCards.length === 0) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-12 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 text-center`}>
                        <span className="text-4xl mb-4 block">🃏</span>
                        <h2 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>Create Your Business Card First</h2>
                        <p className={`text-${currentTheme.textMuted} mb-6`}>
                            Before you can start advertising, you need to create your business card. This is what everyone will see!
                        </p>
                        <button
                            onClick={() => router.push('/cards')}
                            className={`px-6 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all`}
                        >
                            Create Business Card
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 2) {
        return (
            <div className={`min-h-screen bg-${currentTheme.bg} py-12 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 text-center`}>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">✓</span>
                        </div>
                        <h2 className="text-2xl font-bold text-green-400 mb-2">Payment Verified!</h2>
                        <p className={`text-${currentTheme.textMuted} mb-6`}>Your ad campaign is now active.</p>

                        <div className={`bg-${currentTheme.border}/50 rounded-lg p-4 mb-6`}>
                            <h3 className={`text-lg font-bold text-${currentTheme.text} mb-2`}>🔷 Join the Referral Matrix?</h3>
                            <p className={`text-${currentTheme.textMuted} text-sm mb-4`}>
                                Fill 6 spots and earn <span className="text-green-400 font-bold">${settings.matrix_payout}</span> back!
                            </p>

                            <div className="flex justify-center mb-2">
                                <div className={`w-12 h-8 bg-${currentTheme.accent}/30 border border-${currentTheme.accent} rounded text-xs flex items-center justify-center text-${currentTheme.accent}`}>You</div>
                            </div>
                            <div className="flex justify-center gap-4 mb-2">
                                <div className={`w-10 h-6 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>2</div>
                                <div className={`w-10 h-6 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>3</div>
                            </div>
                            <div className="flex justify-center gap-2">
                                <div className={`w-8 h-5 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>4</div>
                                <div className={`w-8 h-5 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>5</div>
                                <div className={`w-8 h-5 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>6</div>
                                <div className={`w-8 h-5 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>7</div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleMatrixChoice(false)}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg hover:bg-${currentTheme.card} transition-all`}
                            >
                                No Thanks
                            </button>
                            <button
                                onClick={() => handleMatrixChoice(true)}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all`}
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
            <div className={`min-h-screen bg-${currentTheme.bg} py-12 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6`}>
                        <h2 className={`text-xl font-bold text-${currentTheme.text} mb-2 text-center`}>Who Referred You?</h2>
                        <p className={`text-${currentTheme.textMuted} text-sm mb-6 text-center`}>
                            Enter their username to be placed in their matrix, or skip to be auto-placed.
                        </p>

                        <div className="mb-6">
                            <label className={`block text-sm font-medium text-${currentTheme.textMuted} mb-2`}>
                                Referrer's Username (Optional)
                            </label>
                            <input
                                type="text"
                                value={referredBy}
                                onChange={handleReferralChange}
                                className={`w-full px-3 py-2 bg-${currentTheme.border} border border-${currentTheme.border} rounded-lg text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-2 focus:ring-${currentTheme.accent}`}
                                placeholder="Enter username"
                            />
                            {referrerName && (
                                <p className="text-green-400 text-sm mt-2">
                                    ✓ You'll be placed under {referrerName}'s matrix
                                </p>
                            )}
                            {referrerNotFound && referredBy.length >= 2 && (
                                <p className={`text-${currentTheme.accent} text-sm mt-2`}>
                                    ⚠ User not found or doesn't have an active matrix
                                </p>
                            )}
                        </div>

                        {message && (
                            <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-center">
                                {message}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing}
                                className={`flex-1 py-3 bg-${currentTheme.border} text-${currentTheme.text} font-bold rounded-lg hover:bg-${currentTheme.card} transition-all disabled:opacity-50`}
                            >
                                {processing ? 'Processing...' : 'Skip (Auto-place me)'}
                            </button>
                            <button
                                onClick={handleJoinMatrix}
                                disabled={processing || (referredBy && !referrerName)}
                                className={`flex-1 py-3 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                            >
                                {processing ? 'Processing...' : 'Join Matrix'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} py-12 px-4`}>
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className={`text-3xl font-bold text-${currentTheme.text}`}>Start Advertising</h1>
                    <p className={`text-${currentTheme.textMuted} mt-2`}>Get your business card seen by thousands!</p>
                </div>

                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6 mb-8`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-xl font-bold text-${currentTheme.text}`}>🃏 Select Card for This Campaign</h2>
                        {businessCards.length < 5 && (
                            <button
                                onClick={() => router.push('/cards')}
                                className={`px-3 py-1 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded-lg hover:bg-${currentTheme.card}`}
                            >
                                + Create New Card
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {businessCards.map((card) => (
                            <button
                                key={card.id}
                                onClick={() => setSelectedCardId(card.id)}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${selectedCardId === card.id
                                    ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                    : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {card.image_url ? (
                                        <img
                                            src={card.image_url}
                                            alt={card.business_name}
                                            className="w-16 h-16 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className={`w-16 h-16 bg-${currentTheme.border} rounded-lg flex items-center justify-center`}>
                                            <span className="text-2xl">🃏</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-${currentTheme.text} font-medium truncate`}>{card.business_name}</p>
                                        <p className={`text-${currentTheme.textMuted} text-sm truncate`}>{card.tagline || 'No tagline'}</p>
                                    </div>
                                    {selectedCardId === card.id && (
                                        <span className={`text-${currentTheme.accent} text-xl`}>✓</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    <p className={`text-${currentTheme.textMuted} text-sm mt-4`}>
                        {businessCards.length}/5 cards created
                    </p>
                </div>

                <div className={`bg-gradient-to-br from-${currentTheme.accent}/20 to-orange-500/20 border border-${currentTheme.accent}/30 rounded-xl p-6 mb-8`}>
                    <h2 className={`text-xl font-bold text-${currentTheme.text} mb-4`}>📦 Ad Package</h2>

                    <div className="space-y-4">
                        <div className={`flex justify-between items-center py-3 border-b border-${currentTheme.border}`}>
                            <span className={`text-${currentTheme.textMuted}`}>Guaranteed Views</span>
                            <span className={`text-${currentTheme.text} font-bold`}>{parseInt(settings.guaranteed_views).toLocaleString()}</span>
                        </div>
                        <div className={`flex justify-between items-center py-3 border-b border-${currentTheme.border}`}>
                            <span className={`text-${currentTheme.textMuted}`}>Your Card in Memory Game</span>
                            <span className="text-green-400">✓ Included</span>
                        </div>
                        <div className={`flex justify-between items-center py-3 border-b border-${currentTheme.border}`}>
                            <span className={`text-${currentTheme.textMuted}`}>Bonus Views Possible</span>
                            <span className="text-green-400">✓ Yes</span>
                        </div>
                        <div className={`flex justify-between items-center py-3 border-b border-${currentTheme.border}`}>
                            <span className={`text-${currentTheme.textMuted}`}>View Tracking Dashboard</span>
                            <span className="text-green-400">✓ Included</span>
                        </div>
                        <div className={`flex justify-between items-center py-3 border-b border-${currentTheme.border}`}>
                            <span className={`text-${currentTheme.textMuted}`}>Optional Referral Matrix</span>
                            <span className="text-green-400">✓ Included</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className={`text-${currentTheme.textMuted} text-lg font-medium`}>Total Price</span>
                            <span className={`text-${currentTheme.accent} font-bold text-2xl`}>${settings.ad_price}</span>
                        </div>
                    </div>
                </div>

                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-6`}>
                    <h2 className={`text-xl font-bold text-${currentTheme.text} mb-4`}>💳 Payment Method</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setPaymentMethod('stripe')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'stripe'
                                ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                }`}
                        >
                            <span className="text-2xl block mb-2">💳</span>
                            <p className={`text-${currentTheme.text} font-medium`}>Credit Card</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>via Stripe</p>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('cashapp')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'cashapp'
                                ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                }`}
                        >
                            <span className="text-2xl block mb-2">💵</span>
                            <p className={`text-${currentTheme.text} font-medium`}>CashApp</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Manual payment</p>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('venmo')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'venmo'
                                ? `border-${currentTheme.accent} bg-${currentTheme.accent}/10`
                                : `border-${currentTheme.border} hover:border-${currentTheme.textMuted}`
                                }`}
                        >
                            <span className="text-2xl block mb-2">📱</span>
                            <p className={`text-${currentTheme.text} font-medium`}>Venmo</p>
                            <p className={`text-${currentTheme.textMuted} text-sm`}>Manual payment</p>
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    {message && (
                        <div className={`mb-4 px-4 py-3 rounded-lg inline-block ${message.includes('Error')
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-green-500/10 border border-green-500/30 text-green-400'
                            }`}>
                            {message}
                        </div>
                    )}

                    <button
                        onClick={handlePurchase}
                        disabled={processing || !selectedCardId}
                        className={`px-12 py-4 bg-gradient-to-r from-${currentTheme.accent} to-orange-500 text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold text-lg rounded-lg hover:from-${currentTheme.accentHover} hover:to-orange-400 transition-all disabled:opacity-50`}
                    >
                        {processing ? 'Processing...' : `Pay $${settings.ad_price} & Start Campaign`}
                    </button>

                    {!selectedCardId && (
                        <p className={`text-${currentTheme.accent} text-sm mt-2`}>
                            Please select a card above
                        </p>
                    )}

                    <p className={`text-${currentTheme.textMuted} text-sm mt-4`}>
                        By purchasing, you agree to our terms of service.
                    </p>
                </div>
            </div>
        </div>
    )
}