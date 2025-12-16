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
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <p className="text-slate-400 text-xs">Total Cancellations</p>
                    <p className="text-xl font-bold text-red-400">{cancellations.length}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <p className="text-slate-400 text-xs">Views Forfeited</p>
                    <p className="text-xl font-bold text-amber-400">
                        {cancellations.reduce((sum, c) => sum + (c.views_remaining_at_cancel || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                    <p className="text-slate-400 text-xs">Revenue (Cancelled)</p>
                    <p className="text-xl font-bold text-green-400">
                        ${cancellations.reduce((sum, c) => sum + (c.amount_paid || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Cancellations Table */}
            <div className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-700">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">User</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Views Used</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Forfeited</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Paid</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Reason</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Confirmed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {cancellations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-sm">
                                        No cancelled campaigns yet
                                    </td>
                                </tr>
                            ) : (
                                cancellations.map((cancel) => (
                                    <tr key={cancel.id} className="hover:bg-slate-700/50">
                                        <td className="px-3 py-2">
                                            <p className="text-white font-medium text-xs">{cancel.user?.username || 'Unknown'}</p>
                                            <p className="text-slate-400 text-[10px]">{cancel.user?.email || ''}</p>
                                        </td>
                                        <td className="px-3 py-2">
                                            <p className="text-white text-xs">
                                                {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleDateString() : 'N/A'}
                                            </p>
                                            <p className="text-slate-400 text-[10px]">
                                                {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleTimeString() : ''}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-white text-xs">{getTotalViews(cancel).toLocaleString()}</span>
                                            <span className="text-slate-400 text-[10px]"> / {cancel.views_guaranteed?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-red-400 font-medium text-xs">
                                                {(cancel.views_remaining_at_cancel || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-green-400 text-xs">${cancel.amount_paid || 0}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-slate-300 text-xs">
                                                {cancel.cancelled_reason || 'No reason'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {cancel.cancelled_confirmation === 'END CAMPAIGN' ? (
                                                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full">
                                                    ✓ Verified
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full">
                                                    Not verified
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reason Breakdown */}
            {cancellations.length > 0 && (
                <div className="mt-4 bg-slate-800 border border-slate-700 rounded p-3">
                    <h2 className="text-sm font-bold text-white mb-2">Cancellation Reasons</h2>
                    <div className="space-y-1.5">
                        {Object.entries(
                            cancellations.reduce((acc, c) => {
                                const reason = c.cancelled_reason || 'No reason provided'
                                acc[reason] = (acc[reason] || 0) + 1
                                return acc
                            }, {})
                        ).map(([reason, count]) => (
                            <div key={reason} className="flex items-center justify-between text-xs">
                                <span className="text-slate-300">{reason}</span>
                                <span className="px-2 py-0.5 bg-slate-700 text-white rounded-full">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}