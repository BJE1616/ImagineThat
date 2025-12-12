'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [stats, setStats] = useState({
        totalPaid: 0,
        totalPending: 0,
        paymentsThisMonth: 0
    })

    useEffect(() => {
        loadPayments()
    }, [filter])

    const loadPayments = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('prize_payments')
                .select('*')
                .order('created_at', { ascending: false })

            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            const { data: paymentsData, error: paymentsError } = await query.limit(100)

            if (paymentsError) throw paymentsError

            if (paymentsData && paymentsData.length > 0) {
                const userIds = [...new Set(paymentsData.map(p => p.user_id))]
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email')
                    .in('id', userIds)

                const combined = paymentsData.map(payment => ({
                    ...payment,
                    user: usersData?.find(u => u.id === payment.user_id) || { username: 'Unknown', email: '' }
                }))

                setPayments(combined)
            } else {
                setPayments([])
            }

            const { data: allPayments } = await supabase
                .from('prize_payments')
                .select('prize_amount, status, created_at')

            if (allPayments) {
                const now = new Date()
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

                setStats({
                    totalPaid: allPayments
                        .filter(p => p.status === 'paid')
                        .reduce((sum, p) => sum + (p.prize_amount || 0), 0),
                    totalPending: allPayments
                        .filter(p => p.status === 'pending')
                        .reduce((sum, p) => sum + (p.prize_amount || 0), 0),
                    paymentsThisMonth: allPayments
                        .filter(p => p.status === 'paid' && new Date(p.created_at) >= monthStart)
                        .reduce((sum, p) => sum + (p.prize_amount || 0), 0)
                })
            }
        } catch (error) {
            console.error('Error loading payments:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const updatePaymentStatus = async (paymentId, newStatus) => {
        try {
            const { error } = await supabase
                .from('prize_payments')
                .update({
                    status: newStatus,
                    paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', paymentId)

            if (error) throw error

            loadPayments()
        } catch (error) {
            console.error('Error updating payment:', error)
            alert('Error updating payment status')
        }
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-700 rounded w-64"></div>
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>
                        ))}
                    </div>
                    <div className="h-96 bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Payment History</h1>
                <p className="text-slate-400 mt-1">Track all prize payments</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Total Paid</p>
                            <p className="text-3xl font-bold text-green-400 mt-1">${stats.totalPaid.toLocaleString()}</p>
                        </div>
                        <span className="text-4xl">✅</span>
                    </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Pending</p>
                            <p className="text-3xl font-bold text-amber-400 mt-1">${stats.totalPending.toLocaleString()}</p>
                        </div>
                        <span className="text-4xl">⏳</span>
                    </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">This Month</p>
                            <p className="text-3xl font-bold text-blue-400 mt-1">${stats.paymentsThisMonth.toLocaleString()}</p>
                        </div>
                        <span className="text-4xl">📅</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mb-6">
                {[
                    { value: 'all', label: 'All Payments' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'pending', label: 'Pending' }
                ].map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === tab.value
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Date</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Player</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Email</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Week</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Rank</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Amount</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Status</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Paid At</th>
                                <th className="text-left py-4 px-6 text-slate-400 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length > 0 ? (
                                payments.map(payment => (
                                    <tr key={payment.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                        <td className="py-4 px-6 text-slate-300 text-sm">{formatDate(payment.created_at)}</td>
                                        <td className="py-4 px-6">
                                            <p className="text-white font-medium">{payment.user.username}</p>
                                        </td>
                                        <td className="py-4 px-6 text-slate-300">{payment.user.email}</td>
                                        <td className="py-4 px-6 text-slate-300">{payment.week_start}</td>
                                        <td className="py-4 px-6">
                                            <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold text-sm ${payment.rank === 1 ? 'bg-amber-500 text-slate-900' :
                                                    payment.rank === 2 ? 'bg-slate-400 text-slate-900' :
                                                        payment.rank === 3 ? 'bg-amber-700 text-white' :
                                                            'bg-slate-600 text-slate-300'
                                                }`}>
                                                {payment.rank}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-green-400 font-semibold">${payment.prize_amount}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${payment.status === 'paid'
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                }`}>
                                                {payment.status === 'paid' ? '✓ Paid' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-400 text-sm">{formatDate(payment.paid_at)}</td>
                                        <td className="py-4 px-6">
                                            <button
                                                onClick={() => updatePaymentStatus(
                                                    payment.id,
                                                    payment.status === 'paid' ? 'pending' : 'paid'
                                                )}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${payment.status === 'paid'
                                                        ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                                        : 'bg-green-600 text-white hover:bg-green-500'
                                                    }`}
                                            >
                                                {payment.status === 'paid' ? 'Undo' : 'Mark Paid'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-slate-400">
                                        <p className="text-lg">No payment records found</p>
                                        <p className="text-sm mt-1">Payments will appear here when prizes are marked as paid</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}