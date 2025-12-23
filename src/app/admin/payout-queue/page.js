'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PayoutQueuePage() {
    const [loading, setLoading] = useState(true)
    const [queue, setQueue] = useState([])
    const [history, setHistory] = useState([])
    const [activeTab, setActiveTab] = useState('queue')
    const [message, setMessage] = useState(null)
    const [processingId, setProcessingId] = useState(null)
    const [payoutForm, setPayoutForm] = useState({
        confirmation_number: '',
        notes: ''
    })
    const [cashPosition, setCashPosition] = useState({
        starting_balance: 0,
        income_received: 0,
        expenses_paid: 0,
        payouts_sent: 0,
        calculated_balance: 0,
        actual_balance: '',
        last_verified: null
    })
    const [showReconcile, setShowReconcile] = useState(false)
    const [stats, setStats] = useState({
        pending_count: 0,
        pending_amount: 0,
        today_paid: 0,
        today_amount: 0
    })

    useEffect(() => {
        loadAllData()
    }, [])

    const loadAllData = async () => {
        setLoading(true)
        await Promise.all([
            loadQueue(),
            loadHistory(),
            loadCashPosition(),
            loadStats()
        ])
        setLoading(false)
    }

    const loadQueue = async () => {
        const { data, error } = await supabase
            .from('payout_queue')
            .select(`
                *,
                users (id, username, email, first_name, last_name, preferred_payment_method, payment_handle)
            `)
            .eq('status', 'pending')
            .order('queued_at', { ascending: true })

        if (!error) setQueue(data || [])
    }

    const loadHistory = async () => {
        const { data, error } = await supabase
            .from('payout_history')
            .select(`
                *,
                users (id, username, email, first_name, last_name)
            `)
            .order('paid_at', { ascending: false })
            .limit(50)

        if (!error) setHistory(data || [])
    }

    const loadCashPosition = async () => {
        const { data: settings } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'cash_starting_balance')
            .single()

        const startingBalance = parseFloat(settings?.setting_value || '0')

        const { data: lastVerified } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'cash_last_verified')
            .single()

        const { data: actualBalance } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'cash_actual_balance')
            .single()

        const { data: campaigns } = await supabase
            .from('ad_campaigns')
            .select('amount_paid')

        const incomeReceived = campaigns?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0

        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount')

        const expensesPaid = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

        const { data: payouts } = await supabase
            .from('payout_history')
            .select('amount')

        const payoutsSent = payouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        const calculatedBalance = startingBalance + incomeReceived - expensesPaid - payoutsSent

        setCashPosition({
            starting_balance: startingBalance,
            income_received: incomeReceived,
            expenses_paid: expensesPaid,
            payouts_sent: payoutsSent,
            calculated_balance: calculatedBalance,
            actual_balance: actualBalance?.setting_value || '',
            last_verified: lastVerified?.setting_value || null
        })
    }

    const loadStats = async () => {
        const { data: pending } = await supabase
            .from('payout_queue')
            .select('amount')
            .eq('status', 'pending')

        const today = new Date().toISOString().split('T')[0]
        const { data: todayPaid } = await supabase
            .from('payout_history')
            .select('amount')
            .gte('paid_at', today)

        setStats({
            pending_count: pending?.length || 0,
            pending_amount: pending?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
            today_paid: todayPaid?.length || 0,
            today_amount: todayPaid?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
        })
    }

    const startProcessing = (payout) => {
        setProcessingId(payout.id)
        setPayoutForm({ confirmation_number: '', notes: '' })
    }

    const cancelProcessing = () => {
        setProcessingId(null)
        setPayoutForm({ confirmation_number: '', notes: '' })
    }

    const markAsPaid = async (payout) => {
        try {
            // Insert into payout_history
            const { error: historyError } = await supabase
                .from('payout_history')
                .insert([{
                    user_id: payout.user_id,
                    amount: payout.amount,
                    reason: payout.reason,
                    reference_type: payout.reference_type,
                    reference_id: payout.reference_id,
                    payment_method: payout.payment_method || payout.users?.preferred_payment_method,
                    payment_handle: payout.payment_handle || payout.users?.payment_handle,
                    confirmation_number: payoutForm.confirmation_number || null,
                    notes: payoutForm.notes || null,
                    paid_at: new Date().toISOString()
                }])

            if (historyError) throw historyError

            // Update matrix payout_status if it's a matrix payout
            if (payout.reference_type === 'matrix' && payout.reference_id) {
                await supabase
                    .from('matrix_entries')
                    .update({
                        payout_status: 'paid',
                        payout_sent_at: new Date().toISOString()
                    })
                    .eq('id', payout.reference_id)
            }

            // Update prize_payouts status if it's a weekly prize
            if (payout.reference_type === 'weekly_prize' && payout.reference_id) {
                await supabase
                    .from('prize_payouts')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payout.reference_id)
            }

            // Delete from queue
            const { error: deleteError } = await supabase
                .from('payout_queue')
                .delete()
                .eq('id', payout.id)

            if (deleteError) throw deleteError

            setMessage({ type: 'success', text: 'Payout marked as paid!' })
            setProcessingId(null)
            setPayoutForm({ confirmation_number: '', notes: '' })
            loadAllData()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error marking paid:', error)
            setMessage({ type: 'error', text: 'Failed to process payout' })
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setMessage({ type: 'success', text: 'Copied!' })
        setTimeout(() => setMessage(null), 1500)
    }

    const saveReconciliation = async () => {
        try {
            await supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'cash_actual_balance',
                    setting_value: cashPosition.actual_balance
                }, { onConflict: 'setting_key' })

            await supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'cash_last_verified',
                    setting_value: new Date().toISOString()
                }, { onConflict: 'setting_key' })

            const difference = parseFloat(cashPosition.actual_balance) - cashPosition.calculated_balance
            if (difference !== 0) {
                const newStarting = cashPosition.starting_balance + difference
                await supabase
                    .from('admin_settings')
                    .upsert({
                        setting_key: 'cash_starting_balance',
                        setting_value: newStarting.toString()
                    }, { onConflict: 'setting_key' })
            }

            setMessage({ type: 'success', text: 'Reconciliation saved!' })
            setShowReconcile(false)
            loadCashPosition()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save' })
        }
    }

    const getReasonBadge = (payout) => {
        if (payout.reference_type === 'weekly_prize') {
            return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '🎰' }
        } else if (payout.reference_type === 'matrix') {
            return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '🔷' }
        } else if (payout.reference_type === 'match_game') {
            return { bg: 'bg-green-500/20', text: 'text-green-400', icon: '🎮' }
        }
        return { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: '💵' }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    const formatTime = (dateString) => {
        if (!dateString) return ''
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Payout Queue</h1>
                    <p className="text-slate-400 text-sm">Process pending payouts</p>
                </div>
                {message && (
                    <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Pending</p>
                    <p className="text-xl font-bold text-orange-400">{stats.pending_count}</p>
                    <p className="text-orange-400 text-sm">${stats.pending_amount.toFixed(2)}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Paid Today</p>
                    <p className="text-xl font-bold text-green-400">{stats.today_paid}</p>
                    <p className="text-green-400 text-sm">${stats.today_amount.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Calculated Balance</p>
                    <p className="text-xl font-bold text-white">${cashPosition.calculated_balance.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-yellow-500/50" onClick={() => setShowReconcile(true)}>
                    <p className="text-slate-400 text-xs">Last Verified</p>
                    <p className="text-lg font-bold text-yellow-400">
                        {cashPosition.actual_balance ? `$${parseFloat(cashPosition.actual_balance).toFixed(2)}` : 'Not set'}
                    </p>
                    <p className="text-slate-500 text-xs">{cashPosition.last_verified ? formatDate(cashPosition.last_verified) : 'Click to reconcile'}</p>
                </div>
            </div>

            {/* Reconcile Modal */}
            {showReconcile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 w-96">
                        <h3 className="text-white font-semibold mb-3">Reconcile Cash Position</h3>

                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between text-slate-300">
                                <span>Starting Balance</span>
                                <span>${cashPosition.starting_balance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>+ Income Received</span>
                                <span>${cashPosition.income_received.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-red-400">
                                <span>- Expenses Paid</span>
                                <span>${cashPosition.expenses_paid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-red-400">
                                <span>- Payouts Sent</span>
                                <span>${cashPosition.payouts_sent.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-2">
                                <span>Calculated Balance</span>
                                <span>${cashPosition.calculated_balance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-slate-400 text-xs block mb-1">Actual Bank Balance</label>
                            <input
                                type="number"
                                step="0.01"
                                value={cashPosition.actual_balance}
                                onChange={(e) => setCashPosition({ ...cashPosition, actual_balance: e.target.value })}
                                placeholder="Enter actual balance"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                            {cashPosition.actual_balance && (
                                <p className={`text-xs mt-1 ${parseFloat(cashPosition.actual_balance) === cashPosition.calculated_balance ? 'text-green-400' : 'text-yellow-400'}`}>
                                    Difference: ${(parseFloat(cashPosition.actual_balance) - cashPosition.calculated_balance).toFixed(2)}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowReconcile(false)}
                                className="flex-1 px-3 py-2 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveReconciliation}
                                className="flex-1 px-3 py-2 bg-yellow-500 text-slate-900 rounded text-sm font-medium hover:bg-yellow-400"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
                {['queue', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-yellow-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab === 'queue' ? `Queue (${stats.pending_count})` : 'History'}
                    </button>
                ))}
            </div>

            {/* Queue Tab */}
            {activeTab === 'queue' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    {queue.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p className="text-2xl mb-2">🎉</p>
                            <p>No pending payouts!</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                    <th className="text-left py-2 px-3">User</th>
                                    <th className="text-left py-2 px-3">Reason</th>
                                    <th className="text-left py-2 px-3">Payment</th>
                                    <th className="text-right py-2 px-3">Amount</th>
                                    <th className="text-left py-2 px-3">Queued</th>
                                    <th className="text-right py-2 px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {queue.map(payout => {
                                    const badge = getReasonBadge(payout)
                                    return (
                                        <tr key={payout.id} className="border-t border-slate-700">
                                            <td className="py-2 px-3">
                                                <p className="text-white font-medium">{payout.users?.username || 'Unknown'}</p>
                                                <p className="text-slate-500 text-xs">{payout.users?.email}</p>
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                                    {badge.icon} {payout.reason}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3">
                                                {(payout.payment_method || payout.users?.preferred_payment_method) ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-300 capitalize">
                                                            {payout.payment_method || payout.users?.preferred_payment_method}:
                                                        </span>
                                                        <span className="text-yellow-400">
                                                            {payout.payment_handle || payout.users?.payment_handle}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(payout.payment_handle || payout.users?.payment_handle)}
                                                            className="text-slate-500 hover:text-white ml-1"
                                                            title="Copy"
                                                        >
                                                            📋
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-red-400 text-xs">No payment info</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-right text-green-400 font-semibold">
                                                ${payout.amount.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 text-xs">
                                                {formatDate(payout.queued_at)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                {processingId === payout.id ? (
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <input
                                                            type="text"
                                                            placeholder="Conf #"
                                                            value={payoutForm.confirmation_number}
                                                            onChange={(e) => setPayoutForm({ ...payoutForm, confirmation_number: e.target.value })}
                                                            className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Notes"
                                                            value={payoutForm.notes}
                                                            onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                                            className="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                        />
                                                        <button
                                                            onClick={() => markAsPaid(payout)}
                                                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400"
                                                        >
                                                            ✓ Paid
                                                        </button>
                                                        <button
                                                            onClick={cancelProcessing}
                                                            className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs hover:bg-slate-500"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startProcessing(payout)}
                                                        className="px-3 py-1 bg-yellow-500 text-slate-900 rounded text-xs font-medium hover:bg-yellow-400"
                                                    >
                                                        Process
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    {history.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p>No payout history yet.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                    <th className="text-left py-2 px-3">Date</th>
                                    <th className="text-left py-2 px-3">User</th>
                                    <th className="text-left py-2 px-3">Reason</th>
                                    <th className="text-left py-2 px-3">Payment</th>
                                    <th className="text-right py-2 px-3">Amount</th>
                                    <th className="text-left py-2 px-3">Conf #</th>
                                    <th className="text-left py-2 px-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(payout => {
                                    const badge = getReasonBadge(payout)
                                    return (
                                        <tr key={payout.id} className="border-t border-slate-700">
                                            <td className="py-2 px-3 text-slate-400 text-xs">
                                                {formatDate(payout.paid_at)}<br />
                                                <span className="text-slate-500">{formatTime(payout.paid_at)}</span>
                                            </td>
                                            <td className="py-2 px-3">
                                                <p className="text-white">{payout.users?.username || 'Unknown'}</p>
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                                    {badge.icon} {payout.reason}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 text-xs capitalize">
                                                {payout.payment_method}<br />
                                                <span className="text-slate-500">{payout.payment_handle}</span>
                                            </td>
                                            <td className="py-2 px-3 text-right text-green-400 font-semibold">
                                                ${payout.amount.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 text-xs">
                                                {payout.confirmation_number || '-'}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500 text-xs max-w-32 truncate">
                                                {payout.notes || '-'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <div className="mt-3 p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                <p>💡 <strong>Workflow:</strong> Open Cash App/Venmo/Zelle → Send payment → Click Process → Enter confirmation # → Mark as Paid</p>
                <p className="mt-1">🎰 <strong>Weekly Prize:</strong> Winners are added here when marked "Verified" on the Winners page. Marking paid here updates their status automatically.</p>
            </div>
        </div>
    )
}