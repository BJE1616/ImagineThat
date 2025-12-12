'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdvertisePage() {
    const router = useRouter()
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
    const [joinMatrix, setJoinMatrix] = useState(true)
    const [existingCampaign, setExistingCampaign] = useState(null)
    const [message, setMessage] = useState('')

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

            // Check for existing active campaign
            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('status', 'active')
                .single()

            setExistingCampaign(campaignData)

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

    const findMatrixSpotForUser = async (newUserId) => {
        try {
            // Get user's referrer
            const { data: userData } = await supabase
                .from('users')
                .select('referred_by')
                .eq('id', newUserId)
                .single()

            const referrerId = userData?.referred_by

            // If user has a referrer, try to place them in referrer's matrix
            if (referrerId) {
                const { data: referrerMatrix } = await supabase
                    .from('matrix_entries')
                    .select('*')
                    .eq('user_id', referrerId)
                    .eq('is_active', true)
                    .eq('is_completed', false)
                    .single()

                if (referrerMatrix) {
                    // Try to place in spot 2 or 3
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

                        await checkMatrixCompletion(referrerMatrix.id)
                        return { placed: true, spot: 3 }
                    }
                }
            }

            // Find oldest waiting matrix with empty spots
            const { data: waitingMatrices } = await supabase
                .from('matrix_entries')
                .select('*')
                .eq('is_active', true)
                .eq('is_completed', false)
                .order('created_at', { ascending: true })

            if (waitingMatrices && waitingMatrices.length > 0) {
                for (const matrix of waitingMatrices) {
                    // Skip if this is the user's own matrix
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

                            // Send notification
                            const notifType = spot.num <= 3 ? 'free_referral' : 'matrix_growth'
                            const notifTitle = spot.num <= 3
                                ? '🎉 You got a free referral!'
                                : '🔷 Your matrix is growing!'
                            const notifMessage = spot.num <= 3
                                ? 'Someone was auto-placed in your matrix. Keep growing your team!'
                                : 'A new advertiser joined your matrix!'

                            await supabase
                                .from('notifications')
                                .insert([{
                                    user_id: matrix.user_id,
                                    type: notifType,
                                    title: notifTitle,
                                    message: notifMessage
                                }])

                            await checkMatrixCompletion(matrix.id)
                            return { placed: true, spot: spot.num }
                        }
                    }
                }
            }

            return { placed: false }
        } catch (error) {
            console.error('Error placing user in matrix:', error)
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

                // Get payout amount from settings
                const { data: settingsData } = await supabase
                    .from('admin_settings')
                    .select('setting_value')
                    .eq('setting_key', 'matrix_payout')
                    .single()

                const payoutAmount = settingsData?.setting_value || '200'

                await supabase
                    .from('matrix_entries')
                    .update({
                        is_completed: true,
                        completed_at: new Date().toISOString(),
                        payout_amount: parseFloat(payoutAmount),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', matrixId)

                await supabase
                    .from('notifications')
                    .insert([{
                        user_id: matrix.user_id,
                        type: 'matrix_complete',
                        title: '🎉 Matrix Complete!',
                        message: `Congratulations! Your matrix is full! You've earned $${payoutAmount}!`
                    }])
            }
        } catch (error) {
            console.error('Error checking matrix completion:', error)
        }
    }

    const handlePurchase = async () => {
        setProcessing(true)
        setMessage('')

        try {
            console.log('Starting purchase for user:', user.id)

            // Step 1: Create ad campaign
            console.log('Creating campaign...')
            const campaignResult = await supabase
                .from('ad_campaigns')
                .insert([{
                    user_id: user.id,
                    payment_method: paymentMethod,
                    amount_paid: parseFloat(settings.ad_price),
                    views_guaranteed: parseInt(settings.guaranteed_views),
                    status: 'active'
                }])
                .select()
                .single()

            console.log('Campaign result:', campaignResult)

            if (campaignResult.error) {
                console.error('Campaign error details:', campaignResult.error)
                setMessage('Error creating campaign: ' + (campaignResult.error.message || campaignResult.error.details || 'Unknown error'))
                return
            }

            const campaign = campaignResult.data

            // Step 2: If user wants to join matrix, create their matrix entry
            if (joinMatrix) {
                console.log('Creating matrix entry...')
                const matrixResult = await supabase
                    .from('matrix_entries')
                    .insert([{
                        user_id: user.id,
                        campaign_id: campaign.id,
                        spot_1: user.id,
                        is_active: true
                    }])
                    .select()
                    .single()

                console.log('Matrix result:', matrixResult)

                if (matrixResult.error) {
                    console.error('Matrix error details:', matrixResult.error)
                    // Campaign was created, but matrix failed - still continue
                    setMessage('Campaign created, but matrix join failed: ' + matrixResult.error.message)
                } else {
                    // Step 3: Place user in someone else's matrix
                    console.log('Placing user in matrix...')
                    await findMatrixSpotForUser(user.id)
                }
            }

            setMessage('🎉 Campaign created successfully! Redirecting...')

            setTimeout(() => {
                router.push('/dashboard')
            }, 2000)

        } catch (error) {
            console.error('Full error object:', error)
            console.error('Error name:', error?.name)
            console.error('Error message:', error?.message)
            console.error('Error stack:', error?.stack)
            setMessage('Error: ' + (error?.message || 'Unknown error occurred'))
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    if (existingCampaign) {
        return (
            <div className="min-h-screen bg-slate-900 py-12 px-4">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                        <span className="text-6xl mb-4 block">📢</span>
                        <h1 className="text-2xl font-bold text-white mb-4">You Already Have an Active Campaign</h1>
                        <p className="text-slate-400 mb-6">
                            You can only have one active ad campaign at a time. Your current campaign is still running!
                        </p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
                        >
                            View Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Start Advertising</h1>
                    <p className="text-slate-400 mt-2">Get your business card seen by thousands!</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Package Details */}
                    <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">📦 Ad Package</h2>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-slate-700">
                                <span className="text-slate-300">Guaranteed Views</span>
                                <span className="text-white font-bold">{parseInt(settings.guaranteed_views).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-700">
                                <span className="text-slate-300">Your Card in Memory Game</span>
                                <span className="text-green-400">✓ Included</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-700">
                                <span className="text-slate-300">Bonus Views Possible</span>
                                <span className="text-green-400">✓ Yes</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-700">
                                <span className="text-slate-300">View Tracking Dashboard</span>
                                <span className="text-green-400">✓ Included</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="text-slate-300 text-lg font-medium">Total Price</span>
                                <span className="text-amber-400 font-bold text-2xl">${settings.ad_price}</span>
                            </div>
                        </div>
                    </div>

                    {/* Matrix Bonus */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">🔷 Referral Matrix (Free Bonus!)</h2>

                        <p className="text-slate-400 mb-4">
                            Join our referral matrix and earn money back!
                        </p>

                        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                            <div className="text-center mb-4">
                                <p className="text-slate-300 text-sm">Fill 7 spots and earn:</p>
                                <p className="text-green-400 font-bold text-3xl">${settings.matrix_payout}</p>
                            </div>

                            {/* Mini Matrix Preview */}
                            <div className="flex justify-center mb-2">
                                <div className="w-12 h-8 bg-amber-500/30 border border-amber-500 rounded text-xs flex items-center justify-center text-amber-400">You</div>
                            </div>
                            <div className="flex justify-center gap-4 mb-2">
                                <div className="w-10 h-6 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">2</div>
                                <div className="w-10 h-6 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">3</div>
                            </div>
                            <div className="flex justify-center gap-2">
                                <div className="w-8 h-5 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">4</div>
                                <div className="w-8 h-5 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">5</div>
                                <div className="w-8 h-5 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">6</div>
                                <div className="w-8 h-5 bg-slate-600 border border-slate-500 rounded text-xs flex items-center justify-center text-slate-400">7</div>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={joinMatrix}
                                onChange={(e) => setJoinMatrix(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-slate-300">Yes, I want to join the referral matrix!</span>
                        </label>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mt-8">
                    <h2 className="text-xl font-bold text-white mb-4">💳 Payment Method</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setPaymentMethod('stripe')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'stripe'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                                }`}
                        >
                            <span className="text-2xl block mb-2">💳</span>
                            <p className="text-white font-medium">Credit Card</p>
                            <p className="text-slate-400 text-sm">via Stripe</p>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('cashapp')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'cashapp'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                                }`}
                        >
                            <span className="text-2xl block mb-2">💵</span>
                            <p className="text-white font-medium">CashApp</p>
                            <p className="text-slate-400 text-sm">Manual payment</p>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('venmo')}
                            className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === 'venmo'
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                                }`}
                        >
                            <span className="text-2xl block mb-2">📱</span>
                            <p className="text-white font-medium">Venmo</p>
                            <p className="text-slate-400 text-sm">Manual payment</p>
                        </button>
                    </div>
                </div>

                {/* Purchase Button */}
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
                        disabled={processing}
                        className="px-12 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                    >
                        {processing ? 'Processing...' : `Pay $${settings.ad_price} & Start Campaign`}
                    </button>

                    <p className="text-slate-500 text-sm mt-4">
                        By purchasing, you agree to our terms of service.
                    </p>
                </div>
            </div>
        </div>
    )
}