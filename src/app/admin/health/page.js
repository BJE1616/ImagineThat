'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Tooltip from '@/components/Tooltip'

const WEIGHTS = { financial: 30, tokenEconomy: 25, prizeSustain: 20, expenseControl: 15, configHealth: 10 }

const TIPS = {
    overallHealth: "Combined score from 5 weighted factors. 80+ is excellent, 60-79 is good, 40-59 needs attention, below 40 is critical.",
    financial: "Revenue vs obligations. Can you cover what you owe?",
    tokenEconomy: "Token circulation health and burn rate.",
    prizeSustain: "Can current revenue sustain prize payouts?",
    expenseControl: "Are expenses reasonable compared to revenue?",
    configHealth: "Are game settings configured sustainably?",
    tokenLiability: "All tokens users currently hold × token value. This is money you owe if everyone redeems.",
    dailyAwards: "Tokens awarded to daily leaderboard winners based on your configured places × token value.",
    gameAwards: "Tokens earned from Card Gallery views and Slot machine wins during this period.",
    payouts: "Matrix payouts and prize winnings waiting to be sent.",
    trueAvailable: "What's actually safe to take as profit after all obligations are covered."
}

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

const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num || 0)

function ImpactPreview({ impact }) {
    return (
        <div className={`p-2 rounded mb-3 ${impact.newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
            <h4 className="text-white font-medium text-xs mb-1">📊 Impact Preview</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <p className="text-slate-400 text-[10px]">New True Available</p>
                    <p className={`font-bold ${impact.newTrueAvailable >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>{formatCurrency(impact.newTrueAvailable)}</p>
                </div>
                <div>
                    <p className="text-slate-400 text-[10px]">Health Score</p>
                    <p className="font-bold">
                        <span className="text-slate-400">{impact.currentScore}</span>
                        <span className="text-white mx-1">→</span>
                        <span className={impact.scoreDiff > 0 ? 'text-green-400' : 'text-yellow-400'}>{impact.newScore}</span>
                        {impact.scoreDiff !== 0 && <span className={`text-[10px] ml-1 ${impact.scoreDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>({impact.scoreDiff > 0 ? '+' : ''}{impact.scoreDiff})</span>}
                    </p>
                </div>
            </div>
        </div>
    )
}

function ActionButtons({ onApply, onSaveLater, onCancel, applying, disabled, warning }) {
    return (
        <div className="flex gap-1">
            <button onClick={onApply} disabled={applying || disabled} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${warning ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-green-500 hover:bg-green-400 disabled:bg-slate-600 text-white'}`}>
                {applying ? 'Applying...' : warning ? '⚠️ Apply' : '✅ Apply'}
            </button>
            <button onClick={onSaveLater} className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white rounded text-xs">📋</button>
            <button onClick={onCancel} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">✕</button>
        </div>
    )
}

export default function HealthDashboardPage() {
    const [loading, setLoading] = useState(true)
    const [dateRange, setDateRange] = useState('month')
    const [expandedSection, setExpandedSection] = useState(null)
    const [fixPanelOpen, setFixPanelOpen] = useState(null)
    const [fixPanelData, setFixPanelData] = useState({ activeTab: 'awards' })
    const [applying, setApplying] = useState(false)
    const [actionQueue, setActionQueue] = useState([])
    const [currentUser, setCurrentUser] = useState(null)
    const [recentChanges, setRecentChanges] = useState([])
    const [showHistory, setShowHistory] = useState(false)

    const [financial, setFinancial] = useState({
        grossRevenue: 0, processingFees: 0, netRevenue: 0, recurringExpenses: 0,
        oneTimeExpenses: 0, totalHardCosts: 0, pendingPayouts: 0, weeklyPrizesDue: 0,
        tokenLiability: 0, dailyTokenCost: 0, dailyTokensAwarded: 0, gameTokenCost: 0, gameTokensAwarded: 0, totalObligations: 0,
        trueAvailable: 0, campaignCount: 0, tokenValue: 0.05, days: 30
    })

    const [tokenEconomy, setTokenEconomy] = useState({
        tokenValue: 0.05, totalCirculation: 0, totalIssued: 0, totalBurned: 0,
        burnRate: 0, usersWithBalance: 0, avgBalance: 0, circulationValue: 0
    })

    const [dailyConfig, setDailyConfig] = useState([])
    const [weeklyPrizes, setWeeklyPrizes] = useState([])
    const [expenses, setExpenses] = useState({ recurring: [], monthlyTotal: 0 })
    const [healthScores, setHealthScores] = useState({ overall: 0, financial: 0, tokenEconomy: 0, prizeSustain: 0, expenseControl: 0, configHealth: 0 })
    const [issues, setIssues] = useState([])

    useEffect(() => {
        const loadCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: userData } = await supabase.from('users').select('id, email, role').eq('id', user.id).single()
                setCurrentUser(userData)
            }
        }
        loadCurrentUser()
    }, [])

    useEffect(() => {
        const saved = localStorage.getItem('healthActionQueue')
        if (saved) setActionQueue(JSON.parse(saved))
    }, [])

    useEffect(() => { localStorage.setItem('healthActionQueue', JSON.stringify(actionQueue)) }, [actionQueue])
    useEffect(() => { loadAllData() }, [dateRange])
    useEffect(() => { loadRecentChanges() }, [])

    const loadRecentChanges = async () => {
        try {
            const { data } = await supabase.from('admin_audit_log').select('*').in('action', ['daily_awards_change', 'token_value_change', 'health_fix_applied']).order('created_at', { ascending: false }).limit(10)
            setRecentChanges(data || [])
        } catch (error) { console.error('Error loading recent changes:', error) }
    }

    const formatChangeDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const getChangeIcon = (action) => ({ daily_awards_change: '🎮', token_value_change: '🪙', health_fix_applied: '🏥' }[action] || '📝')

    const logAuditAction = async (action, tableName, recordId, oldValue, newValue, description) => {
        if (!currentUser) return
        try {
            await supabase.from('admin_audit_log').insert([{ user_id: currentUser.id, user_email: currentUser.email, action, table_name: tableName, record_id: recordId, old_value: oldValue, new_value: newValue, description }])
            await loadRecentChanges()
        } catch (error) { console.error('Error logging audit:', error) }
    }

    const getDateFilter = () => {
        const now = new Date()
        if (dateRange === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        if (dateRange === 'week') { const w = new Date(now); w.setDate(now.getDate() - now.getDay()); w.setHours(0, 0, 0, 0); return w.toISOString() }
        if (dateRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        if (dateRange === 'year') return new Date(now.getFullYear(), 0, 1).toISOString()
        return new Date(0).toISOString()
    }

    const loadAllData = async () => {
        setLoading(true)
        try { await Promise.all([loadFinancialData(), loadTokenEconomyData(), loadDailyConfig(), loadWeeklyPrizes(), loadExpenseData()]) }
        catch (error) { console.error('Error loading health data:', error) }
        finally { setLoading(false) }
    }

    const loadDailyConfig = async () => { const { data } = await supabase.from('daily_leaderboard_config').select('*').order('game_key'); setDailyConfig(data || []) }
    const loadWeeklyPrizes = async () => { const { data } = await supabase.from('weekly_prizes').select('*').eq('is_active', true).order('week_start'); setWeeklyPrizes(data || []) }

    const loadFinancialData = async () => {
        const dateFilter = getDateFilter()
        const { data: campaigns } = await supabase.from('ad_campaigns').select('amount_paid, status').gte('created_at', dateFilter).neq('status', 'cancelled')
        const grossRevenue = campaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
        const campaignCount = campaigns?.filter(c => c.amount_paid > 0).length || 0
        const processingFees = (grossRevenue * 0.029) + (campaignCount * 0.30)
        const netRevenue = grossRevenue - processingFees

        const { data: recurring } = await supabase.from('recurring_expenses').select('amount, frequency').eq('is_active', true)
        let recurringExpenses = 0
        recurring?.forEach(exp => { recurringExpenses += exp.frequency === 'monthly' ? (parseFloat(exp.amount) || 0) : (parseFloat(exp.amount) || 0) / 12 })
        let expenseMultiplier = dateRange === 'today' ? 1 / 30 : dateRange === 'week' ? 7 / 30 : dateRange === 'year' ? 12 : 1
        recurringExpenses *= expenseMultiplier

        const { data: oneTime } = await supabase.from('expenses').select('amount').gte('expense_date', dateFilter.split('T')[0])
        const oneTimeExpenses = oneTime?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
        const totalHardCosts = recurringExpenses + oneTimeExpenses

        const { data: pending } = await supabase.from('payout_queue').select('amount')
        const pendingPayouts = pending?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0

        const { data: tokenSetting } = await supabase.from('economy_settings').select('setting_value').eq('setting_key', 'token_value').single()
        const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05

        const { data: balances } = await supabase.from('bb_balances').select('balance')
        const totalTokens = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
        const tokenLiability = totalTokens * tokenValue

        const { data: dailyConfigData } = await supabase.from('daily_leaderboard_config').select('first_tokens, second_tokens, third_tokens, is_enabled').eq('is_enabled', true)
        let dailyTokensAwarded = 0
        dailyConfigData?.forEach(config => { dailyTokensAwarded += (config.first_tokens || 0) + (config.second_tokens || 0) + (config.third_tokens || 0) })

        let days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : dateRange === 'year' ? 365 : 30
        const dailyTokenCost = dailyTokensAwarded * tokenValue * days

        // Get actual game tokens awarded (Card Gallery + Slots)
        const { data: gameTokenData } = await supabase
            .from('bb_transactions')
            .select('amount')
            .eq('type', 'earn')
            .in('source', ['card_gallery', 'slot_machine'])
            .gte('created_at', dateFilter)

        const gameTokensAwarded = gameTokenData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0
        const gameTokenCost = gameTokensAwarded * tokenValue

        const now = new Date()
        const { data: prizesDue } = await supabase.from('weekly_prizes').select('total_prize_pool, prize_type').eq('prize_type', 'cash').eq('is_active', true).lte('week_end_time', now.toISOString())
        const weeklyPrizesDue = prizesDue?.reduce((sum, p) => sum + (parseFloat(p.total_prize_pool) || 0), 0) || 0

        const totalObligations = pendingPayouts + weeklyPrizesDue + tokenLiability + dailyTokenCost + gameTokenCost
        const trueAvailable = netRevenue - totalHardCosts - totalObligations

        const financialData = { grossRevenue, processingFees, netRevenue, recurringExpenses, oneTimeExpenses, totalHardCosts, pendingPayouts, weeklyPrizesDue, tokenLiability, dailyTokenCost, dailyTokensAwarded, gameTokenCost, gameTokensAwarded, totalObligations, trueAvailable, campaignCount, tokenValue, days }
        setFinancial(financialData)
        calculateHealthScores(financialData)
    }

    const loadTokenEconomyData = async () => {
        const { data: tokenSetting } = await supabase.from('economy_settings').select('setting_value').eq('setting_key', 'token_value').single()
        const tokenValue = parseFloat(tokenSetting?.setting_value) || 0.05
        const { data: balances } = await supabase.from('bb_balances').select('balance, lifetime_earned, lifetime_spent')
        const totalCirculation = balances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
        const totalIssued = balances?.reduce((sum, b) => sum + (b.lifetime_earned || 0), 0) || 0
        const totalBurned = balances?.reduce((sum, b) => sum + (b.lifetime_spent || 0), 0) || 0
        const usersWithBalance = balances?.filter(b => b.balance > 0).length || 0
        const burnRate = totalIssued > 0 ? (totalBurned / totalIssued) * 100 : 0
        const avgBalance = usersWithBalance > 0 ? Math.round(totalCirculation / usersWithBalance) : 0
        setTokenEconomy({ tokenValue, totalCirculation, totalIssued, totalBurned, burnRate, usersWithBalance, avgBalance, circulationValue: totalCirculation * tokenValue })
    }

    const loadExpenseData = async () => {
        const { data: recurring } = await supabase.from('recurring_expenses').select('*, expense_categories(name)').eq('is_active', true).order('amount', { ascending: false })
        let monthlyTotal = 0
        recurring?.forEach(exp => { monthlyTotal += exp.frequency === 'monthly' ? (parseFloat(exp.amount) || 0) : (parseFloat(exp.amount) || 0) / 12 })
        setExpenses({ recurring: recurring || [], monthlyTotal })
    }

    const calculateHealthScores = (data) => {
        const newIssues = []
        let financialScore = 100

        if (data.netRevenue <= 0) {
            financialScore = 10
            newIssues.push({ severity: 'critical', title: 'No Revenue', message: 'No revenue for this period.', cause: 'No ad campaigns.', fix: 'Launch campaigns.', fixType: null })
        } else if (data.trueAvailable < 0) {
            const deficit = Math.abs(data.trueAvailable)
            financialScore = Math.max(10, 50 - (deficit / data.netRevenue) * 100)
            const monthlyDailyTokenCost = data.dailyTokensAwarded * data.tokenValue * 30
            let mainCause = monthlyDailyTokenCost > data.netRevenue * 0.5
                ? `Daily tokens cost ${formatCurrency(monthlyDailyTokenCost)}/mo`
                : 'Costs exceed revenue'
            newIssues.push({ severity: 'critical', title: `Deficit: ${formatCurrency(deficit)}`, message: 'Unsustainable.', cause: mainCause, fix: 'Reduce daily awards or token value', fixType: 'dailyTokens', deficit })
            if (tokenEconomy.burnRate === 0 && tokenEconomy.totalCirculation > 0) {
                newIssues.push({ severity: 'warning', title: '0% Burn Rate', message: 'No tokens spent.', cause: 'No spend options.', fix: 'Add token sinks.', fixType: null })
            }
        } else {
            const coverageRatio = data.netRevenue / (data.totalObligations || 1)
            financialScore = coverageRatio >= 2 ? 100 : coverageRatio >= 1.5 ? 85 : coverageRatio >= 1.2 ? 70 : 55
        }

        let expenseScore = 100
        if (data.netRevenue > 0) {
            const expenseRatio = (data.totalHardCosts / data.netRevenue) * 100
            expenseScore = expenseRatio > 50 ? 30 : expenseRatio > 30 ? 60 : 100
        }

        const overall = Math.round((financialScore * WEIGHTS.financial + 100 * WEIGHTS.tokenEconomy + 100 * WEIGHTS.prizeSustain + expenseScore * WEIGHTS.expenseControl + 100 * WEIGHTS.configHealth) / 100)
        setHealthScores({ overall, financial: Math.round(financialScore), tokenEconomy: 100, prizeSustain: 100, expenseControl: Math.round(expenseScore), configHealth: 100 })
        setIssues(newIssues)
    }

    const openFixPanel = (fixType) => {
        const configCopy = dailyConfig.map(c => ({ ...c, new_first: c.first_tokens, new_second: c.second_tokens, new_third: c.third_tokens }))
        setFixPanelData({ activeTab: 'awards', configs: configCopy, newTokenValue: tokenEconomy.tokenValue, showCustomize: false })
        setFixPanelOpen(fixType)
    }

    const calculateDailyTokenImpact = () => {
        if (!fixPanelData.configs) return null
        const currentDaily = dailyConfig.reduce((sum, c) => sum + (c.is_enabled ? (c.first_tokens + c.second_tokens + c.third_tokens) : 0), 0)
        const newDaily = fixPanelData.configs.reduce((sum, c) => sum + (c.is_enabled ? (c.new_first + c.new_second + c.new_third) : 0), 0)
        const tokenValue = tokenEconomy.tokenValue
        const currentMonthlyCost = currentDaily * tokenValue * 30
        const newMonthlyCost = newDaily * tokenValue * 30
        const savings = currentMonthlyCost - newMonthlyCost
        const newDailyTokenCost = newDaily * tokenValue * financial.days
        const newTotalObligations = financial.totalObligations - financial.dailyTokenCost + newDailyTokenCost
        const newTrueAvailable = financial.netRevenue - financial.totalHardCosts - newTotalObligations

        let newFinancialScore = 100
        if (financial.netRevenue <= 0) newFinancialScore = 10
        else if (newTrueAvailable < 0) newFinancialScore = Math.max(10, 50 - (Math.abs(newTrueAvailable) / financial.netRevenue) * 100)
        else {
            const coverageRatio = financial.netRevenue / (newTotalObligations || 1)
            newFinancialScore = coverageRatio >= 2 ? 100 : coverageRatio >= 1.5 ? 85 : coverageRatio >= 1.2 ? 70 : 55
        }

        const newOverall = Math.round((newFinancialScore * WEIGHTS.financial + healthScores.tokenEconomy * WEIGHTS.tokenEconomy + healthScores.prizeSustain * WEIGHTS.prizeSustain + healthScores.expenseControl * WEIGHTS.expenseControl + healthScores.configHealth * WEIGHTS.configHealth) / 100)
        return { currentDaily, newDaily, reduction: currentDaily - newDaily, reductionPercent: currentDaily > 0 ? ((currentDaily - newDaily) / currentDaily * 100).toFixed(0) : 0, currentMonthlyCost, newMonthlyCost, savings, newTrueAvailable, currentScore: healthScores.overall, newScore: newOverall, scoreDiff: newOverall - healthScores.overall }
    }

    const updateFixConfig = (index, field, value) => {
        const newConfigs = [...fixPanelData.configs]
        newConfigs[index] = { ...newConfigs[index], [field]: parseInt(value) || 0 }
        setFixPanelData(prev => ({ ...prev, configs: newConfigs }))
    }

    const applyDailyTokenChanges = async (configsToApply = null) => {
        setApplying(true)
        const configs = configsToApply || fixPanelData.configs
        try {
            for (const config of configs) {
                const oldConfig = dailyConfig.find(c => c.id === config.id)
                const oldValues = { first_tokens: oldConfig?.first_tokens, second_tokens: oldConfig?.second_tokens, third_tokens: oldConfig?.third_tokens }
                const newValues = { first_tokens: config.new_first, second_tokens: config.new_second, third_tokens: config.new_third }
                if (oldValues.first_tokens !== newValues.first_tokens || oldValues.second_tokens !== newValues.second_tokens || oldValues.third_tokens !== newValues.third_tokens) {
                    await supabase.from('daily_leaderboard_config').update({ first_tokens: config.new_first, second_tokens: config.new_second, third_tokens: config.new_third, updated_at: new Date().toISOString() }).eq('id', config.id)
                    await logAuditAction('daily_awards_change', 'daily_leaderboard_config', config.id, oldValues, newValues, `Health: ${config.game_key} ${oldValues.first_tokens}/${oldValues.second_tokens}/${oldValues.third_tokens} → ${newValues.first_tokens}/${newValues.second_tokens}/${newValues.third_tokens}`)
                }
            }
            const impact = calculateDailyTokenImpact()
            await logAuditAction('health_fix_applied', 'daily_leaderboard_config', null, { healthScore: healthScores.overall, trueAvailable: financial.trueAvailable }, { healthScore: impact?.newScore, trueAvailable: impact?.newTrueAvailable, monthlySavings: impact?.savings }, `Health: Daily token reduction. Savings: ${formatCurrency(impact?.savings || 0)}/mo`)
            await loadAllData()
            setFixPanelOpen(null)
            setFixPanelData({ activeTab: 'awards', showCustomize: false })
        } catch (error) { console.error('Error:', error); alert('Error applying changes') }
        finally { setApplying(false) }
    }

    const applyTokenValueChange = async () => {
        setApplying(true)
        try {
            const oldValue = tokenEconomy.tokenValue, newValue = fixPanelData.newTokenValue
            const oldLiability = tokenEconomy.circulationValue, newLiability = tokenEconomy.totalCirculation * newValue
            await supabase.from('economy_settings').update({ setting_value: newValue, updated_at: new Date().toISOString() }).eq('setting_key', 'token_value')
            await logAuditAction('token_value_change', 'economy_settings', 'token_value', { token_value: oldValue, liability: oldLiability }, { token_value: newValue, liability: newLiability }, `Health: Token value ${formatCurrency(oldValue)} → ${formatCurrency(newValue)}. Liability reduced ${formatCurrency(oldLiability - newLiability)}`)
            await loadAllData()
            setFixPanelOpen(null)
        } catch (error) { console.error('Error:', error); alert('Error applying changes') }
        finally { setApplying(false) }
    }

    const addToActionQueue = (item) => { setActionQueue(prev => [...prev, { ...item, id: Date.now(), addedAt: new Date().toISOString() }]); setFixPanelOpen(null) }
    const removeFromQueue = (id) => setActionQueue(prev => prev.filter(a => a.id !== id))

    if (loading) {
        return (
            <div className="p-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mx-auto mb-2"></div>
                    <p className="text-slate-400 text-xs">Analyzing...</p>
                </div>
            </div>
        )
    }

    const impact = calculateDailyTokenImpact()

    return (
        <div className="p-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-base font-bold text-white">🏥 Business Health</h1>
                    <p className="text-slate-400 text-[10px]">Financial health with fix tools</p>
                </div>
                <div className="flex items-center gap-1">
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-[10px]">
                        <option value="today">Today</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                        <option value="all">All</option>
                    </select>
                    <button onClick={loadAllData} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px]">↻</button>
                </div>
            </div>

            {/* Action Queue */}
            {actionQueue.length > 0 && (
                <div className="mb-2 p-2 bg-purple-500/10 border border-purple-500/50 rounded">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-purple-400 font-bold text-[10px]">📋 Saved ({actionQueue.length})</h3>
                        <button onClick={() => setActionQueue([])} className="text-purple-400 hover:text-purple-300 text-[10px]">Clear</button>
                    </div>
                    {actionQueue.map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-slate-800/50 rounded p-1.5 mb-1">
                            <div><p className="text-white text-[10px] font-medium">{item.title}</p><p className="text-slate-400 text-[9px]">{item.description}</p></div>
                            <div className="flex gap-1">
                                <button onClick={() => openFixPanel(item.type)} className="px-1.5 py-0.5 bg-purple-500 text-white rounded text-[9px]">Do</button>
                                <button onClick={() => removeFromQueue(item.id)} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[9px]">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Health Score */}
            <div className={`mb-2 p-2 rounded border ${getScoreColor(healthScores.overall).bg} ${getScoreColor(healthScores.overall).border}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className={`text-3xl font-bold ${getScoreColor(healthScores.overall).text}`}>{healthScores.overall}</p>
                            <p className={`text-[10px] font-medium ${getScoreColor(healthScores.overall).text}`}>{getScoreLabel(healthScores.overall)}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-600"></div>
                        <div><p className="text-white font-semibold text-xs">Overall Health</p><p className="text-slate-400 text-[10px]">5 weighted factors</p></div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                        {[{ key: 'financial', label: '💰', tip: TIPS.financial }, { key: 'tokenEconomy', label: '🪙', tip: TIPS.tokenEconomy }, { key: 'prizeSustain', label: '🏆', tip: TIPS.prizeSustain }, { key: 'expenseControl', label: '📊', tip: TIPS.expenseControl }, { key: 'configHealth', label: '⚙️', tip: TIPS.configHealth }].map(f => (
                            <Tooltip key={f.key} text={f.tip}>
                                <div className="bg-slate-800/50 rounded px-1.5 py-0.5 text-center w-10 cursor-help">
                                    <p className="text-[10px]">{f.label}</p>
                                    <p className={`text-xs font-bold ${getScoreColor(healthScores[f.key]).text}`}>{healthScores[f.key]}</p>
                                </div>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            </div>

            {/* Issues */}
            {issues.length > 0 && (
                <div className={`mb-2 p-2 rounded border ${issues.some(i => i.severity === 'critical') ? 'bg-red-500/10 border-red-500' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                    <h3 className={`font-bold text-xs mb-1 ${issues.some(i => i.severity === 'critical') ? 'text-red-400' : 'text-yellow-400'}`}>
                        {issues.some(i => i.severity === 'critical') ? '🚨' : '⚠️'} Issues ({issues.length})
                    </h3>
                    {issues.map((issue, idx) => (
                        <div key={idx} className="bg-slate-800/50 rounded p-2 mb-1 last:mb-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{issue.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                                        <h4 className="text-white font-medium text-xs">{issue.title}</h4>
                                    </div>
                                    <p className="text-slate-400 text-[10px]">{issue.message}</p>
                                    {issue.cause && <p className="text-slate-500 text-[10px]"><span className="text-slate-400">Cause:</span> {issue.cause}</p>}
                                    {issue.fix && <p className="text-green-400 text-[10px]"><span className="text-green-500">Fix:</span> {issue.fix}</p>}
                                </div>
                                {issue.fixType && (
                                    <button onClick={() => openFixPanel(issue.fixType)} className={`px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap ${issue.severity === 'critical' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900'}`}>🔧 Fix</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Fix Panel */}
            {fixPanelOpen && (
                <div className="mb-2 p-2 bg-slate-800 border-2 border-yellow-500 rounded overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-yellow-400 font-bold text-xs truncate">🔧 Fix: {issues[0]?.title || 'Improve Health'}</h3>
                        <button onClick={() => setFixPanelOpen(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
                    </div>

                    {/* RECOMMENDATION ENGINE */}
                    {!fixPanelData.showCustomize && (() => {
                        const deficit = Math.abs(financial.trueAvailable)
                        const dailyCostPerDay = financial.dailyTokensAwarded * tokenEconomy.tokenValue
                        const monthlyDailyCost = dailyCostPerDay * 30
                        const tokenLiab = tokenEconomy.circulationValue

                        const neededSavings = deficit * 1.1
                        const awardReductionPct = Math.min(90, Math.ceil((neededSavings / monthlyDailyCost) * 100))
                        const awardSavings = monthlyDailyCost * (awardReductionPct / 100)
                        const valueReductionPct = Math.min(50, Math.ceil((neededSavings / tokenLiab) * 100))

                        let recommendation = 'awards', recPct = awardReductionPct, recSavings = awardSavings
                        let reasoning = []

                        if (monthlyDailyCost === 0) { recommendation = 'tokenValue'; recPct = valueReductionPct; reasoning.push('No daily awards to reduce') }
                        else if (awardReductionPct <= 75) { reasoning.push(`Daily awards cost ${formatCurrency(monthlyDailyCost)}/mo`); reasoning.push(`${recPct}% reduction covers deficit`) }
                        else if (awardReductionPct <= 90) { reasoning.push(`Significant ${recPct}% reduction needed`) }
                        else { recommendation = 'combo'; recPct = 75; recSavings = monthlyDailyCost * 0.75 + tokenLiab * 0.15; reasoning.push('Deficit too large for awards alone') }

                        const newDailyTokens = Math.round(financial.dailyTokensAwarded * (1 - recPct / 100))
                        const newMonthlyDailyCost = newDailyTokens * tokenEconomy.tokenValue * 30
                        const newTrueAvailable = financial.trueAvailable + (monthlyDailyCost - newMonthlyDailyCost)

                        let newScore = healthScores.overall
                        if (newTrueAvailable >= 0) {
                            const newObligations = financial.totalObligations - financial.dailyTokenCost + (newDailyTokens * tokenEconomy.tokenValue * financial.days)
                            const coverage = financial.netRevenue / (newObligations || 1)
                            let newFinScore = coverage >= 2 ? 100 : coverage >= 1.5 ? 85 : coverage >= 1.2 ? 70 : 55
                            newScore = Math.round((newFinScore * 30 + 100 * 25 + 100 * 20 + healthScores.expenseControl * 15 + 100 * 10) / 100)
                        }

                        const multiplier = 1 - (recPct / 100)
                        const gameChanges = dailyConfig.filter(c => c.is_enabled).map(c => ({
                            name: c.game_key.replace(/_/g, ' '),
                            old: `${c.first_tokens}/${c.second_tokens}/${c.third_tokens}`,
                            new: `${Math.round(c.first_tokens * multiplier)}/${Math.round(c.second_tokens * multiplier)}/${Math.round(c.third_tokens * multiplier)}`
                        }))

                        return (
                            <div>
                                <div className="bg-green-500/10 border border-green-500 rounded p-2 mb-2">
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg">🎯</span>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-green-400 font-bold text-xs">RECOMMENDATION</h4>
                                            <p className="text-white font-medium text-[10px]">
                                                {recommendation === 'awards' && `Reduce daily awards by ${recPct}%`}
                                                {recommendation === 'tokenValue' && `Reduce token value by ${recPct}%`}
                                                {recommendation === 'combo' && `75% award cut + 15% token value`}
                                            </p>
                                        </div>
                                    </div>
                                    {recommendation === 'awards' && gameChanges.length > 0 && (
                                        <div className="mt-2 bg-slate-800/50 rounded p-1.5 grid grid-cols-2 gap-1">
                                            {gameChanges.map((g, i) => (
                                                <div key={i} className="text-[10px]">
                                                    <span className="text-slate-400 capitalize">{g.name}:</span> <span className="text-red-400">{g.old}</span> → <span className="text-green-400">{g.new}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-700/30 rounded p-2 mb-2">
                                    <h5 className="text-blue-400 font-medium text-[10px] mb-1">💡 WHY:</h5>
                                    <ul className="space-y-0.5">
                                        {reasoning.map((r, i) => <li key={i} className="text-slate-300 text-[10px] flex items-start gap-1"><span className="text-green-400">•</span> {r}</li>)}
                                    </ul>
                                </div>

                                <div className={`rounded p-2 mb-2 ${newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
                                    <h5 className="text-white font-medium text-[10px] mb-1">📊 RESULT:</h5>
                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                        <div><p className="text-slate-400">Score</p><p className="font-bold"><span className="text-red-400">{healthScores.overall}</span> → <span className="text-green-400">{newScore}</span></p></div>
                                        <div><p className="text-slate-400">Available</p><p className={`font-bold ${newTrueAvailable >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>{formatCurrency(newTrueAvailable)}</p></div>
                                        <div><p className="text-slate-400">Savings</p><p className="text-green-400 font-bold">{formatCurrency(recSavings)}/mo</p></div>
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    <button onClick={() => {
                                        const mult = 1 - (recPct / 100)
                                        const newConfigs = dailyConfig.map(c => ({ ...c, new_first: Math.round(c.first_tokens * mult), new_second: Math.round(c.second_tokens * mult), new_third: Math.round(c.third_tokens * mult) }))
                                        applyDailyTokenChanges(newConfigs)
                                    }} disabled={applying} className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-400 disabled:bg-slate-600 text-white rounded text-xs font-medium">
                                        {applying ? '...' : '✅ Apply'}
                                    </button>
                                    <button onClick={() => {
                                        const mult = 1 - (recPct / 100)
                                        const newConfigs = dailyConfig.map(c => ({ ...c, new_first: Math.round(c.first_tokens * mult), new_second: Math.round(c.second_tokens * mult), new_third: Math.round(c.third_tokens * mult) }))
                                        setFixPanelData(prev => ({ ...prev, showCustomize: true, configs: newConfigs, activeTab: 'awards' }))
                                    }} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded text-xs">✏️ Edit</button>
                                    <button onClick={() => setFixPanelOpen(null)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">❌</button>
                                </div>
                            </div>
                        )
                    })()}

                    {fixPanelData.showCustomize && (
                        <>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-1.5 mb-2">
                                <p className="text-blue-400 text-[10px]">✏️ <strong>Customize</strong> <button onClick={() => setFixPanelData(prev => ({ ...prev, showCustomize: false }))} className="ml-1 text-blue-300 underline">← Back</button></p>
                            </div>

                            <div className="flex gap-1 mb-2 border-b border-slate-700 pb-1">
                                {['awards', 'tokenValue', 'prizes', 'combo'].map(tab => (
                                    <button key={tab} onClick={() => setFixPanelData(prev => ({ ...prev, activeTab: tab }))}
                                        className={`px-2 py-1 text-[10px] font-medium rounded-t ${fixPanelData.activeTab === tab ? 'bg-slate-700 text-yellow-400' : 'text-slate-400 hover:text-white'}`}>
                                        {tab === 'awards' && '🎮 Awards'}
                                        {tab === 'tokenValue' && '💰 Value'}
                                        {tab === 'prizes' && '🏆 Prizes'}
                                        {tab === 'combo' && '🔀 Combo'}
                                    </button>
                                ))}
                            </div>

                            {fixPanelData.activeTab === 'awards' && (
                                <div>
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 mb-2">
                                        <p className="text-slate-300 text-[10px]">Best when issuing too many tokens. Doesn't affect existing tokens.</p>
                                    </div>

                                    {impact && (
                                        <div className="grid grid-cols-3 gap-1 mb-2">
                                            <div className="bg-slate-700/50 rounded p-1.5 text-center">
                                                <p className="text-slate-400 text-[9px]">Current</p>
                                                <p className="text-red-400 font-bold text-xs">{formatCurrency(impact.currentMonthlyCost)}/mo</p>
                                            </div>
                                            <div className="bg-slate-700/50 rounded p-1.5 text-center">
                                                <p className="text-slate-400 text-[9px]">New</p>
                                                <p className="text-green-400 font-bold text-xs">{formatCurrency(impact.newMonthlyCost)}/mo</p>
                                            </div>
                                            <div className={`rounded p-1.5 text-center ${impact.savings > 0 ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                                                <p className="text-slate-400 text-[9px]">Savings</p>
                                                <p className={`font-bold text-xs ${impact.savings > 0 ? 'text-green-400' : 'text-slate-400'}`}>{formatCurrency(impact.savings)}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                                        {fixPanelData.configs?.map((config, idx) => (
                                            <div key={config.id} className="bg-slate-700/30 rounded p-1.5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-white font-medium text-[10px] capitalize">{config.game_key.replace(/_/g, ' ')}</span>
                                                    <span className={`text-[9px] px-1 rounded ${config.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{config.is_enabled ? 'On' : 'Off'}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {['first', 'second', 'third'].map((place, i) => (
                                                        <div key={place} className="flex items-center gap-1">
                                                            <span className="text-slate-500 text-[9px]">{['1st', '2nd', '3rd'][i]}</span>
                                                            <input type="number" value={config[`new_${place}`]} onChange={(e) => updateFixConfig(idx, `new_${place}`, e.target.value)}
                                                                className="w-10 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-white text-[10px]" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-1 mb-2">
                                        <span className="text-slate-400 text-[10px] py-1">Quick:</span>
                                        {[25, 50, 75].map(pct => (
                                            <button key={pct} onClick={() => {
                                                const mult = 1 - (pct / 100)
                                                setFixPanelData(prev => ({ ...prev, configs: prev.configs.map(c => ({ ...c, new_first: Math.round(c.first_tokens * mult), new_second: Math.round(c.second_tokens * mult), new_third: Math.round(c.third_tokens * mult) })) }))
                                            }} className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px]">-{pct}%</button>
                                        ))}
                                        <button onClick={() => setFixPanelData(prev => ({ ...prev, configs: prev.configs.map(c => ({ ...c, new_first: c.first_tokens, new_second: c.second_tokens, new_third: c.third_tokens })) }))} className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded text-[10px]">Reset</button>
                                    </div>

                                    {impact && <ImpactPreview impact={impact} />}
                                    <ActionButtons onApply={applyDailyTokenChanges} onSaveLater={() => addToActionQueue({ type: 'dailyTokens', title: 'Reduce Daily Awards', description: `Save ${formatCurrency(impact?.savings || 0)}/mo` })} onCancel={() => setFixPanelOpen(null)} applying={applying} disabled={impact?.savings === 0} />
                                </div>
                            )}

                            {fixPanelData.activeTab === 'tokenValue' && (
                                <div>
                                    <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2 mb-2">
                                        <p className="text-slate-300 text-[10px]"><span className="text-white font-medium">Last resort.</span> Devalues tokens users already earned.</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1 mb-2">
                                        <div className="bg-slate-700/50 rounded p-1.5 text-center"><p className="text-slate-400 text-[9px]">Value</p><p className="text-yellow-400 font-bold text-xs">{formatCurrency(tokenEconomy.tokenValue)}</p></div>
                                        <div className="bg-slate-700/50 rounded p-1.5 text-center"><p className="text-slate-400 text-[9px]">Circulation</p><p className="text-white font-bold text-xs">{formatNumber(tokenEconomy.totalCirculation)}</p></div>
                                        <div className="bg-slate-700/50 rounded p-1.5 text-center"><p className="text-slate-400 text-[9px]">Liability</p><p className="text-red-400 font-bold text-xs">{formatCurrency(tokenEconomy.circulationValue)}</p></div>
                                    </div>

                                    <div className="bg-slate-700/30 rounded p-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <input type="range" min="0.01" max="0.10" step="0.01" value={fixPanelData.newTokenValue || tokenEconomy.tokenValue}
                                                onChange={(e) => setFixPanelData(prev => ({ ...prev, newTokenValue: parseFloat(e.target.value) }))} className="flex-1" />
                                            <span className="text-yellow-400 font-bold text-sm w-12 text-right">{formatCurrency(fixPanelData.newTokenValue || tokenEconomy.tokenValue)}</span>
                                        </div>
                                    </div>

                                    {(() => {
                                        const newValue = fixPanelData.newTokenValue || tokenEconomy.tokenValue
                                        const currentLiability = tokenEconomy.circulationValue
                                        const newLiability = tokenEconomy.totalCirculation * newValue
                                        const savingsFromValue = currentLiability - newLiability
                                        const newTrueAvailable = financial.trueAvailable + savingsFromValue

                                        return (
                                            <>
                                                <div className={`p-2 rounded mb-2 ${newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
                                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                        <div><p className="text-slate-400">Liability</p><p className="font-bold"><span className="text-red-400">{formatCurrency(currentLiability)}</span> → <span className="text-green-400">{formatCurrency(newLiability)}</span></p></div>
                                                        <div><p className="text-slate-400">Savings</p><p className={`font-bold ${savingsFromValue > 0 ? 'text-green-400' : 'text-slate-400'}`}>{formatCurrency(savingsFromValue)}</p></div>
                                                    </div>
                                                    {newValue < tokenEconomy.tokenValue && <p className="text-red-300 text-[10px] mt-1">⚠️ Affects user trust</p>}
                                                </div>
                                                <ActionButtons onApply={applyTokenValueChange} onSaveLater={() => addToActionQueue({ type: 'tokenValue', title: 'Token Value', description: `${formatCurrency(tokenEconomy.tokenValue)} → ${formatCurrency(fixPanelData.newTokenValue)}` })} onCancel={() => setFixPanelOpen(null)} applying={applying} disabled={fixPanelData.newTokenValue === tokenEconomy.tokenValue} warning={fixPanelData.newTokenValue < tokenEconomy.tokenValue} />
                                            </>
                                        )
                                    })()}
                                </div>
                            )}

                            {fixPanelData.activeTab === 'prizes' && (
                                <div>
                                    <div className="bg-green-500/10 border border-green-500/30 rounded p-2 mb-2">
                                        <p className="text-slate-300 text-[10px]">Reduce cash prizes or switch to token prizes.</p>
                                    </div>
                                    <div className="bg-slate-700/30 rounded p-3 text-center mb-2">
                                        {weeklyPrizes.filter(p => p.prize_type === 'cash').length === 0
                                            ? <p className="text-green-400 font-medium text-xs">✅ No Active Cash Prizes</p>
                                            : <><p className="text-yellow-400 font-medium text-xs">{weeklyPrizes.filter(p => p.prize_type === 'cash').length} Cash Prize(s)</p><p className="text-red-400 font-bold">{formatCurrency(weeklyPrizes.filter(p => p.prize_type === 'cash').reduce((sum, p) => sum + (p.total_prize_pool || 0), 0))}</p></>
                                        }
                                    </div>
                                    <Link href="/admin/prizes" className="block w-full px-3 py-1.5 bg-green-500 hover:bg-green-400 text-white rounded text-xs font-medium text-center">🏆 Prize Management →</Link>
                                </div>
                            )}

                            {fixPanelData.activeTab === 'combo' && (
                                <div>
                                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 mb-2">
                                        <p className="text-slate-300 text-[10px]">Combine changes to spread impact.</p>
                                    </div>
                                    <div className="bg-slate-700/30 rounded p-2 mb-2">
                                        {(() => {
                                            const deficit = Math.abs(financial.trueAvailable)
                                            const awardSavings = (financial.dailyTokensAwarded * tokenEconomy.tokenValue * 30) * 0.5
                                            const valueSavings = tokenEconomy.circulationValue * 0.2
                                            return (
                                                <div className="space-y-1 text-[10px]">
                                                    <div className="flex justify-between p-1 bg-slate-800/50 rounded"><span className="text-white">1. Awards -50%</span><span className="text-green-400">{formatCurrency(awardSavings)}/mo</span></div>
                                                    <div className="flex justify-between p-1 bg-slate-800/50 rounded"><span className="text-white">2. Value -20%</span><span className="text-green-400">{formatCurrency(valueSavings)}</span></div>
                                                    <div className="border-t border-slate-600 pt-1 mt-1">
                                                        <div className="flex justify-between"><span className="text-slate-400">Deficit:</span><span className="text-red-400">{formatCurrency(deficit)}</span></div>
                                                        <div className="flex justify-between"><span className="text-slate-400">Combined:</span><span className="text-green-400">{formatCurrency(awardSavings + valueSavings)}</span></div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                    <div className="space-y-1">
                                        <button onClick={() => { setFixPanelData(prev => ({ ...prev, activeTab: 'awards', configs: prev.configs.map(c => ({ ...c, new_first: Math.round(c.first_tokens * 0.5), new_second: Math.round(c.second_tokens * 0.5), new_third: Math.round(c.third_tokens * 0.5) })) })) }}
                                            className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded text-xs">🎮 Start with Awards</button>
                                        <button onClick={() => setFixPanelData(prev => ({ ...prev, activeTab: 'tokenValue', newTokenValue: tokenEconomy.tokenValue * 0.8 }))}
                                            className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">💰 Then Token Value</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Financial Breakdown */}
            <div className="mb-2 bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'financial' ? null : 'financial')} className="w-full p-2 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">💰</span>
                        <div className="text-left"><h3 className="text-white font-bold text-xs">Financial Breakdown</h3><p className="text-slate-400 text-[10px]">Revenue → Costs → Profit</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right"><p className="text-slate-400 text-[9px]">Available</p><p className={`text-sm font-bold ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(financial.trueAvailable)}</p></div>
                        <span className={`text-slate-400 text-[10px] ${expandedSection === 'financial' ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {expandedSection === 'financial' && (
                    <div className="p-2 border-t border-slate-700 grid grid-cols-4 gap-1">
                        <div className="bg-green-500/10 border border-green-500/30 rounded p-1.5">
                            <h4 className="text-green-400 font-bold text-[10px] mb-1">📈 Revenue</h4>
                            <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between"><span className="text-slate-400">Campaigns</span><span className="text-green-400">{formatCurrency(financial.grossRevenue)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Fees</span><span className="text-red-400">-{formatCurrency(financial.processingFees)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-0.5"><span className="text-white">Net</span><span>{formatCurrency(financial.netRevenue)}</span></div>
                            </div>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded p-1.5">
                            <h4 className="text-orange-400 font-bold text-[10px] mb-1">🏢 Costs</h4>
                            <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between"><span className="text-slate-400">Recurring</span><span className="text-red-400">-{formatCurrency(financial.recurringExpenses)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">One-Time</span><span className="text-red-400">-{formatCurrency(financial.oneTimeExpenses)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-0.5"><span className="text-white">Total</span><span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span></div>
                            </div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-1.5">
                            <h4 className="text-red-400 font-bold text-[10px] mb-1">⚠️ Obligations</h4>
                            <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between"><span className="text-slate-400"><Tooltip text={TIPS.tokenLiability}>Tokens</Tooltip></span><span className="text-red-400">-{formatCurrency(financial.tokenLiability)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400"><Tooltip text={TIPS.dailyAwards}>Daily</Tooltip></span><span className="text-red-400">-{formatCurrency(financial.dailyTokenCost)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400"><Tooltip text={TIPS.gameAwards}>Game Awards</Tooltip></span><span className="text-red-400">-{formatCurrency(financial.gameTokenCost)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400"><Tooltip text={TIPS.payouts}>Payouts</Tooltip></span><span className="text-red-400">-{formatCurrency(financial.pendingPayouts + financial.weeklyPrizesDue)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-0.5"><span className="text-white">Total</span><span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span></div>
                            </div>
                        </div>
                        <div className={`p-1.5 rounded border ${financial.trueAvailable >= 0 ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                            <h4 className={`font-bold text-[10px] mb-1 ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>💵 Profit</h4>
                            <div className="space-y-0.5 text-[10px]">
                                <div className="flex justify-between"><span className="text-slate-400">Net</span><span>{formatCurrency(financial.netRevenue)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Costs</span><span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Oblig.</span><span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-0.5"><span className="text-white"><Tooltip text={TIPS.trueAvailable}>AVAIL</Tooltip></span><span className={financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(financial.trueAvailable)}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Token Economy */}
            <div className="mb-2 bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'tokens' ? null : 'tokens')} className="w-full p-2 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🪙</span>
                        <div className="text-left"><h3 className="text-white font-bold text-xs">Token Economy</h3><p className="text-slate-400 text-[10px]">Circulation & burn rate</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right"><p className="text-slate-400 text-[9px]">Liability</p><p className="text-yellow-400 text-sm font-bold">{formatCurrency(tokenEconomy.circulationValue)}</p></div>
                        <span className={`text-slate-400 text-[10px] ${expandedSection === 'tokens' ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {expandedSection === 'tokens' && (
                    <div className="p-2 border-t border-slate-700">
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-1 mb-2">
                            {[['Value', formatCurrency(tokenEconomy.tokenValue), 'text-yellow-400'], ['Circ.', formatNumber(tokenEconomy.totalCirculation), 'text-white'], ['Issued', formatNumber(tokenEconomy.totalIssued), 'text-green-400'], ['Burned', formatNumber(tokenEconomy.totalBurned), 'text-red-400'], ['Burn%', `${tokenEconomy.burnRate.toFixed(1)}%`, tokenEconomy.burnRate >= 30 ? 'text-green-400' : 'text-yellow-400'], ['Users', formatNumber(tokenEconomy.usersWithBalance), 'text-white'], ['Avg', formatNumber(tokenEconomy.avgBalance), 'text-white'], ['Avg$', formatCurrency(tokenEconomy.avgBalance * tokenEconomy.tokenValue), 'text-white']].map(([label, value, color], i) => (
                                <div key={i} className="bg-slate-700/50 rounded p-1 text-center"><p className="text-slate-400 text-[9px]">{label}</p><p className={`font-bold text-[10px] ${color}`}>{value}</p></div>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            <Link href="/admin/economy" className="px-2 py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded text-[10px] font-medium">Economy →</Link>
                            <Link href="/admin/game-settings" className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px]">Games →</Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Monthly Expenses */}
            <div className="mb-2 bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')} className="w-full p-2 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🏢</span>
                        <div className="text-left"><h3 className="text-white font-bold text-xs">Monthly Fixed Costs</h3><p className="text-slate-400 text-[10px]">Recurring expenses</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-right"><p className="text-slate-400 text-[9px]">Monthly</p><p className="text-red-400 text-sm font-bold">{formatCurrency(expenses.monthlyTotal)}</p></div>
                        <span className={`text-slate-400 text-[10px] ${expandedSection === 'expenses' ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {expandedSection === 'expenses' && (
                    <div className="p-2 border-t border-slate-700">
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 mb-2">
                            {expenses.recurring.map(exp => (
                                <div key={exp.id} className="bg-slate-700/50 rounded p-1 flex justify-between items-center text-[10px]">
                                    <span className="text-white truncate">{exp.name}</span>
                                    <span className="text-red-400 font-medium">{formatCurrency(exp.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <Link href="/admin/accounting" className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px]">Manage →</Link>
                    </div>
                )}
            </div>

            {/* Quick Links */}
            <div className="bg-slate-800 border border-slate-700 rounded p-2 mb-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-xs">🔗 Quick</h3>
                    <div className="flex gap-1">
                        {[['💰', 'Acct', '/admin/accounting'], ['🪙', 'Econ', '/admin/economy'], ['🏆', 'Prize', '/admin/prizes'], ['🎮', 'Game', '/admin/game-settings']].map(([icon, label, href]) => (
                            <Link key={label} href={href} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white">{icon} {label}</Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Changes */}
            <div className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <button onClick={() => setShowHistory(!showHistory)} className="w-full p-2 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📜</span>
                        <div className="text-left"><h3 className="text-white font-bold text-xs">Recent Changes</h3><p className="text-slate-400 text-[10px]">Adjustment history</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">{recentChanges.length}</span>
                        <span className={`text-slate-400 text-[10px] ${showHistory ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {showHistory && (
                    <div className="p-2 border-t border-slate-700">
                        {recentChanges.length === 0 ? (
                            <p className="text-slate-400 text-[10px] text-center py-2">No changes yet</p>
                        ) : (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {recentChanges.map((change) => (
                                    <div key={change.id} className="bg-slate-700/30 rounded p-1.5 flex items-start gap-1.5">
                                        <span className="text-sm">{getChangeIcon(change.action)}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-white text-[10px] font-medium truncate">{change.description || change.action.replace(/_/g, ' ')}</p>
                                                <span className="text-slate-500 text-[9px] whitespace-nowrap">{formatChangeDate(change.created_at)}</span>
                                            </div>
                                            <p className="text-slate-400 text-[9px] truncate">{change.user_email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-2 text-center">
                            <Link href="/admin/audit-log" className="text-yellow-400 hover:text-yellow-300 text-[10px]">Full Log →</Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}