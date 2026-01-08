'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Tooltip from '@/components/Tooltip'

// ===== TOOLTIP CONTENT =====
const TIPS = {
    // Overview stats
    grossRevenue: "Total money received from ad campaigns before any deductions.",
    processingFees: "Stripe charges ~2.9% + $0.30 per transaction. This is automatically calculated.",
    netRevenue: "Gross revenue minus processing fees. This is your actual income.",
    matrixPayouts: "Total $200 payouts sent to users who completed their referral matrix.",
    pendingPayouts: "Matrix payouts that are owed but not yet sent. This is held in reserve.",
    availableForPartners: "Money available to split between partners after all obligations.",

    // Allocations
    allocations: "Set aside percentages for specific purposes before partner split. Partners get the remainder.",
    allocationPercentage: "What percentage of net revenue goes to this fund. Total cannot exceed 100%.",
    partnersSplit: "The leftover percentage after allocations. This is split among active partners.",

    // Partners
    partnerPercentage: "This partner's share of the 'Available for Partners' amount. All active partners should total 100%.",
    partnerSplit: "The actual dollar amount this partner receives based on their percentage.",

    // Expenses
    recurringExpenses: "Bills that repeat (monthly/yearly). These are tracked separately from one-time expenses.",
    oneTimeExpenses: "Individual purchases or costs. Add each expense as it occurs.",

    // Transactions
    transactions: "All money in and out. Ad campaigns are added automatically. Use 'Add Income' for other revenue.",

    // Fund Balances
    fundBalances: "Money set aside in each allocation category. Builds up over time based on allocation percentages.",

    // Tax Summaries
    taxYear: "The tax year to send summaries for. Users who earned money this year will be included.",
    taxRecipients: "Number of users who received payouts (matrix, prizes, etc.) during the selected year.",
    taxConfirm: "This sends official tax documents. Double-check the year and recipient count before sending."
}

