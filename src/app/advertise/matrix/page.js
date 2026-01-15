'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function MatrixPage() {
    const { currentTheme } = useTheme()
    const router = useRouter()
    const [settings, setSettings] = useState({
        guaranteed_views: '1000',
        ad_price: '100',
        matrix_payout: '200'
    })
    const [hasActiveCampaign, setHasActiveCampaign] = useState(false)

    useEffect(() => {
        fetchSettings()
        checkUserCampaign()
    }, [])

    const checkUserCampaign = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: campaigns } = await supabase
                .from('ad_campaigns')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .limit(1)

            if (campaigns && campaigns.length > 0) {
                setHasActiveCampaign(true)
            }
        } catch (error) {
            console.error('Error checking campaign:', error)
        }
    }

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

    const profit = parseInt(settings.matrix_payout) - parseInt(settings.ad_price)

    return (
        <div className={`min-h-screen bg-${currentTheme.bg}`}>

            {/* Header */}
            <section className={`py-8 px-4 border-b border-${currentTheme.border}`}>
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className={`text-2xl sm:text-3xl font-bold text-${currentTheme.text} mb-2`}>
                        The Referral Matrix
                    </h1>
                    <p className={`text-sm text-${currentTheme.textMuted}`}>
                        You and then just 6 spots below.
                    </p>
                </div>
            </section>

            {/* How It Works */}
            <section className={`py-8 px-4`}>
                <div className="max-w-lg mx-auto">

                    {/* Visual Matrix */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-xl p-5 mb-6`}>
                        <p className={`text-xs text-${currentTheme.textMuted} text-center mb-4`}>Your Matrix Structure</p>

                        {/* Pyramid Visual */}
                        <div className="flex flex-col items-center gap-2 mb-4">
                            {/* Row 1 - You */}
                            <div className="flex justify-center">
                                <div className={`w-14 h-10 bg-${currentTheme.accent}/30 border-2 border-${currentTheme.accent} rounded text-xs flex items-center justify-center text-${currentTheme.accent} font-bold`}>
                                    YOU
                                </div>
                            </div>

                            {/* Row 2 - Your Referrals */}
                            <div className="flex justify-center gap-3">
                                <div className={`w-12 h-8 bg-green-500/20 border border-green-500 rounded text-xs flex items-center justify-center text-green-500`}>2</div>
                                <div className={`w-12 h-8 bg-green-500/20 border border-green-500 rounded text-xs flex items-center justify-center text-green-500`}>3</div>
                            </div>

                            {/* Row 3 - Their Referrals */}
                            <div className="flex justify-center gap-2">
                                <div className={`w-10 h-7 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>4</div>
                                <div className={`w-10 h-7 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>5</div>
                                <div className={`w-10 h-7 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>6</div>
                                <div className={`w-10 h-7 bg-${currentTheme.border} border border-${currentTheme.textMuted} rounded text-xs flex items-center justify-center text-${currentTheme.textMuted}`}>7</div>
                            </div>
                        </div>


                    </div>

                    {/* Steps */}
                    <div className="space-y-3 mb-6">
                        <div className={`flex gap-3 p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                            <span className={`text-${currentTheme.accent} font-bold`}>1</span>
                            <div>
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Start a campaign for ${settings.ad_price}</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>Each paid Ad campaign is allowed to join the optional Matrix for Free!</p>
                            </div>
                        </div>

                        <div className={`flex gap-3 p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                            <span className={`text-${currentTheme.accent} font-bold`}>2</span>
                            <div>
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Refer 2 people (spots 2 & 3)</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>Refer just 2 people who buy ads (they input your username) and if they do the same thing you did then it's done and you get paid! </p>
                            </div>
                        </div>

                        <div className={`flex gap-3 p-3 bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg`}>
                            <span className={`text-${currentTheme.accent} font-bold`}>3</span>
                            <div>
                                <p className={`text-sm font-medium text-${currentTheme.text}`}>Spots 4-7</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>You can fill them, people under you can fill them or you may receive Free auto placements under you if people join and don't have anyone who referred them!</p>
                            </div>
                        </div>

                        <div className={`flex gap-3 p-3 bg-green-900/20 border border-green-700 rounded-lg`}>
                            <span className="text-green-500 font-bold">4</span>
                            <div>
                                <p className={`text-sm font-medium text-green-400`}>Get paid ${settings.matrix_payout}!</p>
                                <p className={`text-xs text-${currentTheme.textMuted}`}>You'll get $100 as a thank you, $100 additonal dollars for the ad campaign you paid for and you will still receive your ads as promised and possibly even Free bonus ad views! That's a ${profit} profit on your ${settings.ad_price} campaign.</p>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    {hasActiveCampaign ? (
                        <button
                            onClick={() => router.push('/dashboard?joinMatrix=true')}
                            className="block w-full py-3 bg-green-600 text-white text-center text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-500 hover:-translate-y-1 transition-all"
                        >
                            Join Matrix Now
                        </button>
                    ) : (
                        <Link
                            href="/advertise/start"
                            className="block w-full py-3 bg-green-900 text-white text-center text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-green-800 hover:-translate-y-1 transition-all"
                        >
                            Start Your Campaign
                        </Link>
                    )}
                </div>
            </section>

            {/* FAQ */}
            <section className={`py-6 px-4 bg-${currentTheme.card}/50`}>
                <div className="max-w-lg mx-auto">
                    <h2 className={`text-lg font-bold text-${currentTheme.text} mb-4 text-center`}>Quick Questions</h2>

                    <div className="space-y-3 text-sm">
                        <div>
                            <p className={`font-medium text-${currentTheme.text}`}>Is the matrix required?</p>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>No! It's completely optional. Your ad campaign works the same either way.  It's just an optional way to make some money as a thank you from us.</p>
                        </div>

                        <div>
                            <p className={`font-medium text-${currentTheme.text}`}>What if I don't refer anyone?</p>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Nothing!  BTW, it's actually possible you could get placements from other users or auto-placements from the system; however, referring just two people who buy ads greatly increase your odds of completing the matrix.</p>
                        </div>

                        <div>
                            <p className={`font-medium text-${currentTheme.text}`}>How do I get paid?</p>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>When your matrix completes, the system notifies both you and us, and we transfer cash to your preferred account (selected in your settings).</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom Links */}
            <section className={`py-6 px-4 border-t border-${currentTheme.border}`}>
                <div className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/advertise/pricing"
                        className={`px-5 py-2 text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-center transition-all`}
                    >
                        ← View Pricing
                    </Link>
                    <Link
                        href="/advertise"
                        className={`px-5 py-2 text-sm text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-center transition-all`}
                    >
                        How It Works →
                    </Link>
                </div>
            </section>

        </div>
    )
}