'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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

// ===== REUSABLE COMPONENTS =====
function ImpactPreview({ impact }) {
    return (
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
                <p className="text-yellow-300 text-xs mt-2">⚠️ Still in deficit. Consider additional reductions.</p>
            )}
            {impact.newTrueAvailable >= 0 && impact.newTrueAvailable < 50 && (
                <p className="text-green-300 text-xs mt-2">✅ Break-even! Consider more reduction for safety buffer.</p>
            )}
            {impact.newTrueAvailable >= 50 && (
                <p className="text-green-300 text-xs mt-2">✅ Excellent! Healthy profit margin.</p>
            )}
        </div>
    )
}

function ActionButtons({ onApply, onSaveLater, onCancel, applying, disabled, warning }) {
    return (
        <div className="flex gap-2">
            <button
                onClick={onApply}
                disabled={applying || disabled}
                className={`flex-1 px-4 py-2 rounded text-sm font-medium ${warning
                    ? 'bg-orange-500 hover:bg-orange-400 text-white'
                    : 'bg-green-500 hover:bg-green-400 disabled:bg-slate-600 text-white'
                    }`}
            >
                {applying ? 'Applying...' : warning ? '⚠️ Apply (Affects Users)' : '✅ Apply Changes'}
            </button>
            <button onClick={onSaveLater} className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded text-sm font-medium">
                📋 Later
            </button>
            <button onClick={onCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium">
                Cancel
            </button>
        </div>
    )
}

// ===== MAIN COMPONENT =====
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
        tokenLiability: 0, dailyTokenCost: 0, dailyTokensAwarded: 0, totalObligations: 0,
        trueAvailable: 0, campaignCount: 0, tokenValue: 0.05, days: 30
    })

    const [tokenEconomy, setTokenEconomy] = useState({
        tokenValue: 0.05, totalCirculation: 0, totalIssued: 0, totalBurned: 0,
        burnRate: 0, usersWithBalance: 0, avgBalance: 0, circulationValue: 0
    })

    const [dailyConfig, setDailyConfig] = useState([])
    const [weeklyPrizes, setWeeklyPrizes] = useState([])
    const [expenses, setExpenses] = useState({ recurring: [], monthlyTotal: 0 })
    const [healthScores, setHealthScores] = useState({
        overall: 0, financial: 0, tokenEconomy: 0, prizeSustain: 0, expenseControl: 0, configHealth: 0
    })
    const [issues, setIssues] = useState([])

    // Load current user for audit logging
    useEffect(() => {
        const loadCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, email, role')
                    .eq('id', user.id)
                    .single()
                setCurrentUser(userData)
            }
        }
        loadCurrentUser()
    }, [])

    // Load/save action queue
    useEffect(() => {
        const saved = localStorage.getItem('healthActionQueue')
        if (saved) setActionQueue(JSON.parse(saved))
    }, [])

    useEffect(() => {
        localStorage.setItem('healthActionQueue', JSON.stringify(actionQueue))
    }, [actionQueue])

    useEffect(() => { loadAllData() }, [dateRange])

    useEffect(() => { loadRecentChanges() }, [])

    // ===== RECENT CHANGES FUNCTIONS =====
    const loadRecentChanges = async () => {
        try {
            const { data } = await supabase
                .from('admin_audit_log')
                .select('*')
                .in('action', ['daily_awards_change', 'token_value_change', 'health_fix_applied'])
                .order('created_at', { ascending: false })
                .limit(10)

            setRecentChanges(data || [])
        } catch (error) {
            console.error('Error loading recent changes:', error)
        }
    }

    const formatChangeDate = (dateStr) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getChangeIcon = (action) => {
        switch (action) {
            case 'daily_awards_change': return '🎮'
            case 'token_value_change': return '🪙'
            case 'health_fix_applied': return '🏥'
            default: return '📝'
        }
    }

    // ===== AUDIT LOGGING FUNCTION =====
    const logAuditAction = async (action, tableName, recordId, oldValue, newValue, description) => {
        if (!currentUser) return

        try {
            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser.id,
                user_email: currentUser.email,
                action,
                table_name: tableName,
                record_id: recordId,
                old_value: oldValue,
                new_value: newValue,
                description
            }])
            // Reload recent changes after logging
            await loadRecentChanges()
        } catch (error) {
            console.error('Error logging audit:', error)
        }
    }

    const getDateFilter = () => {
        const now = new Date()
        if (dateRange === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        if (dateRange === 'week') {
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - now.getDay())
            weekStart.setHours(0, 0, 0, 0)
            return weekStart.toISOString()
        }
        if (dateRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        if (dateRange === 'year') return new Date(now.getFullYear(), 0, 1).toISOString()
        return new Date(0).toISOString()
    }

    const loadAllData = async () => {
        setLoading(true)
        try {
            await Promise.all([loadFinancialData(), loadTokenEconomyData(), loadDailyConfig(), loadWeeklyPrizes(), loadExpenseData()])
        } catch (error) {
            console.error('Error loading health data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadDailyConfig = async () => {
        const { data } = await supabase.from('daily_leaderboard_config').select('*').order('game_key')
        setDailyConfig(data || [])
    }

    const loadWeeklyPrizes = async () => {
        const { data } = await supabase.from('weekly_prizes').select('*').eq('is_active', true).order('week_start')
        setWeeklyPrizes(data || [])
    }

    const loadFinancialData = async () => {
        const dateFilter = getDateFilter()

        const { data: campaigns } = await supabase.from('ad_campaigns').select('amount_paid, status').gte('created_at', dateFilter).neq('status', 'cancelled')
        const grossRevenue = campaigns?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0
        const campaignCount = campaigns?.filter(c => c.amount_paid > 0).length || 0

        const processingFees = (grossRevenue * 0.029) + (campaignCount * 0.30)
        const netRevenue = grossRevenue - processingFees

        const { data: recurring } = await supabase.from('recurring_expenses').select('amount, frequency').eq('is_active', true)
        let recurringExpenses = 0
        recurring?.forEach(exp => {
            if (exp.frequency === 'monthly') recurringExpenses += parseFloat(exp.amount) || 0
            else if (exp.frequency === 'yearly') recurringExpenses += (parseFloat(exp.amount) || 0) / 12
        })

        let expenseMultiplier = 1
        if (dateRange === 'today') expenseMultiplier = 1 / 30
        else if (dateRange === 'week') expenseMultiplier = 7 / 30
        else if (dateRange === 'year') expenseMultiplier = 12
        recurringExpenses = recurringExpenses * expenseMultiplier

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
        dailyConfigData?.forEach(config => {
            dailyTokensAwarded += (config.first_tokens || 0) + (config.second_tokens || 0) + (config.third_tokens || 0)
        })

        let days = 30
        if (dateRange === 'today') days = 1
        else if (dateRange === 'week') days = 7
        else if (dateRange === 'year') days = 365

        const dailyTokenCost = dailyTokensAwarded * tokenValue * days

        const now = new Date()
        const { data: prizesDue } = await supabase.from('weekly_prizes').select('total_prize_pool, prize_type').eq('prize_type', 'cash').eq('is_active', true).lte('week_end_time', now.toISOString())
        const weeklyPrizesDue = prizesDue?.reduce((sum, p) => sum + (parseFloat(p.total_prize_pool) || 0), 0) || 0

        const totalObligations = pendingPayouts + weeklyPrizesDue + tokenLiability + dailyTokenCost
        const trueAvailable = netRevenue - totalHardCosts - totalObligations

        const financialData = {
            grossRevenue, processingFees, netRevenue, recurringExpenses, oneTimeExpenses, totalHardCosts,
            pendingPayouts, weeklyPrizesDue, tokenLiability, dailyTokenCost, dailyTokensAwarded,
            totalObligations, trueAvailable, campaignCount, tokenValue, days
        }

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
        recurring?.forEach(exp => {
            if (exp.frequency === 'monthly') monthlyTotal += parseFloat(exp.amount) || 0
            else if (exp.frequency === 'yearly') monthlyTotal += (parseFloat(exp.amount) || 0) / 12
        })
        setExpenses({ recurring: recurring || [], monthlyTotal })
    }

    const calculateHealthScores = (data) => {
        const newIssues = []
        let financialScore = 100

        if (data.netRevenue <= 0) {
            financialScore = 10
            newIssues.push({ severity: 'critical', title: 'No Revenue', message: 'No revenue for this period.', cause: 'No ad campaigns generating income.', fix: 'Launch ad campaigns to generate revenue.', fixType: null })
        } else if (data.trueAvailable < 0) {
            const deficit = Math.abs(data.trueAvailable)
            financialScore = Math.max(10, 50 - (deficit / data.netRevenue) * 100)

            const monthlyDailyTokenCost = data.dailyTokensAwarded * data.tokenValue * 30
            let mainCause = '', mainFix = '', fixType = 'dailyTokens'

            if (monthlyDailyTokenCost > data.netRevenue * 0.5) {
                mainCause = `Daily token awards cost ${formatCurrency(monthlyDailyTokenCost)}/month (${formatNumber(data.dailyTokensAwarded)} tokens/day × ${formatCurrency(data.tokenValue)}/token)`
                mainFix = `Reduce daily awards by 50% to save ${formatCurrency(monthlyDailyTokenCost / 2)}/month`
            } else {
                mainCause = 'Combination of token awards, prizes, and fixed costs exceed revenue'
                mainFix = 'Reduce daily token awards or adjust token value'
            }

            newIssues.push({ severity: 'critical', title: `Deficit of ${formatCurrency(deficit)}`, message: 'Obligations exceed revenue. This is unsustainable.', cause: mainCause, fix: mainFix, fixType, deficit })

            if (tokenEconomy.burnRate === 0 && tokenEconomy.totalCirculation > 0) {
                newIssues.push({ severity: 'warning', title: '0% Token Burn Rate', message: 'No tokens being spent - liability only grows.', cause: 'Users have no way or incentive to spend tokens.', fix: 'Add merch or features that cost tokens.', fixType: null })
            }
        } else {
            const coverageRatio = data.netRevenue / (data.totalObligations || 1)
            if (coverageRatio >= 2) financialScore = 100
            else if (coverageRatio >= 1.5) financialScore = 85
            else if (coverageRatio >= 1.2) financialScore = 70
            else financialScore = 55
        }

        let expenseScore = 100
        if (data.netRevenue > 0) {
            const expenseRatio = (data.totalHardCosts / data.netRevenue) * 100
            if (expenseRatio > 50) expenseScore = 30
            else if (expenseRatio > 30) expenseScore = 60
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
            if (coverageRatio >= 2) newFinancialScore = 100
            else if (coverageRatio >= 1.5) newFinancialScore = 85
            else if (coverageRatio >= 1.2) newFinancialScore = 70
            else newFinancialScore = 55
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
                const oldValues = {
                    first_tokens: oldConfig?.first_tokens,
                    second_tokens: oldConfig?.second_tokens,
                    third_tokens: oldConfig?.third_tokens
                }
                const newValues = {
                    first_tokens: config.new_first,
                    second_tokens: config.new_second,
                    third_tokens: config.new_third
                }

                if (oldValues.first_tokens !== newValues.first_tokens ||
                    oldValues.second_tokens !== newValues.second_tokens ||
                    oldValues.third_tokens !== newValues.third_tokens) {

                    await supabase.from('daily_leaderboard_config').update({
                        first_tokens: config.new_first,
                        second_tokens: config.new_second,
                        third_tokens: config.new_third,
                        updated_at: new Date().toISOString()
                    }).eq('id', config.id)

                    await logAuditAction(
                        'daily_awards_change',
                        'daily_leaderboard_config',
                        config.id,
                        oldValues,
                        newValues,
                        `Health Dashboard: Changed ${config.game_key} awards from ${oldValues.first_tokens}/${oldValues.second_tokens}/${oldValues.third_tokens} to ${newValues.first_tokens}/${newValues.second_tokens}/${newValues.third_tokens}`
                    )
                }
            }

            const impact = calculateDailyTokenImpact()
            await logAuditAction(
                'health_fix_applied',
                'daily_leaderboard_config',
                null,
                { healthScore: healthScores.overall, trueAvailable: financial.trueAvailable },
                { healthScore: impact?.newScore, trueAvailable: impact?.newTrueAvailable, monthlySavings: impact?.savings },
                `Health Dashboard: Applied daily token reduction. Savings: ${formatCurrency(impact?.savings || 0)}/month`
            )

            await loadAllData()
            setFixPanelOpen(null)
            setFixPanelData({ activeTab: 'awards', showCustomize: false })
        } catch (error) {
            console.error('Error:', error)
            alert('Error applying changes')
        } finally {
            setApplying(false)
        }
    }

    const applyTokenValueChange = async () => {
        setApplying(true)
        try {
            const oldValue = tokenEconomy.tokenValue
            const newValue = fixPanelData.newTokenValue
            const oldLiability = tokenEconomy.circulationValue
            const newLiability = tokenEconomy.totalCirculation * newValue

            await supabase.from('economy_settings').update({
                setting_value: newValue,
                updated_at: new Date().toISOString()
            }).eq('setting_key', 'token_value')

            await logAuditAction(
                'token_value_change',
                'economy_settings',
                'token_value',
                { token_value: oldValue, liability: oldLiability },
                { token_value: newValue, liability: newLiability },
                `Health Dashboard: Changed token value from ${formatCurrency(oldValue)} to ${formatCurrency(newValue)}. Liability reduced by ${formatCurrency(oldLiability - newLiability)}`
            )

            await loadAllData()
            setFixPanelOpen(null)
        } catch (error) {
            console.error('Error:', error)
            alert('Error applying changes')
        } finally {
            setApplying(false)
        }
    }

    const addToActionQueue = (item) => {
        setActionQueue(prev => [...prev, { ...item, id: Date.now(), addedAt: new Date().toISOString() }])
        setFixPanelOpen(null)
    }

    const removeFromQueue = (id) => setActionQueue(prev => prev.filter(a => a.id !== id))

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

    const impact = calculateDailyTokenImpact()

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-lg font-bold text-white">🏥 Business Health Dashboard</h1>
                    <p className="text-slate-400 text-xs">Financial health with educational fix tools</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="all">All Time</option>
                    </select>
                    <button onClick={loadAllData} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">↻</button>
                </div>
            </div>

            {/* Action Queue */}
            {actionQueue.length > 0 && (
                <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-purple-400 font-bold text-xs">📋 Saved Actions ({actionQueue.length})</h3>
                        <button onClick={() => setActionQueue([])} className="text-purple-400 hover:text-purple-300 text-xs">Clear</button>
                    </div>
                    <div className="space-y-1">
                        {actionQueue.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                                <div>
                                    <p className="text-white text-xs font-medium">{item.title}</p>
                                    <p className="text-slate-400 text-[10px]">{item.description}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openFixPanel(item.type)} className="px-2 py-1 bg-purple-500 text-white rounded text-[10px]">Do</button>
                                    <button onClick={() => removeFromQueue(item.id)} className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-[10px]">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Health Score */}
            <div className={`mb-3 p-3 rounded-lg border ${getScoreColor(healthScores.overall).bg} ${getScoreColor(healthScores.overall).border}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <p className={`text-4xl font-bold ${getScoreColor(healthScores.overall).text}`}>{healthScores.overall}</p>
                            <p className={`text-xs font-medium ${getScoreColor(healthScores.overall).text}`}>{getScoreLabel(healthScores.overall)}</p>
                        </div>
                        <div className="h-12 w-px bg-slate-600"></div>
                        <div>
                            <p className="text-white font-semibold text-sm">Overall Business Health</p>
                            <p className="text-slate-400 text-xs">Weighted score across 5 factors</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {[{ key: 'financial', label: '💰' }, { key: 'tokenEconomy', label: '🪙' }, { key: 'prizeSustain', label: '🏆' }, { key: 'expenseControl', label: '📊' }, { key: 'configHealth', label: '⚙️' }].map(f => (
                            <div key={f.key} className="bg-slate-800/50 rounded px-2 py-1 text-center min-w-[50px]">
                                <p className="text-xs">{f.label}</p>
                                <p className={`text-sm font-bold ${getScoreColor(healthScores[f.key]).text}`}>{healthScores[f.key]}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Issues */}
            {issues.length > 0 && (
                <div className={`mb-3 p-3 rounded-lg border ${issues.some(i => i.severity === 'critical') ? 'bg-red-500/10 border-red-500' : 'bg-yellow-500/10 border-yellow-500/50'}`}>
                    <h3 className={`font-bold text-sm mb-2 ${issues.some(i => i.severity === 'critical') ? 'text-red-400' : 'text-yellow-400'}`}>
                        {issues.some(i => i.severity === 'critical') ? '🚨' : '⚠️'} Issues ({issues.length})
                    </h3>
                    <div className="space-y-2">
                        {issues.map((issue, idx) => (
                            <div key={idx} className="bg-slate-800/50 rounded p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {issue.severity === 'critical' ? 'Critical' : 'Warning'}
                                            </span>
                                            <h4 className="text-white font-medium text-sm">{issue.title}</h4>
                                        </div>
                                        <p className="text-slate-400 text-xs">{issue.message}</p>
                                        {issue.cause && <p className="text-slate-500 text-xs mt-1"><span className="text-slate-400">Cause:</span> {issue.cause}</p>}
                                        {issue.fix && <p className="text-green-400 text-xs mt-1"><span className="text-green-500">Fix:</span> {issue.fix}</p>}
                                    </div>
                                    {issue.fixType && (
                                        <button onClick={() => openFixPanel(issue.fixType)} className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${issue.severity === 'critical' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900'}`}>
                                            🔧 Fix
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fix Panel */}
            {fixPanelOpen && (
                <div className="mb-3 p-3 sm:p-4 bg-slate-800 border-2 border-yellow-500 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <h3 className="text-yellow-400 font-bold text-sm sm:text-base truncate">🔧 Fix: {issues[0]?.title || 'Improve Health'}</h3>
                        <button onClick={() => setFixPanelOpen(null)} className="text-slate-400 hover:text-white text-lg flex-shrink-0">✕</button>
                    </div>

                    {/* RECOMMENDATION ENGINE */}
                    {!fixPanelData.showCustomize && (() => {
                        const deficit = Math.abs(financial.trueAvailable)
                        const dailyCostPerDay = financial.dailyTokensAwarded * tokenEconomy.tokenValue
                        const monthlyDailyCost = dailyCostPerDay * 30
                        const tokenLiab = tokenEconomy.circulationValue
                        const cashPrizes = weeklyPrizes.filter(p => p.prize_type === 'cash').reduce((s, p) => s + (p.total_prize_pool || 0), 0)

                        const neededSavings = deficit * 1.1
                        const awardReductionPct = Math.min(90, Math.ceil((neededSavings / monthlyDailyCost) * 100))
                        const awardSavings = monthlyDailyCost * (awardReductionPct / 100)

                        const valueReductionPct = Math.min(50, Math.ceil((neededSavings / tokenLiab) * 100))
                        const valueSavings = tokenLiab * (valueReductionPct / 100)

                        let recommendation = 'awards'
                        let recPct = awardReductionPct
                        let recSavings = awardSavings
                        let reasoning = []
                        let rejected = []

                        if (monthlyDailyCost === 0) {
                            recommendation = 'tokenValue'
                            recPct = valueReductionPct
                            recSavings = valueSavings
                            reasoning.push('No daily awards to reduce')
                        } else if (awardReductionPct <= 75) {
                            recommendation = 'awards'
                            recPct = awardReductionPct
                            recSavings = awardSavings
                            reasoning.push(`Daily awards cost ${formatCurrency(monthlyDailyCost)}/mo - your biggest controllable expense`)
                            reasoning.push(`${recPct}% reduction is reasonable and covers the deficit`)
                            reasoning.push(`Doesn't devalue tokens users already earned`)
                            rejected.push({ name: 'Token Value', reason: 'Not needed - award reduction alone is sufficient' })
                            rejected.push({ name: 'Prize Reduction', reason: cashPrizes === 0 ? 'No active cash prizes to reduce' : 'Award reduction is less impactful to users' })
                        } else if (awardReductionPct <= 90) {
                            recommendation = 'awards'
                            recPct = awardReductionPct
                            recSavings = awardSavings
                            reasoning.push(`Significant reduction needed (${recPct}%) but still better than devaluing tokens`)
                            reasoning.push(`Consider adding token sinks long-term to reduce liability`)
                            rejected.push({ name: 'Token Value', reason: 'Would hurt user trust - use only as last resort' })
                        } else {
                            recommendation = 'combo'
                            recPct = 75
                            recSavings = monthlyDailyCost * 0.75 + tokenLiab * 0.15
                            reasoning.push(`Deficit too large for award reduction alone`)
                            reasoning.push(`Combining 75% award cut + 15% token value reduction spreads the impact`)
                            reasoning.push(`This is a significant change - consider if revenue can be increased instead`)
                        }

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
                            <div className="mb-4">
                                <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-3 sm:p-4 mb-4 overflow-hidden">
                                    <div className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-xl sm:text-2xl flex-shrink-0">🎯</span>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <h4 className="text-green-400 font-bold text-sm sm:text-base mb-1">MY RECOMMENDATION</h4>
                                            <p className="text-white font-medium text-xs sm:text-sm break-words">
                                                {recommendation === 'awards' && `Reduce daily token awards by ${recPct}%`}
                                                {recommendation === 'tokenValue' && `Reduce token value by ${recPct}%`}
                                                {recommendation === 'combo' && `75% award cut + 15% token value reduction`}
                                            </p>
                                        </div>
                                    </div>

                                    {recommendation === 'awards' && gameChanges.length > 0 && (
                                        <div className="mt-3 bg-slate-800/50 rounded p-3">
                                            <p className="text-slate-400 text-xs mb-2 font-medium">Specific changes:</p>
                                            <div className="space-y-1">
                                                {gameChanges.map((g, i) => (
                                                    <div key={i} className="text-xs flex flex-wrap gap-1">
                                                        <span className="text-slate-400 capitalize">{g.name}:</span>
                                                        <span className="text-red-400">{g.old}</span>
                                                        <span className="text-slate-500">→</span>
                                                        <span className="text-green-400">{g.new}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-700/30 rounded-lg p-3 mb-3">
                                    <h5 className="text-blue-400 font-medium text-sm mb-2">💡 WHY THIS CHOICE:</h5>
                                    <ul className="space-y-1">
                                        {reasoning.map((r, i) => (
                                            <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                                                <span className="text-green-400">•</span> {r}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {rejected.length > 0 && (
                                    <div className="bg-slate-700/30 rounded-lg p-3 mb-3">
                                        <h5 className="text-slate-400 font-medium text-sm mb-2">🚫 WHY NOT OTHER OPTIONS:</h5>
                                        <ul className="space-y-1">
                                            {rejected.map((r, i) => (
                                                <li key={i} className="text-slate-400 text-xs flex items-start gap-2">
                                                    <span className="text-slate-500">•</span>
                                                    <span><span className="text-slate-300">{r.name}:</span> {r.reason}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className={`rounded-lg p-3 mb-4 ${newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
                                    <h5 className="text-white font-medium text-sm mb-2">📊 EXPECTED RESULT:</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-slate-400 text-xs">Health Score</p>
                                            <p className="font-bold text-sm">
                                                <span className="text-red-400">{healthScores.overall}</span>
                                                <span className="text-slate-500 mx-1">→</span>
                                                <span className="text-green-400">{newScore}</span>
                                                <span className="text-green-400 text-xs ml-1">(+{newScore - healthScores.overall})</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">True Available</p>
                                            <p className="font-bold text-sm">
                                                <span className="text-red-400">{formatCurrency(financial.trueAvailable)}</span>
                                                <span className="text-slate-500 mx-1">→</span>
                                                <span className={newTrueAvailable >= 0 ? 'text-green-400' : 'text-yellow-400'}>{formatCurrency(newTrueAvailable)}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Monthly Savings</p>
                                            <p className="text-green-400 font-bold text-sm">{formatCurrency(recSavings)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={() => {
                                            const mult = 1 - (recPct / 100)
                                            const newConfigs = dailyConfig.map(c => ({
                                                ...c,
                                                new_first: Math.round(c.first_tokens * mult),
                                                new_second: Math.round(c.second_tokens * mult),
                                                new_third: Math.round(c.third_tokens * mult)
                                            }))
                                            applyDailyTokenChanges(newConfigs)
                                        }}
                                        disabled={applying}
                                        className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-slate-600 text-white rounded text-sm font-medium"
                                    >
                                        {applying ? 'Applying...' : '✅ Apply Recommendation'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const mult = 1 - (recPct / 100)
                                            const newConfigs = dailyConfig.map(c => ({
                                                ...c,
                                                new_first: Math.round(c.first_tokens * mult),
                                                new_second: Math.round(c.second_tokens * mult),
                                                new_third: Math.round(c.third_tokens * mult)
                                            }))
                                            setFixPanelData(prev => ({ ...prev, showCustomize: true, configs: newConfigs, activeTab: 'awards' }))
                                        }}
                                        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded text-sm font-medium"
                                    >
                                        ✏️ Customize
                                    </button>
                                    <button
                                        onClick={() => setFixPanelOpen(null)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium"
                                    >
                                        ❌ Reject
                                    </button>
                                </div>

                                <p className="text-slate-500 text-xs mt-3 text-center">
                                    💡 "Customize" lets you adjust the numbers before applying
                                </p>
                            </div>
                        )
                    })()}

                    {fixPanelData.showCustomize && (
                        <>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 mb-4">
                                <p className="text-blue-400 text-xs">
                                    ✏️ <strong>Customize Mode</strong> - Adjust the values below, then apply when ready.
                                    <button onClick={() => setFixPanelData(prev => ({ ...prev, showCustomize: false }))} className="ml-2 text-blue-300 underline">← Back to recommendation</button>
                                </p>
                            </div>

                            <div className="flex gap-1 mb-4 border-b border-slate-700">
                                {['awards', 'tokenValue', 'prizes', 'combo'].map(tab => (
                                    <button key={tab} onClick={() => setFixPanelData(prev => ({ ...prev, activeTab: tab }))}
                                        className={`px-3 py-2 text-xs font-medium rounded-t ${fixPanelData.activeTab === tab ? 'bg-slate-700 text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`}>
                                        {tab === 'awards' && '🎮 Daily Awards'}
                                        {tab === 'tokenValue' && '💰 Token Value'}
                                        {tab === 'prizes' && '🏆 Prizes'}
                                        {tab === 'combo' && '🔀 Combo'}
                                    </button>
                                ))}
                            </div>

                            {fixPanelData.activeTab === 'awards' && (
                                <div>
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mb-4">
                                        <h4 className="text-blue-400 font-medium text-sm mb-1">📚 When to use:</h4>
                                        <p className="text-slate-300 text-xs mb-2">Best when <span className="text-white font-medium">issuing too many tokens</span> relative to revenue. Safest first step - doesn't affect tokens users already have.</p>
                                        <div className="flex gap-4 text-xs">
                                            <div><span className="text-green-400">✓</span> <span className="text-slate-400">Doesn't devalue existing tokens</span></div>
                                            <div><span className="text-red-400">✗</span> <span className="text-slate-400">Takes time to see results</span></div>
                                        </div>
                                    </div>

                                    {impact && (
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                                <p className="text-slate-400 text-[10px]">Current</p>
                                                <p className="text-red-400 font-bold">{formatCurrency(impact.currentMonthlyCost)}/mo</p>
                                                <p className="text-slate-500 text-[10px]">{impact.currentDaily} tokens/day</p>
                                            </div>
                                            <div className="bg-slate-700/50 rounded p-2 text-center">
                                                <p className="text-slate-400 text-[10px]">New</p>
                                                <p className="text-green-400 font-bold">{formatCurrency(impact.newMonthlyCost)}/mo</p>
                                                <p className="text-slate-500 text-[10px]">{impact.newDaily} tokens/day</p>
                                            </div>
                                            <div className={`rounded p-2 text-center ${impact.savings > 0 ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
                                                <p className="text-slate-400 text-[10px]">Savings</p>
                                                <p className={`font-bold ${impact.savings > 0 ? 'text-green-400' : 'text-slate-400'}`}>{formatCurrency(impact.savings)}</p>
                                                <p className="text-slate-500 text-[10px]">{impact.reductionPercent}% cut</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 mb-4">
                                        {fixPanelData.configs?.map((config, idx) => (
                                            <div key={config.id} className="bg-slate-700/30 rounded p-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-medium text-xs capitalize">{config.game_key.replace(/_/g, ' ')}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${config.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{config.is_enabled ? 'On' : 'Off'}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['first', 'second', 'third'].map((place, i) => (
                                                        <div key={place}>
                                                            <label className="text-slate-400 text-[10px]">{['1st', '2nd', '3rd'][i]}</label>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-slate-500 text-[10px]">{config[`${place}_tokens`]}→</span>
                                                                <input type="number" value={config[`new_${place}`]} onChange={(e) => updateFixConfig(idx, `new_${place}`, e.target.value)}
                                                                    className="w-12 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 mb-4">
                                        <span className="text-slate-400 text-xs py-1">Quick:</span>
                                        {[25, 50, 75].map(pct => (
                                            <button key={pct} onClick={() => {
                                                const mult = 1 - (pct / 100)
                                                setFixPanelData(prev => ({ ...prev, configs: prev.configs.map(c => ({ ...c, new_first: Math.round(c.first_tokens * mult), new_second: Math.round(c.second_tokens * mult), new_third: Math.round(c.third_tokens * mult) })) }))
                                            }} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">-{pct}%</button>
                                        ))}
                                        <button onClick={() => setFixPanelData(prev => ({ ...prev, configs: prev.configs.map(c => ({ ...c, new_first: c.first_tokens, new_second: c.second_tokens, new_third: c.third_tokens })) }))} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded text-xs">Reset</button>
                                    </div>

                                    {impact && <ImpactPreview impact={impact} />}
                                    <ActionButtons onApply={applyDailyTokenChanges} onSaveLater={() => addToActionQueue({ type: 'dailyTokens', title: 'Reduce Daily Awards', description: `Save ${formatCurrency(impact?.savings || 0)}/mo` })} onCancel={() => setFixPanelOpen(null)} applying={applying} disabled={impact?.savings === 0} />
                                </div>
                            )}

                            {fixPanelData.activeTab === 'tokenValue' && (
                                <div>
                                    <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3 mb-4">
                                        <h4 className="text-purple-400 font-medium text-sm mb-1">📚 When to use:</h4>
                                        <p className="text-slate-300 text-xs mb-2"><span className="text-white font-medium">Last resort</span> when circulation is high and can't reduce quickly. Instantly reduces liability but <span className="text-red-400">devalues tokens users earned</span>.</p>
                                        <div className="flex gap-4 text-xs">
                                            <div><span className="text-green-400">✓</span> <span className="text-slate-400">Instant liability reduction</span></div>
                                            <div><span className="text-red-400">✗</span> <span className="text-slate-400">Users feel cheated, hurts trust</span></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-slate-700/50 rounded p-2 text-center">
                                            <p className="text-slate-400 text-[10px]">Current Value</p>
                                            <p className="text-yellow-400 font-bold">{formatCurrency(tokenEconomy.tokenValue)}</p>
                                        </div>
                                        <div className="bg-slate-700/50 rounded p-2 text-center">
                                            <p className="text-slate-400 text-[10px]">Circulation</p>
                                            <p className="text-white font-bold">{formatNumber(tokenEconomy.totalCirculation)}</p>
                                        </div>
                                        <div className="bg-slate-700/50 rounded p-2 text-center">
                                            <p className="text-slate-400 text-[10px]">Liability</p>
                                            <p className="text-red-400 font-bold">{formatCurrency(tokenEconomy.circulationValue)}</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-700/30 rounded p-3 mb-4">
                                        <label className="text-slate-300 text-sm font-medium">New Token Value</label>
                                        <div className="flex items-center gap-4 mt-2">
                                            <input type="range" min="0.01" max="0.10" step="0.01" value={fixPanelData.newTokenValue || tokenEconomy.tokenValue}
                                                onChange={(e) => setFixPanelData(prev => ({ ...prev, newTokenValue: parseFloat(e.target.value) }))} className="flex-1" />
                                            <span className="text-yellow-400 font-bold text-lg w-16 text-right">{formatCurrency(fixPanelData.newTokenValue || tokenEconomy.tokenValue)}</span>
                                        </div>
                                    </div>

                                    {(() => {
                                        const newValue = fixPanelData.newTokenValue || tokenEconomy.tokenValue
                                        const currentLiability = tokenEconomy.circulationValue
                                        const newLiability = tokenEconomy.totalCirculation * newValue
                                        const savingsFromValue = currentLiability - newLiability
                                        const newTrueAvailable = financial.trueAvailable + savingsFromValue
                                        const pctChange = ((1 - newValue / tokenEconomy.tokenValue) * 100).toFixed(0)

                                        return (
                                            <>
                                                <div className={`p-3 rounded-lg mb-4 ${newTrueAvailable >= 0 ? 'bg-green-500/10 border border-green-500' : 'bg-yellow-500/10 border border-yellow-500'}`}>
                                                    <h4 className="text-white font-medium text-sm mb-2">📊 Impact Preview</h4>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-slate-400 text-xs">Liability Change</p>
                                                            <p className="font-bold"><span className="text-red-400">{formatCurrency(currentLiability)}</span> → <span className="text-green-400">{formatCurrency(newLiability)}</span></p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-400 text-xs">Instant Savings</p>
                                                            <p className={`font-bold ${savingsFromValue > 0 ? 'text-green-400' : 'text-slate-400'}`}>{formatCurrency(savingsFromValue)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-400 text-xs">User Impact</p>
                                                            <p className="text-red-400 font-bold text-xs">Tokens worth {pctChange}% less</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-400 text-xs">New True Available</p>
                                                            <p className={`font-bold ${newTrueAvailable >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>{formatCurrency(newTrueAvailable)}</p>
                                                        </div>
                                                    </div>
                                                    {newValue < tokenEconomy.tokenValue && (
                                                        <div className="mt-3 p-2 bg-red-500/20 rounded">
                                                            <p className="text-red-300 text-xs">⚠️ Reducing token value affects user trust. Consider reducing daily awards first.</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <ActionButtons onApply={applyTokenValueChange} onSaveLater={() => addToActionQueue({ type: 'tokenValue', title: 'Change Token Value', description: `${formatCurrency(tokenEconomy.tokenValue)} → ${formatCurrency(fixPanelData.newTokenValue)}` })} onCancel={() => setFixPanelOpen(null)} applying={applying} disabled={fixPanelData.newTokenValue === tokenEconomy.tokenValue} warning={fixPanelData.newTokenValue < tokenEconomy.tokenValue} />
                                            </>
                                        )
                                    })()}
                                </div>
                            )}

                            {fixPanelData.activeTab === 'prizes' && (
                                <div>
                                    <div className="bg-green-500/10 border border-green-500/30 rounded p-3 mb-4">
                                        <h4 className="text-green-400 font-medium text-sm mb-1">📚 When to use:</h4>
                                        <p className="text-slate-300 text-xs mb-2">When <span className="text-white font-medium">cash prizes</span> eat into profits. Reduce amounts or switch to token prizes.</p>
                                        <div className="flex gap-4 text-xs">
                                            <div><span className="text-green-400">✓</span> <span className="text-slate-400">Direct cost reduction</span></div>
                                            <div><span className="text-red-400">✗</span> <span className="text-slate-400">May reduce player motivation</span></div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-700/30 rounded p-4 mb-4 text-center">
                                        {weeklyPrizes.filter(p => p.prize_type === 'cash').length === 0 ? (
                                            <div><p className="text-green-400 font-medium">✅ No Active Cash Prizes</p><p className="text-slate-400 text-xs mt-1">Not contributing to deficit.</p></div>
                                        ) : (
                                            <div>
                                                <p className="text-yellow-400 font-medium">{weeklyPrizes.filter(p => p.prize_type === 'cash').length} Active Cash Prize(s)</p>
                                                <p className="text-red-400 text-lg font-bold mt-1">{formatCurrency(weeklyPrizes.filter(p => p.prize_type === 'cash').reduce((sum, p) => sum + (p.total_prize_pool || 0), 0))} total</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-center">
                                        <p className="text-slate-400 text-xs mb-3">Prize configuration is complex - manage in dedicated admin.</p>
                                        <Link href="/admin/prizes" className="inline-block px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded text-sm font-medium">🏆 Prize Management →</Link>
                                    </div>
                                </div>
                            )}

                            {fixPanelData.activeTab === 'combo' && (
                                <div>
                                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 mb-4">
                                        <h4 className="text-orange-400 font-medium text-sm mb-1">📚 When to use:</h4>
                                        <p className="text-slate-300 text-xs mb-2">When no single change is enough, or to <span className="text-white font-medium">spread impact</span> so no single change feels drastic.</p>
                                        <div className="flex gap-4 text-xs">
                                            <div><span className="text-green-400">✓</span> <span className="text-slate-400">Balanced, less noticeable</span></div>
                                            <div><span className="text-red-400">✗</span> <span className="text-slate-400">More complex</span></div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-700/30 rounded p-4 mb-4">
                                        <h4 className="text-white font-medium text-sm mb-3">🎯 Recommended for Your Situation</h4>
                                        {(() => {
                                            const deficit = Math.abs(financial.trueAvailable)
                                            const awardSavings = (financial.dailyTokensAwarded * tokenEconomy.tokenValue * 30) * 0.5
                                            const valueSavings = tokenEconomy.circulationValue * 0.2
                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                                                        <div><p className="text-white text-sm">1. Reduce daily awards 50%</p><p className="text-slate-400 text-xs">Saves {formatCurrency(awardSavings)}/mo</p></div>
                                                        <span className="text-green-400 text-sm font-medium">Primary</span>
                                                    </div>
                                                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                                                        <div><p className="text-white text-sm">2. Reduce token value 20%</p><p className="text-slate-400 text-xs">Saves {formatCurrency(valueSavings)} instantly</p></div>
                                                        <span className="text-yellow-400 text-sm font-medium">If needed</span>
                                                    </div>
                                                    <div className="border-t border-slate-700 pt-3">
                                                        <div className="flex justify-between"><span className="text-slate-400">Deficit:</span><span className="text-red-400 font-medium">{formatCurrency(deficit)}</span></div>
                                                        <div className="flex justify-between"><span className="text-slate-400">Combined savings:</span><span className="text-green-400 font-medium">{formatCurrency(awardSavings + valueSavings)}</span></div>
                                                        <div className="flex justify-between mt-1"><span className="text-white font-medium">Result:</span><span className={awardSavings + valueSavings >= deficit ? 'text-green-400' : 'text-yellow-400'}>{awardSavings + valueSavings >= deficit ? '✅ Covered!' : '⚠️ May need more'}</span></div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    <div className="space-y-2">
                                        <button onClick={() => { setFixPanelData(prev => ({ ...prev, activeTab: 'awards', configs: prev.configs.map(c => ({ ...c, new_first: Math.round(c.first_tokens * 0.5), new_second: Math.round(c.second_tokens * 0.5), new_third: Math.round(c.third_tokens * 0.5) })) })) }}
                                            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded text-sm font-medium">🎮 Start with Daily Awards</button>
                                        <button onClick={() => setFixPanelData(prev => ({ ...prev, activeTab: 'tokenValue', newTokenValue: tokenEconomy.tokenValue * 0.8 }))}
                                            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium">💰 Then Token Value (If Needed)</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Financial Breakdown */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'financial' ? null : 'financial')} className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <div className="text-left"><h3 className="text-white font-bold text-sm">Financial Breakdown</h3><p className="text-slate-400 text-xs">Revenue → Costs → Obligations → Profit</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-slate-400 text-[10px]">True Available</p>
                            <p className={`text-lg font-bold ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(financial.trueAvailable)}</p>
                        </div>
                        <span className={`text-slate-400 text-xs ${expandedSection === 'financial' ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {expandedSection === 'financial' && (
                    <div className="p-3 border-t border-slate-700 grid grid-cols-4 gap-2">
                        <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                            <h4 className="text-green-400 font-bold text-xs mb-2">📈 Revenue</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400">Campaigns</span><span className="text-green-400">{formatCurrency(financial.grossRevenue)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Fees</span><span className="text-red-400">-{formatCurrency(financial.processingFees)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1"><span className="text-white">Net</span><span className="text-white">{formatCurrency(financial.netRevenue)}</span></div>
                            </div>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                            <h4 className="text-orange-400 font-bold text-xs mb-2">🏢 Hard Costs</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400">Recurring</span><span className="text-red-400">-{formatCurrency(financial.recurringExpenses)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">One-Time</span><span className="text-red-400">-{formatCurrency(financial.oneTimeExpenses)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1"><span className="text-white">Total</span><span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span></div>
                            </div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                            <h4 className="text-red-400 font-bold text-xs mb-2">⚠️ Obligations</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400">Token Liability</span><span className="text-red-400">-{formatCurrency(financial.tokenLiability)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Daily Awards</span><span className="text-red-400">-{formatCurrency(financial.dailyTokenCost)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Payouts/Prizes</span><span className="text-red-400">-{formatCurrency(financial.pendingPayouts + financial.weeklyPrizesDue)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1"><span className="text-white">Total</span><span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span></div>
                            </div>
                        </div>
                        <div className={`p-2 rounded border ${financial.trueAvailable >= 0 ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                            <h4 className={`font-bold text-xs mb-2 ${financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}`}>💵 True Profit</h4>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400">Net Revenue</span><span className="text-white">{formatCurrency(financial.netRevenue)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Hard Costs</span><span className="text-red-400">-{formatCurrency(financial.totalHardCosts)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Obligations</span><span className="text-red-400">-{formatCurrency(financial.totalObligations)}</span></div>
                                <div className="flex justify-between font-bold border-t border-slate-600 pt-1 text-sm"><span className="text-white">AVAILABLE</span><span className={financial.trueAvailable >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(financial.trueAvailable)}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Token Economy */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'tokens' ? null : 'tokens')} className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🪙</span>
                        <div className="text-left"><h3 className="text-white font-bold text-sm">Token Economy</h3><p className="text-slate-400 text-xs">Circulation, burn rate, liability</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right"><p className="text-slate-400 text-[10px]">Liability</p><p className="text-yellow-400 text-lg font-bold">{formatCurrency(tokenEconomy.circulationValue)}</p></div>
                        <span className={`text-slate-400 text-xs ${expandedSection === 'tokens' ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {expandedSection === 'tokens' && (
                    <div className="p-3 border-t border-slate-700">
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-3">
                            {[['Token Value', formatCurrency(tokenEconomy.tokenValue), 'text-yellow-400'], ['Circulation', formatNumber(tokenEconomy.totalCirculation), 'text-white'], ['Issued', formatNumber(tokenEconomy.totalIssued), 'text-green-400'], ['Burned', formatNumber(tokenEconomy.totalBurned), 'text-red-400'], ['Burn Rate', `${tokenEconomy.burnRate.toFixed(1)}%`, tokenEconomy.burnRate >= 30 ? 'text-green-400' : 'text-yellow-400'], ['Users', formatNumber(tokenEconomy.usersWithBalance), 'text-white'], ['Avg Bal', formatNumber(tokenEconomy.avgBalance), 'text-white'], ['Avg Value', formatCurrency(tokenEconomy.avgBalance * tokenEconomy.tokenValue), 'text-white']].map(([label, value, color], i) => (
                                <div key={i} className="bg-slate-700/50 rounded p-2 text-center"><p className="text-slate-400 text-[10px]">{label}</p><p className={`font-bold text-sm ${color}`}>{value}</p></div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Link href="/admin/economy" className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded text-xs font-medium">Economy →</Link>
                            <Link href="/admin/game-settings" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium">Games →</Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Monthly Expenses */}
            <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')} className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🏢</span>
                        <div className="text-left"><h3 className="text-white font-bold text-sm">Monthly Fixed Costs</h3><p className="text-slate-400 text-xs">Software and recurring</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right"><p className="text-slate-400 text-[10px]">Monthly</p><p className="text-red-400 text-lg font-bold">{formatCurrency(expenses.monthlyTotal)}</p></div>
                        <span className={`text-slate-400 text-xs ${expandedSection === 'expenses' ? 'rotate-180' : ''}`}>▼</span>
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
                        <Link href="/admin/accounting" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium">Manage →</Link>
                    </div>
                )}
            </div>

            {/* Quick Links */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">🔗 Quick Actions</h3>
                    <div className="flex gap-2">
                        {[['💰', 'Accounting', '/admin/accounting'], ['🪙', 'Economy', '/admin/economy'], ['🏆', 'Prizes', '/admin/prizes'], ['🎮', 'Games', '/admin/game-settings']].map(([icon, label, href]) => (
                            <Link key={label} href={href} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white">{icon} {label}</Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Changes History */}
            <div className="mt-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-700/50"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📜</span>
                        <div className="text-left">
                            <h3 className="text-white font-bold text-sm">Recent Changes</h3>
                            <p className="text-slate-400 text-xs">History of adjustments made from this dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm">{recentChanges.length} entries</span>
                        <span className={`text-slate-400 text-xs transition-transform ${showHistory ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                {showHistory && (
                    <div className="p-3 border-t border-slate-700">
                        {recentChanges.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-4">No changes recorded yet</p>
                        ) : (
                            <div className="space-y-2">
                                {recentChanges.map((change) => (
                                    <div key={change.id} className="bg-slate-700/30 rounded p-2 flex items-start gap-2">
                                        <span className="text-lg">{getChangeIcon(change.action)}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white text-sm font-medium truncate">
                                                    {change.description || change.action.replace(/_/g, ' ')}
                                                </p>
                                                <span className="text-slate-500 text-xs whitespace-nowrap">
                                                    {formatChangeDate(change.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-xs truncate">{change.user_email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-3 text-center">
                            <Link href="/admin/audit-log" className="text-yellow-400 hover:text-yellow-300 text-xs">
                                View Full Audit Log →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}