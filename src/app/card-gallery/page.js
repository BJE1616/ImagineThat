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
    const [bbBalance, setBbBalance] = useState(0)
    const [viewedToday, setViewedToday] = useState(0)
    const [dailyLimit, setDailyLimit] = useState(50)
    const [bbPerView, setBbPerView] = useState(1)
    const [selectedCard, setSelectedCard] = useState(null)
    const [message, setMessage] = useState(null)
    const [gameSettings, setGameSettings] = useState(null)
    const viewedCards = useRef(new Set())

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

                setBbBalance(balanceData?.balance || 0)

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
            }
        } catch (error) {
            console.error('Error checking user:', error)
        }
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
                setBbPerView(data.bb_min || 1)
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

    const viewCard = async (card) => {
        setSelectedCard(card)

        if (!user) return
        if (!gameSettings?.is_enabled) return
        if (viewedCards.current.has(card.id)) return

        const todayBBEarned = viewedToday * bbPerView
        if (todayBBEarned >= dailyLimit) {
            setMessage({ type: 'info', text: 'Daily BB limit reached (' + dailyLimit + ' BB)' })
            setTimeout(() => setMessage(null), 3000)
            return
        }

        try {
            await supabase
                .from('card_gallery_views')
                .insert([{
                    user_id: user.id,
                    card_id: card.id,
                    advertiser_id: card.user_id
                }])

            const bbEarned = bbPerView

            const { data: existingBalance } = await supabase
                .from('bb_balances')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (existingBalance) {
                await supabase
                    .from('bb_balances')
                    .update({
                        balance: existingBalance.balance + bbEarned,
                        total_earned: (existingBalance.total_earned || 0) + bbEarned,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', user.id)
            } else {
                await supabase
                    .from('bb_balances')
                    .insert([{
                        user_id: user.id,
                        balance: bbEarned,
                        total_earned: bbEarned
                    }])
            }

            await supabase
                .from('bb_transactions')
                .insert([{
                    user_id: user.id,
                    type: 'earn',
                    amount: bbEarned,
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

            viewedCards.current.add(card.id)
            setBbBalance(prev => prev + bbEarned)
            setViewedToday(prev => prev + 1)

            setMessage({ type: 'success', text: '+' + bbEarned + ' BB earned!' })
            setTimeout(() => setMessage(null), 2000)

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
            <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">🖼️ Card Gallery</h1>
                            <p className="text-slate-400 text-sm">Browse advertiser cards and earn BB</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {message && (
                                <div className={message.type === 'success' ? 'px-3 py-1 rounded text-sm bg-green-500/20 text-green-400' : 'px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-400'}>
                                    {message.text}
                                </div>
                            )}
                            {user ? (
                                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-2 text-right">
                                    <p className="text-yellow-400 font-bold text-lg">{bbBalance} BB</p>
                                    <p className="text-slate-400 text-xs">{viewedToday * bbPerView}/{dailyLimit} BB today</p>
                                </div>
                            ) : (
                                <button
                                    onClick={() => router.push('/auth/login')}
                                    className="px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium hover:bg-yellow-400"
                                >
                                    Login to Earn BB
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
                            💰 Earn <strong>{bbPerView} BB</strong> for each new card you view! Daily limit: <strong>{dailyLimit} BB</strong>
                            {viewedCards.current.size > 0 && (
                                <span className="text-slate-400 ml-2">({viewedCards.current.size} cards viewed today)</span>
                            )}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {cards.map(card => (
                            <div
                                key={card.id}
                                onClick={() => viewCard(card)}
                                className={viewedCards.current.has(card.id)
                                    ? 'relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-green-500/50'
                                    : 'relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-slate-700 hover:border-yellow-500'
                                }
                            >
                                {card.card_type === 'uploaded' && card.image_url ? (
                                    <img src={card.image_url} alt={card.title || 'Business Card'} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-2" style={{ backgroundColor: card.card_color || '#4F46E5' }}>
                                        <h3 className="font-bold text-center text-sm" style={{ color: card.text_color || '#FFFFFF' }}>{card.title}</h3>
                                    </div>
                                )}
                                {viewedCards.current.has(card.id) && (
                                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">✓</div>
                                )}
                                {user && !viewedCards.current.has(card.id) && gameSettings?.is_enabled && viewedToday * bbPerView < dailyLimit && (
                                    <div className="absolute bottom-1 right-1 bg-yellow-500 text-slate-900 text-xs px-1.5 py-0.5 rounded-full font-bold">+{bbPerView} BB</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedCard && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeCard}>
                    <div className="max-w-md w-full rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {selectedCard.card_type === 'uploaded' && selectedCard.image_url ? (
                            <div className="bg-slate-800">
                                <img src={selectedCard.image_url} alt={selectedCard.title || 'Business Card'} className="w-full h-auto" />
                                <div className="p-4">
                                    {selectedCard.title && <h2 className="text-white font-bold text-lg mb-2">{selectedCard.title}</h2>}
                                    {selectedCard.message && <p className="text-slate-400 text-sm mb-3">{selectedCard.message}</p>}
                                    <div className="text-slate-400 text-sm space-y-1">
                                        {selectedCard.phone && <p>📞 {selectedCard.phone}</p>}
                                        {selectedCard.email && <p>✉️ {selectedCard.email}</p>}
                                        {selectedCard.website && <p>🌐 <a href={selectedCard.website.startsWith('http') ? selectedCard.website : 'https://' + selectedCard.website} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">{selectedCard.website}</a></p>}
                                    </div>
                                    <button onClick={closeCard} className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg">Close</button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6" style={{ backgroundColor: selectedCard.card_color || '#4F46E5' }}>
                                <div className="text-center mb-4">
                                    <h2 className="font-bold text-2xl" style={{ color: selectedCard.text_color || '#FFFFFF' }}>{selectedCard.title}</h2>
                                </div>
                                {selectedCard.message && (
                                    <div className="text-center mb-4">
                                        <p className="text-sm" style={{ color: selectedCard.text_color || '#FFFFFF' }}>{selectedCard.message}</p>
                                    </div>
                                )}
                                <div className="text-center space-y-2" style={{ color: selectedCard.text_color || '#FFFFFF' }}>
                                    {selectedCard.phone && <p className="text-sm">📞 {selectedCard.phone}</p>}
                                    {selectedCard.email && <p className="text-sm">✉️ {selectedCard.email}</p>}
                                    {selectedCard.website && <p className="text-sm">🌐 <a href={selectedCard.website.startsWith('http') ? selectedCard.website : 'https://' + selectedCard.website} target="_blank" rel="noopener noreferrer" className="underline">{selectedCard.website}</a></p>}
                                </div>
                                <button onClick={closeCard} className="mt-6 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
