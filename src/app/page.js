'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function HomePage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [weeklyPrize, setWeeklyPrize] = useState(null)
    const [user, setUser] = useState(null)

    useEffect(() => {
        checkUser()
        loadWeeklyPrize()
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
    }

    const loadWeeklyPrize = async () => {
        try {
            const today = new Date()
            const dayOfWeek = today.getDay()
            const weekStart = new Date(today)
            weekStart.setDate(today.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)

            const { data } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('week_start', weekStart.toISOString().split('T')[0])
                .eq('is_active', true)
                .maybeSingle()

            if (data) setWeeklyPrize(data)
        } catch (error) {
            console.log('No prize this week')
        }
    }

    const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd']
        const v = n % 100
        return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                {/* Background gradient blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute top-20 right-1/4 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl"></div>
                </div>

                <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24 text-center">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <img
                            src="https://ihckzrkcnwnxldupslst.supabase.co/storage/v1/object/public/business-cards/IT%20LOGO.png"
                            alt="Imagine That"
                            className="w-48 sm:w-64 h-auto"
                        />
                    </div>

                    {/* Headline */}
                    <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-${currentTheme.text} mb-4`}>
                        Play Games. <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-teal-400">Earn Rewards.</span>
                    </h1>
                    <p className={`text-lg sm:text-xl text-${currentTheme.textMuted} max-w-2xl mx-auto mb-8`}>
                        Win real prizes playing fun games — or advertise your business and get paid to do it.
                        We've flipped advertising on its head.
                    </p>

                    {/* Dual CTAs */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => router.push('/games')}
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg rounded-xl hover:from-purple-500 hover:to-pink-400 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                        >
                            🎮 Start Playing
                        </button>
                        <button
                            onClick={() => router.push('/advertise')}
                            className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-400 text-white font-bold text-lg rounded-xl hover:from-teal-400 hover:to-cyan-300 transition-all shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                        >
                            📢 Advertise Your Business
                        </button>
                    </div>

                    {user && (
                        <p className={`mt-6 text-${currentTheme.textMuted}`}>
                            Welcome back! <a href="/dashboard" className={`text-${currentTheme.accent} hover:underline`}>Go to Dashboard →</a>
                        </p>
                    )}
                </div>
            </section>

            {/* Weekly Prize Banner */}
            {weeklyPrize && (
                <section className="max-w-4xl mx-auto px-4 -mt-4 mb-12">
                    <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-6 text-center shadow-xl">
                        <p className="text-white/90 font-medium mb-1">🏆 This Week's Prize 🏆</p>
                        {weeklyPrize.is_surprise ? (
                            <p className="text-2xl sm:text-3xl font-bold text-white">🎁 Surprise Prize! Play to find out!</p>
                        ) : weeklyPrize.prize_type === 'cash' ? (
                            <>
                                <p className="text-3xl sm:text-4xl font-bold text-white">${weeklyPrize.total_prize_pool}</p>
                                <p className="text-white/90">
                                    {weeklyPrize.number_of_winners === 1 ? 'Winner takes all!' : `Split among top ${weeklyPrize.number_of_winners} players`}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-2xl sm:text-3xl font-bold text-white">🎁 {weeklyPrize.prize_type === 'merchandise' ? 'Merchandise Prizes!' : 'Special Prize!'}</p>
                                <div className="text-white/90 text-sm mt-1">
                                    {weeklyPrize.prize_descriptions?.filter(d => d).slice(0, 3).map((desc, i) => (
                                        <span key={i}>{i > 0 && ' • '}{getOrdinal(i + 1)}: {desc}</span>
                                    ))}
                                </div>
                            </>
                        )}
                        <button
                            onClick={() => router.push('/games')}
                            className="mt-4 px-6 py-2 bg-white text-red-600 font-bold rounded-lg hover:bg-gray-100 transition-all"
                        >
                            Play Now →
                        </button>
                    </div>
                </section>
            )}

            {/* How It Works - Players */}
            <section className={`py-16 bg-${currentTheme.card}`}>
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="text-purple-500 font-semibold text-sm uppercase tracking-wide">For Players</span>
                        <h2 className={`text-3xl sm:text-4xl font-bold text-${currentTheme.text} mt-2`}>How It Works</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">🎮</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>1. Play Games</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Enjoy fun games like Memory Match and Solitaire. Compete for the best scores each week.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">🪙</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>2. Earn Tokens</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Earn tokens as you play. Use them to redeem merchandise in our store.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">🏆</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>3. Win Prizes</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Top the leaderboard and win real weekly prizes — cash, merch, and more!
                            </p>
                        </div>
                    </div>

                    <div className="text-center mt-10">
                        <button
                            onClick={() => router.push(user ? '/games' : '/auth/register')}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-400 transition-all"
                        >
                            {user ? 'Play Now' : 'Create Free Account'}
                        </button>
                    </div>
                </div>
            </section>

            {/* How It Works - Advertisers */}
            <section className="py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="text-teal-500 font-semibold text-sm uppercase tracking-wide">For Businesses</span>
                        <h2 className={`text-3xl sm:text-4xl font-bold text-${currentTheme.text} mt-2`}>Creative Advertising</h2>
                        <p className={`text-${currentTheme.textMuted} mt-2 max-w-xl mx-auto`}>
                            We've flipped advertising on its head. Get seen by engaged customers — and potentially earn money back.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">🎨</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>1. Create Your Card</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Design a digital business card or upload your own. It takes just minutes.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">🚀</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>2. Launch Campaign</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Start a campaign for just $100. Your card gets shown to players during games.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-3xl">💰</span>
                            </div>
                            <h3 className={`text-xl font-bold text-${currentTheme.text} mb-2`}>3. Earn It Back</h3>
                            <p className={`text-${currentTheme.textMuted}`}>
                                Optional: Join our referral matrix and earn up to $200 — free ads plus profit!
                            </p>
                        </div>
                    </div>

                    <div className="text-center mt-10">
                        <button
                            onClick={() => router.push('/advertise')}
                            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-400 text-white font-bold rounded-xl hover:from-teal-400 hover:to-cyan-300 transition-all"
                        >
                            Learn More About Advertising
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className={`py-16 bg-${currentTheme.card}`}>
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className={`text-3xl sm:text-4xl font-bold text-${currentTheme.text}`}>Why Imagine That?</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: '🎯', title: 'Engaged Audience', desc: 'Players actually see your ads — not scrolling past them' },
                            { icon: '💵', title: 'Affordable', desc: 'Just $100 to start. No complicated pricing.' },
                            { icon: '🔄', title: 'Earn Back', desc: 'Unique referral system lets you profit from advertising' },
                            { icon: '🎁', title: 'Real Prizes', desc: 'Weekly prizes keep players coming back' },
                            { icon: '📱', title: 'Mobile Friendly', desc: 'Play anywhere, anytime on any device' },
                            { icon: '🛡️', title: 'No Spam', desc: 'Clean, fun environment for your brand' },
                            { icon: '📊', title: 'Track Results', desc: 'See exactly how many views your card gets' },
                            { icon: '⚡', title: 'Quick Setup', desc: 'Launch your campaign in under 5 minutes' },
                        ].map((feature, i) => (
                            <div key={i} className={`p-5 bg-${currentTheme.bg} rounded-xl border border-${currentTheme.border}`}>
                                <span className="text-2xl mb-2 block">{feature.icon}</span>
                                <h3 className={`font-bold text-${currentTheme.text} mb-1`}>{feature.title}</h3>
                                <p className={`text-sm text-${currentTheme.textMuted}`}>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className={`text-3xl sm:text-4xl font-bold text-${currentTheme.text}`}>Questions?</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                q: 'Is it really free to play?',
                                a: 'Yes! Playing games and earning tokens is completely free. Create an account and start playing right away.'
                            },
                            {
                                q: 'How do I win prizes?',
                                a: 'Each week, top players on the leaderboard win prizes. Lower scores win — so fewer moves and faster times are better!'
                            },
                            {
                                q: 'How much does advertising cost?',
                                a: 'Campaigns start at just $100. Your digital business card gets shown to players during gameplay.'
                            },
                            {
                                q: 'What\'s the referral matrix?',
                                a: 'It\'s optional! When you advertise, you can join our referral matrix. Fill your 6 spots and earn $200 back — that\'s your original $100 plus $100 profit.'
                            },
                            {
                                q: 'What kind of businesses can advertise?',
                                a: 'Any legitimate local or online business! Restaurants, shops, services, freelancers — if you have a business card, you can advertise here.'
                            },
                        ].map((faq, i) => (
                            <div key={i} className={`p-5 bg-${currentTheme.card} rounded-xl border border-${currentTheme.border}`}>
                                <h3 className={`font-bold text-${currentTheme.text} mb-2`}>{faq.q}</h3>
                                <p className={`text-${currentTheme.textMuted}`}>{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            Ready to Get Started?
                        </h2>
                        <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
                            Join thousands of players winning real prizes — or put your business in front of engaged customers.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => router.push(user ? '/games' : '/auth/register')}
                                className="px-8 py-4 bg-white text-purple-600 font-bold text-lg rounded-xl hover:bg-gray-100 transition-all"
                            >
                                {user ? '🎮 Play Now' : '🎮 Create Free Account'}
                            </button>
                            <button
                                onClick={() => router.push('/advertise')}
                                className="px-8 py-4 bg-white/20 text-white font-bold text-lg rounded-xl hover:bg-white/30 transition-all border-2 border-white/50"
                            >
                                📢 Advertise for $100
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={`py-8 border-t border-${currentTheme.border}`}>
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img
                                src="https://ihckzrkcnwnxldupslst.supabase.co/storage/v1/object/public/business-cards/IT%20LOGO.png"
                                alt="Imagine That"
                                className="w-8 h-8 object-contain"
                            />
                            <span className={`font-bold text-${currentTheme.text}`}>Imagine That</span>
                        </div>
                        <div className={`flex gap-6 text-sm text-${currentTheme.textMuted}`}>
                            <a href="/games" className={`hover:text-${currentTheme.accent}`}>Games</a>
                            <a href="/advertise" className={`hover:text-${currentTheme.accent}`}>Advertise</a>
                            <a href="/store" className={`hover:text-${currentTheme.accent}`}>Store</a>
                            <a href="/auth/login" className={`hover:text-${currentTheme.accent}`}>Sign In</a>
                        </div>
                        <p className={`text-sm text-${currentTheme.textMuted}`}>
                            © 2025 Imagine That. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}