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
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-64"></div>
                    <div className="h-96 bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Campaign Cancellations</h1>
                <p className="text-slate-400 mt-1">View all cancelled campaigns and details</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total Cancellations</p>
                    <p className="text-2xl font-bold text-red-400">{cancellations.length}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total Views Forfeited</p>
                    <p className="text-2xl font-bold text-amber-400">
                        {cancellations.reduce((sum, c) => sum + (c.views_remaining_at_cancel || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Revenue from Cancelled</p>
                    <p className="text-2xl font-bold text-green-400">
                        ${cancellations.reduce((sum, c) => sum + (c.amount_paid || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Cancellations Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Views Used</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Forfeited</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Amount Paid</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Reason</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Confirmed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {cancellations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        No cancelled campaigns yet
                                    </td>
                                </tr>
                            ) : (
                                cancellations.map((cancel) => (
                                    <tr key={cancel.id} className="hover:bg-slate-700/50">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-white font-medium">{cancel.user?.username || 'Unknown'}</p>
                                                <p className="text-slate-400 text-xs">{cancel.user?.email || ''}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-white text-sm">
                                                    {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleDateString() : 'N/A'}
                                                </p>
                                                <p className="text-slate-400 text-xs">
                                                    {cancel.cancelled_at ? new Date(cancel.cancelled_at).toLocaleTimeString() : ''}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-white">{getTotalViews(cancel).toLocaleString()}</span>
                                            <span className="text-slate-400 text-xs"> / {cancel.views_guaranteed?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-red-400 font-medium">
                                                {(cancel.views_remaining_at_cancel || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-green-400">${cancel.amount_paid || 0}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-slate-300 text-sm">
                                                {cancel.cancelled_reason || 'No reason'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {cancel.cancelled_confirmation === 'END CAMPAIGN' ? (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                                    ✓ Verified
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
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
                <div className="mt-8 bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Cancellation Reasons</h2>
                    <div className="space-y-3">
                        {Object.entries(
                            cancellations.reduce((acc, c) => {
                                const reason = c.cancelled_reason || 'No reason provided'
                                acc[reason] = (acc[reason] || 0) + 1
                                return acc
                            }, {})
                        ).map(([reason, count]) => (
                            <div key={reason} className="flex items-center justify-between">
                                <span className="text-slate-300">{reason}</span>
                                <span className="px-3 py-1 bg-slate-700 text-white rounded-full text-sm">
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