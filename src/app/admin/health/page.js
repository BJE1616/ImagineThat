'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ===== MASTER HEALTH DASHBOARD V2 =====
// With inline fix panels and real-time impact preview

// ===== HEALTH SCORE WEIGHTS =====
const WEIGHTS = {
    financial: 30,
    tokenEconomy: 25,
    prizeSustain: 20,
    expenseControl: 15,
    configHealth: 10
}

// ===== HELPERS =====
const getScoreColor = (score) => {
    if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50' }
    if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' }
    if (score >= 40) return { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' }
    return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' }
}

const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Needs Attention'
    return 'Critical'
}

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
}

const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
}

// ===== MAIN COMPONENT =====
export default function HealthDashboardPage() {
    // ===== STATE =====
    const [loading, setLoading] = useState(true)
    const [dateRange, setDateRange] = useState('month')
    const [expandedSection, setExpandedSection] = useState(null)

    // Fix Panel State
    const [fixPanelOpen, setFixPanelOpen] = useState(null) // 'dailyTokens' | 'prizes' | 'tokenValue' | null
    const [fixPanelData, setFixPanelData] = useState({})
    const [applying, setApplying] = useState(false)
    const [actionQueue, setActionQueue] = useState([])

    // Financial Data
    const [financial, setFinancial] = useState({
        grossRevenue: 0,
        otherIncome: 0,
        processingFees: 0,
        netRevenue: 0,
        recurringExpenses: 0,
        oneTimeExpenses: 0,
        totalHardCosts: 0,
        pendingPayouts: 0,
        completedPayouts: 0,
        weeklyPrizesDue: 0,
        weeklyPrizesUpcoming: 0,
        prizePaymentsPending: 0,
        tokenLiability: 0,
        dailyTokenCost: 0,
        merchFulfillment: 0,
        totalObligations: 0,
        trueAvailable: 0,
        campaignCount: 0
    })

    // Token Economy Data
    const [tokenEconomy, setTokenEconomy] = useState({
        tokenValue: 0.05,
        totalCirculation: 0,
        totalIssued: 0,
        totalBurned: 0,
        burnRate: 0,
        usersWithBalance: 0,
        avgBalance: 0,
        circulationValue: 0
    })

    // Daily Leaderboard Config (for fix panel)
    const [dailyConfig, setDailyConfig] = useState([])

    // Weekly Prizes (for fix panel)
    const [weeklyPrizes, setWeeklyPrizes] = useState([])

    // Expenses
    const [expenses, setExpenses] = useState({
        recurring: [],
        monthlyTotal: 0
    })

    // Health Scores
    const [healthScores, setHealthScores] = useState({
        overall: 0,
        financial: 0,
        tokenEconomy: 0,
        prizeSustain: 0,
        expenseControl: 0,
        configHealth: 0
    })

    // Issues & Recommendations
    const [issues, setIssues] = useState([])
    const [recommendations, setRecommendations] = useState([])

    // Load action queue from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('healthActionQueue')
        if (saved) {
            setActionQueue(JSON.parse(saved))
        }
    }, [])

    // Save action queue to localStorage
    useEffect(() => {
        localStorage.setItem('healthActionQueue', JSON.stringify(actionQueue))
    }, [actionQueue])

    // ===== LOAD ALL DATA =====
    useEffect(() => {
        loadAllData()
    }, [dateRange])

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

    const loadAllData = async () => {
        setLoading(true)
        try {
            await Promise.all([
                loadFinancialData(),
                loadTokenEconomyData(),
                loadDailyConfig(),
                loadWeeklyPrizes(),
                loadExpenseData()
            ])
        } catch (error) {
            console.error('Error loading health data:', error)
        } finally {
            setLoading(false)
        }
    }

    // ===== LOAD DAILY LEADERBOARD CONFIG =====
    const loadDailyConfig = async () => {
        const { data } = await supabase
            .from('daily_leaderboard_config')
            .select('*')
            .order('game_key')
        setDailyConfig(data || [])
    }

    // ===== LOAD WEEKLY PRIZES =====
    const loadWeeklyPrizes = async () => {
        const { data } = await supabase
            .from('weekly_prizes')
            .select('*')
            .eq('is_active', true)
            .order('week_start')
        setWeeklyPrizes(data || [])
    }

    // ===== LOAD FINANCIAL DATA =====
    const loadFinancialData = async () => {
        const dateFilter = getDateFilter()

        // Get campaign revenue
        const { data: campaigns } = await supabase
            .from('ad_campaigns')
            .select('amount_paid, status')
            .gte('created_at', dateFilter)
            .neq('status', 'cancelled')

        const grossRevenue = campaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
        const campaignCount = campaigns?.filter(c => c.amount_paid > 0).length || 0

        // Get other income
        const { data: otherTx } = await supabase
            .from('company_transactions')
            .select('net_amount')
            .eq('type', 'revenue')
            .gte('created_at', dateFilter)

        const otherIncome = otherTx?.reduce((sum, t) => sum + (parseFloat(t.net_amount) || 0), 0) || 0

        const processingFees = (grossRevenue * 0.029) + (campaignCount * 0.30)
        const netRevenue = grossRevenue + otherIncome - processingFees

        // Get recurring expenses
        const { data: recurring } = await supabase
            .from('recurring_expenses')
            .select('amount, frequency')
            .eq('is_active', true)

        let recurringExpenses = 0
        recurring?.forEach(exp => {
            if (exp.frequency === 'monthly') {
                recurringExpenses += parseFloat(exp.amount) || 0
            } else if (exp.frequency === 'yearly') {
                recurringExpenses += (parseFloat(exp.amount) || 0) / 12
            }
        })

        // Adjust for date range
        let expenseMultiplier = 1
        if (dateRange === 'today') expenseMultiplier = 1 / 30
        else if (dateRange === 'week') expenseMultiplier = 7 / 30
        else if (dateRange === 'year') expenseMultiplier = 12
        else if (dateRange === 'all') expenseMultiplier = 12
        recurringExpenses = recurringExpenses * expenseMultiplier

        // Get one-time expenses
        const { data: oneTime } = await supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', dateFilter.split('T')[0])

        const oneTimeExpenses = oneTime?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
        const totalHardCosts = recurringExpenses + oneTimeExpenses

        // Get pending payouts
        const { data: pending } = await supabase
            .from('payout_queue')
            .select('amount')

        const pendingPayouts = pending?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

        // Get token value
        const { data: tokenSetting } = await supabase
            .from('economy_settings')
            .select('setting_value')
            .eq('setting_key', 'token_value')
            .single()

        const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

        // Get token liability
        const { data: balances } = await supabase
            .from('bb_balances')
            .select('balance')

        const totalTokens = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
        const tokenLiability = totalTokens * tokenValue

        // Get daily token award cost
        const { data: dailyConfigData } = await supabase
            .from('daily_leaderboard_config')
            .select('first_tokens, second_tokens, third_tokens, is_enabled')
            .eq('is_enabled', true)

        let dailyTokensAwarded = 0
        dailyConfigData?.forEach(config => {
            dailyTokensAwarded += (config.first_tokens || 0) + (config.second_tokens || 0) + (config.third_tokens || 0)
        })

        let days = 30
        if (dateRange === 'today') days = 1
        else if (dateRange === 'week') days = 7
        else if (dateRange === 'year') days = 365
        else if (dateRange === 'all') days = 365

        const dailyTokenCost = dailyTokensAwarded * tokenValue * days

        // Get weekly prizes due
        const now = new Date()
        const { data: prizesDue } = await supabase
            .from('weekly_prizes')
            .select('total_prize_pool, prize_type')
            .eq('prize_type', 'cash')
            .eq('is_active', true)
            .lte('week_end_time', now.toISOString())

        const weeklyPrizesDue = prizesDue?.reduce((sum, p) => sum + (parseFloat(p.total_prize_pool) || 0), 0) || 0

        // Get upcoming prizes
        const { data: prizesUpcoming } = await supabase
            .from('weekly_prizes')
            .select('total_prize_pool, prize_type')
            .eq('prize_type', 'cash')
            .eq('is_active', true)
            .gt('week_end_time', now.toISOString())

        const weeklyPrizesUpcoming = prizesUpcoming?.reduce((sum, p) => sum + (parseFloat(p.total_prize_pool) || 0), 0) || 0

        // Get pending prize payments
        const { data: prizePayments } = await supabase
            .from('prize_payments')
            .select('prize_amount')
            .eq('status', 'pending')

        const prizePaymentsPending = prizePayments?.reduce((sum, p) => sum + (parseFloat(p.prize_amount) || 0), 0) || 0

        // Get merch fulfillment
        const { data: merchPending } = await supabase
            .from('merch_orders')
            .select('actual_cost, shipping_cost')
            .eq('status', 'pending')

        const merchFulfillment = merchPending?.reduce((sum, m) =>
            sum + (parseFloat(m.actual_cost) || 0) + (parseFloat(m.shipping_cost) || 0), 0) || 0

        const totalObligations = pendingPayouts + weeklyPrizesDue + prizePaymentsPending +
            tokenLiability + dailyTokenCost + merchFulfillment

        const trueAvailable = netRevenue - totalHardCosts - totalObligations

        const financialData = {
            grossRevenue,
            otherIncome,
            processingFees,
            netRevenue,
            recurringExpenses,
            oneTimeExpenses,
            totalHardCosts,
            pendingPayouts,
            completedPayouts: 0,
            weeklyPrizesDue,
            weeklyPrizesUpcoming,
            prizePaymentsPending,
            tokenLiability,
            dailyTokenCost,
            dailyTokensAwarded,
            tokenValue,
            days,
            merchFulfillment,
            totalObligations,
            trueAvailable,
            campaignCount
        }

        setFinancial(financialData)
        calculateHealthScores(financialData)
    }

    // ===== LOAD TOKEN ECONOMY DATA =====
    const loadTokenEconomyData = async () => {
        const { data: tokenSetting } = await supabase
            .from('economy_settings')
            .select('setting_value')
            .eq('setting_key', 'token_value')
            .single()

        const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

        const { data: balances } = await supabase
            .from('bb_balances')
            .select('balance, lifetime_earned, lifetime_spent')

        const totalCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
        const totalIssued = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0
        const totalBurned = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0
        const usersWithBalance = balances?.filter(b => b.balance > 0).length || 0

        const burnRate = totalIssued > 0 ? (totalBurned / totalIssued) * 100 : 0
        const avgBalance = usersWithBalance > 0 ? Math.round(totalCirculation / usersWithBalance) : 0
        const circulationValue = totalCirculation * tokenValue

        setTokenEconomy({
            tokenValue,
            totalCirculation,
            totalIssued,
            totalBurned,
            burnRate,
            usersWithBalance,
            avgBalance,
            circulationValue
        })
    }

    // ===== LOAD EXPENSE DATA =====
    const loadExpenseData = async () => {
        const { data: recurring } = await supabase
            .from('recurring_expenses')
            .select('*, expense_categories(name)')
            .eq('is_active', true)
            .order('amount', { ascending: false })

        let monthlyTotal = 0
        recurring?.forEach(exp => {
            if (exp.frequency === 'monthly') {
                monthlyTotal += parseFloat(exp.amount) || 0
            } else if (exp.frequency === 'yearly') {
                monthlyTotal += (parseFloat(exp.amount) || 0) / 12
            }
        })

        setExpenses({
            recurring: recurring || [],
            monthlyTotal
        })
    }

    // ===== CALCULATE HEALTH SCORES =====
    const calculateHealthScores = (data) => {
        const newIssues = []

        let financialScore = 100

        if (data.netRevenue <= 0) {
            financialScore = 10
            newIssues.push({
                severity: 'critical',
                title: 'No Revenue',
                message: 'You have no revenue for this period.',
                cause: 'No ad campaigns have generated income.',
                fix: 'Launch ad campaigns to generate revenue.',
                fixType: null
            })
        } else if (data.trueAvailable < 0) {
            const deficit = Math.abs(data.trueAvailable)
            const deficitPercent = (deficit / data.netRevenue) * 100
            financialScore = Math.max(10, 50 - deficitPercent)

            // Calculate what's causing the deficit
            const dailyTokenCostPerDay = data.dailyTokensAwarded * data.tokenValue
            const monthlyDailyTokenCost = dailyTokenCostPerDay * 30

            // Determine the main cause
            let mainCause = ''
            let mainFix = ''
            let fixType = null

            if (monthlyDailyTokenCost > data.netRevenue * 0.5) {
                mainCause = `Daily token awards cost ${formatCurrency(monthlyDailyTokenCost)}/month (${formatNumber(data.dailyTokensAwarded)} tokens/day × ${formatCurrency(data.tokenValue)}/token)`
                mainFix = `Reduce daily awards by 50% to save ${formatCurrency(monthlyDailyTokenCost / 2)}/month`
                fixType = 'dailyTokens'
            } else if (data.tokenLiability > deficit) {
                mainCause = `Token liability of ${formatCurrency(data.tokenLiability)} (${formatNumber(data.tokenLiability / data.tokenValue)} tokens in circulation)`
                mainFix = 'Add token sinks or reduce token awards to lower liability over time'
                fixType = 'dailyTokens'
            } else if (data.weeklyPrizesDue + data.weeklyPrizesUpcoming > deficit) {
                mainCause = `Cash prizes configured: ${formatCurrency(data.weeklyPrizesDue + data.weeklyPrizesUpcoming)}`
                mainFix = 'Reduce prize pools or switch to token prizes'
                fixType = 'prizes'
            } else {
                mainCause = 'Combination of token awards, prizes, and fixed costs exceed revenue'
                mainFix = 'Reduce daily token awards (biggest impact)'
                fixType = 'dailyTokens'
            }

            newIssues.push({
                severity: 'critical',
                title: `Obligations Exceed Revenue by ${formatCurrency(deficit)}`,
                message: 'You owe more than you\'ve earned. This is unsustainable.',
                cause: mainCause,
                fix: mainFix,
                fixType: fixType,
                deficit: deficit
            })

            // Add secondary issues if there are multiple problems
            if (monthlyDailyTokenCost > data.netRevenue * 0.3 && fixType !== 'dailyTokens') {
                newIssues.push({
                    severity: 'warning',
                    title: 'High Daily Token Awards',
                    message: `Costing ${formatCurrency(monthlyDailyTokenCost)}/month`,
                    cause: `${formatNumber(data.dailyTokensAwarded)} tokens/day at ${formatCurrency(data.tokenValue)} each`,
                    fix: `Reduce by 50% to save ${formatCurrency(monthlyDailyTokenCost / 2)}/month`,
                    fixType: 'dailyTokens'
                })
            }

            if (data.tokenLiability > data.netRevenue * 0.3 && data.tokenLiability > 0) {
                newIssues.push({
                    severity: 'warning',
                    title: 'Growing Token Liability',
                    message: `${formatNumber(data.tokenLiability / data.tokenValue)} tokens = ${formatCurrency(data.tokenLiability)} potential redemption`,
                    cause: `0% burn rate - users aren't spending tokens`,
                    fix: 'Add token sinks (merch, features) to encourage spending',
                    fixType: null
                })
            }
        } else {
            const coverageRatio = data.netRevenue / (data.totalObligations || 1)
            if (coverageRatio >= 2) financialScore = 100
            else if (coverageRatio >= 1.5) financialScore = 85
            else if (coverageRatio >= 1.2) financialScore = 70
            else if (coverageRatio >= 1) financialScore = 55
            else financialScore = 40

            // Add warnings even when profitable
            if (coverageRatio < 1.5 && coverageRatio >= 1) {
                newIssues.push({
                    severity: 'warning',
                    title: 'Low Safety Margin',
                    message: `Revenue only covers obligations ${coverageRatio.toFixed(1)}x (healthy is 1.5x+)`,
                    cause: 'Not enough buffer between revenue and costs',
                    fix: 'Increase revenue or reduce token awards for more margin',
                    fixType: 'dailyTokens'
                })
            }
        }

        let tokenScore = 100
        let prizeScore = 100
        let expenseScore = 100
        let configScore = 100

        if (data.netRevenue > 0) {
            const expenseRatio = (data.totalHardCosts / data.netRevenue) * 100
            if (expenseRatio > 50) expenseScore = 30
            else if (expenseRatio > 30) expenseScore = 60
            else expenseScore = 100
        }

        const overall = Math.round(
            (financialScore * WEIGHTS.financial +
                tokenScore * WEIGHTS.tokenEconomy +
                prizeScore * WEIGHTS.prizeSustain +
                expenseScore * WEIGHTS.expenseControl +
                configScore * WEIGHTS.configHealth) / 100
        )

        setHealthScores({
            overall,
            financial: Math.round(financialScore),
            tokenEconomy: Math.round(tokenScore),
            prizeSustain: Math.round(prizeScore),
            expenseControl: Math.round(expenseScore),
            configHealth: Math.round(configScore)
        })

        setIssues(newIssues)
        setRecommendations([]) // No longer using separate recommendations
    }

    // ===== OPEN FIX PANEL =====
    const openFixPanel = (fixType) => {
        if (fixType === 'dailyTokens') {
            // Pre-populate with current config
            const configCopy = dailyConfig.map(c => ({
                ...c,
                new_first: c.first_tokens,
                new_second: c.second_tokens,
                new_third: c.third_tokens
            }))
            setFixPanelData({ configs: configCopy })
        } else if (fixType === 'prizes') {
            const prizesCopy = weeklyPrizes.map(p => ({
                ...p,
                new_amount: p.total_prize_pool
            }))
            setFixPanelData({ prizes: prizesCopy })
        }
        setFixPanelOpen(fixType)
    }

    // ===== CALCULATE IMPACT PREVIEW =====
    const calculateDailyTokenImpact = () => {
        if (!fixPanelData.configs) return null

        const currentDaily = dailyConfig.reduce((sum, c) =>
            sum + (c.is_enabled ? (c.first_tokens + c.second_tokens + c.third_tokens) : 0), 0)

        const newDaily = fixPanelData.configs.reduce((sum, c) =>
            sum + (c.is_enabled ? (c.new_first + c.new_second + c.new_third) : 0), 0)

        const tokenValue = tokenEconomy.tokenValue
        const currentMonthlyCost = currentDaily * tokenValue * 30
        const newMonthlyCost = newDaily * tokenValue * 30
        const savings = currentMonthlyCost - newMonthlyCost

        // Calculate new health score
        const newDailyTokenCost = newDaily * tokenValue * financial.days
        const newTotalObligations = financial.totalObligations - financial.dailyTokenCost + newDailyTokenCost
        const newTrueAvailable = financial.netRevenue - financial.totalHardCosts - newTotalObligations

        let newFinancialScore = 100
        if (financial.netRevenue <= 0) {
            newFinancialScore = 10
        } else if (newTrueAvailable < 0) {
            const deficit = Math.abs(newTrueAvailable)
            const deficitPercent = (deficit / financial.netRevenue) * 100
            newFinancialScore = Math.max(10, 50 - deficitPercent)
        } else {
            const coverageRatio = financial.netRevenue / (newTotalObligations || 1)
            if (coverageRatio >= 2) newFinancialScore = 100
            else if (coverageRatio >= 1.5) newFinancialScore = 85
            else if (coverageRatio >= 1.2) newFinancialScore = 70
            else if (coverageRatio >= 1) newFinancialScore = 55
            else newFinancialScore = 40
        }

        const newOverall = Math.round(
            (newFinancialScore * WEIGHTS.financial +
                healthScores.tokenEconomy * WEIGHTS.tokenEconomy +
                healthScores.prizeSustain * WEIGHTS.prizeSustain +
                healthScores.expenseControl * WEIGHTS.expenseControl +
                healthScores.configHealth * WEIGHTS.configHealth) / 100
        )

        return {
            currentDaily,
            newDaily,
            reduction: currentDaily - newDaily,
            reductionPercent: currentDaily > 0 ? ((currentDaily - newDaily) / currentDaily * 100).toFixed(0) : 0,
            currentMonthlyCost,
            newMonthlyCost,
            savings,
            newTrueAvailable,
            currentScore: healthScores.overall,
            newScore: newOverall,
            scoreDiff: newOverall - healthScores.overall
        }
    }

    // ===== UPDATE FIX PANEL CONFIG =====
    const updateFixConfig = (index, field, value) => {
        const newConfigs = [...fixPanelData.configs]
        newConfigs[index] = { ...newConfigs[index], [field]: parseInt(value) || 0 }
        setFixPanelData({ ...fixPanelData, configs: newConfigs })
    }

    // ===== APPLY DAILY TOKEN CHANGES =====
    const applyDailyTokenChanges = async () => {
        setApplying(true)
        try {
            for (const config of fixPanelData.configs) {
                await supabase
                    .from('daily_leaderboard_config')
                    .update({
                        first_tokens: config.new_first,
                        second_tokens: config.new_second,
                        third_tokens: config.new_third,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', config.id)
            }

            // Reload data
            await loadAllData()
            setFixPanelOpen(null)
            setFixPanelData({})

            // Remove from action queue if it was there
            setActionQueue(prev => prev.filter(a => a.type !== 'dailyTokens'))
        } catch (error) {
            console.error('Error applying changes:', error)
            alert('Error applying changes. Please try again.')
        } finally {
            setApplying(false)
        }
    }

    // ===== ADD TO ACTION QUEUE =====
    const addToActionQueue = (item) => {
        const newItem = {
            ...item,
            id: Date.now(),
            addedAt: new Date().toISOString()
        }
        setActionQueue(prev => [...prev, newItem])
        setFixPanelOpen(null)
    }

    // ===== REMOVE FROM ACTION QUEUE =====
    const removeFromQueue = (id) => {
        setActionQueue(prev => prev.filter(a => a.id !== id))
    }

    // ===== LOADING STATE =====
    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
                    <p className="text-slate-400 text-sm">Analyzing business health...</p>
                </div>
            </div>
        )
    }

    const impact = fixPanelOpen === 'dailyTokens' ? calculateDailyTokenImpact() : null

    // ===== MAIN RENDER =====
    return (
        <div className="p-3">
            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-lg font-bold text-white">🏥 Business Health Dashboard</h1>
                    <p className="text-slate-400 text-xs">Financial health analysis with real-time fix tools</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="all">All Time</option>
                    </select>
                    <button
                        onClick={loadAllData}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                    >
                        ↻
                    </button>
                </div>
            </div>

            {/* ===== ACTION QUEUE (if items exist) ===== */}
            {actionQueue.length > 0 && (
                <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-purple-400 font-bold text-xs">📋 Action Queue ({actionQueue.length})</h3>
                        <button
                            onClick={() => setActionQueue([])}
                            className="text-purple-400 hover:text-purple-300 text-xs"
                        >
                            Clear All
                        </button>
                    </div>
                    <div className="space-y-1">
                        {actionQueue.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                                <div className="flex-1">
                                    <p className="text-white text-xs font-medium">{item.title}</p>
                                    <p className="text-slate-400 text-[10px]">{item.description}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openFixPanel(item.type)}
                                        className="px-2 py-1 bg-purple-500 text-white rounded text-[10px]"
                                    >
                                        Do Now
                                    </button>
                                    <button
                                        onClick={() => removeFromQueue(item.id)}
                                        className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-[10px]"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== OVERALL HEALTH SCORE ===== */}
            <div className={`mb-3 p-3 rounded-lg border ${getScoreColor(healthScores.overall).bg} ${getScoreColor(healthScores.overall).border}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <p className={`text-4xl font-bold ${getScoreColor(healthScores.overall).text}`}>
                                {healthScores.overall}
                            </p>
                            <p className={`text-xs font-medium ${getScoreColor(healthScores.overall).text}`}>
                                {getScoreLabel(healthScores.overall)}
                            </p>
                        </div>
                        <div className="h-12 w-px bg-slate-600"></div>
                        <div>
                            <p className="text-white font-semibold text-sm">Overall Business Health</p>
                            <p className="text-slate-400 text-xs">Weighted score across 5 factors</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {[
                            { key: 'financial', label: '💰', weight: WEIGHTS.financial },
                            { key: 'tokenEconomy', label: '🪙', weight: WEIGHTS.tokenEconomy },
                            { key: 'prizeSustain', label: '🏆', weight: WEIGHTS.prizeSustain },
                            { key: 'expenseControl', label: '📊', weight: WEIGHTS.expenseControl },
                            { key: 'configHealth', label: '⚙️', weight: WEIGHTS.configHealth }
                        ].map(factor => (
                            <div key={factor.key} className="bg-slate-800/50 rounded px-2 py-1 text-center min-w-[50px]">
                                <p className="text-xs">{factor.label}</p>
                                <p className={`text-sm font-bold ${getScoreColor(healthScores[factor.key]).text}`}>
                                    {healthScores[factor.key]}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== ISSUES & FIXES (Unified) ===== */}
            {issues.length > 0 && (
                <div className={`mb-3 p-3 rounded-lg border ${issues.some(i => i.severity === 'critical')
                        ? 'bg-red-500/10 border-red-500'
                        : 'bg-yellow-500/10 border-yellow-500/50'
                    }`}>
                    <h3 className={`font-bold text-sm mb-2 ${issues.some(i => i.severity === 'critical') ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        {issues.some(i => i.severity === 'critical') ? '🚨' : '⚠️'} Issues to Fix ({issues.length})
                    </h3>
                    <div className="space-y-2">
                        {issues.map((issue, idx) => (
                            <div key={idx} className="bg-slate-800/50 rounded p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        {/* Problem */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${issue.severity === 'critical'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {issue.severity === 'critical' ? 'Critical' : 'Warning'}
                                            </span>
                                            <h4 className="text-white font-medium text-sm">{issue.title}</h4>
                                        </div>

                                        {/* Details */}
                                        <p className="text-slate-400 text-xs">{issue.message}</p>

                                        {/* Cause & Fix (if available) */}
                                        {issue.cause && (
                                            <p className="text-slate-500 text-xs mt-1">
                                                <span className="text-slate-400">Cause:</span> {issue.cause}
                                            </p>
                                        )}
                                        {issue.fix && (
                                            <p className="text-green-400 text-xs mt-1">
                                                <span className="text-green-500">Fix:</span> {issue.fix}
                                            </p>
                                        )}
                                    </div>

                                    {/* Fix Button */}
                                    {issue.fixType && (
                                        <button
                                            onClick={() => openFixPanel(issue.fixType)}
                                            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${issue.severity === 'critical'
                                                    ? 'bg-red-500 hover:bg-red-400 text-white'
                                                    : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900'
                                                }`}
                                        >
                                            🔧 Fix
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== FIX PANEL: DAILY TOKENS ===== */}
            {fixPanelOpen === 'dailyTokens' && (
                <div className="mb-3 p-4 bg-slate-800 border-2 border-yellow-500 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-yellow-400 font-bold text-sm">🔧 Fix: Daily Token Awards</h3>
                        <button
                            onClick={() => setFixPanelOpen(null)}
                            className="text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Current vs New Comparison */}
                    {impact && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Current Daily Cost</p>
                                <p className="text-red-400 font-bold">{formatCurrency(impact.currentMonthlyCost)}/mo</p>
                                <p className="text-slate-500 text-[10px]">{impact.currentDaily} tokens/day</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">New Daily Cost</p>
                                <p className="text-green-400 font-bold">{formatCurrency(impact.newMonthlyCost)}/mo</p>
                                <p className="text-slate-500 text-[10px]">{impact.newDaily} tokens/day</p>
                            </div>
                            <div className={`rounded p-2 text-center ${impact.savings > 0 ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                                <p className="text-slate-400 text-[10px]">Monthly Savings</p>
                                <p className={`font-bold ${impact.savings > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {formatCurrency(impact.savings)}
                                </p>
                                <p className="text-slate-500 text-[10px]">{impact.reductionPercent}% reduction</p>
                            </div>
                        </div>
                    )}

                    {/* Per-Game Controls */}
                    <div className="space-y-3 mb-4">
                        {fixPanelData.configs?.map((config, idx) => (
                            <div key={config.id} className="bg-slate-700/30 rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-medium text-sm capitalize">
                                        {config.game_key.replace('_', ' ')}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${config.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                        {config.is_enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-slate-400 text-[10px]">1st Place</label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500 text-xs">{config.first_tokens}→</span>
                                            <input
                                                type="number"
                                                value={config.new_first}
                                                onChange={(e) => updateFixConfig(idx, 'new_first', e.target.value)}
                                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-slate-400 text-[10px]">2nd Place</label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500 text-xs">{config.second_tokens}→</span>
                                            <input
                                                type="number"
                                                value={config.new_second}
                                                onChange={(e) => updateFixConfig(idx, 'new_second', e.target.value)}
                                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-slate-400 text-[10px]">3rd Place</label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500 text-xs">{config.third_tokens}→</span>
                                            <input
                                                type="number"
                                                value={config.new_third}
                                                onChange={(e) => updateFixConfig(idx, 'new_third', e.target.value)}
                                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Impact Preview */}
                    {impact && (
                        <div className={`p-3 rounded-lg mb-4 ${impact.newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
                            <h4 className="text-white font-medium text-sm mb-2">📊 Impact Preview</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-slate-400 text-xs">New True Available</p>
                                    <p className={`font-bold ${impact.newTrueAvailable >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {formatCurrency(impact.newTrueAvailable)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs">Health Score Change</p>
                                    <p className="font-bold">
                                        <span className="text-slate-400">{impact.currentScore}</span>
                                        <span className="text-white mx-1">→</span>
                                        <span className={impact.scoreDiff > 0 ? 'text-green-400' : 'text-yellow-400'}>{impact.newScore}</span>
                                        {impact.scoreDiff !== 0 && (
                                            <span className={`text-xs ml-1 ${impact.scoreDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ({impact.scoreDiff > 0 ? '+' : ''}{impact.scoreDiff})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {impact.newTrueAvailable < 0 && (
                                <p className="text-yellow-300 text-xs mt-2">
                                    ⚠️ Still in deficit. Consider additional reductions or review other costs.
                                </p>
                            )}
                            {impact.newTrueAvailable >= 0 && impact.newTrueAvailable < 50 && (
                                <p className="text-green-300 text-xs mt-2">
                                    ✅ This brings you to break-even! Consider reducing a bit more for safety buffer.
                                </p>
                            )}
                            {impact.newTrueAvailable >= 50 && (
                                <p className="text-green-300 text-xs mt-2">
                                    ✅ Excellent! This creates a healthy profit margin.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Quick Presets */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => {
                                const newConfigs = fixPanelData.configs.map(c => ({
                                    ...c,
                                    new_first: Math.round(c.first_tokens * 0.5),
                                    new_second: Math.round(c.second_tokens * 0.5),
                                    new_third: Math.round(c.third_tokens * 0.5)
                                }))
                                setFixPanelData({ configs: newConfigs })
                            }}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                        >
                            50% Reduction
                        </button>
                        <button
                            onClick={() => {
                                const newConfigs = fixPanelData.configs.map(c => ({
                                    ...c,
                                    new_first: Math.round(c.first_tokens * 0.25),
                                    new_second: Math.round(c.second_tokens * 0.25),
                                    new_third: Math.round(c.third_tokens * 0.25)
                                }))
                                setFixPanelData({ configs: newConfigs })
                            }}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                        >
                            75% Reduction
                        </button>
                        <button
                            onClick={() => {
                                const newConfigs = fixPanelData.configs.map(c => ({
                                    ...c,
                                    new_first: c.first_tokens,
                                    new_second: c.second_tokens,
                                    new_third: c.third_tokens
                                }))
                                setFixPanelData({ configs: newConfigs })
                            }}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={applyDailyTokenChanges}
                            disabled={applying || impact?.savings === 0}
                            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-slate-600 text-white rounded text-sm font-medium"
                        >
                            {applying ? 'Applying...' : '✅ Apply Changes Now'}
                        </button>
                        <button
                            onClick={() => addToActionQueue({
                                type: 'dailyTokens',
                                title: 'Reduce Daily Token Awards',
                                description: `Save ${formatCurrency(impact?.savings || 0)}/month`
                            })}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded text-sm font-medium"
                        >
                            📋 Save for Later
                        </button>
                        <button
                            onClick={() => setFixPanelOpen(null)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ===== FINANCIAL BREAKDOWN ===== */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'financial' ? null : 'financial')}
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <div className="text-left">
                            <h3 className="text-white font-bold text-sm">Financial Breakdown</h3>
                            <p className="text-slate-400 text-xs">Revenue → Costs → Obligations → Profit</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-slate-400 text-[10px]">True Available</p>
                            <p className={`text-lg font-bold ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(financial.trueAvailable)}
                            </p>
                        </div>
                        <span className={`text-slate-400 transition-transform text-xs ${expandedSection === 'financial' ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </div>
                </button>

                {expandedSection === 'financial' && (
                    <div className="p-3 border-t border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-2">
                        {/* Revenue */}
                        <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                            <h4 className="text-green-400 font-bold text-xs mb-2">📈 Revenue</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ad Campaigns</span>
                                    <span className="text-green-400">{formatCurrency(financial.grossRevenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Processing Fees</span>
                                    <span className="text-red-400">-{formatCurrency(financial.processingFees)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1">
                                    <span className="text-white">Net Revenue</span>
                                    <span className="text-white">{formatCurrency(financial.netRevenue)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Hard Costs */}
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                            <h4 className="text-orange-400 font-bold text-xs mb-2">🏢 Hard Costs</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Recurring</span>
                                    <span className="text-red-400">-{formatCurrency(financial.recurringExpenses)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">One-Time</span>
                                    <span className="text-red-400">-{formatCurrency(financial.oneTimeExpenses)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1">
                                    <span className="text-white">Total</span>
                                    <span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Obligations */}
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                            <h4 className="text-red-400 font-bold text-xs mb-2">⚠️ Obligations</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Token Liability</span>
                                    <span className="text-red-400">-{formatCurrency(financial.tokenLiability)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Daily Awards ({financial.days}d)</span>
                                    <span className="text-red-400">-{formatCurrency(financial.dailyTokenCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Prizes/Payouts</span>
                                    <span className="text-red-400">-{formatCurrency(financial.pendingPayouts + financial.weeklyPrizesDue)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1">
                                    <span className="text-white">Total</span>
                                    <span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span>
                                </div>
                            </div>
                        </div>

                        {/* True Profit */}
                        <div className={`p-2 rounded border ${financial.trueAvailable >= 0 ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                            <h4 className={`font-bold text-xs mb-2 ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                💵 True Profit
                            </h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Net Revenue</span>
                                    <span className="text-white">{formatCurrency(financial.netRevenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Hard Costs</span>
                                    <span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Obligations</span>
                                    <span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1 text-sm">
                                    <span className="text-white">AVAILABLE</span>
                                    <span className={financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {formatCurrency(financial.trueAvailable)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== TOKEN ECONOMY ===== */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'tokens' ? null : 'tokens')}
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🪙</span>
                        <div className="text-left">
                            <h3 className="text-white font-bold text-sm">Token Economy</h3>
                            <p className="text-slate-400 text-xs">Circulation, burn rate, liability</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-slate-400 text-[10px]">Liability</p>
                            <p className="text-yellow-400 text-lg font-bold">{formatCurrency(tokenEconomy.circulationValue)}</p>
                        </div>
                        <span className={`text-slate-400 transition-transform text-xs ${expandedSection === 'tokens' ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </div>
                </button>

                {expandedSection === 'tokens' && (
                    <div className="p-3 border-t border-slate-700">
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-3">
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Token Value</p>
                                <p className="text-yellow-400 font-bold text-sm">{formatCurrency(tokenEconomy.tokenValue)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Circulation</p>
                                <p className="text-white font-bold text-sm">{formatNumber(tokenEconomy.totalCirculation)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Issued</p>
                                <p className="text-green-400 font-bold text-sm">{formatNumber(tokenEconomy.totalIssued)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Burned</p>
                                <p className="text-red-400 font-bold text-sm">{formatNumber(tokenEconomy.totalBurned)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Burn Rate</p>
                                <p className={`font-bold text-sm ${tokenEconomy.burnRate >= 30 && tokenEconomy.burnRate <= 60 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {tokenEconomy.burnRate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Users w/ Bal</p>
                                <p className="text-white font-bold text-sm">{formatNumber(tokenEconomy.usersWithBalance)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Avg Balance</p>
                                <p className="text-white font-bold text-sm">{formatNumber(tokenEconomy.avgBalance)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                <p className="text-slate-400 text-[10px]">Avg Value</p>
                                <p className="text-white font-bold text-sm">{formatCurrency(tokenEconomy.avgBalance * tokenEconomy.tokenValue)}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Link href="/admin/economy" className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded text-xs font-medium">
                                Economy Settings →
                            </Link>
                            <Link href="/admin/game-settings" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium">
                                Game Token Settings →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== MONTHLY EXPENSES ===== */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')}
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🏢</span>
                        <div className="text-left">
                            <h3 className="text-white font-bold text-sm">Monthly Fixed Costs</h3>
                            <p className="text-slate-400 text-xs">Software and recurring expenses</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-slate-400 text-[10px]">Monthly Total</p>
                            <p className="text-red-400 text-lg font-bold">{formatCurrency(expenses.monthlyTotal)}</p>
                        </div>
                        <span className={`text-slate-400 transition-transform text-xs ${expandedSection === 'expenses' ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </div>
                </button>

                {expandedSection === 'expenses' && (
                    <div className="p-3 border-t border-slate-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            {expenses.recurring.map(exp => (
                                <div key={exp.id} className="bg-slate-700/50 rounded p-2 flex justify-between items-center">
                                    <span className="text-white text-xs">{exp.name}</span>
                                    <span className="text-red-400 text-xs font-medium">{formatCurrency(exp.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <Link href="/admin/accounting" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium">
                            Manage Expenses →
                        </Link>
                    </div>
                )}
            </div>

            {/* ===== QUICK LINKS ===== */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">🔗 Quick Actions</h3>
                    <div className="flex gap-2">
                        <Link href="/admin/accounting" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white flex items-center gap-1">
                            💰 Accounting
                        </Link>
                        <Link href="/admin/economy" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white flex items-center gap-1">
                            🪙 Economy
                        </Link>
                        <Link href="/admin/prizes" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white flex items-center gap-1">
                            🏆 Prizes
                        </Link>
                        <Link href="/admin/game-settings" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white flex items-center gap-1">
                            🎮 Games
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}