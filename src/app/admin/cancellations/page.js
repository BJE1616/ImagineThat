'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminCancellationsPage() {
    const [cancellations, setCancellations] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadCancellations()
    }, [])

    const loadCancellations = async () => {
        try {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select(`
                    *,
                    user:users (
                        id,
                        username,
                        email,
                        first_name,
                        last_name
                    )
                `)
                .eq('status', 'cancelled')
                .order('cancelled_at', { ascending: false })

            if (error) throw error
            setCancellations(data || [])
        } catch (error) {
            console.error('Error loading cancellations:', error)
        } finally {
            setLoading(false)
        }
    }

    const getTotalViews = (camp) => {
        return (camp.views_from_game || 0) + (camp.views_from_flips || 0)
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-slate-700 rounded w-48"></div>
                    <div className="h-64 bg-slate-800 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-lg font-bold text-white">Campaign Cancellations</h1>
                <p className="text-slate-400 text-xs">View all cancelled campaigns and details</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <p className="text-slate-400 text-[10px]">Total Cancellations</p>
                    <p className="text-sm font-bold text-red-400">{cancellations.length}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <p className="text-slate-400 text-[10px]">Views Forfeited</p>
                    <p className="text-sm font-bold text-amber-400">
                        {cancellations.reduce((sum, c) => sum + (c.views_remaining_at_cancel || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                    <p className="text-slate-400 text-[10px]">Revenue (Cancelled)</p>
                    <p className="text-sm font-bold text-green-400">
                        ${cancellations.reduce((sum, c) => sum + (c.amount_paid || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Cancellation Cards */}
            {cancellations.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded p-6 text-center">
                    <p className="text-slate-400 text-sm">No cancelled campaigns yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {cancellations.map((cancel) => (
                        <div key={cancel.id} className="bg-slate-800 border border-slate-700 rounded p-3">
                            {/* Header Row - User & Date */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-white font-medium text-sm">{cancel.user?.username || 'Unknown'}</p>
                                    <p className="text-slate-400 text-[10px]">{cancel.user?.email || ''}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white text-xs">
                                        {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                    <p className="text-slate-400 text-[10px]">
                                        {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleTimeString() : ''}
                                    </p>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Views Used</p>
                                    <p className="text-white text-xs font-medium">
                                        {getTotalViews(cancel).toLocaleString()}
                                        <span className="text-slate-400 font-normal"> / {cancel.views_guaranteed?.toLocaleString()}</span>
                                    </p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Forfeited</p>
                                    <p className="text-red-400 text-xs font-medium">
                                        {(cancel.views_remaining_at_cancel || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Paid</p>
                                    <p className="text-green-400 text-xs font-medium">${cancel.amount_paid || 0}</p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-[10px]">Confirmed</p>
                                    {cancel.cancelled_confirmation === 'END CAMPAIGN' ? (
                                        <span className="text-green-400 text-xs font-medium">✓ Verified</span>
                                    ) : (
                                        <span className="text-red-400 text-xs font-medium">Not verified</span>
                                    )}
                                </div>
                            </div>

                            {/* Reason Row */}
                            <div className="bg-slate-700/30 rounded p-2 border-l-2 border-amber-500">
                                <p className="text-slate-400 text-[10px] mb-0.5">Reason</p>
                                <p className="text-slate-200 text-xs">{cancel.cancelled_reason || 'No reason provided'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}