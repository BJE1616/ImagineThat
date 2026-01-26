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
    taxConfirm: "This sends official tax documents. Double-check the year and recipient count before sending.",

    // Wallets
    walletBalances: "Cash available in each payment account for sending payouts. Keep these synced with your actual account balances.",
    loanTracking: "Money loaned to the business that needs to be paid back. Track who lent what and repayment status."
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

    // ===== WALLET & LOAN STATE =====
    const [wallets, setWallets] = useState([])
    const [loans, setLoans] = useState([])
    const [showAddWalletForm, setShowAddWalletForm] = useState(false)
    const [showAddFundsForm, setShowAddFundsForm] = useState(false)
    const [showRepaymentForm, setShowRepaymentForm] = useState(false)
    const [editingWallet, setEditingWallet] = useState(null)
    const [selectedWalletForFunds, setSelectedWalletForFunds] = useState(null)
    const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState(null)
    const [newWallet, setNewWallet] = useState({ wallet_key: '', wallet_name: '' })
    const [addFundsForm, setAddFundsForm] = useState({
        amount: '',
        source_type: 'loan',
        lender_name: '',
        notes: ''
    })
    const [repaymentForm, setRepaymentForm] = useState({
        amount: '',
        notes: ''
    })

    useEffect(() => {
        loadAllData()
    }, [dateRange])

    useEffect(() => {
        if (activeTab === 'tax') {
            loadTaxRecipients(taxYear)
        }
        if (activeTab === 'wallets') {
            loadWallets()
            loadLoans()
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

    // ===== WALLET & LOAN FUNCTIONS =====
    const loadWallets = async () => {
        const { data } = await supabase.from('account_wallets').select('*').order('wallet_name')
        setWallets(data || [])
    }

    const loadLoans = async () => {
        const { data } = await supabase
            .from('business_loans')
            .select('*')
            .order('loan_date', { ascending: false })
        setLoans(data || [])
    }

    const addWallet = async () => {
        if (!newWallet.wallet_key || !newWallet.wallet_name) {
            setMessage({ type: 'error', text: 'Wallet key and name required' })
            return
        }
        // Sanitize wallet_key: lowercase, no spaces
        const sanitizedKey = newWallet.wallet_key.toLowerCase().replace(/\s+/g, '_')

        try {
            const { error } = await supabase.from('account_wallets').insert([{
                wallet_key: sanitizedKey,
                wallet_name: newWallet.wallet_name,
                balance: 0
            }])
            if (error) throw error
            setMessage({ type: 'success', text: 'Wallet added!' })
            setShowAddWalletForm(false)
            setNewWallet({ wallet_key: '', wallet_name: '' })
            loadWallets()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            console.error('Error adding wallet:', error)
            setMessage({ type: 'error', text: 'Failed to add wallet. Key may already exist.' })
        }
    }

    const updateWalletName = async (walletKey, newName) => {
        try {
            const { error } = await supabase
                .from('account_wallets')
                .update({ wallet_name: newName, updated_at: new Date().toISOString() })
                .eq('wallet_key', walletKey)
            if (error) throw error
            setMessage({ type: 'success', text: 'Wallet updated!' })
            setEditingWallet(null)
            loadWallets()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' })
        }
    }

    const deleteWallet = async (walletKey) => {
        // Check if wallet has transactions
        const { data: txns } = await supabase
            .from('wallet_transactions')
            .select('id')
            .eq('wallet_key', walletKey)
            .limit(1)

        if (txns && txns.length > 0) {
            setMessage({ type: 'error', text: 'Cannot delete wallet with transaction history' })
            setTimeout(() => setMessage(null), 3000)
            return
        }

        if (!confirm('Delete this wallet?')) return

        try {
            const { error } = await supabase.from('account_wallets').delete().eq('wallet_key', walletKey)
            if (error) throw error
            setMessage({ type: 'success', text: 'Wallet deleted!' })
            loadWallets()
            setTimeout(() => setMessage(null), 2000)
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' })
        }
    }

    const openAddFundsForm = (wallet) => {
        setSelectedWalletForFunds(wallet)
        setAddFundsForm({ amount: '', source_type: 'loan', lender_name: '', notes: '' })
        setShowAddFundsForm(true)
    }

    const addFundsToWallet = async () => {
        const amount = parseFloat(addFundsForm.amount)
        if (!amount || amount <= 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        if (addFundsForm.source_type === 'loan' && !addFundsForm.lender_name.trim()) {
            setMessage({ type: 'error', text: 'Lender name required for loans' })
            return
        }

        try {
            const wallet = selectedWalletForFunds

            // Update wallet balance
            await supabase
                .from('account_wallets')
                .update({
                    balance: wallet.balance + amount,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_key', wallet.wallet_key)

            // Log the transaction
            await supabase.from('wallet_transactions').insert([{
                wallet_key: wallet.wallet_key,
                transaction_type: addFundsForm.source_type === 'loan' ? 'loan_deposit' : 'deposit',
                amount: amount,
                description: addFundsForm.source_type === 'loan'
                    ? `Loan from ${addFundsForm.lender_name}${addFundsForm.notes ? ` - ${addFundsForm.notes}` : ''}`
                    : `${addFundsForm.source_type === 'revenue' ? 'Revenue' : 'Deposit'}${addFundsForm.notes ? ` - ${addFundsForm.notes}` : ''}`,
                reference_type: addFundsForm.source_type
            }])

            // If it's a loan, create loan record
            if (addFundsForm.source_type === 'loan') {
                await supabase.from('business_loans').insert([{
                    lender_name: addFundsForm.lender_name.trim(),
                    original_amount: amount,
                    loan_date: new Date().toISOString().split('T')[0],
                    wallet_key: wallet.wallet_key,
                    notes: addFundsForm.notes || null,
                    status: 'outstanding',
                    repaid_amount: 0
                }])
            }

            setMessage({ type: 'success', text: addFundsForm.source_type === 'loan' ? 'Loan recorded & funds added!' : 'Funds added!' })
            setShowAddFundsForm(false)
            loadWallets()
            loadLoans()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error adding funds:', error)
            setMessage({ type: 'error', text: 'Failed to add funds' })
        }
    }

    const openRepaymentForm = (loan) => {
        setSelectedLoanForRepayment(loan)
        const remaining = loan.original_amount - (loan.repaid_amount || 0)
        setRepaymentForm({ amount: remaining.toFixed(2), notes: '' })
        setShowRepaymentForm(true)
    }

    const recordRepayment = async () => {
        const amount = parseFloat(repaymentForm.amount)
        const loan = selectedLoanForRepayment
        const remaining = loan.original_amount - (loan.repaid_amount || 0)

        if (!amount || amount <= 0) {
            setMessage({ type: 'error', text: 'Enter a valid amount' })
            return
        }

        if (amount > remaining) {
            setMessage({ type: 'error', text: `Cannot repay more than outstanding amount ($${remaining.toFixed(2)})` })
            return
        }

        try {
            const newRepaidAmount = (loan.repaid_amount || 0) + amount
            const newStatus = newRepaidAmount >= loan.original_amount ? 'repaid' : 'partial'

            // Update loan record
            await supabase
                .from('business_loans')
                .update({
                    repaid_amount: newRepaidAmount,
                    status: newStatus,
                    repaid_date: newStatus === 'repaid' ? new Date().toISOString().split('T')[0] : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', loan.id)

            // Record the repayment
            await supabase.from('loan_repayments').insert([{
                loan_id: loan.id,
                amount: amount,
                repayment_date: new Date().toISOString().split('T')[0],
                notes: repaymentForm.notes || null
            }])

            setMessage({ type: 'success', text: newStatus === 'repaid' ? 'Loan fully repaid!' : 'Repayment recorded!' })
            setShowRepaymentForm(false)
            loadLoans()
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error recording repayment:', error)
            setMessage({ type: 'error', text: 'Failed to record repayment' })
        }
    }

    // ===== END WALLET & LOAN FUNCTIONS =====

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
            .in('status', ['active', 'queued', 'completed'])

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

    // Loan calculations
    const totalLoaned = loans.reduce((sum, l) => sum + (l.original_amount || 0), 0)
    const totalRepaid = loans.reduce((sum, l) => sum + (l.repaid_amount || 0), 0)
    const totalOutstanding = totalLoaned - totalRepaid
    const outstandingLoans = loans.filter(l => l.status !== 'repaid')

    // Group outstanding by lender
    const loansByLender = outstandingLoans.reduce((acc, loan) => {
        const lender = loan.lender_name
        if (!acc[lender]) acc[lender] = 0
        acc[lender] += (loan.original_amount - (loan.repaid_amount || 0))
        return acc
    }, {})

    // Total wallet balance
    const totalWalletBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0)

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

            <div className="flex gap-1 mb-3 flex-wrap">
                {['overview', 'wallets', 'allocations', 'expenses', 'transactions', 'partners', 'tax'].map(tab => (
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
                </div>
            )}

            {/* ===== WALLETS TAB ===== */}
            {activeTab === 'wallets' && (
                <div className="space-y-4">
                    {/* Wallet Balances */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                💰 Wallet Balances
                                <Tooltip text={TIPS.walletBalances} />
                            </h3>
                            <button
                                onClick={() => setShowAddWalletForm(true)}
                                className="text-xs text-yellow-400 hover:text-yellow-300"
                            >
                                + Add Wallet
                            </button>
                        </div>

                        {showAddWalletForm && (
                            <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className="text-slate-400 text-xs">Wallet Key (lowercase, no spaces)</label>
                                        <input
                                            type="text"
                                            value={newWallet.wallet_key}
                                            onChange={(e) => setNewWallet({ ...newWallet, wallet_key: e.target.value })}
                                            placeholder="e.g., paypal"
                                            className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-slate-400 text-xs">Display Name</label>
                                        <input
                                            type="text"
                                            value={newWallet.wallet_name}
                                            onChange={(e) => setNewWallet({ ...newWallet, wallet_name: e.target.value })}
                                            placeholder="e.g., PayPal"
                                            className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowAddWalletForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                                    <button onClick={addWallet} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Add</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {wallets.map(wallet => (
                                <div key={wallet.wallet_key} className="bg-slate-700/50 rounded-lg p-3">
                                    {editingWallet === wallet.wallet_key ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                defaultValue={wallet.wallet_name}
                                                onBlur={(e) => updateWalletName(wallet.wallet_key, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && updateWalletName(wallet.wallet_key, e.target.value)}
                                                className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                                                autoFocus
                                            />
                                            <button onClick={() => setEditingWallet(null)} className="text-xs text-slate-400">Cancel</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-slate-400 text-xs">{wallet.wallet_name}</p>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setEditingWallet(wallet.wallet_key)}
                                                        className="text-[10px] text-slate-500 hover:text-white"
                                                    >✏️</button>
                                                    <button
                                                        onClick={() => deleteWallet(wallet.wallet_key)}
                                                        className="text-[10px] text-slate-500 hover:text-red-400"
                                                    >🗑️</button>
                                                </div>
                                            </div>
                                            <p className={`text-xl font-bold ${wallet.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                ${wallet.balance.toFixed(2)}
                                            </p>
                                            <button
                                                onClick={() => openAddFundsForm(wallet)}
                                                className="text-xs text-yellow-400 hover:text-yellow-300 mt-1"
                                            >
                                                + Add Funds
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                <p className="text-yellow-400 text-xs mb-1">Total All Wallets</p>
                                <p className="text-xl font-bold text-yellow-400">${totalWalletBalance.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Loan Summary */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            📊 Loan Summary
                            <Tooltip text={TIPS.loanTracking} />
                        </h3>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Total Loaned</p>
                                <p className="text-xl font-bold text-white">${totalLoaned.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs">Total Repaid</p>
                                <p className="text-xl font-bold text-green-400">${totalRepaid.toFixed(2)}</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                <p className="text-red-400 text-xs">Outstanding</p>
                                <p className="text-xl font-bold text-red-400">${totalOutstanding.toFixed(2)}</p>
                            </div>
                        </div>

                        {Object.keys(loansByLender).length > 0 && (
                            <div className="bg-slate-700/30 rounded-lg p-3 mb-4">
                                <p className="text-slate-400 text-xs mb-2">Outstanding by Lender:</p>
                                {Object.entries(loansByLender).map(([lender, amount]) => (
                                    <div key={lender} className="flex justify-between text-sm">
                                        <span className="text-white">{lender}</span>
                                        <span className="text-red-400">${amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Loan List */}
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-white font-semibold mb-3">📋 All Loans</h3>

                        {loans.length === 0 ? (
                            <div className="text-center text-slate-400 py-4">
                                <p>No loans recorded yet</p>
                                <p className="text-xs mt-1">Add funds to a wallet as a "Loan" to start tracking</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 text-xs border-b border-slate-700">
                                            <th className="text-left py-2">Date</th>
                                            <th className="text-left py-2">Lender</th>
                                            <th className="text-left py-2">Wallet</th>
                                            <th className="text-right py-2">Amount</th>
                                            <th className="text-right py-2">Repaid</th>
                                            <th className="text-right py-2">Owed</th>
                                            <th className="text-center py-2">Status</th>
                                            <th className="text-right py-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loans.map(loan => {
                                            const owed = loan.original_amount - (loan.repaid_amount || 0)
                                            return (
                                                <tr key={loan.id} className="border-b border-slate-700/50">
                                                    <td className="py-2 text-slate-400">{new Date(loan.loan_date).toLocaleDateString()}</td>
                                                    <td className="py-2 text-white">{loan.lender_name}</td>
                                                    <td className="py-2 text-slate-400 capitalize">{loan.wallet_key || '-'}</td>
                                                    <td className="py-2 text-right text-white">${loan.original_amount.toFixed(2)}</td>
                                                    <td className="py-2 text-right text-green-400">${(loan.repaid_amount || 0).toFixed(2)}</td>
                                                    <td className="py-2 text-right text-red-400">${owed.toFixed(2)}</td>
                                                    <td className="py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${loan.status === 'repaid' ? 'bg-green-500/20 text-green-400' :
                                                                loan.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {loan.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        {loan.status !== 'repaid' && (
                                                            <button
                                                                onClick={() => openRepaymentForm(loan)}
                                                                className="text-xs text-blue-400 hover:text-blue-300"
                                                            >
                                                                Repay
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
                        <p><strong>💡 Tips:</strong></p>
                        <p>• Add funds via "Add Funds" button on each wallet</p>
                        <p>• Choose "Loan" as source to track money owed back</p>
                        <p>• Choose "Revenue" for business income (no repayment needed)</p>
                        <p>• Record repayments as you pay back loans</p>
                    </div>
                </div>
            )}

            {activeTab === 'allocations' && (
                <div className="space-y-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold">
                                <Tooltip text={TIPS.allocations}>Fund Allocations</Tooltip>
                            </h3>
                            <div className="text-xs">
                                <span className="text-slate-400">Partners get:</span>
                                <span className={`ml-1 font-bold ${ownerPercentage >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {ownerPercentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        {allocations.length === 0 ? (
                            <p className="text-slate-400 text-sm">No allocations configured</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs">
                                        <th className="text-left py-1">Fund</th>
                                        <th className="text-right py-1">
                                            <Tooltip text={TIPS.allocationPercentage}>Percentage</Tooltip>
                                        </th>
                                        <th className="text-right py-1">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations.filter(a => !a.is_auto_calculated).map(allocation => (
                                        <tr key={allocation.id} className="border-t border-slate-700">
                                            <td className="py-1 text-white">{allocation.fund_name}</td>
                                            <td className="py-1 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={allocation.percentage}
                                                    onChange={(e) => setAllocations(allocations.map(a => a.id === allocation.id ? { ...a, percentage: e.target.value } : a))}
                                                    onBlur={(e) => updateAllocation(allocation.id, parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs text-right"
                                                />
                                            </td>
                                            <td className="py-1 text-right text-green-400">
                                                ${(summary.netRevenue * (allocation.percentage / 100)).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-slate-700">
                                        <td className="py-1 text-yellow-400 font-medium">
                                            <Tooltip text={TIPS.partnersSplit}>→ Partners Split</Tooltip>
                                        </td>
                                        <td className="py-1 text-right text-yellow-400 font-medium">{ownerPercentage.toFixed(1)}%</td>
                                        <td className="py-1 text-right text-yellow-400 font-medium">${summary.ownerAvailable.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>

                    {funds.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <h3 className="text-white font-semibold mb-3">
                                <Tooltip text={TIPS.fundBalances}>Fund Balances</Tooltip>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {funds.map(fund => (
                                    <div key={fund.id} className="bg-slate-700/50 rounded p-2">
                                        <p className="text-slate-400 text-xs">{fund.fund_name}</p>
                                        <p className="text-white font-bold">${(fund.balance || 0).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'expenses' && (
                <div className="space-y-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold">
                                <Tooltip text={TIPS.recurringExpenses}>Recurring Expenses</Tooltip>
                            </h3>
                            <button onClick={() => setShowRecurringForm(true)} className="text-xs text-yellow-400 hover:text-yellow-300">+ Add Recurring</button>
                        </div>

                        {showRecurringForm && (
                            <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input type="text" placeholder="Name" value={newRecurring.name} onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                    <input type="number" step="0.01" placeholder="Amount" value={newRecurring.amount} onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                    <select value={newRecurring.frequency} onChange={(e) => setNewRecurring({ ...newRecurring, frequency: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                    <select value={newRecurring.category_id} onChange={(e) => setNewRecurring({ ...newRecurring, category_id: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                                        <option value="">Category...</option>
                                        {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowRecurringForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                                    <button onClick={addRecurringExpense} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Add</button>
                                </div>
                            </div>
                        )}

                        {recurringExpenses.length === 0 ? (
                            <p className="text-slate-400 text-sm">No recurring expenses</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs">
                                        <th className="text-left py-1">Name</th>
                                        <th className="text-left py-1">Category</th>
                                        <th className="text-right py-1">Amount</th>
                                        <th className="text-center py-1">Frequency</th>
                                        <th className="text-right py-1">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recurringExpenses.map(exp => (
                                        <tr key={exp.id} className="border-t border-slate-700">
                                            <td className="py-1 text-white">{exp.name}</td>
                                            <td className="py-1 text-slate-400">{exp.expense_categories?.name || '-'}</td>
                                            <td className="py-1 text-right text-red-400">${exp.amount.toFixed(2)}</td>
                                            <td className="py-1 text-center text-slate-400 capitalize">{exp.frequency}</td>
                                            <td className="py-1 text-right">
                                                <button onClick={() => toggleRecurringExpense(exp.id, exp.is_active)} className="text-yellow-400 hover:text-yellow-300 mr-2">
                                                    {exp.is_active ? 'Off' : 'On'}
                                                </button>
                                                <button onClick={() => deleteRecurringExpense(exp.id)} className="text-red-400 hover:text-red-300">Del</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-semibold">
                                <Tooltip text={TIPS.oneTimeExpenses}>One-Time Expenses</Tooltip>
                            </h3>
                            <button onClick={() => setShowExpenseForm(true)} className="text-xs text-yellow-400 hover:text-yellow-300">+ Add Expense</button>
                        </div>

                        {showExpenseForm && (
                            <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input type="text" placeholder="Description" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                    <input type="number" step="0.01" placeholder="Amount" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                    <input type="date" value={newExpense.expense_date} onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                    <select value={newExpense.category_id} onChange={(e) => setNewExpense({ ...newExpense, category_id: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                                        <option value="">Category...</option>
                                        {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowExpenseForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                                    <button onClick={addExpense} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Add</button>
                                </div>
                            </div>
                        )}

                        {expenses.length === 0 ? (
                            <p className="text-slate-400 text-sm">No expenses this period</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs">
                                        <th className="text-left py-1">Date</th>
                                        <th className="text-left py-1">Description</th>
                                        <th className="text-left py-1">Category</th>
                                        <th className="text-right py-1">Amount</th>
                                        <th className="text-right py-1">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.slice(0, 10).map(exp => (
                                        <tr key={exp.id} className="border-t border-slate-700">
                                            <td className="py-1 text-slate-400">{new Date(exp.expense_date).toLocaleDateString()}</td>
                                            <td className="py-1 text-white">{exp.description}</td>
                                            <td className="py-1 text-slate-400">{exp.expense_categories?.name || '-'}</td>
                                            <td className="py-1 text-right text-red-400">${exp.amount.toFixed(2)}</td>
                                            <td className="py-1 text-right">
                                                <button onClick={() => deleteExpense(exp.id)} className="text-red-400 hover:text-red-300">Del</button>
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
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">
                            <Tooltip text={TIPS.transactions}>Recent Transactions</Tooltip>
                        </h3>
                        <button onClick={() => setShowIncomeForm(true)} className="text-xs text-yellow-400 hover:text-yellow-300">+ Add Income</button>
                    </div>

                    {showIncomeForm && (
                        <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" placeholder="Description" value={newIncome.description} onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <input type="number" step="0.01" placeholder="Amount" value={newIncome.amount} onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <input type="date" value={newIncome.transaction_date} onChange={(e) => setNewIncome({ ...newIncome, transaction_date: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <select value={newIncome.category} onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                                    <option value="other">Other Income</option>
                                    <option value="partner_investment">Partner Investment</option>
                                    <option value="refund">Refund Received</option>
                                    <option value="interest">Interest</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowIncomeForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                                <button onClick={addIncome} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Add</button>
                            </div>
                        </div>
                    )}

                    {transactions.length === 0 ? (
                        <p className="text-slate-400 text-sm">No transactions this period</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs">
                                    <th className="text-left py-1">Date</th>
                                    <th className="text-left py-1">Description</th>
                                    <th className="text-left py-1">Category</th>
                                    <th className="text-right py-1">Amount</th>
                                    <th className="text-right py-1">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(txn => (
                                    <tr key={txn.id} className="border-t border-slate-700">
                                        <td className="py-1 text-slate-400">{new Date(txn.created_at).toLocaleDateString()}</td>
                                        <td className="py-1 text-white">{txn.description}</td>
                                        <td className="py-1 text-slate-400 capitalize">{txn.category?.replace('_', ' ') || '-'}</td>
                                        <td className={`py-1 text-right ${txn.type === 'revenue' ? 'text-green-400' : 'text-red-400'}`}>
                                            {txn.type === 'revenue' ? '+' : '-'}${Math.abs(txn.net_amount || txn.gross_amount).toFixed(2)}
                                        </td>
                                        <td className="py-1 text-right">
                                            <button onClick={() => deleteTransaction(txn.id)} className="text-red-400 hover:text-red-300">Del</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'partners' && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">Partners</h3>
                        <button onClick={() => setShowPartnerForm(true)} className="text-xs text-yellow-400 hover:text-yellow-300">+ Add Partner</button>
                    </div>

                    {showPartnerForm && (
                        <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" placeholder="Name" value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <input type="email" placeholder="Email" value={newPartner.email} onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <input type="number" step="0.5" placeholder="Percentage" value={newPartner.percentage} onChange={(e) => setNewPartner({ ...newPartner, percentage: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
                                <select value={newPartner.payment_method} onChange={(e) => setNewPartner({ ...newPartner, payment_method: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                                    <option value="">Payment Method...</option>
                                    <option value="venmo">Venmo</option>
                                    <option value="cashapp">Cash App</option>
                                    <option value="check">Check</option>
                                </select>
                                <input type="text" placeholder="Payment Handle" value={newPartner.payment_handle} onChange={(e) => setNewPartner({ ...newPartner, payment_handle: e.target.value })} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm col-span-2" />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowPartnerForm(false)} className="px-3 py-1 text-sm text-slate-400">Cancel</button>
                                <button onClick={addPartner} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Add</button>
                            </div>
                        </div>
                    )}

                    {partners.length === 0 ? (
                        <p className="text-slate-400 text-sm">No partners configured</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs">
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

            {/* ===== ADD FUNDS MODAL ===== */}
            {showAddFundsForm && selectedWalletForFunds && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">Add Funds to {selectedWalletForFunds.wallet_name}</h3>
                            <p className="text-slate-400 text-sm">Current balance: ${selectedWalletForFunds.balance.toFixed(2)}</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-slate-400 text-xs">Amount *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={addFundsForm.amount}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, amount: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Source Type *</label>
                                <select
                                    value={addFundsForm.source_type}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, source_type: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                    <option value="loan">Loan (will need to repay)</option>
                                    <option value="revenue">Revenue (business income)</option>
                                    <option value="deposit">Other Deposit</option>
                                </select>
                            </div>
                            {addFundsForm.source_type === 'loan' && (
                                <div>
                                    <label className="text-slate-400 text-xs">Lender Name *</label>
                                    <input
                                        type="text"
                                        value={addFundsForm.lender_name}
                                        onChange={(e) => setAddFundsForm({ ...addFundsForm, lender_name: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                        placeholder="e.g., Bobby Evans"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-slate-400 text-xs">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={addFundsForm.notes}
                                    onChange={(e) => setAddFundsForm({ ...addFundsForm, notes: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="e.g., Seed funding for payouts"
                                />
                            </div>
                            {addFundsForm.source_type === 'loan' && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs text-yellow-300">
                                    💡 This will be tracked as a loan. You'll see it in the loan list and can record repayments later.
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => setShowAddFundsForm(false)} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded">Cancel</button>
                            <button onClick={addFundsToWallet} className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium">Add Funds</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== REPAYMENT MODAL ===== */}
            {showRepaymentForm && selectedLoanForRepayment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-bold">Record Repayment</h3>
                            <p className="text-slate-400 text-sm">Loan from {selectedLoanForRepayment.lender_name}</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="bg-slate-700/50 rounded p-3">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-400">Original Amount:</span>
                                    <span className="text-white">${selectedLoanForRepayment.original_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-400">Already Repaid:</span>
                                    <span className="text-green-400">${(selectedLoanForRepayment.repaid_amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold border-t border-slate-600 pt-1">
                                    <span className="text-slate-300">Still Owed:</span>
                                    <span className="text-red-400">${(selectedLoanForRepayment.original_amount - (selectedLoanForRepayment.repaid_amount || 0)).toFixed(2)}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Repayment Amount *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={repaymentForm.amount}
                                    onChange={(e) => setRepaymentForm({ ...repaymentForm, amount: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-slate-400 text-xs">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={repaymentForm.notes}
                                    onChange={(e) => setRepaymentForm({ ...repaymentForm, notes: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                    placeholder="e.g., Partial repayment from January profits"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex gap-2">
                            <button onClick={() => setShowRepaymentForm(false)} className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded">Cancel</button>
                            <button onClick={recordRepayment} className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium">Record Repayment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}