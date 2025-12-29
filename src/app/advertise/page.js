'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function AdvertisePage() {
    const { currentTheme } = useTheme()
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200'
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
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
            console.error('Error fetching settings:', error)
        }
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>

            {/* Hero Section */}
            <section className={`py-8 px-4 border-b border-${currentTheme.border}`}>
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className={`text-2xl sm:text-3xl font-bold text-${currentTheme.text} mb-2`}>
                        Put Your Business in the Game
                    </h1>
                    <p className={`text-sm sm:text-base text-${currentTheme.textMuted} mb-5`}>
                        Advertise Where People Actually Pay Attention
                    </p>
                    <div className="flex flex-row gap-3 justify-center">
                        <Link
                            href="/advertise/pricing"
                            className="px-5 py-2 bg-green-900 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all"
                        >
                            See Pricing
                        </Link>
                        <Link
                            href="/advertise/start"
                            className="px-5 py-2 bg-green-900 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all"
                        >
                            Start a Campaign
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className={`py-8 px-4`}>
                <div className="max-w-4xl mx-auto">
                    <h2 className={`text-xl font-bold text-${currentTheme.text} text-center mb-6`}>
                        How It Works
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Step 1 */}
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 text-center`}>
                            <div className="text-2xl mb-2">🚀</div>
                            <div className={`text-${currentTheme.accent} font-bold text-xs mb-1`}>STEP 1</div>
                            <h3 className={`text-sm font-bold text-${currentTheme.text} mb-1`}>
                                Create Your Business Card
                            </h3>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>
                                Design your digital card with your info, or upload an existing business card. Free!
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 text-center`}>
                            <div className="text-2xl mb-2">🚀</div>
                            <div className={`text-${currentTheme.accent} font-bold text-xs mb-1`}>STEP 2</div>
                            <h3 className={`text-sm font-bold text-${currentTheme.text} mb-1`}>
                                Launch Your Campaign
                            </h3>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>
                                For ${settings.ad_price}, get {parseInt(settings.guaranteed_views).toLocaleString()}+ guaranteed views across all games.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 text-center`}>
                            <div className="text-2xl mb-2">👀</div>
                            <div className={`text-${currentTheme.accent} font-bold text-xs mb-1`}>STEP 3</div>
                            <h3 className={`text-sm font-bold text-${currentTheme.text} mb-1`}>
                                Get Views While They Play
                            </h3>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>
                                Track views in real-time from your dashboard.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Where Your Ad Appears Section */}
            <section className={`py-6 px-4 bg-${currentTheme.card}/50`}>
                <div className="max-w-4xl mx-auto">
                    <h2 className={`text-lg font-bold text-${currentTheme.text} text-center mb-4`}>
                        Where Your Ad Appears
                    </h2>

                    <div className="flex flex-wrap justify-center gap-4 text-center">
                        <div className={`flex items-center gap-2 px-4 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg`}>
                            <span className="text-xl">🃏</span>
                            <div className="text-left">
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Memory Match</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>Players flip & match YOUR CARDd!</p>
                            </div>
                        </div>

                        <div className={`flex items-center gap-2 px-4 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg`}>
                            <span className="text-xl">🎰</span>
                            <div className="text-left">
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Slot Machine</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>YOUR CARD In The Game!</p>
                            </div>
                        </div>

                        <div className={`flex items-center gap-2 px-4 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg`}>
                            <span className="text-xl">🎁</span>
                            <div className="text-left">
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Card Gallery</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>Players view YOUR CARD to earn tokens!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Matrix Teaser Banner */}
            <section className={`py-6 px-4 border-t border-${currentTheme.border}`}>
                <div className="max-w-3xl mx-auto">
                    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <div className="flex items-center gap-3 text-center sm:text-left">
                            <span className="text-2xl">🔄</span>
                            <div>
                                <p className={`text-sm font-bold text-${currentTheme.text}`}>
                                    Want to Earn ${settings.matrix_payout} Back?
                                </p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>
                                    Refer 2 advertisers = ${parseInt(settings.matrix_payout) - parseInt(settings.ad_price)} profit!
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/advertise/matrix"
                            className="px-4 py-2 bg-green-900 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all whitespace-nowrap"
                        >
                            Learn More
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    )
}