export default function AccountingDashboardPage() {
    const [loading, setLoading] = useState(true)
    const [allocations, setAllocations] = useState([])
    const [funds, setFunds] = useState([])
    const [transactions, setTransactions] = useState([])
    const [expenses, setExpenses] = useState([])
    const [recurringExpenses, setRecurringExpenses] = useState([])
    const [expenseCategories, setExpenseCategories] = useState([])
    const [partners, setPartners] = useState([])
    const [summary, setSummary] = useState({
        grossRevenue: 0,
        processingFees: 0,
        netRevenue: 0,
        totalExpenses: 0,
        matrixPayouts: 0,
        pendingPayouts: 0,
        ownerAvailable: 0
    })
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('overview')
    const [dateRange, setDateRange] = useState('month')
    const [showExpenseForm, setShowExpenseForm] = useState(false)
    const [showRecurringForm, setShowRecurringForm] = useState(false)
    const [showIncomeForm, setShowIncomeForm] = useState(false)
    const [showPartnerForm, setShowPartnerForm] = useState(false)
    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category_id: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
    })
    const [newRecurring, setNewRecurring] = useState({
        name: '',
        amount: '',
        category_id: '',
        frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        notes: ''
    })
    const [newIncome, setNewIncome] = useState({
        description: '',
        amount: '',
        category: 'other',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: ''
    })
    const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1)
    const [taxRecipientCount, setTaxRecipientCount] = useState(0)
    const [taxConfirmed, setTaxConfirmed] = useState(false)
    const [sendingTax, setSendingTax] = useState(false)
    const [taxRecipients, setTaxRecipients] = useState([])
    const [newPartner, setNewPartner] = useState({
        name: '',
        email: '',
        percentage: '',
        payment_method: '',
        payment_handle: '',
        notes: ''
    })

    useEffect(() => {
        loadAllData()
    }, [dateRange])

    useEffect(() => {
        if (activeTab === 'tax') {
            loadTaxRecipients(taxYear)
        }
    }, [activeTab, taxYear])

    const loadAllData = async () => {
        setLoading(true)
        try {
            await Promise.all([
                loadAllocations(),
                loadFunds(),
                loadTransactions(),
                loadExpenses(),
                loadRecurringExpenses(),
                loadExpenseCategories(),
                loadPartners(),
                calculateSummary()
            ])
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getDateFilter = () => {
        const now = new Date()
        if (dateRange === 'today') {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        } else if (dateRange === 'week') {
            const dayOfWeek = now.getDay()
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - dayOfWeek)
            weekStart.setHours(0, 0, 0, 0)
            return weekStart.toISOString()
        } else if (dateRange === 'month') {
            return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        } else if (dateRange === 'year') {
            return new Date(now.getFullYear(), 0, 1).toISOString()
        }
        return new Date(0).toISOString()
    }

    const loadAllocations = async () => {
        const { data } = await supabase.from('finance_allocations').select('*').order('display_order')
        setAllocations(data || [])
    }

    const loadFunds = async () => {
        const { data } = await supabase.from('fund_balances').select('*').order('fund_name')
        setFunds(data || [])
    }

    const loadTransactions = async () => {
        const { data } = await supabase
            .from('company_transactions')
            .select('*')
            .gte('created_at', getDateFilter())
            .order('created_at', { ascending: false })
            .limit(20)
        setTransactions(data || [])
    }

    const loadExpenses = async () => {
        const { data } = await supabase
            .from('expenses')
            .select('*, expense_categories(name)')
            .gte('expense_date', getDateFilter().split('T')[0])
            .order('expense_date', { ascending: false })
        setExpenses(data || [])
    }

    const loadRecurringExpenses = async () => {
        const { data } = await supabase
            .from('recurring_expenses')
            .select('*, expense_categories(name)')
            .eq('is_active', true)
            .order('name')
        setRecurringExpenses(data || [])
    }

    const loadExpenseCategories = async () => {
        const { data } = await supabase.from('expense_categories').select('*').order('name')
        setExpenseCategories(data || [])
    }

    const loadPartners = async () => {
        const { data } = await supabase.from('partners').select('*').order('is_owner', { ascending: false }).order('name')
        setPartners(data || [])
    }

    const loadTaxRecipients = async (year) => {
        try {
            const startDate = `${year}-01-01`
            const endDate = `${year}-12-31`

            const { data, error } = await supabase
                .from('payout_history')
                .select('user_id, amount, users(email, username, first_name)')
                .gte('paid_at', startDate)
                .lte('paid_at', endDate)

            if (error) throw error

            const userTotals = {}
            data?.forEach(p => {
                if (p.user_id && p.users?.email) {
                    if (!userTotals[p.user_id]) {
                        userTotals[p.user_id] = {
                            email: p.users.email,
                            username: p.users.username,
                            first_name: p.users.first_name,
                            total: 0
                        }
                    }
                    userTotals[p.user_id].total += parseFloat(p.amount) || 0
                }
            })

            const recipients = Object.values(userTotals).map(u => ({
                ...u,
                total: u.total.toFixed(2)
            }))

            setTaxRecipients(recipients)
            setTaxRecipientCount(recipients.length)
        } catch (error) {
            console.error('Error loading tax recipients:', error)
            setTaxRecipients([])
            setTaxRecipientCount(0)
        }
    }

    const sendTaxSummaries = async () => {
        if (!taxConfirmed || sendingTax) return

        setSendingTax(true)
        try {
            let successCount = 0
            let errorCount = 0

            for (const recipient of taxRecipients) {
                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'tax_summary_ready',
                            to: recipient.email,
                            data: {
                                first_name: recipient.first_name || recipient.username,
                                year: taxYear.toString(),
                                total_earnings: recipient.total
                            }
                        })
                    })
                    successCount++
                } catch (err) {
                    console.error(`Failed to send to ${recipient.email}:`, err)
                    errorCount++
                }
            }

            setMessage({
                type: errorCount === 0 ? 'success' : 'error',
                text: `Sent ${successCount} tax summaries${errorCount > 0 ? `, ${errorCount} failed` : ''}`
            })
            setTaxConfirmed(false)
            setTimeout(() => setMessage(null), 5000)
        } catch (error) {
            console.error('Error sending tax summaries:', error)
            setMessage({ type: 'error', text: 'Failed to send tax summaries' })
        } finally {
            setSendingTax(false)
        }
    }

    const calculateSummary = async () => {
        const dateFilter = getDateFilter()

        const { data: campaigns } = await supabase
            .from('ad_campaigns')
            .select('amount_paid, status')
            .gte('created_at', dateFilter)

        const grossRevenue = campaigns?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0

        const { data: payouts } = await supabase
            .from('payout_history')
            .select('amount')
            .gte('paid_at', dateFilter)

        const matrixPayouts = payouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        const { data: pending } = await supabase
            .from('payout_queue')
            .select('amount')
            .eq('status', 'pending')

        const pendingPayouts = pending?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        const { data: expenseData } = await supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', dateFilter.split('T')[0])

        const totalExpenses = expenseData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

        const processingFees = grossRevenue * 0.029 + (campaigns?.length || 0) * 0.30

        const netRevenue = grossRevenue - processingFees
        const afterExpenses = netRevenue - totalExpenses - matrixPayouts

        const { data: allocs } = await supabase.from('finance_allocations').select('*')

        const totalAllocPercent = allocs?.filter(a => !a.is_auto_calculated).reduce((sum, a) => sum + (a.percentage || 0), 0) || 0
        const ownerPercent = 100 - totalAllocPercent
        const ownerAvailable = Math.max(0, afterExpenses * (ownerPercent / 100) - pendingPayouts)

        setSummary({
            grossRevenue,
            processingFees,
            netRevenue,
            totalExpenses,
            matrixPayouts,
            pendingPayouts,
            ownerAvailable
        })
    }

    const updateAllocation = async (id, percentage) => {
        try {
            const { error } = await supabase
                .from('finance_allocations')
                .update({ percentage, updated_at: new Date().toISOString() })
                .eq('id', id)
            if (error) throw error
            setAllocations(allocations.map(a => a.id === id ? { ...a, percentage } : a))
            calculateSummary()
            setMessage({ type: 'success', text: 'Updated!' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const addExpense = async () => {
        if (!newExpense.description || !newExpense.amount) {
            setMessage({ type: 'error', text: 'Description and amount required' })
            return
        }
        try {
            const { error } = await supabase.from('expenses').insert([{
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                category_id: newExpense.category_id || null,
                expense_date: newExpense.expense_date,
                notes: newExpense.notes || null
            }])
            if (error) throw error
            setMessage({ type: 'success', text: 'Expense added!' })
            setShowExpenseForm(false)
            setNewExpense({ description: '', amount: '', category_id: '', expense_date: new Date().toISOString().split('T')[0], notes: '' })
            loadExpenses()
            calculateSummary()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to add expense' })
        }
    }

    const deleteExpense = async (id) => {
        if (!confirm('Delete this expense?')) return
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Deleted!' })
            loadExpenses()
            calculateSummary()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const addRecurringExpense = async () => {
        if (!newRecurring.name || !newRecurring.amount) {
            setMessage({ type: 'error', text: 'Name and amount required' })
            return
        }
        try {
            const { error } = await supabase.from('recurring_expenses').insert([{
                name: newRecurring.name,
                amount: parseFloat(newRecurring.amount),
                category_id: newRecurring.category_id || null,
                frequency: newRecurring.frequency,
                start_date: newRecurring.start_date,
                notes: newRecurring.notes || null,
                is_active: true
            }])
            if (error) throw error
            setMessage({ type: 'success', text: 'Recurring expense added!' })
            setShowRecurringForm(false)
            setNewRecurring({ name: '', amount: '', category_id: '', frequency: 'monthly', start_date: new Date().toISOString().split('T')[0], notes: '' })
            loadRecurringExpenses()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to add' })
        }
    }

    const toggleRecurringExpense = async (id, isActive) => {
        try {
            const { error } = await supabase.from('recurring_expenses').update({ is_active: !isActive }).eq('id', id)
            if (error) throw error
            loadRecurringExpenses()
            setMessage({ type: 'success', text: isActive ? 'Disabled' : 'Enabled' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const deleteRecurringExpense = async (id) => {
        if (!confirm('Delete this recurring expense?')) return
        try {
            const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Deleted!' })
            loadRecurringExpenses()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const addIncome = async () => {
        if (!newIncome.description || !newIncome.amount) {
            setMessage({ type: 'error', text: 'Description and amount required' })
            return
        }
        try {
            const { error } = await supabase.from('company_transactions').insert([{
                type: 'revenue',
                category: newIncome.category,
                description: newIncome.description,
                gross_amount: parseFloat(newIncome.amount),
                processing_fee: 0,
                net_amount: parseFloat(newIncome.amount),
                transaction_date: newIncome.transaction_date,
                notes: newIncome.notes || null
            }])
            if (error) throw error
            setMessage({ type: 'success', text: 'Income added!' })
            setShowIncomeForm(false)
            setNewIncome({ description: '', amount: '', category: 'other', transaction_date: new Date().toISOString().split('T')[0], notes: '' })
            loadTransactions()
            calculateSummary()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to add income' })
        }
    }

    const deleteTransaction = async (id) => {
        if (!confirm('Delete this transaction?')) return
        try {
            const { error } = await supabase.from('company_transactions').delete().eq('id', id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Deleted!' })
            loadTransactions()
            calculateSummary()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const addPartner = async () => {
        if (!newPartner.name || !newPartner.percentage) {
            setMessage({ type: 'error', text: 'Name and percentage required' })
            return
        }
        try {
            const { error } = await supabase.from('partners').insert([{
                name: newPartner.name,
                email: newPartner.email || null,
                percentage: parseFloat(newPartner.percentage),
                payment_method: newPartner.payment_method || null,
                payment_handle: newPartner.payment_handle || null,
                notes: newPartner.notes || null,
                is_active: true,
                is_owner: false
            }])
            if (error) throw error
            setMessage({ type: 'success', text: 'Partner added!' })
            setShowPartnerForm(false)
            setNewPartner({ name: '', email: '', percentage: '', payment_method: '', payment_handle: '', notes: '' })
            loadPartners()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to add partner' })
        }
    }

    const updatePartnerPercentage = async (id, percentage) => {
        try {
            const { error } = await supabase
                .from('partners')
                .update({ percentage, updated_at: new Date().toISOString() })
                .eq('id', id)
            if (error) throw error
            setPartners(partners.map(p => p.id === id ? { ...p, percentage } : p))
            setMessage({ type: 'success', text: 'Updated!' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const togglePartner = async (id, isActive) => {
        try {
            const { error } = await supabase.from('partners').update({ is_active: !isActive }).eq('id', id)
            if (error) throw error
            loadPartners()
            setMessage({ type: 'success', text: isActive ? 'Deactivated' : 'Activated' })
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const deletePartner = async (id) => {
        if (!confirm('Delete this partner?')) return
        try {
            const { error } = await supabase.from('partners').delete().eq('id', id)
            if (error) throw error
            setMessage({ type: 'success', text: 'Deleted!' })
            loadPartners()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const totalAllocated = allocations.filter(a => !a.is_auto_calculated).reduce((sum, a) => sum + (a.percentage || 0), 0)
    const ownerPercentage = 100 - totalAllocated
    const activePartners = partners.filter(p => p.is_active)
    const totalPartnerPercentage = activePartners.reduce((sum, p) => sum + (parseFloat(p.percentage) || 0), 0)

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
                    <h1 className="text-xl font-bold text-white">Accounting Dashboard</h1>
                    <p className="text-slate-400 text-sm">Financial overview and management</p>
                </div>
                <div className="flex items-center gap-2">
                    {message && (
                        <div className={`px-3 py-1 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </div>
                    )}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-1 mb-3">
                {['overview', 'allocations', 'expenses', 'transactions', 'partners', 'tax'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-yellow-500 text-slate-900'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <p className="text-slate-400 text-xs">
                                <Tooltip text={TIPS.grossRevenue}>Gross Revenue</Tooltip>
                            </p>
                            <p className="text-xl font-bold text-green-400">${summary.grossRevenue.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <p className="text-slate-400 text-xs">
                                <Tooltip text={TIPS.processingFees}>Processing Fees</Tooltip>
                            </p>
                            <p className="text-xl font-bold text-red-400">-${summary.processingFees.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <p className="text-slate-400 text-xs">
                                <Tooltip text={TIPS.matrixPayouts}>Matrix Payouts</Tooltip>
                            </p>
                            <p className="text-xl font-bold text-red-400">-${summary.matrixPayouts.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <p className="text-slate-400 text-xs">
                                <Tooltip text={TIPS.availableForPartners}>Available for Partners</Tooltip>
                            </p>
                            <p className="text-xl font-bold text-yellow-400">${summary.ownerAvailable.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h3 className="text-white font-semibold mb-2 text-sm">Profit & Loss Summary</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-slate-300">
                                <span>Gross Revenue</span>
                                <span className="text-green-400">${summary.grossRevenue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>Processing Fees</span>
                                <span className="text-red-400">-${summary.processingFees.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 border-t border-slate-700 pt-1">
                                <span><Tooltip text={TIPS.netRevenue}>Net Revenue</Tooltip></span>
                                <span className="text-white">${summary.netRevenue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>Expenses</span>
                                <span className="text-red-400">-${summary.totalExpenses.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>Matrix Payouts</span>
                                <span className="text-red-400">-${summary.matrixPayouts.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 border-t border-slate-700 pt-1">
                                <span>After Obligations</span>
                                <span className="text-white">${(summary.netRevenue - summary.totalExpenses - summary.matrixPayouts).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span><Tooltip text={TIPS.pendingPayouts}>Pending Payouts (Hold)</Tooltip></span>
                                <span className="text-orange-400">-${summary.pendingPayouts.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-slate-700 pt-1">
                                <span className="text-white">Available for Partners</span>
                                <span className="text-yellow-400">${summary.ownerAvailable.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {activePartners.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                            <h3 className="text-white font-semibold mb-2 text-sm">
                                <Tooltip text={TIPS.partnerSplit}>Partner Profit Split</Tooltip>
                            </h3>
                            <div className="space-y-1 text-sm">
                                {activePartners.map(partner => (
                                    <div key={partner.id} className="flex justify-between text-slate-300">
                                        <span>{partner.name} ({partner.percentage}%)</span>
                                        <span className="text-green-400">${(summary.ownerAvailable * (partner.percentage / 100)).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold border-t border-slate-700 pt-1">
                                    <span className="text-white">Total</span>
                                    <span className={totalPartnerPercentage === 100 ? 'text-green-400' : 'text-red-400'}>
                                        ${(summary.ownerAvailable * (totalPartnerPercentage / 100)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            {totalPartnerPercentage !== 100 && (
                                <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs">
                                    ⚠️ Partner percentages = {totalPartnerPercentage.toFixed(1)}% (should be 100%)
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <h3 className="text-white font-semibold mb-2 text-sm">
                            <Tooltip text={TIPS.fundBalances}>Fund Balances</Tooltip>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {funds.map(fund => (
                                <div key={fund.id} className="bg-slate-700/50 rounded p-2">
                                    <p className="text-slate-400 text-xs truncate">{fund.fund_name}</p>
                                    <p className="text-white font-semibold">${(fund.balance || 0).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'allocations' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <h3 className="text-white font-semibold mb-2 text-sm">
                        <Tooltip text={TIPS.allocations}>Allocation Percentages</Tooltip>
                    </h3>
                    <p className="text-slate-400 text-xs mb-3">Set how net revenue is distributed. Owner/Partners get the remainder.</p>

                    <div className="space-y-2">
                        {allocations.filter(a => !a.is_auto_calculated).map(alloc => (
                            <div key={alloc.id} className="flex items-center gap-3">
                                <span className="text-slate-300 text-sm w-40">{alloc.setting_name}</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={alloc.percentage}
                                    onChange={(e) => setAllocations(allocations.map(a => a.id === alloc.id ? { ...a, percentage: Number(e.target.value) } : a))}
                                    onBlur={(e) => updateAllocation(alloc.id, Number(e.target.value))}
                                    className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                                <span className="text-slate-400 text-sm">%</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 border-t border-slate-700 pt-2">
                            <span className="text-yellow-400 text-sm w-40 font-semibold">
                                <Tooltip text={TIPS.partnersSplit}>Partners Split</Tooltip>
                            </span>
                            <span className="text-yellow-400 font-bold">{ownerPercentage.toFixed(1)}%</span>
                            <span className="text-slate-500 text-xs">(auto-calculated)</span>
                        </div>
                    </div>

                    {totalAllocated > 100 && (
                        <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                            ⚠️ Allocations exceed 100%! Please reduce.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'expenses' && (
                <div className="space-y-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-white font-semibold text-sm">
                                <Tooltip text={TIPS.recurringExpenses}>Recurring Expenses</Tooltip>
                            </h3>
                            <button
                                onClick={() => setShowRecurringForm(!showRecurringForm)}
                                className="px-2 py-1 bg-yellow-500 text-slate-900 rounded text-xs font-medium hover:bg-yellow-400"
                            >
                                {showRecurringForm ? 'Cancel' : '+ Add'}
                            </button>
                        </div>

                        {showRecurringForm && (
                            <div className="mb-3 p-2 bg-slate-700/50 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                    <input type="text" placeholder="Name" value={newRecurring.name}
                                        onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                    <input type="number" placeholder="Amount" step="0.01" value={newRecurring.amount}
                                        onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                    <select value={newRecurring.category_id}
                                        onChange={(e) => setNewRecurring({ ...newRecurring, category_id: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                                        <option value="">Category</option>
                                        {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <select value={newRecurring.frequency}
                                        onChange={(e) => setNewRecurring({ ...newRecurring, frequency: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                    <button onClick={addRecurringExpense}
                                        className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400">Save</button>
                                </div>
                            </div>
                        )}

                        {recurringExpenses.length === 0 ? (
                            <p className="text-slate-400 text-sm">No recurring expenses yet.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400">
                                        <th className="text-left py-1">Name</th>
                                        <th className="text-left py-1">Category</th>
                                        <th className="text-left py-1">Freq</th>
                                        <th className="text-right py-1">Amount</th>
                                        <th className="text-right py-1">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recurringExpenses.map(exp => (
                                        <tr key={exp.id} className="border-t border-slate-700">
                                            <td className="py-1 text-white">{exp.name}</td>
                                            <td className="py-1 text-slate-400">{exp.expense_categories?.name || '-'}</td>
                                            <td className="py-1 text-slate-400">{exp.frequency}</td>
                                            <td className="py-1 text-right text-red-400">${(exp.amount || 0).toFixed(2)}</td>
                                            <td className="py-1 text-right">
                                                <button onClick={() => toggleRecurringExpense(exp.id, exp.is_active)}
                                                    className="text-yellow-400 hover:text-yellow-300 mr-2">
                                                    {exp.is_active ? 'Off' : 'On'}
                                                </button>
                                                <button onClick={() => deleteRecurringExpense(exp.id)}
                                                    className="text-red-400 hover:text-red-300">Del</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-white font-semibold text-sm">
                                <Tooltip text={TIPS.oneTimeExpenses}>One-Time Expenses</Tooltip>
                            </h3>
                            <button
                                onClick={() => setShowExpenseForm(!showExpenseForm)}
                                className="px-2 py-1 bg-yellow-500 text-slate-900 rounded text-xs font-medium hover:bg-yellow-400"
                            >
                                {showExpenseForm ? 'Cancel' : '+ Add'}
                            </button>
                        </div>

                        {showExpenseForm && (
                            <div className="mb-3 p-2 bg-slate-700/50 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                    <input type="text" placeholder="Description" value={newExpense.description}
                                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                    <input type="number" placeholder="Amount" step="0.01" value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                    <select value={newExpense.category_id}
                                        onChange={(e) => setNewExpense({ ...newExpense, category_id: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                                        <option value="">Category</option>
                                        {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <input type="date" value={newExpense.expense_date}
                                        onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                    <button onClick={addExpense}
                                        className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400">Save</button>
                                </div>
                            </div>
                        )}

                        {expenses.length === 0 ? (
                            <p className="text-slate-400 text-sm">No expenses yet.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400">
                                        <th className="text-left py-1">Date</th>
                                        <th className="text-left py-1">Description</th>
                                        <th className="text-left py-1">Category</th>
                                        <th className="text-right py-1">Amount</th>
                                        <th className="text-right py-1">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(exp => (
                                        <tr key={exp.id} className="border-t border-slate-700">
                                            <td className="py-1 text-slate-400">{exp.expense_date}</td>
                                            <td className="py-1 text-white">{exp.description}</td>
                                            <td className="py-1 text-slate-400">{exp.expense_categories?.name || '-'}</td>
                                            <td className="py-1 text-right text-red-400">${(exp.amount || 0).toFixed(2)}</td>
                                            <td className="py-1 text-right">
                                                <button onClick={() => deleteExpense(exp.id)}
                                                    className="text-red-400 hover:text-red-300">Del</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-semibold text-sm">
                            <Tooltip text={TIPS.transactions}>Transactions</Tooltip>
                        </h3>
                        <button
                            onClick={() => setShowIncomeForm(!showIncomeForm)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-400"
                        >
                            {showIncomeForm ? 'Cancel' : '+ Add Income'}
                        </button>
                    </div>

                    {showIncomeForm && (
                        <div className="mb-3 p-2 bg-slate-700/50 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                <input type="text" placeholder="Description" value={newIncome.description}
                                    onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <input type="number" placeholder="Amount" step="0.01" value={newIncome.amount}
                                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <select value={newIncome.category}
                                    onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                                    <option value="ad_campaign">Ad Campaign</option>
                                    <option value="cash_payment">Cash Payment</option>
                                    <option value="refund_received">Refund Received</option>
                                    <option value="partner_investment">Partner Investment</option>
                                    <option value="sponsorship">Sponsorship</option>
                                    <option value="other">Other</option>
                                </select>
                                <input type="date" value={newIncome.transaction_date}
                                    onChange={(e) => setNewIncome({ ...newIncome, transaction_date: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <button onClick={addIncome}
                                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400">Save</button>
                            </div>
                        </div>
                    )}

                    {transactions.length === 0 ? (
                        <p className="text-slate-400 text-sm">No transactions yet.</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="text-left py-1">Date</th>
                                    <th className="text-left py-1">Type</th>
                                    <th className="text-left py-1">Description</th>
                                    <th className="text-right py-1">Amount</th>
                                    <th className="text-right py-1">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="border-t border-slate-700">
                                        <td className="py-1 text-slate-400">{tx.transaction_date}</td>
                                        <td className="py-1">
                                            <span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'revenue' ? 'bg-green-500/20 text-green-400' :
                                                tx.type === 'expense' ? 'bg-red-500/20 text-red-400' :
                                                    tx.type === 'payout' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-slate-500/20 text-slate-400'
                                                }`}>{tx.type}</span>
                                        </td>
                                        <td className="py-1 text-white">{tx.description}</td>
                                        <td className={`py-1 text-right ${tx.type === 'revenue' ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.type === 'revenue' ? '+' : '-'}${Math.abs(tx.net_amount || 0).toFixed(2)}
                                        </td>
                                        <td className="py-1 text-right">
                                            <button onClick={() => deleteTransaction(tx.id)}
                                                className="text-red-400 hover:text-red-300">Del</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'partners' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-semibold text-sm">Partner Profit Sharing</h3>
                        <button
                            onClick={() => setShowPartnerForm(!showPartnerForm)}
                            className="px-2 py-1 bg-yellow-500 text-slate-900 rounded text-xs font-medium hover:bg-yellow-400"
                        >
                            {showPartnerForm ? 'Cancel' : '+ Add Partner'}
                        </button>
                    </div>

                    {showPartnerForm && (
                        <div className="mb-3 p-2 bg-slate-700/50 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
                                <input type="text" placeholder="Name" value={newPartner.name}
                                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <input type="email" placeholder="Email" value={newPartner.email}
                                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <input type="number" placeholder="%" step="0.5" value={newPartner.percentage}
                                    onChange={(e) => setNewPartner({ ...newPartner, percentage: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <select value={newPartner.payment_method}
                                    onChange={(e) => setNewPartner({ ...newPartner, payment_method: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                                    <option value="">Payment Method</option>
                                    <option value="zelle">Zelle</option>
                                    <option value="venmo">Venmo</option>
                                    <option value="cashapp">Cash App</option>
                                </select>
                                <input type="text" placeholder="Handle/Email" value={newPartner.payment_handle}
                                    onChange={(e) => setNewPartner({ ...newPartner, payment_handle: e.target.value })}
                                    className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs" />
                                <button onClick={addPartner}
                                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-400">Save</button>
                            </div>
                        </div>
                    )}

                    {totalPartnerPercentage !== 100 && partners.length > 0 && (
                        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs">
                            ⚠️ Partner percentages = {totalPartnerPercentage.toFixed(1)}% (should equal 100%)
                        </div>
                    )}

                    {partners.length === 0 ? (
                        <p className="text-slate-400 text-sm">No partners yet.</p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="text-left py-1">Name</th>
                                    <th className="text-left py-1">Email</th>
                                    <th className="text-left py-1">Payment</th>
                                    <th className="text-right py-1">
                                        <Tooltip text={TIPS.partnerPercentage}>%</Tooltip>
                                    </th>
                                    <th className="text-right py-1">Split (${summary.ownerAvailable.toFixed(0)})</th>
                                    <th className="text-center py-1">Active</th>
                                    <th className="text-right py-1">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {partners.map(partner => (
                                    <tr key={partner.id} className={`border-t border-slate-700 ${!partner.is_active ? 'opacity-50' : ''}`}>
                                        <td className="py-1 text-white">
                                            {partner.name}
                                            {partner.is_owner && <span className="ml-1 text-yellow-400 text-xs">(Owner)</span>}
                                        </td>
                                        <td className="py-1 text-slate-400">{partner.email || '-'}</td>
                                        <td className="py-1 text-slate-400">
                                            {partner.payment_method ? `${partner.payment_method}: ${partner.payment_handle}` : '-'}
                                        </td>
                                        <td className="py-1 text-right">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.5"
                                                value={partner.percentage}
                                                onChange={(e) => setPartners(partners.map(p => p.id === partner.id ? { ...p, percentage: e.target.value } : p))}
                                                onBlur={(e) => updatePartnerPercentage(partner.id, parseFloat(e.target.value) || 0)}
                                                className="w-16 px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs text-right"
                                            />
                                        </td>
                                        <td className="py-1 text-right text-green-400">
                                            ${(summary.ownerAvailable * (partner.percentage / 100)).toFixed(2)}
                                        </td>
                                        <td className="py-1 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs ${partner.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                {partner.is_active ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="py-1 text-right">
                                            <button onClick={() => togglePartner(partner.id, partner.is_active)}
                                                className="text-yellow-400 hover:text-yellow-300 mr-2">
                                                {partner.is_active ? 'Off' : 'On'}
                                            </button>
                                            {!partner.is_owner && (
                                                <button onClick={() => deletePartner(partner.id)}
                                                    className="text-red-400 hover:text-red-300">Del</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="mt-3 p-2 bg-slate-700/50 rounded-lg text-xs text-slate-400">
                        <p>💡 <strong>Tips:</strong></p>
                        <p>• Partner percentages should total 100%</p>
                        <p>• Add partner investments via Transactions → Add Income → "Partner Investment"</p>
                        <p>• Owner cannot be deleted but percentage can be adjusted</p>
                    </div>
                </div>
            )}

            {activeTab === 'tax' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        📋 Year-End Tax Summaries
                        <Tooltip text={TIPS.taxConfirm} />
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <label className="text-slate-400 text-sm flex items-center gap-1">
                                Tax Year <Tooltip text={TIPS.taxYear} />
                            </label>
                            <select
                                value={taxYear}
                                onChange={(e) => {
                                    setTaxYear(parseInt(e.target.value))
                                    setTaxConfirmed(false)
                                }}
                                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            >
                                {[...Array(5)].map((_, i) => {
                                    const year = new Date().getFullYear() - 1 - i
                                    return <option key={year} value={year}>{year}</option>
                                })}
                            </select>
                        </div>

                        <div className="bg-slate-700/50 rounded-lg p-3">
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                                Recipients <Tooltip text={TIPS.taxRecipients} />
                            </p>
                            <p className="text-2xl font-bold text-white">{taxRecipientCount}</p>
                            <p className="text-xs text-slate-500">users earned money in {taxYear}</p>
                        </div>

                        {taxRecipientCount > 0 && (
                            <>
                                <div className="bg-slate-700/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                                    <p className="text-xs text-slate-400 mb-2">Will send to:</p>
                                    <div className="space-y-1">
                                        {taxRecipients.slice(0, 10).map((r, i) => (
                                            <p key={i} className="text-xs text-slate-300">{r.email} - ${r.total}</p>
                                        ))}
                                        {taxRecipients.length > 10 && (
                                            <p className="text-xs text-slate-500">...and {taxRecipients.length - 10} more</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <p className="text-red-400 text-sm font-medium">⚠️ Warning</p>
                                    <p className="text-red-300 text-xs mt-1">
                                        This will send official tax summary emails to {taxRecipientCount} users.
                                        This action cannot be undone.
                                    </p>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={taxConfirmed}
                                        onChange={(e) => setTaxConfirmed(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                                    />
                                    <span className="text-slate-300 text-sm">
                                        I confirm I want to send {taxYear} tax summaries to {taxRecipientCount} users
                                    </span>
                                </label>

                                <button
                                    onClick={sendTaxSummaries}
                                    disabled={!taxConfirmed || sendingTax}
                                    className={`w-full py-2 rounded-lg font-medium transition-all ${taxConfirmed && !sendingTax
                                        ? 'bg-yellow-500 text-slate-900 hover:bg-yellow-400'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    {sendingTax ? 'Sending...' : `Send ${taxYear} Tax Summaries`}
                                </button>
                            </>
                        )}

                        {taxRecipientCount === 0 && (
                            <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                                <p className="text-slate-400">No users earned money in {taxYear}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}