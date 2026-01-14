'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function SuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [campaign, setCampaign] = useState(null)
    const [matrixPayout, setMatrixPayout] = useState('200')

    useEffect(() => {
        const campaignId = searchParams.get('campaign_id')
        if (campaignId) {
            loadCampaign(campaignId)
        } else {
            setLoading(false)
        }
        fetchMatrixPayout()
    }, [searchParams])

    const fetchMatrixPayout = async () => {
        const { data } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'matrix_payout')
            .single()
        if (data?.setting_value) {
            setMatrixPayout(data.setting_value)
        }
    }

    const loadCampaign = async (id) => {
        const { data } = await supabase
            .from('ad_campaigns')
            .select('*')
            .eq('id', id)
            .single()
        setCampaign(data)
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 py-8 px-4">
            <div className="max-w-md mx-auto text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                </div>
                <h1 className="text-2xl font-bold text-green-400 mb-2">Payment Successful!</h1>
                <p className="text-slate-400 mb-6">
                    {campaign?.status === 'active'
                        ? 'Your ad campaign is now live!'
                        : 'Your campaign is queued and will go live soon.'}
                </p>

                {/* Matrix Promo Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
                    <h2 className="text-xl font-bold text-yellow-400 mb-2">Want to earn ${matrixPayout}?</h2>
                    <p className="text-slate-400 text-sm mb-4">
                        Join our free referral program! Help 6 other businesses advertise and earn ${matrixPayout} cash back.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500"
                        >
                            Yes, tell me more
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-6 py-3 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600"
                        >
                            No thanks, go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SuccessLoading() {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
}

export default function AdvertiseSuccessPage() {
    return (
        <Suspense fallback={<SuccessLoading />}>
            <SuccessContent />
        </Suspense>
    )
}