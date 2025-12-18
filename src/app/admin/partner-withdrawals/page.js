'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PartnerWithdrawalsPage() {
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState([])
    const [transactions, setTransactions] = useState([])
    const [availableProfit, setAvailableProfit] = useState(0)
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('balances')
    const [showAllocateForm, setShowAllocateForm] = useState(false)
    const [showWithdrawForm, setShowWithdrawForm] = useState(null)
    const [allocateAmount, setAllocateAmount] = useState('')
    const [withdrawForm, setWithdrawForm] = useState({
        amount: '',
        payment_method: '',
        payment_handle: '',
        confirmation_number: '',
        notes: ''
    })

    useEffect(() => {
        loadAllData()
    }, [])

    const loadAllData = async () => {
        setLoading(true)
        await Promise.all([
            loadPartners(),
            loadTransactions(),
            loadAvailableProfit()
        ])
        setLoading(false)
    }

    const loadPartners = async () => {
        const { data: partnersData } = await supabase
            .from('partners')
            .select('*')
            .eq('is_active', true)
            .order('is_owner', { ascending: false })
            .order('name')

        if (partnersData) {
            // Calculate balances for each partner
            const partnersWithBalances = await Promise.all(
                partnersData.map(async (partner) => {
                    const { data: txns } = await supabase
                        .from('partner_transactions')
                        .select('type, amount')
                        .eq('partner_id', partner.id)

                    const allocations = txns?.filter(t => t.type === 'allocation').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
                    const withdrawals = txns?.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
                    const balance = allocations - withdrawals

                    return {
                        ...partner,
                        total_allocated: allocations,
                        total_withdrawn: withdrawals,
                        balance: balance
                    }
                })
            )
            setPartners(partnersWithBalances)
        }
    }

    const loadTransactions = async () => {
        const { data } = await supabase
            .from('partner_transactions')
            .select(`
                *,
                partners (name)
            `)
            .order('created_at', { ascending: false })
            .limit(50)

        setTransactions(data || [])
    }

    const loadAvailableProfit = async () => {
        // Get summary data similar to accounting page
        const { data: campaigns } = await supabase
            .from('ad_campaigns')
            .select('amount_paid')

        const grossRevenue = campaigns?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0

        const { data: payouts } = await supabase
            .from('payout_history')
            .select('amount')

        const matrixPayouts = payouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount')

        const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

        const processingFees = grossRevenue * 0.029 + (campaigns?.length || 0) * 0.30
        const netRevenue = grossRevenue - processingFees

        const { data: allocs } = await supabase
            .from('finance_allocations')
            .select('*')

        const totalAllocPercent = allocs?.filter(a => !a.is_auto_calculated).reduce((sum, a) => sum + (a.percentage || 0), 0) || 0
        const ownerPercent = 100 - totalAllocPercent
        const availableForPartners = Math.max(0, (netRevenue - totalExpenses - matrixPayouts) * (ownerPercent / 100))

        // Subtract already allocated amounts
        const { data: partnerAllocs } = await supabase
            .from('partner_transactions')
            .select('amount')
            .eq('type', 'allocation')

        const totalAllocated = partnerAllocs?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0

        setAvailableProfit(Math.max(0, availableForPartners - totalAllocated))
    }

    const allocateProfits = async () => {
        if (!allocateAmount || parseFloat(allocateAmount) <= 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        const amount = parseFloat(allocateAmount)
        if (amount > availableProfit) {
            setMessage({ type: 'error', text: 'Amount exceeds available profit' })
            return
        }

        try {
            // Calculate each partner's share
            const activePartners = partners.filter(p => p.is_active)
            const totalPercentage = activePartners.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0)

            if (totalPercentage !== 100) {
                setMessage({ type: 'error', text: 'Partner percentages must equal 100%' })
                return
            }

            // Create allocation for each partner
            const allocations = activePartners.map(partner => ({
                partner_id: partner.id,
                type: 'allocation',
                amount: (amount * (partner.percentage / 100)).toFixed(2),
                description: `Profit allocation - $${amount.toFixed(2)} total`
            }))

            const { error } = await supabase
                .from('partner_transactions')
                .insert(allocations)

            if (error) throw error

            setMessage({ type: 'success', text: 'Profits allocated!' })
            setShowAllocateForm(false)
            setAllocateAmount('')
            loadAllData()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error allocating:', error)
            setMessage({ type: 'error', text: 'Failed to allocate' })
        }
    }

    const processWithdrawal = async (partner) => {
        if (!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        const amount = parseFloat(withdrawForm.amount)
        if (amount > partner.balance) {
            setMessage({ type: 'error', text: 'Amount exceeds available balance' })
            return
        }

        try {
            const { error } = await supabase
                .from('partner_transactions')
                .insert([{
                    partner_id: partner.id,
                    type: 'withdrawal',
                    amount: amount,
                    description: 'Withdrawal',
                    payment_method: withdrawForm.payment_method || partner.payment_method,
                    payment_handle: withdrawForm.payment_handle || partner.payment_handle,
                    confirmation_number: withdrawForm.confirmation_number || null,
                    notes: withdrawForm.notes || null
                }])

            if (error) throw error

            // Update partner total_paid_out
            await supabase
                .from('partners')
                .update({
                    total_paid_out: (partner.total_paid_out || 0) + amount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', partner.id)

            setMessage({ type: 'success', text: 'Withdrawal processed!' })
            setShowWithdrawForm(null)
            setWithdrawForm({
                amount: '',
                payment_method: '',
                payment_handle: '',
                confirmation_number: '',
                notes: ''
            })
            loadAllData()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error processing withdrawal:', error)
            setMessage({ type: 'error', text: 'Failed to process' })
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
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
                    <h1 className="text-xl font-bold text-white">Partner Withdrawals</h1>
                    <p className="text-slate-400 text-sm">Manage partner balances and payouts</p>
                </div>
                {message && (
                    <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Available to Allocate</p>
                    <p className="text-xl font-bold text-green-400">${availableProfit.toFixed(2)}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Partner Balances</p>
                    <p className="text-xl font-bold text-yellow-400">
                        ${partners.reduce((sum, p) => sum + (p.balance || 0), 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Allocated (All Time)</p>
                    <p className="text-xl font-bold text-white">
                        ${partners.reduce((sum, p) => sum + (p.total_allocated || 0), 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Withdrawn (All Time)</p>
                    <p className="text-xl font-bold text-white">
                        ${partners.reduce((sum, p) => sum + (p.total_withdrawn || 0), 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Allocate Button */}
            {availableProfit > 0 && (
                <div className="mb-4">
                    {showAllocateForm ? (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <h3 className="text-white font-semibold text-sm mb-2">Allocate Profits to Partners</h3>
                            <div className="flex items-center gap-3">
                                <div>
                                    <label className="text-slate-400 text-xs block mb-1">Amount to Allocate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        max={availableProfit}
                                        value={allocateAmount}
                                        onChange={(e) => setAllocateAmount(e.target.value)}
                                        placeholder={`Max: $${availableProfit.toFixed(2)}`}
                                        className="w-40 px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    />
                                </div>
                                {allocateAmount && parseFloat(allocateAmount) > 0 && (
                                    <div className="text-xs text-slate-400">
                                        <p className="font-medium text-white mb-1">Split Preview:</p>
                                        {partners.filter(p => p.is_active).map(p => (
                                            <p key={p.id}>
                                                {p.name}: ${(parseFloat(allocateAmount) * (p.percentage / 100)).toFixed(2)} ({p.percentage}%)
                                            </p>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={() => setShowAllocateForm(false)}
                                        className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={allocateProfits}
                                        className="px-3 py-1 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-400"
                                    >
                                        Allocate
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAllocateForm(true)}
                            className="px-4 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-400"
                        >
                            + Allocate Profits (${availableProfit.toFixed(2)} available)
                        </button>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
                {['balances', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-yellow-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab === 'balances' ? 'Partner Balances' : 'Transaction History'}
                    </button>
                ))}
            </div>

            {/* Balances Tab */}
            {activeTab === 'balances' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                <th className="text-left py-2 px-3">Partner</th>
                                <th className="text-right py-2 px-3">Allocated</th>
                                <th className="text-right py-2 px-3">Withdrawn</th>
                                <th className="text-right py-2 px-3">Balance</th>
                                <th className="text-left py-2 px-3">Payment Info</th>
                                <th className="text-right py-2 px-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partners.map(partner => (
                                <tr key={partner.id} className="border-t border-slate-700">
                                    <td className="py-2 px-3">
                                        <p className="text-white font-medium">
                                            {partner.name}
                                            {partner.is_owner && <span className="ml-1 text-yellow-400 text-xs">(Owner)</span>}
                                        </p>
                                        <p className="text-slate-500 text-xs">{partner.percentage}% share</p>
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                        ${(partner.total_allocated || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                        ${(partner.total_withdrawn || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <span className={`font-semibold ${partner.balance > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                            ${(partner.balance || 0).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-400 text-xs">
                                        {partner.payment_method ? (
                                            <span className="capitalize">{partner.payment_method}: {partner.payment_handle}</span>
                                        ) : (
                                            <span className="text-slate-500">Not set</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        {showWithdrawForm === partner.id ? (
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="flex gap-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        max={partner.balance}
                                                        placeholder="Amount"
                                                        value={withdrawForm.amount}
                                                        onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                                                        className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Conf #"
                                                        value={withdrawForm.confirmation_number}
                                                        onChange={(e) => setWithdrawForm({ ...withdrawForm, confirmation_number: e.target.value })}
                                                        className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                    />
                                                </div>
                                                <div className="flex gap-1">
                                                    <input
                                                        type="text"
                                                        placeholder="Notes"
                                                        value={withdrawForm.notes}
                                                        onChange={(e) => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
                                                        className="w-32 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                                                    />
                                                    <button
                                                        onClick={() => processWithdrawal(partner)}
                                                        className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowWithdrawForm(null)
                                                            setWithdrawForm({ amount: '', payment_method: '', payment_handle: '', confirmation_number: '', notes: '' })
                                                        }}
                                                        className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs hover:bg-slate-500"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowWithdrawForm(partner.id)}
                                                disabled={partner.balance <= 0}
                                                className={`px-3 py-1 rounded text-xs font-medium ${partner.balance > 0
                                                        ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400'
                                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                Withdraw
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p>No transactions yet.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-700/50 text-slate-400 text-xs">
                                    <th className="text-left py-2 px-3">Date</th>
                                    <th className="text-left py-2 px-3">Partner</th>
                                    <th className="text-left py-2 px-3">Type</th>
                                    <th className="text-right py-2 px-3">Amount</th>
                                    <th className="text-left py-2 px-3">Conf #</th>
                                    <th className="text-left py-2 px-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="border-t border-slate-700">
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {formatDate(tx.created_at)}
                                        </td>
                                        <td className="py-2 px-3 text-white">
                                            {tx.partners?.name || 'Unknown'}
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'allocation'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className={`py-2 px-3 text-right font-semibold ${tx.type === 'allocation' ? 'text-green-400' : 'text-orange-400'
                                            }`}>
                                            {tx.type === 'allocation' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">
                                            {tx.confirmation_number || '-'}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 text-xs max-w-32 truncate">
                                            {tx.notes || tx.description || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <div className="mt-3 p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                <p>💡 <strong>Workflow:</strong> Allocate profits to partners → They accumulate a balance → Process withdrawals when they want to be paid</p>
            </div>
        </div>
    )
}