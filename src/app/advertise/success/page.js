'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdvertiseSuccessPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [campaign, setCampaign] = useState(null)

    useEffect(() => {
        const campaignId = searchParams.get('campaign_id')
        if (campaignId) {
            loadCampaign(campaignId)
        } else {
            setLoading(false)
        }
    }, [searchParams])

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
                <button
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-3 bg-yellow-500 text-slate-900 font-bold rounded-lg hover:bg-yellow-400"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    )
}