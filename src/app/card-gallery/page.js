'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useRouter } from 'next/navigation'

export default function CardGalleryPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [tokenBalance, setTokenBalance] = useState(0)
    const [viewedToday, setViewedToday] = useState(0)
    const [dailyLimit, setDailyLimit] = useState(50)
    const [tokensPerView, setTokensPerView] = useState(1)
    const [entryChance, setEntryChance] = useState(30)
    const [selectedCard, setSelectedCard] = useState(null)
    const [message, setMessage] = useState(null)
    const [gameSettings, setGameSettings] = useState(null)
    const [celebration, setCelebration] = useState(null)
    const viewedCards = useRef(new Set())
    const [weeklyEntries, setWeeklyEntries] = useState(0)
    const demoViewedCards = useRef(new Set())

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        await checkUser()
        await loadGameSettings()
        await loadCards()
        setLoading(false)
    }

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                const { data: balanceData } = await supabase
                    .from('bb_balances')
                    .select('balance')
                    .eq('user_id', authUser.id)
                    .single()

                setTokenBalance(balanceData?.balance || 0)

                const today = new Date().toISOString().split('T')[0]
                const { data: activityData } = await supabase
                    .from('user_daily_activity')
                    .select('count')
                    .eq('user_id', authUser.id)
                    .eq('activity_type', 'card_gallery_view')
                    .eq('activity_date', today)
                    .single()

                setViewedToday(activityData?.count || 0)

                const { data: viewedData } = await supabase
                    .from('card_gallery_views')
                    .select('card_id')
                    .eq('user_id', authUser.id)
                    .gte('viewed_at', today)

                if (viewedData) {
                    viewedData.forEach(v => viewedCards.current.add(v.card_id))
                }

                // Load weekly entries from user_daily_spins
                const weekStart = getWeekStart()
                const { data: weeklySpinsData } = await supabase
                    .from('user_daily_spins')
                    .select('drawing_entries')
                    .eq('user_id', authUser.id)
                    .gte('spin_date', weekStart.toISOString().split('T')[0])

                const totalEntries = weeklySpinsData?.reduce((sum, day) => sum + (day.drawing_entries || 0), 0) || 0
                setWeeklyEntries(totalEntries)
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
    }

    const getWeekStart = () => {
        const now = new Date()
        const day = now.getDay()
        const diff = now.getDate() - day
        const weekStart = new Date(now.setDate(diff))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    const loadGameSettings = async () => {
        try {
            const { data } = await supabase
                .from('game_bb_settings')
                .select('*')
                .eq('game_key', 'card_gallery')
                .single()

            if (data) {
                setGameSettings(data)
                setDailyLimit(data.daily_bb_cap || 50)
                setTokensPerView(data.bb_min || 1)
                setEntryChance(data.entry_award_chance || 30)
            }
        } catch (error) {
            console.log('Using default card gallery settings')
        }
    }

    const loadCards = async () => {
        try {
            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('user_id')
                .eq('status', 'active')

            if (!campaigns || campaigns.length === 0) {
                setCards([])
                return
            }

            const advertiserIds = [...new Set(campaigns.map(c => c.user_id))]

            const { data: cardsData } = await supabase
                .from('business_cards')
                .select('*')
                .in('user_id', advertiserIds)

            setCards(cardsData || [])
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const viewCard = async (card, e) => {
        e.stopPropagation()
        setSelectedCard(card)

        // DEMO MODE: Record view for advertiser even without login
        if (!user) {
            if (demoViewedCards.current.has(card.id)) return
            demoViewedCards.current.add(card.id)

            try {
                // Still credit the advertiser
                const { data: campaignData } = await supabase
                    .from('ad_campaigns')
                    .select('id, views_from_clicks')
                    .eq('user_id', card.user_id)
                    .eq('status', 'active')
                    .limit(1)

                if (campaignData && campaignData.length > 0) {
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            views_from_clicks: (campaignData[0].views_from_clicks || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', campaignData[0].id)
                }

                setMessage({ type: 'info', text: 'Register to earn tokens!' })
                setTimeout(() => setMessage(null), 2000)
            } catch (error) {
                console.error('Error recording demo view:', error)
            }
            return
        }

        if (!gameSettings?.is_enabled) return
        if (viewedCards.current.has(card.id)) return

        viewedCards.current.add(card.id)

        // Check token daily cap
        const todayTokensEarned = viewedToday * tokensPerView
        const canEarnTokens = todayTokensEarned < dailyLimit

        // Roll for token win
        const multiplier = gameSettings?.view_multiplier || 2.0
        const tokenWinChance = cards.length > 0
            ? Math.min((dailyLimit / cards.length / multiplier), 1)
            : 1
        const wonTokens = canEarnTokens && Math.random() < tokenWinChance

        // Roll for entry win (separate roll)
        const entryRoll = Math.random() * 100
        const wonEntry = entryRoll < entryChance
        console.log('Entry roll:', entryRoll, 'Entry chance:', entryChance, 'Won entry:', wonEntry)

        // Record the view
        try {
            await supabase
                .from('card_gallery_views')
                .insert([{
                    user_id: user.id,
                    card_id: card.id,
                    advertiser_id: card.user_id,
                    bb_awarded: wonTokens
                }])

            // Credit advertiser
            const { data: campaignData } = await supabase
                .from('ad_campaigns')
                .select('id, views_from_clicks')
                .eq('user_id', card.user_id)
                .eq('status', 'active')
                .limit(1)

            if (campaignData && campaignData.length > 0) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        views_from_clicks: (campaignData[0].views_from_clicks || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaignData[0].id)
            }

            // Award tokens if won
            if (wonTokens) {
                const tokensEarned = tokensPerView

                const { data: existingBalance } = await supabase
                    .from('bb_balances')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (existingBalance) {
                    await supabase
                        .from('bb_balances')
                        .update({
                            balance: existingBalance.balance + tokensEarned,
                            lifetime_earned: (existingBalance.lifetime_earned || 0) + tokensEarned,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', user.id)
                } else {
                    await supabase
                        .from('bb_balances')
                        .insert([{
                            user_id: user.id,
                            balance: tokensEarned,
                            lifetime_earned: tokensEarned
                        }])
                }

                await supabase
                    .from('bb_transactions')
                    .insert([{
                        user_id: user.id,
                        type: 'earn',
                        amount: tokensEarned,
                        source: 'card_gallery',
                        description: 'Viewed card: ' + (card.title || 'Business Card')
                    }])

                const today = new Date().toISOString().split('T')[0]
                const { data: existingActivity } = await supabase
                    .from('user_daily_activity')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('activity_type', 'card_gallery_view')
                    .eq('activity_date', today)
                    .single()

                if (existingActivity) {
                    await supabase
                        .from('user_daily_activity')
                        .update({ count: existingActivity.count + 1 })
                        .eq('id', existingActivity.id)
                } else {
                    await supabase
                        .from('user_daily_activity')
                        .insert([{
                            user_id: user.id,
                            activity_type: 'card_gallery_view',
                            activity_date: today,
                            count: 1
                        }])
                }

                setTokenBalance(prev => prev + tokensEarned)
                setViewedToday(prev => prev + 1)
            }

            // Award entry if won
            if (wonEntry) {
                const today = new Date().toISOString().split('T')[0]
                const { data: spinData } = await supabase
                    .from('user_daily_spins')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('spin_date', today)
                    .single()

                if (spinData) {
                    await supabase
                        .from('user_daily_spins')
                        .update({ drawing_entries: (spinData.drawing_entries || 0) + 1 })
                        .eq('id', spinData.id)
                } else {
                    await supabase
                        .from('user_daily_spins')
                        .insert([{
                            user_id: user.id,
                            spin_date: today,
                            free_spins_used: 0,
                            paid_spins: 0,
                            tokens_won: 0,
                            tokens_wagered: 0,
                            drawing_entries: 1
                        }])
                }

                setWeeklyEntries(prev => prev + 1)
            }

            // Show celebration or message
            if (wonTokens || wonEntry) {
                setCelebration({
                    tokens: wonTokens ? tokensPerView : 0,
                    entry: wonEntry,
                    id: Date.now()
                })
                setTimeout(() => setCelebration(null), 2000)
            } else {
                setMessage({ type: 'info', text: 'Thanks for viewing!' })
                setTimeout(() => setMessage(null), 2000)
            }

        } catch (error) {
            console.error('Error recording view:', error)
        }
    }

    const closeCard = () => {
        setSelectedCard(null)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400">Loading gallery...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Demo Mode Banner */}
            {!user && (
                <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-30">
                    🎮 DEMO MODE — <button onClick={() => router.push('/auth/register')} className="underline hover:no-underline">REGISTER for FREE</button> to earn real tokens & prizes!
                </div>
            )}

            {celebration && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="animate-celebration text-center">
                        {celebration.tokens > 0 && (
                            <div className="text-4xl sm:text-5xl font-bold text-yellow-400 drop-shadow-lg">
                                +{celebration.tokens} Tokens!
                            </div>
                        )}
                        {celebration.entry && (
                            <div className={`text-2xl font-bold text-purple-400 ${celebration.tokens > 0 ? 'mt-2' : ''}`}>
                                +1 🎟️ Entry!
                            </div>
                        )}
                        <div className="text-6xl mt-2">🎉</div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes celebrationFloat {
                    0% { opacity: 0; transform: translateY(20px) scale(0.8); }
                    20% { opacity: 1; transform: translateY(0) scale(1.1); }
                    40% { transform: translateY(-10px) scale(1); }
                    100% { opacity: 0; transform: translateY(-60px) scale(0.9); }
                }
                .animate-celebration { animation: celebrationFloat 2s ease-out forwards; }
            `}</style>

            <div className={`bg-slate-800 border-b border-slate-700 sticky ${user ? 'top-0' : 'top-[36px]'} z-10`}>
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">🖼️ Card Gallery</h1>
                            <p className="text-slate-400 text-sm">Tap the eye to view cards {user ? 'and win prizes' : ''}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {message && (
                                <div className={message.type === 'success' ? 'px-3 py-1 rounded text-sm bg-green-500/20 text-green-400' : 'px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-400'}>
                                    {message.text}
                                </div>
                            )}
                            {user ? (
                                <div className="flex items-center gap-2">
                                    <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg px-2 py-2 text-center">
                                        <p className="text-purple-400 font-bold text-sm">🎟️ {weeklyEntries}</p>
                                        <p className="text-slate-400 text-[10px]">entries</p>
                                    </div>
                                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-2 text-right">
                                        <p className="text-yellow-400 font-bold text-base sm:text-lg">🪙 {tokenBalance}</p>
                                        <p className="text-slate-400 text-xs">{viewedToday * tokensPerView}/{dailyLimit} today</p>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => router.push('/auth/login')} className="px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium hover:bg-yellow-400 text-sm">
                                    Login to Earn!
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {user && gameSettings?.is_enabled && (
                <div className="max-w-7xl mx-auto px-4 pt-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                        <p className="text-yellow-400">
                            🪙 Every view is a chance to win Tokens! Watch for the celebration! 🎟️ Every <strong>10 unique views daily = 1 drawing entry</strong>!
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 py-6">
                {cards.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-400 text-lg">No advertiser cards available yet.</p>
                        <p className="text-slate-500 text-sm mt-2">Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                        {cards.map(card => {
                            const isViewed = user ? viewedCards.current.has(card.id) : demoViewedCards.current.has(card.id)
                            const canEarn = user && gameSettings?.is_enabled && !isViewed

                            return (
                                <div
                                    key={card.id}
                                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${isViewed ? 'border-green-500/50 opacity-75' : 'border-slate-700 hover:border-yellow-500/50'}`}
                                    style={{ aspectRatio: '3.5 / 2' }}
                                >
                                    {card.card_type === 'uploaded' && card.image_url ? (
                                        <img src={card.image_url} alt={card.title || 'Business Card'} className="w-full h-full object-contain bg-slate-800" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center p-2" style={{ backgroundColor: card.card_color || '#4F46E5' }}>
                                            <h3 className="font-bold text-center text-xs leading-tight line-clamp-2" style={{ color: card.text_color || '#FFFFFF' }}>{card.title}</h3>
                                        </div>
                                    )}

                                    {isViewed && (
                                        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">✓</div>
                                    )}

                                    <button
                                        onClick={(e) => viewCard(card, e)}
                                        className={`absolute bottom-1 right-1 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all shadow ${canEarn ? 'bg-yellow-500 hover:bg-yellow-400 hover:scale-110' : 'bg-white/80 hover:bg-white'}`}
                                        title={canEarn ? 'View for a chance to win!' : 'View card'}
                                    >
                                        <span className="text-lg sm:text-base">👁</span>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Demo CTA Box */}
            {!user && cards.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 pb-8">
                    <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
                        <h3 className="text-xl font-bold text-green-400 mb-2">🎁 Want to Earn Tokens?</h3>
                        <p className="text-slate-300 text-sm mb-4">
                            Register for FREE and start earning tokens for every card you view. Use tokens to enter weekly prize drawings!
                        </p>
                        <button
                            onClick={() => router.push('/auth/register')}
                            className="px-6 py-3 bg-green-900 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all"
                        >
                            REGISTER for FREE
                        </button>
                    </div>
                </div>
            )}

            {selectedCard && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={closeCard}>
                    <div className="max-w-lg w-full rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {selectedCard.card_type === 'uploaded' && selectedCard.image_url ? (
                            <div className="bg-slate-800">
                                <img src={selectedCard.image_url} alt={selectedCard.title || 'Business Card'} className="w-full h-auto max-h-[60vh] object-contain bg-slate-900" />
                                <div className="p-4">
                                    {selectedCard.title && <h2 className="text-white font-bold text-xl mb-2">{selectedCard.title}</h2>}
                                    {selectedCard.message && <p className="text-slate-300 text-sm mb-4">{selectedCard.message}</p>}
                                    <div className="text-slate-300 text-sm space-y-2">
                                        {selectedCard.phone && <p>📞 <a href={'tel:' + selectedCard.phone} className="hover:text-yellow-400">{selectedCard.phone}</a></p>}
                                        {selectedCard.email && <p>✉️ <a href={'mailto:' + selectedCard.email} className="hover:text-yellow-400">{selectedCard.email}</a></p>}
                                        {selectedCard.website && <p>🌐 <a href={selectedCard.website.startsWith('http') ? selectedCard.website : 'https://' + selectedCard.website} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">{selectedCard.website}</a></p>}
                                        {selectedCard.address && <p>📍 {selectedCard.address}</p>}
                                    </div>
                                    <button onClick={closeCard} className="mt-4 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg">Close</button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 sm:p-8" style={{ backgroundColor: selectedCard.card_color || '#4F46E5' }}>
                                <div className="text-center mb-6">
                                    <h2 className="font-bold text-2xl sm:text-3xl" style={{ color: selectedCard.text_color || '#FFFFFF' }}>{selectedCard.title}</h2>
                                </div>
                                {selectedCard.message && (
                                    <div className="text-center mb-6">
                                        <p className="text-base" style={{ color: selectedCard.text_color || '#FFFFFF', opacity: 0.9 }}>{selectedCard.message}</p>
                                    </div>
                                )}
                                <div className="text-center space-y-3" style={{ color: selectedCard.text_color || '#FFFFFF' }}>
                                    {selectedCard.phone && <p>📞 <a href={'tel:' + selectedCard.phone} className="hover:opacity-80">{selectedCard.phone}</a></p>}
                                    {selectedCard.email && <p>✉️ <a href={'mailto:' + selectedCard.email} className="hover:opacity-80">{selectedCard.email}</a></p>}
                                    {selectedCard.website && <p>🌐 <a href={selectedCard.website.startsWith('http') ? selectedCard.website : 'https://' + selectedCard.website} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">{selectedCard.website}</a></p>}
                                    {selectedCard.address && <p>📍 {selectedCard.address}</p>}
                                </div>
                                <button onClick={closeCard} className="mt-8 w-full py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}