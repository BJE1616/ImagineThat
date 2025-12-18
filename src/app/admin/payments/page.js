'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminPaymentsPage() {
    const { currentTheme } = useTheme()
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
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>
                        ))}
                    </div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Payment History</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Track all prize payments</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Total Paid</p>
                            <p className="text-xl font-bold text-green-400">${stats.totalPaid.toLocaleString()}</p>
                        </div>
                        <span className="text-xl">✅</span>
                    </div>
                </div>
                <div className={`bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded p-3`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Pending</p>
                            <p className={`text-xl font-bold text-${currentTheme.accent}`}>${stats.totalPending.toLocaleString()}</p>
                        </div>
                        <span className="text-xl">⏳</span>
                    </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>This Month</p>
                            <p className="text-xl font-bold text-blue-400">${stats.paymentsThisMonth.toLocaleString()}</p>
                        </div>
                        <span className="text-xl">📅</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-1 mb-3">
                {[
                    { value: 'all', label: 'All' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'pending', label: 'Pending' }
                ].map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${filter === tab.value
                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b border-${currentTheme.border}`}>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Date</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Week</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Rank</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Amount</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Paid At</th>
                                <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length > 0 ? (
                                payments.map(payment => (
                                    <tr key={payment.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 transition-colors`}>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{formatDate(payment.created_at)}</td>
                                        <td className="py-2 px-3">
                                            <p className={`text-${currentTheme.text} font-medium text-xs`}>{payment.user.username}</p>
                                        </td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{payment.user.email}</td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{payment.week_start}</td>
                                        <td className="py-2 px-3">
                                            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${payment.rank === 1 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` :
                                                payment.rank === 2 ? 'bg-slate-400 text-slate-900' :
                                                    payment.rank === 3 ? 'bg-amber-700 text-white' :
                                                        `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                                                }`}>
                                                {payment.rank}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="text-green-400 font-semibold text-xs">${payment.prize_amount}</span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${payment.status === 'paid'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : `bg-${currentTheme.accent}/20 text-${currentTheme.accent} border border-${currentTheme.accent}/30`
                                                }`}>
                                                {payment.status === 'paid' ? '✓ Paid' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{formatDate(payment.paid_at)}</td>
                                        <td className="py-2 px-3">
                                            <button
                                                onClick={() => updatePaymentStatus(
                                                    payment.id,
                                                    payment.status === 'paid' ? 'pending' : 'paid'
                                                )}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${payment.status === 'paid'
                                                    ? `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                                    : 'bg-green-600 text-white hover:bg-green-500'
                                                    }`}
                                            >
                                                {payment.status === 'paid' ? 'Undo' : 'Paid'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                        <p className="text-sm">No payment records found</p>
                                        <p className="text-xs mt-1">Payments will appear here when prizes are marked as paid</p>
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