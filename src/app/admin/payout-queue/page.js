'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PayoutQueuePage() {
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [queue, setQueue] = useState([])
    const [history, setHistory] = useState([])
    const [activeTab, setActiveTab] = useState('queue')
    const [historyFilter, setHistoryFilter] = useState('30')
    const [message, setMessage] = useState(null)

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [selectedPayout, setSelectedPayout] = useState(null)
    const [paymentForm, setPaymentForm] = useState({
        payment_method: '',
        confirmation_number: '',
        amount_paid: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
    })
    const [formErrors, setFormErrors] = useState({})
    const [processing, setProcessing] = useState(false)

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

    const PAYMENT_METHODS = [
        { value: 'venmo', label: 'Venmo' },
        { value: 'cashapp', label: 'Cash App' },
        { value: 'paypal', label: 'PayPal' },
        { value: 'zelle', label: 'Zelle' },
        { value: 'check', label: 'Check' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'other', label: 'Other' }
    ]

    useEffect(() => {
        getCurrentUser()
        loadAllData()
    }, [])

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory()
        }
    }, [historyFilter])

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)
    }

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
        let query = supabase
            .from('payout_history')
            .select(`
                *,
                users!payout_history_user_id_fkey (id, username, email, first_name, last_name),
                paid_by_user:users!payout_history_paid_by_fkey (username)
            `)
            .order('paid_at', { ascending: false })

        if (historyFilter !== 'all') {
            const daysAgo = new Date()
            daysAgo.setDate(daysAgo.getDate() - parseInt(historyFilter))
            query = query.gte('paid_at', daysAgo.toISOString())
        }

        const { data, error } = await query.limit(200)

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

    const openPaymentModal = (payout) => {
        setSelectedPayout(payout)
        setPaymentForm({
            payment_method: payout.payment_method || payout.users?.preferred_payment_method || '',
            confirmation_number: '',
            amount_paid: payout.amount.toFixed(2),
            payment_date: new Date().toISOString().split('T')[0],
            notes: ''
        })
        setFormErrors({})
        setShowPaymentModal(true)
    }

    const closePaymentModal = () => {
        setShowPaymentModal(false)
        setSelectedPayout(null)
        setPaymentForm({
            payment_method: '',
            confirmation_number: '',
            amount_paid: '',
            payment_date: new Date().toISOString().split('T')[0],
            notes: ''
        })
        setFormErrors({})
    }

    const validateForm = () => {
        const errors = {}

        if (!paymentForm.payment_method) {
            errors.payment_method = 'Payment method is required'
        }
        if (!paymentForm.confirmation_number.trim()) {
            errors.confirmation_number = 'Transaction/Confirmation # is required'
        }
        if (!paymentForm.amount_paid || parseFloat(paymentForm.amount_paid) <= 0) {
            errors.amount_paid = 'Valid amount is required'
        }
        if (!paymentForm.payment_date) {
            errors.payment_date = 'Payment date is required'
        }

        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const processPayment = async () => {
        if (!validateForm()) return

        setProcessing(true)
        try {
            const payout = selectedPayout

            // Insert into payout_history
            const { error: historyError } = await supabase
                .from('payout_history')
                .insert([{
                    user_id: payout.user_id,
                    amount: parseFloat(paymentForm.amount_paid),
                    reason: payout.reason,
                    reference_type: payout.reference_type,
                    reference_id: payout.reference_id,
                    payment_method: paymentForm.payment_method,
                    payment_handle: payout.payment_handle || payout.users?.payment_handle || 'unknown',
                    confirmation_number: paymentForm.confirmation_number.trim(),
                    notes: paymentForm.notes.trim() || null,
                    paid_at: new Date(paymentForm.payment_date).toISOString(),
                    paid_by: currentUser?.id || null
                }])

            if (historyError) throw historyError

            // Update related records based on reference type
            if (payout.reference_type === 'matrix' && payout.reference_id) {
                await supabase
                    .from('matrix_entries')
                    .update({
                        payout_status: 'paid',
                        payout_sent_at: new Date().toISOString()
                    })
                    .eq('id', payout.reference_id)
            }

            if (payout.reference_type === 'weekly_prize' && payout.reference_id) {
                await supabase
                    .from('prize_payouts')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payout.reference_id)

                // Also update public_winners
                await supabase
                    .from('public_winners')
                    .update({
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('payout_id', payout.reference_id)
            }

            // Delete from queue
            const { error: deleteError } = await supabase
                .from('payout_queue')
                .delete()
                .eq('id', payout.id)

            if (deleteError) throw deleteError

            // Audit log
            await supabase.from('admin_audit_log').insert([{
                user_email: currentUser?.email,
                action: 'payout_processed',
                table_name: 'payout_history',
                record_id: payout.id,
                new_value: {
                    user: payout.users?.username,
                    amount: parseFloat(paymentForm.amount_paid),
                    payment_method: paymentForm.payment_method,
                    confirmation_number: paymentForm.confirmation_number.trim(),
                    reason: payout.reason
                },
                description: `Processed $${parseFloat(paymentForm.amount_paid).toFixed(2)} payout to ${payout.users?.username} via ${paymentForm.payment_method} (Conf: ${paymentForm.confirmation_number.trim()})`
            }])

            // Send payout notification email
            try {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'payout_initiated',
                        to: payout.users?.email,
                        data: {
                            first_name: payout.users?.first_name || payout.users?.username,
                            amount: parseFloat(paymentForm.amount_paid).toFixed(2),
                            payment_method: paymentForm.payment_method,
                            payment_handle: payout.payment_handle || payout.users?.payment_handle || 'N/A',
                            confirmation_number: paymentForm.confirmation_number.trim(),
                            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        }
                    })
                })
            } catch (emailError) {
                console.error('Payout notification email error:', emailError)
            }

            setMessage({ type: 'success', text: `✅ Payout of $${parseFloat(paymentForm.amount_paid).toFixed(2)} to ${payout.users?.username} processed!` })
            closePaymentModal()
            loadAllData()
            setTimeout(() => setMessage(null), 4000)
        } catch (error) {
            console.error('Error processing payout:', error)
            setMessage({ type: 'error', text: 'Failed to process payout. Please try again.' })
        } finally {
            setProcessing(false)
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

    const getPaymentMethodLabel = (value) => {
        const method = PAYMENT_METHODS.find(m => m.value === value)
        return method?.label || value
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

            {/* Payment Modal */}
            {showPaymentModal && selectedPayout && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold text-lg">💰 Process Payment</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Paying <span className="text-yellow-400 font-medium">{selectedPayout.users?.username}</span> for {selectedPayout.reason}
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Recipient Info */}
                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs mb-1">Send payment to:</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{selectedPayout.payment_handle || selectedPayout.users?.payment_handle || 'No handle on file'}</p>
                                        <p className="text-slate-500 text-xs">{selectedPayout.users?.email}</p>
                                    </div>
                                    {(selectedPayout.payment_handle || selectedPayout.users?.payment_handle) && (
                                        <button
                                            onClick={() => copyToClipboard(selectedPayout.payment_handle || selectedPayout.users?.payment_handle)}
                                            className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs hover:bg-slate-500"
                                        >
                                            📋 Copy
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Payment Method *</label>
                                <select
                                    value={paymentForm.payment_method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                    className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.payment_method ? 'border-red-500' : 'border-slate-600'}`}
                                >
                                    <option value="">Select method...</option>
                                    {PAYMENT_METHODS.map(method => (
                                        <option key={method.value} value={method.value}>{method.label}</option>
                                    ))}
                                </select>
                                {formErrors.payment_method && <p className="text-red-400 text-xs mt-1">{formErrors.payment_method}</p>}
                            </div>

                            {/* Confirmation Number */}
                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Transaction/Confirmation # *</label>
                                <input
                                    type="text"
                                    value={paymentForm.confirmation_number}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, confirmation_number: e.target.value })}
                                    placeholder="e.g., 1234567890"
                                    className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.confirmation_number ? 'border-red-500' : 'border-slate-600'}`}
                                />
                                {formErrors.confirmation_number && <p className="text-red-400 text-xs mt-1">{formErrors.confirmation_number}</p>}
                            </div>

                            {/* Amount and Date Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 text-xs mb-1">Amount Paid *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={paymentForm.amount_paid}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                                            className={`w-full pl-7 pr-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.amount_paid ? 'border-red-500' : 'border-slate-600'}`}
                                        />
                                    </div>
                                    {formErrors.amount_paid && <p className="text-red-400 text-xs mt-1">{formErrors.amount_paid}</p>}
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-xs mb-1">Payment Date *</label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                        className={`w-full px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.payment_date ? 'border-red-500' : 'border-slate-600'}`}
                                    />
                                    {formErrors.payment_date && <p className="text-red-400 text-xs mt-1">{formErrors.payment_date}</p>}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-slate-400 text-xs mb-1">Notes (optional)</label>
                                <textarea
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    placeholder="Any additional notes..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button
                                onClick={closePaymentModal}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded font-medium hover:bg-slate-600 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processPayment}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-500 disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : '✓ Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <th className="text-left py-2 px-3">Payment Info</th>
                                    <th className="text-right py-2 px-3">Amount</th>
                                    <th className="text-left py-2 px-3">Queued</th>
                                    <th className="text-right py-2 px-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {queue.map(payout => {
                                    const badge = getReasonBadge(payout)
                                    return (
                                        <tr key={payout.id} className="border-t border-slate-700 hover:bg-slate-700/30">
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
                                                    <div>
                                                        <span className="text-slate-400 capitalize text-xs">
                                                            {payout.payment_method || payout.users?.preferred_payment_method}
                                                        </span>
                                                        <p className="text-yellow-400 text-sm">
                                                            {payout.payment_handle || payout.users?.payment_handle}
                                                        </p>
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
                                                <button
                                                    onClick={() => openPaymentModal(payout)}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500"
                                                >
                                                    💰 Pay Now
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* History Filter */}
            {activeTab === 'history' && (
                <div className="mb-3 flex items-center gap-2">
                    <span className="text-slate-400 text-sm">Show:</span>
                    <select
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                        className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="all">All time</option>
                    </select>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                        <th className="text-left py-2 px-3">Date</th>
                                        <th className="text-left py-2 px-3">User</th>
                                        <th className="text-left py-2 px-3">Reason</th>
                                        <th className="text-left py-2 px-3">Method</th>
                                        <th className="text-right py-2 px-3">Amount</th>
                                        <th className="text-left py-2 px-3">Conf #</th>
                                        <th className="text-left py-2 px-3">Paid By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((payout) => {
                                        const badge = getReasonBadge(payout)
                                        return (
                                            <tr key={payout.id} className="border-t border-slate-700">
                                                <td className="py-2 px-3 text-slate-400 text-xs">
                                                    {formatDate(payout.paid_at)}<br />
                                                    <span className="text-slate-500">{formatTime(payout.paid_at)}</span>
                                                </td>
                                                <td className="py-2 px-3">
                                                    <p className="text-white">{payout.users?.username || 'Unknown'}</p>
                                                    <p className="text-slate-500 text-xs">{payout.payment_handle}</p>
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                                        {badge.icon} {payout.reason}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-300 text-xs capitalize">
                                                    {getPaymentMethodLabel(payout.payment_method)}
                                                </td>
                                                <td className="py-2 px-3 text-right text-green-400 font-semibold">
                                                    ${payout.amount.toFixed(2)}
                                                </td>
                                                <td className="py-2 px-3 text-yellow-400 text-xs font-mono">
                                                    {payout.confirmation_number || '-'}
                                                </td>
                                                <td className="py-2 px-3 text-slate-400 text-xs">
                                                    {payout.paid_by_user?.username || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-3 p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                <p>💡 <strong>Workflow:</strong> Open Venmo/Cash App/PayPal → Send payment → Click "Pay Now" → Enter transaction details → Confirm</p>
            </div>
        </div>
    )
}