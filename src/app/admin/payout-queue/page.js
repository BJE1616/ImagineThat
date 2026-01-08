'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '../layout'

export default function PayoutQueuePage() {
    const { role } = useAdminRole()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [queue, setQueue] = useState([])
    const [history, setHistory] = useState([])
    const [wallets, setWallets] = useState([])
    const [reconciliations, setReconciliations] = useState([])
    const [activeTab, setActiveTab] = useState('queue')
    const [message, setMessage] = useState(null)
    const [expandedRow, setExpandedRow] = useState(null)

    // History Filters
    const [historyDateFilter, setHistoryDateFilter] = useState('30')
    const [historyMethodFilter, setHistoryMethodFilter] = useState('all')
    const [historyTypeFilter, setHistoryTypeFilter] = useState('all')
    const [historyCustomStart, setHistoryCustomStart] = useState('')
    const [historyCustomEnd, setHistoryCustomEnd] = useState('')
    const [filteredHistory, setFilteredHistory] = useState([])
    const [historyTotals, setHistoryTotals] = useState({ count: 0, amount: 0 })

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

    // Transfer Modal
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferForm, setTransferForm] = useState({
        from_wallet: 'bank',
        to_wallet: 'venmo',
        amount: '',
        notes: ''
    })

    // Add Funds Modal
    const [showAddFundsModal, setShowAddFundsModal] = useState(false)
    const [addFundsWallet, setAddFundsWallet] = useState(null)
    const [addFundsForm, setAddFundsForm] = useState({
        type: 'deposit',
        amount: '',
        description: ''
    })

    // Reconciliation Modal
    const [showReconcileModal, setShowReconcileModal] = useState(false)
    const [reconcileForm, setReconcileForm] = useState({
        verified_total: '',
        notes: ''
    })

    // View Reconciliation Modal
    const [showViewReconcileModal, setShowViewReconcileModal] = useState(false)
    const [selectedReconciliation, setSelectedReconciliation] = useState(null)
    const [resolutionNotes, setResolutionNotes] = useState('')

    const [stats, setStats] = useState({
        pending_count: 0,
        pending_amount: 0,
        today_paid: 0,
        today_amount: 0
    })

    // Role-based permissions
    const canProcessPayouts = ['super_admin', 'admin'].includes(role)
    const canTransfer = ['super_admin', 'admin'].includes(role)
    const canAddFunds = role === 'super_admin'
    const canMakeAdjustments = role === 'super_admin'

    const PAYMENT_METHODS = [
        { value: 'venmo', label: 'Venmo' },
        { value: 'cashapp', label: 'Cash App' },
        { value: 'paypal', label: 'PayPal' },
        { value: 'zelle', label: 'Zelle' },
        { value: 'check', label: 'Check' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'other', label: 'Other' }
    ]

    const DATE_FILTER_OPTIONS = [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: '7', label: 'Last 7 Days' },
        { value: '30', label: 'Last 30 Days' },
        { value: 'this_week', label: 'This Week' },
        { value: 'last_week', label: 'Last Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'last_month', label: 'Last Month' },
        { value: 'custom', label: 'Custom Range' },
        { value: 'all', label: 'All Time' }
    ]

    useEffect(() => {
        getCurrentUser()
        loadAllData()
    }, [])

    useEffect(() => {
        applyHistoryFilters()
    }, [history, historyDateFilter, historyMethodFilter, historyTypeFilter, historyCustomStart, historyCustomEnd])

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)
    }

    const loadAllData = async () => {
        setLoading(true)
        await Promise.all([
            loadQueue(),
            loadHistory(),
            loadWallets(),
            loadReconciliations(),
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
                users!payout_history_user_id_fkey (id, username, email, first_name, last_name),
                paid_by_user:users!payout_history_paid_by_fkey (username)
            `)
            .order('paid_at', { ascending: false })
            .limit(500)

        if (!error) setHistory(data || [])
    }

    const loadWallets = async () => {
        const { data, error } = await supabase
            .from('account_wallets')
            .select('*')
            .order('wallet_key')

        if (!error) setWallets(data || [])
    }

    const loadReconciliations = async () => {
        const { data, error } = await supabase
            .from('payout_reconciliations')
            .select('*')
            .order('reconciled_at', { ascending: false })
            .limit(100)

        if (!error) setReconciliations(data || [])
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

    const getDateRange = (filterValue) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (filterValue) {
            case 'today':
                return { start: today, end: now }
            case 'yesterday':
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                return { start: yesterday, end: today }
            case '7':
                const week = new Date(today)
                week.setDate(week.getDate() - 7)
                return { start: week, end: now }
            case '30':
                const month = new Date(today)
                month.setDate(month.getDate() - 30)
                return { start: month, end: now }
            case 'this_week':
                const thisWeekStart = new Date(today)
                thisWeekStart.setDate(today.getDate() - today.getDay())
                return { start: thisWeekStart, end: now }
            case 'last_week':
                const lastWeekEnd = new Date(today)
                lastWeekEnd.setDate(today.getDate() - today.getDay())
                const lastWeekStart = new Date(lastWeekEnd)
                lastWeekStart.setDate(lastWeekEnd.getDate() - 7)
                return { start: lastWeekStart, end: lastWeekEnd }
            case 'this_month':
                const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
                return { start: thisMonthStart, end: now }
            case 'last_month':
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
                return { start: lastMonthStart, end: lastMonthEnd }
            case 'custom':
                return {
                    start: historyCustomStart ? new Date(historyCustomStart) : new Date(0),
                    end: historyCustomEnd ? new Date(historyCustomEnd + 'T23:59:59') : now
                }
            case 'all':
            default:
                return { start: new Date(0), end: now }
        }
    }

    const applyHistoryFilters = () => {
        let filtered = [...history]

        const { start, end } = getDateRange(historyDateFilter)
        filtered = filtered.filter(p => {
            const paidDate = new Date(p.paid_at)
            return paidDate >= start && paidDate <= end
        })

        if (historyMethodFilter !== 'all') {
            filtered = filtered.filter(p => p.payment_method === historyMethodFilter)
        }

        if (historyTypeFilter !== 'all') {
            filtered = filtered.filter(p => p.reference_type === historyTypeFilter)
        }

        setFilteredHistory(filtered)
        setHistoryTotals({
            count: filtered.length,
            amount: filtered.reduce((sum, p) => sum + (p.amount || 0), 0)
        })
    }

    const getFilterLabel = () => {
        const dateLabel = DATE_FILTER_OPTIONS.find(o => o.value === historyDateFilter)?.label || ''
        const methodLabel = historyMethodFilter !== 'all'
            ? PAYMENT_METHODS.find(m => m.value === historyMethodFilter)?.label
            : 'All Methods'
        return `${methodLabel} - ${dateLabel}`
    }

    const openPaymentModal = (payout) => {
        if (!canProcessPayouts) {
            setMessage({ type: 'error', text: 'You do not have permission to process payouts' })
            return
        }
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
        if (!paymentForm.payment_method) errors.payment_method = 'Required'
        if (!paymentForm.confirmation_number.trim()) errors.confirmation_number = 'Required'
        if (!paymentForm.amount_paid || parseFloat(paymentForm.amount_paid) <= 0) errors.amount_paid = 'Required'
        if (!paymentForm.payment_date) errors.payment_date = 'Required'
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const processPayment = async () => {
        if (!validateForm()) return

        setProcessing(true)
        try {
            const payout = selectedPayout
            const amount = parseFloat(paymentForm.amount_paid)

            const { error: historyError } = await supabase
                .from('payout_history')
                .insert([{
                    user_id: payout.user_id,
                    amount: amount,
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

            const walletKey = paymentForm.payment_method === 'cashapp' ? 'cashapp' :
                paymentForm.payment_method === 'venmo' ? 'venmo' : 'bank'

            const wallet = wallets.find(w => w.wallet_key === walletKey)
            if (wallet) {
                await supabase
                    .from('account_wallets')
                    .update({
                        balance: wallet.balance - amount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('wallet_key', walletKey)

                await supabase.from('wallet_transactions').insert([{
                    wallet_key: walletKey,
                    transaction_type: 'payout',
                    amount: -amount,
                    description: `Payout to ${payout.users?.username} - ${payout.reason}`,
                    reference_type: 'payout',
                    created_by: currentUser?.id
                }])
            }

            if (payout.reference_type === 'matrix' && payout.reference_id) {
                await supabase
                    .from('matrix_entries')
                    .update({ payout_status: 'paid', payout_sent_at: new Date().toISOString() })
                    .eq('id', payout.reference_id)
            }

            if (payout.reference_type === 'weekly_prize' && payout.reference_id) {
                await supabase
                    .from('prize_payouts')
                    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq('id', payout.reference_id)

                await supabase
                    .from('public_winners')
                    .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq('payout_id', payout.reference_id)
            }

            await supabase.from('payout_queue').delete().eq('id', payout.id)

            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action: 'payout_processed',
                table_name: 'payout_history',
                record_id: payout.id,
                new_value: {
                    user: payout.users?.username,
                    amount: amount,
                    payment_method: paymentForm.payment_method,
                    confirmation_number: paymentForm.confirmation_number.trim(),
                    wallet_deducted: walletKey
                },
                description: `Processed $${amount.toFixed(2)} payout to ${payout.users?.username} via ${paymentForm.payment_method}`
            }])

            try {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'payout_initiated',
                        to: payout.users?.email,
                        data: {
                            first_name: payout.users?.first_name || payout.users?.username,
                            amount: amount.toFixed(2),
                            payment_method: paymentForm.payment_method,
                            payment_handle: payout.payment_handle || payout.users?.payment_handle || 'N/A',
                            confirmation_number: paymentForm.confirmation_number.trim(),
                            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        }
                    })
                })
            } catch (emailError) {
                console.error('Email error:', emailError)
            }

            setMessage({ type: 'success', text: `✅ Paid $${amount.toFixed(2)} to ${payout.users?.username}` })
            closePaymentModal()
            loadAllData()
            setTimeout(() => setMessage(null), 4000)
        } catch (error) {
            console.error('Error:', error)
            setMessage({ type: 'error', text: 'Failed to process payout' })
        } finally {
            setProcessing(false)
        }
    }

    const openTransferModal = () => {
        if (!canTransfer) {
            setMessage({ type: 'error', text: 'You do not have permission to transfer funds' })
            return
        }
        setShowTransferModal(true)
    }

    const processTransfer = async () => {
        const amount = parseFloat(transferForm.amount)
        if (!amount || amount <= 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        try {
            const fromWallet = wallets.find(w => w.wallet_key === transferForm.from_wallet)
            const toWallet = wallets.find(w => w.wallet_key === transferForm.to_wallet)

            if (!fromWallet || !toWallet) throw new Error('Invalid wallets')

            await supabase
                .from('account_wallets')
                .update({ balance: fromWallet.balance - amount, updated_at: new Date().toISOString() })
                .eq('wallet_key', transferForm.from_wallet)

            await supabase
                .from('account_wallets')
                .update({ balance: toWallet.balance + amount, updated_at: new Date().toISOString() })
                .eq('wallet_key', transferForm.to_wallet)

            await supabase.from('wallet_transactions').insert([
                {
                    wallet_key: transferForm.from_wallet,
                    transaction_type: 'transfer_out',
                    amount: -amount,
                    description: `Transfer to ${toWallet.wallet_name}${transferForm.notes ? ` - ${transferForm.notes}` : ''}`,
                    reference_type: 'transfer',
                    related_wallet_key: transferForm.to_wallet,
                    created_by: currentUser?.id
                },
                {
                    wallet_key: transferForm.to_wallet,
                    transaction_type: 'transfer_in',
                    amount: amount,
                    description: `Transfer from ${fromWallet.wallet_name}${transferForm.notes ? ` - ${transferForm.notes}` : ''}`,
                    reference_type: 'transfer',
                    related_wallet_key: transferForm.from_wallet,
                    created_by: currentUser?.id
                }
            ])

            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action: 'wallet_transfer',
                table_name: 'account_wallets',
                new_value: {
                    from: fromWallet.wallet_name,
                    to: toWallet.wallet_name,
                    amount: amount,
                    notes: transferForm.notes || null
                },
                description: `Transferred $${amount.toFixed(2)} from ${fromWallet.wallet_name} to ${toWallet.wallet_name}`
            }])

            setMessage({ type: 'success', text: `Transferred $${amount.toFixed(2)}` })
            setShowTransferModal(false)
            setTransferForm({ from_wallet: 'bank', to_wallet: 'venmo', amount: '', notes: '' })
            loadWallets()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Transfer failed' })
        }
    }

    const openAddFundsModal = (wallet) => {
        if (!canAddFunds) {
            setMessage({ type: 'error', text: 'Only Super Admin can add funds or make adjustments' })
            return
        }
        setAddFundsWallet(wallet)
        setAddFundsForm({ type: 'deposit', amount: '', description: '' })
        setShowAddFundsModal(true)
    }

    const processAddFunds = async () => {
        const amount = parseFloat(addFundsForm.amount)
        if (!amount || amount === 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        if (!addFundsForm.description.trim()) {
            setMessage({ type: 'error', text: 'Description is required' })
            return
        }

        try {
            const wallet = addFundsWallet
            const finalAmount = addFundsForm.type === 'adjustment' ? amount : Math.abs(amount)
            const newBalance = wallet.balance + finalAmount

            await supabase
                .from('account_wallets')
                .update({ balance: newBalance, updated_at: new Date().toISOString() })
                .eq('wallet_key', wallet.wallet_key)

            await supabase.from('wallet_transactions').insert([{
                wallet_key: wallet.wallet_key,
                transaction_type: addFundsForm.type,
                amount: finalAmount,
                description: addFundsForm.description.trim(),
                reference_type: 'manual',
                created_by: currentUser?.id
            }])

            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action: addFundsForm.type === 'deposit' ? 'wallet_deposit' : 'wallet_adjustment',
                table_name: 'account_wallets',
                record_id: wallet.id,
                old_value: { balance: wallet.balance },
                new_value: {
                    balance: newBalance,
                    type: addFundsForm.type,
                    amount: finalAmount,
                    description: addFundsForm.description.trim()
                },
                description: `${addFundsForm.type === 'deposit' ? 'Deposited' : 'Adjusted'} ${wallet.wallet_name}: ${finalAmount >= 0 ? '+' : ''}$${finalAmount.toFixed(2)} - ${addFundsForm.description.trim()}`
            }])

            setMessage({ type: 'success', text: `${addFundsForm.type === 'deposit' ? 'Deposit' : 'Adjustment'} saved!` })
            setShowAddFundsModal(false)
            loadWallets()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error:', error)
            setMessage({ type: 'error', text: 'Failed to save' })
        }
    }

    const openReconcileModal = () => {
        if (historyTotals.count === 0) {
            setMessage({ type: 'error', text: 'No transactions to reconcile with current filters' })
            return
        }
        setReconcileForm({ verified_total: historyTotals.amount.toFixed(2), notes: '' })
        setShowReconcileModal(true)
    }

    const saveReconciliation = async () => {
        const verified = parseFloat(reconcileForm.verified_total)
        if (isNaN(verified)) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        try {
            const { start, end } = getDateRange(historyDateFilter)
            const discrepancy = verified - historyTotals.amount
            const status = Math.abs(discrepancy) < 0.01 ? 'matched' : 'discrepancy'

            await supabase.from('payout_reconciliations').insert([{
                period_label: getFilterLabel(),
                period_start: start.toISOString().split('T')[0],
                period_end: end.toISOString().split('T')[0],
                payment_method: historyMethodFilter,
                system_total: historyTotals.amount,
                verified_total: verified,
                status: status,
                discrepancy_amount: discrepancy !== 0 ? discrepancy : null,
                reconciled_by: currentUser?.id,
                reconciled_at: new Date().toISOString()
            }])

            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action: 'payout_reconciliation',
                table_name: 'payout_reconciliations',
                new_value: {
                    period: getFilterLabel(),
                    system_total: historyTotals.amount,
                    verified_total: verified,
                    status: status,
                    discrepancy: discrepancy
                },
                description: `Reconciled ${getFilterLabel()}: System $${historyTotals.amount.toFixed(2)} vs Verified $${verified.toFixed(2)} - ${status}`
            }])

            setMessage({ type: 'success', text: status === 'matched' ? '✅ Reconciled - amounts match!' : `⚠️ Saved with $${Math.abs(discrepancy).toFixed(2)} discrepancy` })
            setShowReconcileModal(false)
            loadReconciliations()
            setTimeout(() => setMessage(null), 4000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save reconciliation' })
        }
    }

    const openViewReconciliation = (rec) => {
        setSelectedReconciliation(rec)
        setResolutionNotes(rec.resolution_notes || '')
        setShowViewReconcileModal(true)
    }

    const resolveReconciliation = async () => {
        try {
            await supabase
                .from('payout_reconciliations')
                .update({
                    status: 'resolved',
                    resolution_notes: resolutionNotes,
                    resolved_at: new Date().toISOString()
                })
                .eq('id', selectedReconciliation.id)

            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action: 'reconciliation_resolved',
                table_name: 'payout_reconciliations',
                record_id: selectedReconciliation.id,
                new_value: { resolution_notes: resolutionNotes },
                description: `Resolved reconciliation: ${selectedReconciliation.period_label} - ${resolutionNotes}`
            }])

            setMessage({ type: 'success', text: 'Marked as resolved' })
            setShowViewReconcileModal(false)
            loadReconciliations()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to resolve' })
        }
    }

    const deleteReconciliation = async (id) => {
        if (!confirm('Delete this reconciliation record?')) return
        try {
            await supabase.from('payout_reconciliations').delete().eq('id', id)
            setMessage({ type: 'success', text: 'Deleted' })
            setShowViewReconcileModal(false)
            loadReconciliations()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const getReasonBadge = (payout) => {
        if (payout.reference_type === 'weekly_prize') return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '🎰', label: 'Prize' }
        if (payout.reference_type === 'matrix') return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '🔷', label: 'Matrix' }
        if (payout.reference_type === 'match_game') return { bg: 'bg-green-500/20', text: 'text-green-400', icon: '🎮', label: 'Game' }
        return { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: '💵', label: 'Other' }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setMessage({ type: 'success', text: 'Copied!' })
        setTimeout(() => setMessage(null), 1500)
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    const totalWalletBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0)

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Payout Queue</h1>
                    <p className="text-slate-400 text-sm">Process payouts and reconcile accounts</p>
                </div>
                {message && (
                    <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Wallet Balances */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-400 text-xs">💡 These should match your actual Bank/Venmo/Cash App balances</p>
                    {canTransfer && (
                        <button
                            onClick={openTransferModal}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Transfer Between Accounts →
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {wallets.map(wallet => (
                        <div key={wallet.wallet_key} className="bg-slate-700/50 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-slate-400 text-xs">{wallet.wallet_name}</p>
                                {canAddFunds && (
                                    <button
                                        onClick={() => openAddFundsModal(wallet)}
                                        className="text-[10px] text-yellow-400 hover:text-yellow-300"
                                    >
                                        + Add
                                    </button>
                                )}
                            </div>
                            <p className={`text-lg font-bold ${wallet.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                ${wallet.balance.toFixed(2)}
                            </p>
                        </div>
                    ))}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                        <p className="text-yellow-400 text-xs mb-1">Total All Accounts</p>
                        <p className="text-lg font-bold text-yellow-400">${totalWalletBalance.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-xs">Pending Payouts</p>
                        <p className="text-lg font-bold text-orange-400">{stats.pending_count}</p>
                    </div>
                    <p className="text-orange-400 font-semibold">${stats.pending_amount.toFixed(2)}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-xs">Paid Today</p>
                        <p className="text-lg font-bold text-green-400">{stats.today_paid}</p>
                    </div>
                    <p className="text-green-400 font-semibold">${stats.today_amount.toFixed(2)}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
                {['queue', 'history', 'reconciliation'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setExpandedRow(null); }}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-yellow-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab === 'queue' ? `Queue (${stats.pending_count})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Queue Tab */}
            {activeTab === 'queue' && (
                <div className="space-y-3">
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
                                        <th className="text-right py-2 px-3">Amount</th>
                                        <th className="text-left py-2 px-3">Queued</th>
                                        <th className="text-right py-2 px-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queue.map(payout => {
                                        const badge = getReasonBadge(payout)
                                        const isExpanded = expandedRow === payout.id
                                        return (
                                            <React.Fragment key={payout.id}>
                                                <tr
                                                    className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer"
                                                    onClick={() => setExpandedRow(isExpanded ? null : payout.id)}
                                                >
                                                    <td className="py-2 px-3 text-white font-medium">
                                                        {payout.users?.username || 'Unknown'}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                                            {badge.icon} {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-green-400 font-semibold">
                                                        ${payout.amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-400 text-xs">
                                                        {formatDate(payout.queued_at)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right">
                                                        {canProcessPayouts ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openPaymentModal(payout); }}
                                                                className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500"
                                                            >
                                                                Pay Now
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-500 text-xs">View Only</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-900/50">
                                                        <td colSpan={5} className="px-3 py-2">
                                                            <div className="grid grid-cols-3 gap-3 text-xs">
                                                                <div>
                                                                    <p className="text-slate-500">Email</p>
                                                                    <p className="text-slate-300">{payout.users?.email}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Payment Method</p>
                                                                    <p className="text-slate-300 capitalize">{payout.payment_method || payout.users?.preferred_payment_method || 'Not set'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Payment Handle</p>
                                                                    <div className="flex items-center gap-1">
                                                                        <p className="text-yellow-400">{payout.payment_handle || payout.users?.payment_handle || 'Not set'}</p>
                                                                        {(payout.payment_handle || payout.users?.payment_handle) && (
                                                                            <button onClick={() => copyToClipboard(payout.payment_handle || payout.users?.payment_handle)} className="text-slate-500 hover:text-white">📋</button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Queue Tip */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300">
                        <p><strong>💡 Workflow:</strong> Open Venmo/Cash App → Send payment to user → Click "Pay Now" → Enter confirmation # → Amount is auto-deducted from wallet balance</p>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-3">
                    {/* Filters */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2 items-center">
                            <select
                                value={historyDateFilter}
                                onChange={(e) => setHistoryDateFilter(e.target.value)}
                                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                            >
                                {DATE_FILTER_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>

                            {historyDateFilter === 'custom' && (
                                <>
                                    <input
                                        type="date"
                                        value={historyCustomStart}
                                        onChange={(e) => setHistoryCustomStart(e.target.value)}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                    />
                                    <span className="text-slate-400 text-xs">to</span>
                                    <input
                                        type="date"
                                        value={historyCustomEnd}
                                        onChange={(e) => setHistoryCustomEnd(e.target.value)}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                    />
                                </>
                            )}

                            <select
                                value={historyMethodFilter}
                                onChange={(e) => setHistoryMethodFilter(e.target.value)}
                                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                            >
                                <option value="all">All Methods</option>
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            <select
                                value={historyTypeFilter}
                                onChange={(e) => setHistoryTypeFilter(e.target.value)}
                                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                            >
                                <option value="all">All Types</option>
                                <option value="matrix">Matrix</option>
                                <option value="weekly_prize">Weekly Prize</option>
                                <option value="match_game">Match Game</option>
                            </select>
                        </div>
                    </div>

                    {/* Summary Box */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
                        <div>
                            <p className="text-yellow-400 font-semibold text-sm">{getFilterLabel()}</p>
                            <p className="text-slate-300 text-xs">{historyTotals.count} transactions</p>
                        </div>
                        <div className="text-right">
                            <p className="text-yellow-400 font-bold text-xl">${historyTotals.amount.toFixed(2)}</p>
                            <button
                                onClick={openReconcileModal}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                Mark Reconciled →
                            </button>
                        </div>
                    </div>

                    {/* History Tip */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300">
                        <p><strong>💡 Tip:</strong> Use filters to match payouts to your Venmo/Cash App statement, then click "Mark Reconciled" to confirm they match.</p>
                    </div>

                    {/* History Table */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        {filteredHistory.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <p>No payouts match your filters</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                        <th className="text-left py-2 px-3">Date</th>
                                        <th className="text-left py-2 px-3">User</th>
                                        <th className="text-left py-2 px-3">Reason</th>
                                        <th className="text-right py-2 px-3">Amount</th>
                                        <th className="text-center py-2 px-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHistory.map(payout => {
                                        const badge = getReasonBadge(payout)
                                        const isExpanded = expandedRow === payout.id
                                        return (
                                            <React.Fragment key={payout.id}>
                                                <tr
                                                    className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer"
                                                    onClick={() => setExpandedRow(isExpanded ? null : payout.id)}
                                                >
                                                    <td className="py-2 px-3 text-slate-400 text-xs">
                                                        {formatDate(payout.paid_at)}
                                                    </td>
                                                    <td className="py-2 px-3 text-white">
                                                        {payout.users?.username || 'Unknown'}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                                            {badge.icon} {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-green-400 font-semibold">
                                                        ${payout.amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center text-slate-500">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-900/50">
                                                        <td colSpan={5} className="px-3 py-2">
                                                            <div className="grid grid-cols-5 gap-3 text-xs">
                                                                <div>
                                                                    <p className="text-slate-500">Method</p>
                                                                    <p className="text-slate-300 capitalize">{payout.payment_method}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Handle</p>
                                                                    <p className="text-yellow-400">{payout.payment_handle}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Confirmation #</p>
                                                                    <p className="text-slate-300 font-mono">{payout.confirmation_number}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Paid By</p>
                                                                    <p className="text-slate-300">{payout.paid_by_user?.username || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-500">Notes</p>
                                                                    <p className="text-slate-300">{payout.notes || '-'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Reconciliation Tab */}
            {activeTab === 'reconciliation' && (
                <div className="space-y-3">
                    {/* Reconciliation Tip */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300">
                        <p><strong>💡 Status Guide:</strong> ✅ = Amounts matched | ⚠️ = Discrepancy needs resolution | ✅ Resolved = Discrepancy explained | Click any row to view details</p>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        {reconciliations.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <p className="text-2xl mb-2">📋</p>
                                <p>No reconciliations yet</p>
                                <p className="text-xs mt-1">Go to History tab, filter by date/method, and click "Mark Reconciled"</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                        <th className="text-left py-2 px-3">Period</th>
                                        <th className="text-left py-2 px-3">Method</th>
                                        <th className="text-right py-2 px-3">System</th>
                                        <th className="text-right py-2 px-3">Verified</th>
                                        <th className="text-center py-2 px-3">Status</th>
                                        <th className="text-left py-2 px-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reconciliations.map(rec => (
                                        <tr
                                            key={rec.id}
                                            className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer"
                                            onClick={() => openViewReconciliation(rec)}
                                        >
                                            <td className="py-2 px-3 text-white">{rec.period_label}</td>
                                            <td className="py-2 px-3 text-slate-300 capitalize">{rec.payment_method === 'all' ? 'All' : rec.payment_method}</td>
                                            <td className="py-2 px-3 text-right text-slate-300">${rec.system_total.toFixed(2)}</td>
                                            <td className="py-2 px-3 text-right text-slate-300">${rec.verified_total?.toFixed(2) || '-'}</td>
                                            <td className="py-2 px-3 text-center">
                                                {rec.status === 'matched' && <span className="text-green-400">✅</span>}
                                                {rec.status === 'discrepancy' && <span className="text-orange-400">⚠️ ${Math.abs(rec.discrepancy_amount).toFixed(2)}</span>}
                                                {rec.status === 'resolved' && <span className="text-blue-400">✅ Resolved</span>}
                                                {rec.status === 'pending' && <span className="text-slate-400">⏳</span>}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(rec.reconciled_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedPayout && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold text-lg">💰 Process Payment</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Paying <span className="text-yellow-400 font-medium">{selectedPayout.users?.username}</span>
                            </p>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs mb-1">Send to:</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{selectedPayout.payment_handle || selectedPayout.users?.payment_handle || 'No handle'}</p>
                                        <p className="text-slate-500 text-xs">{selectedPayout.users?.email}</p>
                                    </div>
                                    {(selectedPayout.payment_handle || selectedPayout.users?.payment_handle) && (
                                        <button onClick={() => copyToClipboard(selectedPayout.payment_handle || selectedPayout.users?.payment_handle)} className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs">📋</button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs">Payment Method *</label>
                                <select
                                    value={paymentForm.payment_method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.payment_method ? 'border-red-500' : 'border-slate-600'}`}
                                >
                                    <option value="">Select...</option>
                                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs">Confirmation # *</label>
                                <input
                                    type="text"
                                    value={paymentForm.confirmation_number}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, confirmation_number: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.confirmation_number ? 'border-red-500' : 'border-slate-600'}`}
                                    placeholder="From Venmo/Cash App receipt"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-slate-400 text-xs">Amount *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={paymentForm.amount_paid}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 bg-slate-700 border rounded text-white text-sm ${formErrors.amount_paid ? 'border-red-500' : 'border-slate-600'}`}
                                    />
                                </div>
                                <div>
                                    <label className="text-slate-400 text-xs">Date *</label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                            </div>

                            <div className="bg-slate-700/30 rounded p-2 text-xs text-slate-400">
                                💡 This will deduct ${paymentForm.amount_paid || '0.00'} from your {paymentForm.payment_method === 'cashapp' ? 'Cash App' : paymentForm.payment_method === 'venmo' ? 'Venmo' : 'Bank'} balance
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={closePaymentModal} disabled={processing} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded font-medium">Cancel</button>
                            <button onClick={processPayment} disabled={processing} className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-500">
                                {processing ? 'Processing...' : '✓ Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">Transfer Between Accounts</h3>
                            <p className="text-slate-400 text-xs mt-1">Move money between your Bank/Venmo/Cash App</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-slate-400 text-xs">From</label>
                                <select
                                    value={transferForm.from_wallet}
                                    onChange={(e) => setTransferForm({ ...transferForm, from_wallet: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                    {wallets.map(w => <option key={w.wallet_key} value={w.wallet_key}>{w.wallet_name} (${w.balance.toFixed(2)})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">To</label>
                                <select
                                    value={transferForm.to_wallet}
                                    onChange={(e) => setTransferForm({ ...transferForm, to_wallet: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                    {wallets.filter(w => w.wallet_key !== transferForm.from_wallet).map(w => <option key={w.wallet_key} value={w.wallet_key}>{w.wallet_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={transferForm.amount}
                                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={transferForm.notes}
                                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="e.g., Loading Venmo for payouts"
                                />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 text-xs text-blue-300">
                                💡 Use this when you transfer money between your actual accounts (e.g., Bank → Venmo to fund payouts)
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded">Cancel</button>
                            <button onClick={processTransfer} className="flex-1 px-4 py-2 bg-yellow-500 text-slate-900 rounded font-medium">Transfer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Funds Modal */}
            {showAddFundsModal && addFundsWallet && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">Add Funds to {addFundsWallet.wallet_name}</h3>
                            <p className="text-slate-400 text-xs mt-1">Current balance: ${addFundsWallet.balance.toFixed(2)}</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-slate-400 text-xs">Type</label>
                                <select
                                    value={addFundsForm.type}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, type: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                    <option value="deposit">Deposit (add money)</option>
                                    {canMakeAdjustments && <option value="adjustment">Adjustment (+/-)</option>}
                                </select>
                            </div>

                            {addFundsForm.type === 'deposit' && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-xs text-green-300">
                                    💵 <strong>Deposit:</strong> Money added to account (advertiser payment, check deposit, starting balance, etc.)
                                </div>
                            )}

                            {addFundsForm.type === 'adjustment' && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 text-xs text-orange-300">
                                    ⚠️ <strong>Adjustment:</strong> Use positive or negative number to correct balance discrepancy. Requires explanation.
                                </div>
                            )}

                            <div>
                                <label className="text-slate-400 text-xs">Amount {addFundsForm.type === 'adjustment' && '(use negative for decrease)'}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={addFundsForm.amount}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, amount: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder={addFundsForm.type === 'adjustment' ? '-50.00 or 50.00' : '0.00'}
                                />
                            </div>

                            <div>
                                <label className="text-slate-400 text-xs">Description *</label>
                                <input
                                    type="text"
                                    value={addFundsForm.description}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, description: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder={addFundsForm.type === 'deposit' ? 'e.g., Advertiser payment - ABC Corp' : 'e.g., Correcting missed transaction'}
                                />
                            </div>

                            {addFundsForm.amount && (
                                <div className="bg-slate-700/50 rounded p-2 text-sm">
                                    <p className="text-slate-400">New balance will be:</p>
                                    <p className="text-white font-bold">
                                        ${(addFundsWallet.balance + (addFundsForm.type === 'adjustment' ? parseFloat(addFundsForm.amount) || 0 : Math.abs(parseFloat(addFundsForm.amount)) || 0)).toFixed(2)}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => setShowAddFundsModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded">Cancel</button>
                            <button onClick={processAddFunds} className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reconcile Modal */}
            {showReconcileModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">Mark as Reconciled</h3>
                            <p className="text-slate-400 text-sm">{getFilterLabel()}</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="bg-slate-700/50 rounded p-3">
                                <p className="text-slate-400 text-xs">System Total (from our records)</p>
                                <p className="text-white font-bold text-xl">${historyTotals.amount.toFixed(2)}</p>
                                <p className="text-slate-500 text-xs">{historyTotals.count} transactions</p>
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Verified Total (from your {historyMethodFilter !== 'all' ? historyMethodFilter : 'payment'} statement)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={reconcileForm.verified_total}
                                    onChange={(e) => setReconcileForm({ ...reconcileForm, verified_total: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                                {reconcileForm.verified_total && (
                                    <p className={`text-xs mt-1 ${Math.abs(parseFloat(reconcileForm.verified_total) - historyTotals.amount) < 0.01 ? 'text-green-400' : 'text-orange-400'}`}>
                                        Difference: ${(parseFloat(reconcileForm.verified_total) - historyTotals.amount).toFixed(2)}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={reconcileForm.notes}
                                    onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="e.g., Matched Venmo statement"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => setShowReconcileModal(false)} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded">Cancel</button>
                            <button onClick={saveReconciliation} className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Reconciliation Modal */}
            {showViewReconcileModal && selectedReconciliation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">{selectedReconciliation.period_label}</h3>
                            <p className="text-slate-400 text-sm capitalize">{selectedReconciliation.payment_method === 'all' ? 'All Methods' : selectedReconciliation.payment_method}</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-xs">System Total</p>
                                    <p className="text-white font-bold">${selectedReconciliation.system_total.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-xs">Verified Total</p>
                                    <p className="text-white font-bold">${selectedReconciliation.verified_total?.toFixed(2)}</p>
                                </div>
                            </div>

                            {selectedReconciliation.discrepancy_amount && selectedReconciliation.status !== 'resolved' && (
                                <div className="bg-orange-500/20 border border-orange-500/30 rounded p-3">
                                    <p className="text-orange-400 font-semibold">Discrepancy: ${selectedReconciliation.discrepancy_amount.toFixed(2)}</p>
                                    <p className="text-orange-300 text-xs mt-1">This needs to be investigated and resolved</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-slate-400 text-xs">Status</p>
                                    <p className="text-white capitalize">{selectedReconciliation.status}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs">Reconciled</p>
                                    <p className="text-white">{formatDate(selectedReconciliation.reconciled_at)}</p>
                                </div>
                            </div>

                            {selectedReconciliation.status === 'discrepancy' && (
                                <div>
                                    <label className="text-slate-400 text-xs">Resolution Notes (explain what caused the discrepancy)</label>
                                    <textarea
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        rows={2}
                                        placeholder="e.g., Found missing $50 refund that wasn't logged..."
                                    />
                                </div>
                            )}

                            {selectedReconciliation.resolution_notes && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                                    <p className="text-blue-400 text-xs font-medium">Resolution Notes:</p>
                                    <p className="text-white text-sm">{selectedReconciliation.resolution_notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => deleteReconciliation(selectedReconciliation.id)} className="px-4 py-2 bg-red-500/20 text-red-400 rounded text-sm">Delete</button>
                            <div className="flex-1"></div>
                            <button onClick={() => setShowViewReconcileModal(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded">Close</button>
                            {selectedReconciliation.status === 'discrepancy' && (
                                <button onClick={resolveReconciliation} className="px-4 py-2 bg-green-600 text-white rounded font-medium">Mark Resolved</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}