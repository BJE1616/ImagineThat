'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function FinancesPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)
    const [bbBalance, setBbBalance] = useState(null)
    const [bbTransactions, setBbTransactions] = useState([])
    const [pendingPayouts, setPendingPayouts] = useState([])
    const [payoutHistory, setPayoutHistory] = useState([])
    const [activeTab, setActiveTab] = useState('bb')

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/auth/login')
                return
            }
            setUser(authUser)
            await loadData(authUser.id)
        } catch (error) {
            console.error('Error:', error)
            router.push('/auth/login')
        }
    }

    const loadData = async (userId) => {
        setLoading(true)
        await Promise.all([
            loadBBBalance(userId),
            loadBBTransactions(userId),
            loadPendingPayouts(userId),
            loadPayoutHistory(userId)
        ])
        setLoading(false)
    }

    const loadBBBalance = async (userId) => {
        try {
            const { data } = await supabase
                .from('bb_balances')
                .select('*')
                .eq('user_id', userId)
                .single()
            setBbBalance(data)
        } catch (error) {
            console.log('No BB balance found')
        }
    }

    const loadBBTransactions = async (userId) => {
        try {
            const { data } = await supabase
                .from('bb_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)
            setBbTransactions(data || [])
        } catch (error) {
            console.error('Error loading BB transactions:', error)
        }
    }

    const loadPendingPayouts = async (userId) => {
        try {
            const { data } = await supabase
                .from('payout_queue')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
            setPendingPayouts(data || [])
        } catch (error) {
            console.error('Error loading pending payouts:', error)
        }
    }

    const loadPayoutHistory = async (userId) => {
        try {
            const { data } = await supabase
                .from('payout_history')
                .select('*')
                .eq('user_id', userId)
                .order('paid_at', { ascending: false })
                .limit(50)
            setPayoutHistory(data || [])
        } catch (error) {
            console.error('Error loading payout history:', error)
        }
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    }

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400">Loading finances...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <h1 className="text-xl font-bold text-white">💰 My Finances</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">BB Balance</p>
                        <p className="text-yellow-400 font-bold text-lg">{bbBalance?.balance || 0}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Total BB Earned</p>
                        <p className="text-green-400 font-bold text-lg">{bbBalance?.total_earned || 0}</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Pending Cash</p>
                        <p className="text-orange-400 font-bold text-lg">
                            ${pendingPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <p className="text-slate-400 text-xs">Total Paid Out</p>
                        <p className="text-green-400 font-bold text-lg">
                            ${payoutHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('bb')}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${activeTab === 'bb' ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                        Bonus Bucks
                    </button>
                    <button
                        onClick={() => setActiveTab('cash')}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${activeTab === 'cash' ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Cash Payouts
                    </button>
                </div>

                {/* BB Transactions Tab */}
                {activeTab === 'bb' && (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        <div className="p-3 border-b border-slate-700">
                            <h2 className="text-white font-medium text-sm">Bonus Bucks History</h2>
                        </div>
                        {bbTransactions.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-sm">No transactions yet</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400 text-xs">
                                            <th className="text-left p-2">Date</th>
                                            <th className="text-left p-2">Type</th>
                                            <th className="text-left p-2 hidden sm:table-cell">Description</th>
                                            <th className="text-right p-2">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bbTransactions.map(tx => (
                                            <tr key={tx.id} className="border-b border-slate-700/50">
                                                <td className="p-2 text-slate-300 text-xs">{formatDateTime(tx.created_at)}</td>
                                                <td className="p-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${tx.type === 'earn' ? 'bg-green-500/20 text-green-400' : tx.type === 'spend' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-slate-400 text-xs hidden sm:table-cell truncate max-w-[200px]">{tx.description || tx.source || '-'}</td>
                                                <td className={`p-2 text-right font-medium ${tx.type === 'earn' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Cash Payouts Tab */}
                {activeTab === 'cash' && (
                    <div className="space-y-4">
                        {/* Pending Payouts */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                                <h2 className="text-white font-medium text-sm">Pending Payouts</h2>
                                <span className="text-orange-400 text-xs">{pendingPayouts.length} pending</span>
                            </div>
                            {pendingPayouts.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">No pending payouts</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700 text-slate-400 text-xs">
                                                <th className="text-left p-2">Date</th>
                                                <th className="text-left p-2">Reason</th>
                                                <th className="text-left p-2">Status</th>
                                                <th className="text-right p-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingPayouts.map(payout => (
                                                <tr key={payout.id} className="border-b border-slate-700/50">
                                                    <td className="p-2 text-slate-300 text-xs">{formatDate(payout.created_at)}</td>
                                                    <td className="p-2 text-slate-400 text-xs">{payout.reason || 'Matrix Completion'}</td>
                                                    <td className="p-2">
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${payout.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : payout.status === 'approved' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                            {payout.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right font-medium text-green-400">${Number(payout.amount).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Payout History */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                            <div className="p-3 border-b border-slate-700">
                                <h2 className="text-white font-medium text-sm">Payout History</h2>
                            </div>
                            {payoutHistory.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">No payouts yet</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700 text-slate-400 text-xs">
                                                <th className="text-left p-2">Date Paid</th>
                                                <th className="text-left p-2">Method</th>
                                                <th className="text-left p-2 hidden sm:table-cell">Reference</th>
                                                <th className="text-right p-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payoutHistory.map(payout => (
                                                <tr key={payout.id} className="border-b border-slate-700/50">
                                                    <td className="p-2 text-slate-300 text-xs">{formatDate(payout.paid_at)}</td>
                                                    <td className="p-2 text-slate-400 text-xs">{payout.payment_method || '-'}</td>
                                                    <td className="p-2 text-slate-400 text-xs hidden sm:table-cell">{payout.reference || '-'}</td>
                                                    <td className="p-2 text-right font-medium text-green-400">${Number(payout.amount).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}