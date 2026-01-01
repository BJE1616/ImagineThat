'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaymentsRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/admin/payout-queue')
    }, [router])

    return (
        <div className="p-4 text-slate-400">
            Redirecting to Payout Queue...
        </div>
    )
}