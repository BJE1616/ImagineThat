'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function PricingPage() {
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

    const costPerView = (parseInt(settings.ad_price) / parseInt(settings.guaranteed_views)).toFixed(2)

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>

            {/* Header */}
            <section className={`py-8 px-4 border-b border-${currentTheme.border}`}>
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className={`text-2xl sm:text-3xl font-bold text-${currentTheme.text} mb-2`}>
                        Simple, Transparent Pricing
                    </h1>
                    <p className={`text-sm text-${currentTheme.textMuted}`}>
                        One price. Everything included. No hidden fees.
                    </p>
                </div>
            </section>

            {/* Pricing Card */}
            <section className={`py-8 px-4`}>
                <div className="max-w-md mx-auto">
                    <div className={`bg-${currentTheme.card} border-2 border-${currentTheme.accent} rounded-xl p-6`}>

                        {/* Price */}
                        <div className="text-center mb-6">
                            <div className={`text-5xl font-bold text-${currentTheme.text}`}>
                                ${settings.ad_price}
                            </div>
                            <p className={`text-sm text-${currentTheme.textMuted} mt-1`}>per ad campaign and it includes...</p>
                        </div>

                        {/* What's Included */}
                        <div className="space-y-3 mb-6">
                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>{parseInt(settings.guaranteed_views).toLocaleString()}+ Guaranteed Views (Possibly Free Bonus Views Also).</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>That's just ${costPerView} per view</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>Shown in All Games</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>(Memory Match, Slots, Solitaire Boards  and Card Gallery)</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>Real-Time Dashboard</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Track views as they happen</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>Bonus Views Possible</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Often exceed guaranteed amount</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>Clickable Website Link</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Drive traffic to your site</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <p className={`text-sm font-medium text-${currentTheme.text}`}>Optional Referral Matrix</p>
                                    <p className={`text-xs text-${currentTheme.textMuted}`}>Earn ${settings.matrix_payout} back!</p>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <Link
                            href="/advertise/start"
                            className="block w-full py-3 bg-green-900 text-white text-center text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all"
                        >
                            Start Your Campaign
                        </Link>
                    </div>
                </div>
            </section>

            {/* Comparison */}
            <section className={`py-6 px-4 bg-${currentTheme.card}/50`}>
                <div className="max-w-xl mx-auto text-center">
                    <h2 className={`text-lg font-bold text-${currentTheme.text} mb-4`}>
                        Compare the Value
                    </h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className={`p-3 bg-${currentTheme.bg} border border-${currentTheme.border} rounded-lg`}>
                            <p className={`text-${currentTheme.textMuted} text-xs mb-1`}>Social Media Ads</p>
                            <p className={`text-${currentTheme.text} font-bold`}>$1-5+ per click</p>
                        </div>
                        <div className={`p-3 bg-green-900/20 border border-green-700 rounded-lg`}>
                            <p className={`text-${currentTheme.textMuted} text-xs mb-1`}>ImagineThat.icu</p>
                            <p className="text-green-500 font-bold">${costPerView} per view</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom Links */}
            <section className={`py-6 px-4 border-t border-${currentTheme.border}`}>
                <div className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/advertise"
                        className={`px-5 py-2 text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-center transition-all`}
                    >
                        ← How It Works
                    </Link>
                    <Link
                        href="/advertise/matrix"
                        className={`px-5 py-2 text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-center transition-all`}
                    >
                        Learn About the Matrix →
                    </Link>
                </div>
            </section>

        </div>
    )
}