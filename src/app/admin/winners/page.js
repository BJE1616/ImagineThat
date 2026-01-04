'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminWinnersPage() {
    const { currentTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('slots')

    // ===== MATCH GAME STATE =====
    const [leaderboard, setLeaderboard] = useState([])
    const [payments, setPayments] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [weekOffset, setWeekOffset] = useState(0)
    const [currentWeek, setCurrentWeek] = useState('')

    // ===== SLOTS DRAWING STATE =====
    const [slotsPrize, setSlotsPrize] = useState(null)
    const [slotsEntries, setSlotsEntries] = useState([])
    const [slotsLoading, setSlotsLoading] = useState(true)
    const [selectedWinner, setSelectedWinner] = useState(null)
    const [announcing, setAnnouncing] = useState(false)
    const [message, setMessage] = useState(null)

    // ===== VERIFICATION STATE =====
    const [verificationData, setVerificationData] = useState(null)
    const [verificationLoading, setVerificationLoading] = useState(false)
    const [verificationStep, setVerificationStep] = useState('pick')

    // ===== PAYOUT STATE =====
    const [payoutStatus, setPayoutStatus] = useState(null)
    const [payoutNotes, setPayoutNotes] = useState('')
    const [savingPayout, setSavingPayout] = useState(false)

    // ===== EMAIL MODAL STATE =====
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)

    // ===== MARK AS NOTIFIED STATE =====
    const [showNotifiedModal, setShowNotifiedModal] = useState(false)
    const [notificationNote, setNotificationNote] = useState('')
    const [savingNotified, setSavingNotified] = useState(false)

    // ===== ARCHIVE STATE =====
    const [archive, setArchive] = useState([])
    const [archiveLoading, setArchiveLoading] = useState(true)
    const [expandedWeek, setExpandedWeek] = useState(null)
    const [archiveStats, setArchiveStats] = useState({
        totalWeeks: 0,
        totalGames: 0,
        totalPrizesPaid: 0,
        uniqueWinners: 0
    })

    // ===== PUBLIC BOARD STATE =====
    const [publicWinners, setPublicWinners] = useState([])
    const [boardLoading, setBoardLoading] = useState(true)
    const [showWinnersPage, setShowWinnersPage] = useState(true)
    const [savingVisibility, setSavingVisibility] = useState(false)
    const [filterGameType, setFilterGameType] = useState('all')
    const [filterVisibility, setFilterVisibility] = useState('all')
    const [filterFeatured, setFilterFeatured] = useState('all')
    const [editingWinner, setEditingWinner] = useState(null)
    const [editDisplayName, setEditDisplayName] = useState('')
    const [editDisplayText, setEditDisplayText] = useState('')
    const [editAdminNotes, setEditAdminNotes] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newWinner, setNewWinner] = useState({
        display_name: '',
        display_text: '',
        prize_type: 'cash',
        prize_value: '',
        game_type: 'manual',
        week_start: new Date().toISOString().split('T')[0],
        admin_notes: ''
    })

    useEffect(() => {
        if (activeTab === 'match') {
            loadWeekData()
        } else if (activeTab === 'slots') {
            loadSlotsDrawing()
        } else if (activeTab === 'archive') {
            loadArchive()
        } else if (activeTab === 'board') {
            loadPublicWinners()
            loadVisibilitySetting()
        }
    }, [weekOffset, activeTab])

    // ===== SHARED HELPERS =====
    const getWeekStart = (offset = 0) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - dayOfWeek - (offset * 7))
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
    }

    const formatWeekRange = (weekStart) => {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }

    // ===== MATCH GAME FUNCTIONS =====
    const loadWeekData = async () => {
        setLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStartStr)
                .order('score', { ascending: true })
                .limit(20)

            if (leaderboardError) throw leaderboardError

            if (leaderboardData && leaderboardData.length > 0) {
                const userIds = leaderboardData.map(entry => entry.user_id)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const combined = leaderboardData.map(entry => ({
                    ...entry,
                    user: usersData?.find(u => u.id === entry.user_id) || { username: 'Unknown', email: '' }
                }))

                setLeaderboard(combined)

                const { data: queuedData } = await supabase
                    .from('payout_queue')
                    .select('reference_id')
                    .eq('reference_type', 'match_game')
                    .in('reference_id', leaderboardData.map(e => e.id))

                const { data: paidData } = await supabase
                    .from('payout_history')
                    .select('reference_id')
                    .eq('reference_type', 'match_game')
                    .in('reference_id', leaderboardData.map(e => e.id))

                const paymentsMap = {}
                queuedData?.forEach(p => { paymentsMap[p.reference_id] = { status: 'queued' } })
                paidData?.forEach(p => { paymentsMap[p.reference_id] = { status: 'paid' } })
                setPayments(paymentsMap)
            } else {
                setLeaderboard([])
                setPayments({})
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const addToPayoutQueue = async (entry, rank) => {
        setSaving(entry.id)
        const weekStartStr = getWeekStart(weekOffset).toISOString().split('T')[0]
        const prizeAmount = getPrizeAmount(rank)

        try {
            const existingStatus = payments[entry.id]
            if (existingStatus) {
                setMessage({ type: 'error', text: 'Already in queue or paid' })
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('username, preferred_payment_method, payment_handle')
                .eq('id', entry.user_id)
                .single()

            const { data: existingQueue } = await supabase
                .from('payout_queue')
                .select('id')
                .eq('reference_type', 'match_game')
                .eq('reference_id', entry.id)
                .single()

            if (existingQueue) {
                setMessage({ type: 'error', text: 'Already in payout queue' })
                return
            }

            await supabase
                .from('payout_queue')
                .insert([{
                    user_id: entry.user_id,
                    amount: prizeAmount,
                    reason: `Match Game #${rank} - ${currentWeek}`,
                    reference_type: 'match_game',
                    reference_id: entry.id,
                    payment_method: userData?.preferred_payment_method || null,
                    payment_handle: userData?.payment_handle || null,
                    status: 'pending',
                    queued_at: new Date().toISOString()
                }])

            setPayments(prev => ({ ...prev, [entry.id]: { status: 'queued' } }))

            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'match_winner_queued',
                table_name: 'payout_queue',
                record_id: entry.id,
                new_value: { username: userData?.username, rank, amount: prizeAmount },
                description: `Added ${userData?.username} (#${rank}) to payout queue for $${prizeAmount}`
            }])

            setMessage({ type: 'success', text: `Added ${userData?.username} to payout queue!` })
        } catch (error) {
            console.error('Error adding to queue:', error)
            setMessage({ type: 'error', text: 'Failed to add to queue' })
        } finally {
            setSaving(null)
        }
    }

    const getPrizeAmount = (rank) => {
        const prizes = { 1: 100, 2: 75, 3: 50, 4: 25, 5: 25 }
        return prizes[rank] || 0
    }

    const getRankBadge = (rank) => {
        if (rank === 1) return { emoji: '🥇', color: `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` }
        if (rank === 2) return { emoji: '🥈', color: 'bg-slate-400 text-slate-900' }
        if (rank === 3) return { emoji: '🥉', color: 'bg-amber-700 text-white' }
        return { emoji: rank.toString(), color: `bg-${currentTheme.border} text-${currentTheme.textMuted}` }
    }

    // ===== SLOTS DRAWING FUNCTIONS =====
    const loadSlotsDrawing = async () => {
        setSlotsLoading(true)
        try {
            const weekStart = getWeekStart(weekOffset)
            const weekStartStr = weekStart.toISOString().split('T')[0]
            setCurrentWeek(formatWeekRange(weekStart))

            const { data: prizeData } = await supabase
                .from('weekly_prizes')
                .select('*')
                .eq('game_type', 'slots')
                .eq('week_start', weekStartStr)
                .single()

            setSlotsPrize(prizeData || null)

            if (prizeData?.winner_user_id) {
                setVerificationStep('confirmed')
                await loadPayoutStatus(prizeData.id)
                await loadVerificationData(prizeData.winner_user_id)
            } else {
                setVerificationStep('pick')
                setSelectedWinner(null)
                setVerificationData(null)
            }

            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            const weekEndStr = weekEnd.toISOString().split('T')[0]

            const { data: entriesData } = await supabase
                .from('user_daily_spins')
                .select('user_id, drawing_entries, spin_date')
                .gte('spin_date', weekStartStr)
                .lte('spin_date', weekEndStr)
                .gt('drawing_entries', 0)

            if (entriesData && entriesData.length > 0) {
                const userEntries = {}
                entriesData.forEach(e => {
                    if (!userEntries[e.user_id]) userEntries[e.user_id] = 0
                    userEntries[e.user_id] += e.drawing_entries || 0
                })

                const userIds = Object.keys(userEntries)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name')
                    .in('id', userIds)

                const entriesList = Object.entries(userEntries).map(([userId, entries]) => ({
                    user_id: userId,
                    entries: entries,
                    user: usersData?.find(u => u.id === userId) || { username: 'Unknown', email: '' }
                })).sort((a, b) => b.entries - a.entries)

                setSlotsEntries(entriesList)
            } else {
                setSlotsEntries([])
            }
        } catch (error) {
            console.error('Error loading slots drawing:', error)
        } finally {
            setSlotsLoading(false)
        }
    }

    const loadVerificationData = async (userId) => {
        setVerificationLoading(true)
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('id, username, email, first_name, last_name, created_at, payout_method, payout_handle')
                .eq('id', userId)
                .single()

            const { data: balanceData } = await supabase
                .from('bb_balances')
                .select('balance, lifetime_earned')
                .eq('user_id', userId)
                .single()

            const { data: spinsData } = await supabase
                .from('user_daily_spins')
                .select('free_spins_used, paid_spins')
                .eq('user_id', userId)

            const totalSpins = spinsData?.reduce((sum, day) => sum + (day.free_spins_used || 0) + (day.paid_spins || 0), 0) || 0

            const { data: ipLogs } = await supabase
                .from('user_ip_logs')
                .select('ip_address, city, region, country, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)

            const userIps = [...new Set(ipLogs?.map(log => log.ip_address) || [])]
            let fraudFlags = []

            if (userIps.length > 0) {
                const { data: sharedIpAccounts } = await supabase
                    .from('user_ip_logs')
                    .select('user_id, ip_address')
                    .in('ip_address', userIps)
                    .neq('user_id', userId)

                if (sharedIpAccounts && sharedIpAccounts.length > 0) {
                    const sharedUserIds = [...new Set(sharedIpAccounts.map(a => a.user_id))]
                    const { data: sharedUsers } = await supabase
                        .from('users')
                        .select('id, username, email')
                        .in('id', sharedUserIds)

                    fraudFlags = sharedUsers?.map(u => ({
                        type: 'shared_ip',
                        message: `Shares IP with: ${u.username} (${u.email})`,
                        severity: 'warning'
                    })) || []
                }
            }

            const accountAge = userData?.created_at
                ? Math.floor((new Date() - new Date(userData.created_at)) / (1000 * 60 * 60 * 24))
                : 0

            if (accountAge < 7) {
                fraudFlags.push({ type: 'new_account', message: `Account is only ${accountAge} days old`, severity: 'warning' })
            }

            const selectedEntry = slotsEntries.find(e => e.user_id === userId)
            const avgEntriesPerSpin = selectedEntry && totalSpins > 0 ? (selectedEntry.entries / totalSpins) : 0

            if (avgEntriesPerSpin > 5) {
                fraudFlags.push({ type: 'high_entry_ratio', message: `Unusually high entries per spin ratio (${avgEntriesPerSpin.toFixed(1)})`, severity: 'info' })
            }

            setVerificationData({
                user: userData,
                balance: balanceData?.balance || 0,
                lifetimeEarned: balanceData?.lifetime_earned || 0,
                totalSpins,
                accountAge,
                ipLogs: ipLogs || [],
                uniqueLocations: [...new Set(ipLogs?.map(l => `${l.city}, ${l.country}`))],
                fraudFlags
            })
        } catch (error) {
            console.error('Error loading verification data:', error)
            setMessage({ type: 'error', text: 'Failed to load verification data' })
        } finally {
            setVerificationLoading(false)
        }
    }

    const loadPayoutStatus = async (prizeId) => {
        try {
            const { data } = await supabase
                .from('prize_payouts')
                .select('*')
                .eq('prize_id', prizeId)
                .single()

            if (data) {
                setPayoutStatus(data)
                setPayoutNotes(data.notes || '')
            } else {
                setPayoutStatus(null)
                setPayoutNotes('')
            }
        } catch (error) {
            setPayoutStatus(null)
            setPayoutNotes('')
        }
    }

    const pickRandomWinner = async () => {
        if (slotsEntries.length === 0) return

        const totalEntries = slotsEntries.reduce((sum, e) => sum + e.entries, 0)
        let random = Math.random() * totalEntries

        let winner = slotsEntries[0]
        for (const entry of slotsEntries) {
            random -= entry.entries
            if (random <= 0) { winner = entry; break }
        }

        setSelectedWinner(winner)
        setVerificationStep('verify')
        await loadVerificationData(winner.user_id)
    }

    const confirmWinner = async () => {
        if (!selectedWinner || !slotsPrize) return
        setAnnouncing(true)

        try {
            const { error } = await supabase
                .from('weekly_prizes')
                .update({
                    winner_user_id: selectedWinner.user_id,
                    winner_selected_at: new Date().toISOString(),
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', slotsPrize.id)

            if (error) throw error

            await supabase
                .from('prize_payouts')
                .insert([{
                    prize_id: slotsPrize.id,
                    user_id: selectedWinner.user_id,
                    status: 'pending',
                    notes: '',
                    created_at: new Date().toISOString()
                }])

            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_selected',
                table_name: 'weekly_prizes',
                record_id: slotsPrize.id,
                new_value: { winner_user_id: selectedWinner.user_id, username: selectedWinner.user.username },
                description: `Selected ${selectedWinner.user.username} as Slots winner for ${currentWeek}`
            }])

            setMessage({ type: 'success', text: `🎉 Winner confirmed: ${selectedWinner.user.username}!` })
            setVerificationStep('confirmed')
            loadSlotsDrawing()
        } catch (error) {
            console.error('Error confirming winner:', error)
            setMessage({ type: 'error', text: 'Failed to confirm winner. Please try again.' })
        } finally {
            setAnnouncing(false)
        }
    }

    const clearSelection = () => {
        setSelectedWinner(null)
        setVerificationData(null)
        setVerificationStep('pick')
    }

    const updatePayoutStatus = async (newStatus) => {
        if (!slotsPrize || !payoutStatus) return
        setSavingPayout(true)

        try {
            const updateData = { status: newStatus, notes: payoutNotes, updated_at: new Date().toISOString() }
            if (newStatus === 'paid') updateData.paid_at = new Date().toISOString()

            const { error } = await supabase
                .from('prize_payouts')
                .update(updateData)
                .eq('id', payoutStatus.id)

            if (error) throw error

            if (newStatus === 'verified') {
                const { data: userData } = await supabase
                    .from('users')
                    .select('username, payout_method, payout_handle')
                    .eq('id', verificationData.user.id)
                    .single()

                const prizeAmount = slotsPrize.prize_type === 'cash' ? slotsPrize.total_prize_pool : 0

                if (prizeAmount > 0) {
                    const { data: existingQueue } = await supabase
                        .from('payout_queue')
                        .select('id')
                        .eq('reference_type', 'weekly_prize')
                        .eq('reference_id', payoutStatus.id)
                        .single()

                    if (!existingQueue) {
                        await supabase
                            .from('payout_queue')
                            .insert([{
                                user_id: verificationData.user.id,
                                amount: prizeAmount,
                                reason: `Weekly Slots Prize - ${currentWeek}`,
                                reference_type: 'weekly_prize',
                                reference_id: payoutStatus.id,
                                payment_method: userData?.payout_method || null,
                                payment_handle: userData?.payout_handle || null,
                                status: 'pending',
                                queued_at: new Date().toISOString()
                            }])
                    }
                }

                const { data: existingPublicWinner } = await supabase
                    .from('public_winners')
                    .select('id')
                    .eq('payout_id', payoutStatus.id)
                    .single()

                if (!existingPublicWinner) {
                    const weekStart = getWeekStart(weekOffset)
                    const weekStartStr = weekStart.toISOString().split('T')[0]
                    const prizeDisplay = slotsPrize.prize_type === 'cash'
                        ? `$${slotsPrize.total_prize_pool} Cash Prize`
                        : (slotsPrize.prize_descriptions?.[0] || 'Special Prize')

                    await supabase
                        .from('public_winners')
                        .insert([{
                            user_id: verificationData.user.id,
                            prize_id: slotsPrize.id,
                            payout_id: payoutStatus.id,
                            display_name: userData?.username || verificationData.user.username,
                            display_text: prizeDisplay,
                            prize_type: slotsPrize.prize_type,
                            prize_value: prizeAmount,
                            is_visible: true,
                            is_featured: false,
                            verified_at: new Date().toISOString(),
                            week_start: weekStartStr,
                            game_type: 'slots'
                        }])
                }

                await supabase.from('admin_audit_log').insert([{
                    user_email: (await supabase.auth.getUser()).data.user?.email,
                    action: 'winner_verified',
                    table_name: 'prize_payouts',
                    record_id: payoutStatus.id,
                    new_value: { status: 'verified', username: verificationData.user.username, prize_amount: prizeAmount },
                    description: `Verified ${verificationData.user.username} as winner, added to payout queue ($${prizeAmount})`
                }])

                setMessage({ type: 'success', text: `✅ Winner verified! Added to payout queue and winners board.` })
            } else {
                setMessage({ type: 'success', text: `Status updated to: ${newStatus}` })
            }

            setPayoutStatus(prev => ({ ...prev, status: newStatus }))
        } catch (error) {
            console.error('Error updating payout:', error)
            setMessage({ type: 'error', text: 'Failed to update status' })
        } finally {
            setSavingPayout(false)
        }
    }

    const savePayoutNotes = async () => {
        if (!payoutStatus) return
        setSavingPayout(true)

        try {
            const { error } = await supabase
                .from('prize_payouts')
                .update({ notes: payoutNotes, updated_at: new Date().toISOString() })
                .eq('id', payoutStatus.id)

            if (error) throw error
            setMessage({ type: 'success', text: 'Notes saved' })
        } catch (error) {
            console.error('Error saving notes:', error)
            setMessage({ type: 'error', text: 'Failed to save notes' })
        } finally {
            setSavingPayout(false)
        }
    }

    // ===== EMAIL FUNCTIONS =====
    const openEmailPreview = async () => {
        try {
            const { data: template, error } = await supabase
                .from('email_templates')
                .select('subject, html_body')
                .eq('template_key', 'prize_winner')
                .single()

            if (error || !template) {
                setMessage({ type: 'error', text: 'Email template not found. Please check email templates.' })
                return
            }

            const prizeDisplay = slotsPrize.prize_type === 'cash'
                ? `$${slotsPrize.total_prize_pool} Cash Prize`
                : (slotsPrize.prize_descriptions?.[0] || 'Special Prize')

            let subject = template.subject
                .replace(/\{\{username\}\}/g, verificationData.user.username)
                .replace(/\{\{prize\}\}/g, prizeDisplay)
                .replace(/\{\{game_type\}\}/g, 'Slots Drawing')

            let body = template.html_body
                .replace(/\{\{username\}\}/g, verificationData.user.username)
                .replace(/\{\{prize\}\}/g, prizeDisplay)
                .replace(/\{\{game_type\}\}/g, 'Slots Drawing')

            setEmailSubject(subject)
            setEmailBody(body)
            setShowEmailModal(true)
        } catch (error) {
            console.error('Error loading email template:', error)
            setMessage({ type: 'error', text: 'Failed to load email template' })
        }
    }

    const sendWinnerEmail = async () => {
        if (!verificationData?.user?.email) {
            setMessage({ type: 'error', text: 'No email address found for winner' })
            return
        }

        setSendingEmail(true)
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: verificationData.user.email, subject: emailSubject, html: emailBody })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to send email')

            await supabase
                .from('prize_payouts')
                .update({ email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', payoutStatus.id)

            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_email_sent',
                table_name: 'prize_payouts',
                record_id: payoutStatus.id,
                new_value: { email_to: verificationData.user.email, subject: emailSubject },
                description: `Sent winner notification email to ${verificationData.user.email}`
            }])

            setPayoutStatus(prev => ({ ...prev, email_sent_at: new Date().toISOString() }))
            setShowEmailModal(false)
            setMessage({ type: 'success', text: '📧 Email sent successfully!' })
        } catch (error) {
            console.error('Error sending email:', error)
            setMessage({ type: 'error', text: `Failed to send email: ${error.message}` })
        } finally {
            setSendingEmail(false)
        }
    }

    const openNotifiedModal = () => {
        setNotificationNote('')
        setShowNotifiedModal(true)
    }

    const markAsNotified = async () => {
        setSavingNotified(true)
        try {
            await supabase
                .from('prize_payouts')
                .update({ email_sent_at: new Date().toISOString(), notification_note: notificationNote || null, updated_at: new Date().toISOString() })
                .eq('id', payoutStatus.id)

            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'winner_marked_notified',
                table_name: 'prize_payouts',
                record_id: payoutStatus.id,
                new_value: { notification_note: notificationNote || 'No note', username: verificationData.user.username },
                description: `Marked ${verificationData.user.username} as notified${notificationNote ? ` (${notificationNote})` : ''}`
            }])

            setPayoutStatus(prev => ({ ...prev, email_sent_at: new Date().toISOString(), notification_note: notificationNote }))
            setShowNotifiedModal(false)
            setMessage({ type: 'success', text: '✅ Marked as notified' })
        } catch (error) {
            console.error('Error marking as notified:', error)
            setMessage({ type: 'error', text: 'Failed to mark as notified' })
        } finally {
            setSavingNotified(false)
        }
    }

    const getTotalEntries = () => slotsEntries.reduce((sum, e) => sum + e.entries, 0)

    const getPrizeDisplay = () => {
        if (!slotsPrize) return 'No prize set'
        if (slotsPrize.is_surprise) return '🎁 Surprise!'
        if (slotsPrize.prize_type === 'cash') return `$${slotsPrize.total_prize_pool}`
        return slotsPrize.prize_descriptions?.[0] || 'Special Prize'
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
            case 'verified': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
            case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/50'
            default: return `bg-${currentTheme.border} text-${currentTheme.textMuted}`
        }
    }

    // ===== ARCHIVE FUNCTIONS =====
    const loadArchive = async () => {
        setArchiveLoading(true)
        try {
            const { data: allGames, error: gamesError } = await supabase
                .from('leaderboard')
                .select('*')
                .order('week_start', { ascending: false })

            if (gamesError) throw gamesError

            const weekMap = {}
            allGames?.forEach(game => {
                if (!weekMap[game.week_start]) {
                    weekMap[game.week_start] = { week_start: game.week_start, games: [], totalGames: 0, bestScore: Infinity }
                }
                weekMap[game.week_start].games.push(game)
                weekMap[game.week_start].totalGames++
                if (game.score < weekMap[game.week_start].bestScore) {
                    weekMap[game.week_start].bestScore = game.score
                }
            })

            const weeks = Object.values(weekMap).map(week => ({
                ...week,
                games: week.games.sort((a, b) => a.score - b.score).slice(0, 20)
            }))

            const allUserIds = [...new Set(weeks.flatMap(w => w.games.map(g => g.user_id)))]
            const { data: usersData } = await supabase
                .from('users')
                .select('id, username, email')
                .in('id', allUserIds)

            weeks.forEach(week => {
                week.games = week.games.map(game => ({
                    ...game,
                    user: usersData?.find(u => u.id === game.user_id) || { username: 'Unknown' }
                }))
            })

            const { data: paymentsData } = await supabase
                .from('prize_payments')
                .select('*')

            const totalPrizesPaid = paymentsData?.filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + (p.prize_amount || 0), 0) || 0

            const uniqueWinners = new Set(weeks.flatMap(w => w.games.slice(0, 5).map(g => g.user_id))).size

            setArchiveStats({ totalWeeks: weeks.length, totalGames: allGames?.length || 0, totalPrizesPaid, uniqueWinners })
            setArchive(weeks)
        } catch (error) {
            console.error('Error loading archive:', error)
        } finally {
            setArchiveLoading(false)
        }
    }

    const isCurrentWeek = (weekStartStr) => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const currentWeekStart = new Date(today)
        currentWeekStart.setDate(today.getDate() - dayOfWeek)
        currentWeekStart.setHours(0, 0, 0, 0)
        return weekStartStr === currentWeekStart.toISOString().split('T')[0]
    }

    const formatWeekRangeFromStr = (weekStartStr) => {
        const weekStart = new Date(weekStartStr + 'T00:00:00')
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const options = { month: 'short', day: 'numeric' }
        return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekStart.getFullYear()}`
    }

    // ===== PUBLIC BOARD FUNCTIONS =====
    const loadPublicWinners = async () => {
        setBoardLoading(true)
        try {
            const { data, error } = await supabase
                .from('public_winners')
                .select('*')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })

            if (error) throw error
            setPublicWinners(data || [])
        } catch (err) {
            console.error('Error loading winners:', err)
            setMessage({ type: 'error', text: 'Failed to load winners' })
        } finally {
            setBoardLoading(false)
        }
    }

    const loadVisibilitySetting = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'show_winners_page')
                .single()

            if (data) setShowWinnersPage(data.setting_value === 'true')
        } catch (err) {
            console.error('Error loading visibility setting:', err)
        }
    }

    const toggleWinnersPageVisibility = async () => {
        setSavingVisibility(true)
        try {
            const newValue = !showWinnersPage
            const { error } = await supabase
                .from('admin_settings')
                .update({ setting_value: newValue.toString() })
                .eq('setting_key', 'show_winners_page')

            if (error) throw error

            setShowWinnersPage(newValue)
            setMessage({ type: 'success', text: newValue ? 'Winners page is now VISIBLE' : 'Winners page is now HIDDEN' })
        } catch (err) {
            console.error('Error updating visibility:', err)
            setMessage({ type: 'error', text: 'Failed to update visibility setting' })
        } finally {
            setSavingVisibility(false)
        }
    }

    const toggleBoardVisibility = async (winner) => {
        setSaving(winner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({ is_visible: !winner.is_visible, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            if (error) throw error

            setPublicWinners(prev => prev.map(w => w.id === winner.id ? { ...w, is_visible: !w.is_visible } : w))
            setMessage({ type: 'success', text: `Winner ${!winner.is_visible ? 'shown' : 'hidden'}` })
        } catch (err) {
            console.error('Error toggling visibility:', err)
            setMessage({ type: 'error', text: 'Failed to update visibility' })
        } finally {
            setSaving(null)
        }
    }

    const toggleFeatured = async (winner) => {
        setSaving(winner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({ is_featured: !winner.is_featured, updated_at: new Date().toISOString() })
                .eq('id', winner.id)

            if (error) throw error

            setPublicWinners(prev => prev.map(w => w.id === winner.id ? { ...w, is_featured: !w.is_featured } : w))
            setMessage({ type: 'success', text: `Winner ${!winner.is_featured ? 'featured' : 'unfeatured'}` })
        } catch (err) {
            console.error('Error toggling featured:', err)
            setMessage({ type: 'error', text: 'Failed to update featured status' })
        } finally {
            setSaving(null)
        }
    }

    const moveBoardWinner = async (winner, direction) => {
        const currentIndex = publicWinners.findIndex(w => w.id === winner.id)
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

        if (newIndex < 0 || newIndex >= publicWinners.length) return

        setSaving(winner.id)
        try {
            const otherWinner = publicWinners[newIndex]
            const currentOrder = winner.display_order || currentIndex
            const otherOrder = otherWinner.display_order || newIndex

            await supabase.from('public_winners').update({ display_order: otherOrder, updated_at: new Date().toISOString() }).eq('id', winner.id)
            await supabase.from('public_winners').update({ display_order: currentOrder, updated_at: new Date().toISOString() }).eq('id', otherWinner.id)

            await loadPublicWinners()
            setMessage({ type: 'success', text: 'Order updated' })
        } catch (err) {
            console.error('Error moving winner:', err)
            setMessage({ type: 'error', text: 'Failed to reorder' })
        } finally {
            setSaving(null)
        }
    }

    const openEditModal = (winner) => {
        setEditingWinner(winner)
        setEditDisplayName(winner.display_name || '')
        setEditDisplayText(winner.display_text || '')
        setEditAdminNotes(winner.admin_notes || '')
    }

    const saveEdit = async () => {
        if (!editingWinner) return
        setSaving(editingWinner.id)
        try {
            const { error } = await supabase
                .from('public_winners')
                .update({ display_name: editDisplayName, display_text: editDisplayText, admin_notes: editAdminNotes, updated_at: new Date().toISOString() })
                .eq('id', editingWinner.id)

            if (error) throw error

            setPublicWinners(prev => prev.map(w => w.id === editingWinner.id ? { ...w, display_name: editDisplayName, display_text: editDisplayText, admin_notes: editAdminNotes } : w))
            setEditingWinner(null)
            setMessage({ type: 'success', text: 'Winner updated' })
        } catch (err) {
            console.error('Error saving edit:', err)
            setMessage({ type: 'error', text: 'Failed to save changes' })
        } finally {
            setSaving(null)
        }
    }

    const addManualWinner = async () => {
        if (!newWinner.display_name || !newWinner.display_text) {
            setMessage({ type: 'error', text: 'Display name and text are required' })
            return
        }

        setSaving('new')
        try {
            const maxOrder = Math.max(...publicWinners.map(w => w.display_order || 0), 0)

            const { data, error } = await supabase
                .from('public_winners')
                .insert([{
                    display_name: newWinner.display_name,
                    display_text: newWinner.display_text,
                    prize_type: newWinner.prize_type,
                    prize_value: newWinner.prize_value ? parseFloat(newWinner.prize_value) : null,
                    game_type: newWinner.game_type,
                    week_start: newWinner.week_start,
                    admin_notes: newWinner.admin_notes,
                    is_visible: true,
                    is_featured: false,
                    display_order: maxOrder + 1,
                    verified_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) throw error

            setPublicWinners(prev => [...prev, data])
            setShowAddModal(false)
            setNewWinner({ display_name: '', display_text: '', prize_type: 'cash', prize_value: '', game_type: 'manual', week_start: new Date().toISOString().split('T')[0], admin_notes: '' })
            setMessage({ type: 'success', text: 'Manual winner added' })
        } catch (err) {
            console.error('Error adding manual winner:', err)
            setMessage({ type: 'error', text: 'Failed to add winner' })
        } finally {
            setSaving(null)
        }
    }

    const deleteBoardWinner = async (winner) => {
        if (!confirm(`Delete "${winner.display_name}" from the winners board? This cannot be undone.`)) return

        setSaving(winner.id)
        try {
            const { error } = await supabase.from('public_winners').delete().eq('id', winner.id)
            if (error) throw error

            setPublicWinners(prev => prev.filter(w => w.id !== winner.id))
            setMessage({ type: 'success', text: 'Winner deleted' })
        } catch (err) {
            console.error('Error deleting winner:', err)
            setMessage({ type: 'error', text: 'Failed to delete winner' })
        } finally {
            setSaving(null)
        }
    }

    const filteredPublicWinners = publicWinners.filter(w => {
        if (filterGameType !== 'all' && w.game_type !== filterGameType) return false
        if (filterVisibility === 'visible' && !w.is_visible) return false
        if (filterVisibility === 'hidden' && w.is_visible) return false
        if (filterFeatured === 'featured' && !w.is_featured) return false
        if (filterFeatured === 'normal' && w.is_featured) return false
        return true
    })

    // ===== RENDER =====
    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>Winners Management</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Pick winners, manage payouts, and control the public winners board</p>
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-1 mb-3 flex-wrap">
                <button
                    onClick={() => setActiveTab('slots')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'slots' ? 'bg-purple-500 text-white' : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`}`}
                >
                    🎰 Slots
                </button>
                <button
                    onClick={() => setActiveTab('match')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'match' ? 'bg-green-500 text-white' : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`}`}
                >
                    🎮 Match
                </button>
                <button
                    onClick={() => setActiveTab('archive')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-blue-500 text-white' : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`}`}
                >
                    📚 Archive
                </button>
                <button
                    onClick={() => setActiveTab('board')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'board' ? 'bg-yellow-500 text-slate-900' : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`}`}
                >
                    📋 Public Board
                </button>
            </div>

            {/* ===== WEEK NAVIGATION (for slots/match) ===== */}
            {(activeTab === 'slots' || activeTab === 'match') && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                    <div className="flex items-center justify-between">
                        <button onClick={() => setWeekOffset(prev => prev + 1)} className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded hover:bg-${currentTheme.card}`}>← Prev</button>
                        <div className="text-center">
                            <p className={`text-${currentTheme.text} font-semibold text-sm`}>{currentWeek}</p>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>{weekOffset === 0 ? 'Current Week' : `${weekOffset} week${weekOffset > 1 ? 's' : ''} ago`}</p>
                        </div>
                        <button onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0} className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-sm rounded disabled:opacity-50`}>Next →</button>
                    </div>
                </div>
            )}

            {/* ===== MESSAGE ===== */}
            {message && (
                <div className={`mb-3 p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* ===== EMAIL PREVIEW MODAL ===== */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
                        <div className={`p-2 border-b border-${currentTheme.border} flex items-center justify-between`}>
                            <h3 className={`text-${currentTheme.text} font-bold text-sm`}>📧 Email Preview</h3>
                            <button onClick={() => setShowEmailModal(false)} className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}>✕</button>
                        </div>
                        <div className="p-3 overflow-y-auto flex-1">
                            <div className="flex gap-4 mb-2">
                                <div className="flex-1">
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>To:</label>
                                    <p className={`text-${currentTheme.text} text-sm`}>{verificationData?.user?.email}</p>
                                </div>
                                <div className="flex-1">
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Subject:</label>
                                    <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={`w-full p-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`} />
                                </div>
                            </div>
                            <div className="mb-2">
                                <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Preview:</label>
                                <div className="p-3 rounded border text-sm" style={{ backgroundColor: '#f1f5f9' }} dangerouslySetInnerHTML={{ __html: emailBody }} />
                            </div>
                            <details className="mb-2">
                                <summary className={`text-${currentTheme.textMuted} text-xs cursor-pointer hover:text-${currentTheme.text}`}>Edit HTML (advanced)</summary>
                                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className={`w-full p-2 mt-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-xs font-mono`} rows={5} />
                            </details>
                        </div>
                        <div className={`p-2 border-t border-${currentTheme.border} flex gap-2 justify-end`}>
                            <button onClick={() => setShowEmailModal(false)} className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}>Cancel</button>
                            <button onClick={sendWinnerEmail} disabled={sendingEmail} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50">{sendingEmail ? 'Sending...' : '📧 Send Email'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MARK AS NOTIFIED MODAL ===== */}
            {showNotifiedModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg w-full max-w-md`}>
                        <div className={`p-4 border-b border-${currentTheme.border}`}>
                            <h3 className={`text-${currentTheme.text} font-bold`}>Mark as Notified</h3>
                            <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>Record that winner was notified through other means</p>
                        </div>
                        <div className="p-4">
                            <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Note (optional):</label>
                            <textarea value={notificationNote} onChange={(e) => setNotificationNote(e.target.value)} placeholder="e.g., Called them, DM'd on social media, etc." className={`w-full p-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`} rows={3} />
                        </div>
                        <div className={`p-4 border-t border-${currentTheme.border} flex gap-2 justify-end`}>
                            <button onClick={() => setShowNotifiedModal(false)} className={`px-4 py-2 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}>Cancel</button>
                            <button onClick={markAsNotified} disabled={savingNotified} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 disabled:opacity-50">{savingNotified ? 'Saving...' : '✅ Mark as Notified'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EDIT WINNER MODAL ===== */}
            {editingWinner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`w-full max-w-md p-4 rounded-lg bg-${currentTheme.card}`}>
                        <h2 className={`text-lg font-bold mb-3 text-${currentTheme.text}`}>Edit Winner</h2>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Name</label>
                                <input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Text</label>
                                <input type="text" value={editDisplayText} onChange={(e) => setEditDisplayText(e.target.value)} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Admin Notes</label>
                                <textarea value={editAdminNotes} onChange={(e) => setEditAdminNotes(e.target.value)} rows={2} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingWinner(null)} className={`px-3 py-1.5 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text}`}>Cancel</button>
                            <button onClick={saveEdit} disabled={saving === editingWinner.id} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving === editingWinner.id ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ADD MANUAL WINNER MODAL ===== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`w-full max-w-md p-4 rounded-lg bg-${currentTheme.card}`}>
                        <h2 className={`text-lg font-bold mb-1 text-${currentTheme.text}`}>Add Manual Winner</h2>
                        <p className={`text-xs mb-3 text-${currentTheme.textMuted}`}>For legacy winners or special contests</p>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Name *</label>
                                <input type="text" value={newWinner.display_name} onChange={(e) => setNewWinner({ ...newWinner, display_name: e.target.value })} placeholder="e.g., John D." className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Display Text *</label>
                                <input type="text" value={newWinner.display_text} onChange={(e) => setNewWinner({ ...newWinner, display_text: e.target.value })} placeholder="e.g., $50 Cash Prize" className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Prize Type</label>
                                    <select value={newWinner.prize_type} onChange={(e) => setNewWinner({ ...newWinner, prize_type: e.target.value })} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`}>
                                        <option value="cash">Cash</option>
                                        <option value="gift_card">Gift Card</option>
                                        <option value="physical">Physical</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Value ($)</label>
                                    <input type="number" value={newWinner.prize_value} onChange={(e) => setNewWinner({ ...newWinner, prize_value: e.target.value })} placeholder="50" className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Game Type</label>
                                    <select value={newWinner.game_type} onChange={(e) => setNewWinner({ ...newWinner, game_type: e.target.value })} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`}>
                                        <option value="manual">Manual</option>
                                        <option value="slots">Slots</option>
                                        <option value="match">Match</option>
                                        <option value="contest">Contest</option>
                                        <option value="referral">Referral</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Week/Date</label>
                                    <input type="date" value={newWinner.week_start} onChange={(e) => setNewWinner({ ...newWinner, week_start: e.target.value })} className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs mb-1 text-${currentTheme.textMuted}`}>Admin Notes</label>
                                <textarea value={newWinner.admin_notes} onChange={(e) => setNewWinner({ ...newWinner, admin_notes: e.target.value })} rows={2} placeholder="Internal notes" className={`w-full px-2 py-1.5 text-sm rounded border bg-${currentTheme.bg} text-${currentTheme.text} border-${currentTheme.border}`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowAddModal(false)} className={`px-3 py-1.5 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text}`}>Cancel</button>
                            <button onClick={addManualWinner} disabled={saving === 'new'} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving === 'new' ? 'Adding...' : 'Add Winner'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SLOTS TAB ===== */}
            {activeTab === 'slots' && (
                <>
                    {slotsLoading ? (
                        <div className="animate-pulse space-y-3"><div className={`h-32 bg-${currentTheme.card} rounded`}></div></div>
                    ) : (
                        <>
                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>This Week's Prize</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{getPrizeDisplay()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Entries</p>
                                        <p className="text-purple-400 font-bold text-lg">🎟️ {getTotalEntries()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>Participants</p>
                                        <p className={`text-${currentTheme.text} font-bold text-lg`}>{slotsEntries.length}</p>
                                    </div>
                                </div>
                            </div>

                            {verificationStep === 'pick' && slotsEntries.length > 0 && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-2`}>🎲 Step 1: Select Winner</h3>
                                    <button onClick={pickRandomWinner} className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-bold text-sm hover:from-purple-400 hover:to-purple-500">🎲 Pick Random Winner</button>
                                </div>
                            )}

                            {verificationStep === 'verify' && selectedWinner && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-3`}>🔍 Step 2: Verify Winner</h3>
                                    <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg mb-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-yellow-400 text-xs mb-1">Selected Winner:</p>
                                                <p className={`text-${currentTheme.text} font-bold text-lg`}>{selectedWinner.user.username}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>{selectedWinner.user.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-purple-400 font-bold text-lg">🎟️ {selectedWinner.entries}</p>
                                                <p className={`text-${currentTheme.textMuted} text-xs`}>entries</p>
                                            </div>
                                        </div>
                                    </div>

                                    {verificationLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className={`ml-2 text-${currentTheme.textMuted} text-sm`}>Loading verification data...</span>
                                        </div>
                                    ) : verificationData && (
                                        <>
                                            {verificationData.fraudFlags.length > 0 && (
                                                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                                                    <p className="text-red-400 font-bold text-xs mb-1">⚠️ Flags Detected:</p>
                                                    {verificationData.fraudFlags.map((flag, i) => (
                                                        <p key={i} className={`text-xs ${flag.severity === 'warning' ? 'text-yellow-400' : 'text-orange-400'}`}>• {flag.message}</p>
                                                    ))}
                                                </div>
                                            )}
                                            {verificationData.fraudFlags.length === 0 && (
                                                <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                                                    <p className="text-green-400 font-bold text-xs">✅ No fraud flags detected</p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Account Age</p>
                                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{verificationData.accountAge} days</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Total Spins</p>
                                                    <p className={`text-${currentTheme.text} font-bold text-sm`}>{verificationData.totalSpins}</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Current Balance</p>
                                                    <p className="text-yellow-400 font-bold text-sm">🪙 {verificationData.balance}</p>
                                                </div>
                                                <div className={`p-2 bg-${currentTheme.border}/30 rounded`}>
                                                    <p className={`text-${currentTheme.textMuted} text-[10px]`}>Lifetime Earned</p>
                                                    <p className="text-green-400 font-bold text-sm">🪙 {verificationData.lifetimeEarned}</p>
                                                </div>
                                            </div>
                                            <div className={`p-2 bg-${currentTheme.border}/30 rounded mb-3`}>
                                                <p className={`text-${currentTheme.textMuted} text-[10px] mb-1`}>Login Locations ({verificationData.uniqueLocations.length} unique)</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {verificationData.uniqueLocations.slice(0, 5).map((loc, i) => (
                                                        <span key={i} className={`px-2 py-0.5 bg-${currentTheme.card} rounded text-${currentTheme.text} text-xs`}>📍 {loc}</span>
                                                    ))}
                                                    {verificationData.uniqueLocations.length > 5 && <span className={`text-${currentTheme.textMuted} text-xs`}>+{verificationData.uniqueLocations.length - 5} more</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={clearSelection} className={`flex-1 py-2 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm`}>Cancel</button>
                                                <button onClick={pickRandomWinner} className="flex-1 py-2 bg-purple-600 text-white rounded text-sm">🎲 Re-Pick</button>
                                                <button onClick={confirmWinner} disabled={announcing} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-bold">{announcing ? 'Confirming...' : '✅ Confirm Winner'}</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {verificationStep === 'confirmed' && slotsPrize?.winner_user_id && (
                                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3 mb-3`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm mb-3`}>✅ Winner Confirmed - Payout Tracking</h3>
                                    {verificationData && (
                                        <div className="p-2 bg-green-500/20 border border-green-500/50 rounded-lg mb-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-${currentTheme.text} text-sm`}><span className="text-green-400">🏆 Winner:</span> <span className="font-bold">{verificationData.user?.username}</span><span className={`text-${currentTheme.textMuted}`}> — {verificationData.user?.email}</span></p>
                                                    {verificationData.user?.payout_method && <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>💳 {verificationData.user.payout_method}: {verificationData.user.payout_handle}</p>}
                                                </div>
                                                <div className="text-right"><p className={`text-${currentTheme.textMuted} text-xs`}>Confirmed {formatDate(slotsPrize.winner_selected_at)}</p></div>
                                            </div>
                                        </div>
                                    )}
                                    {payoutStatus && (
                                        <>
                                            <div className="mb-3">
                                                <p className={`text-${currentTheme.textMuted} text-xs mb-2`}>Payout Status:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['pending', 'verified'].map(status => (
                                                        <button key={status} onClick={() => updatePayoutStatus(status)} disabled={savingPayout || payoutStatus.status === 'paid'} className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${payoutStatus.status === status ? getStatusColor(status) : `bg-${currentTheme.border}/30 text-${currentTheme.textMuted} border-${currentTheme.border} hover:bg-${currentTheme.border}`} ${payoutStatus.status === 'paid' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            {status === 'pending' && '⏳'}{status === 'verified' && '✓'} {status.charAt(0).toUpperCase() + status.slice(1)}
                                                        </button>
                                                    ))}
                                                    {payoutStatus.status === 'paid' && <span className="px-3 py-1.5 rounded text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/50">💰 Paid</span>}
                                                </div>
                                                {payoutStatus.status === 'verified' && <p className="text-purple-400 text-xs mt-2">✓ Added to Payout Queue and Winners Board — <a href="/admin/payout-queue" className="underline hover:text-purple-300">Process payment there →</a></p>}
                                                {payoutStatus.status === 'paid' && <p className="text-green-400 text-xs mt-2">✓ Payment completed</p>}
                                            </div>
                                            {payoutStatus.status === 'verified' && (
                                                <div className={`mb-3 p-2 rounded-lg ${payoutStatus.email_sent_at ? 'bg-green-500/20 border border-green-500/50' : 'bg-orange-500/20 border border-orange-500/50'}`}>
                                                    {payoutStatus.email_sent_at ? (
                                                        <p className="text-green-400 font-bold text-xs">✅ Winner Notified — {formatDateTime(payoutStatus.email_sent_at)}{payoutStatus.notification_note && <span className={`font-normal text-${currentTheme.textMuted}`}> ({payoutStatus.notification_note})</span>}</p>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-orange-400 font-bold text-xs">🔔 Winner Not Yet Notified</p>
                                                            <div className="flex gap-2">
                                                                <button onClick={openEmailPreview} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-500">📧 Preview & Send Email</button>
                                                                <button onClick={openNotifiedModal} className={`px-3 py-1 bg-${currentTheme.border} text-${currentTheme.text} rounded text-xs hover:bg-${currentTheme.card}`}>✅ Mark as Notified</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <details className="mb-2">
                                                <summary className={`text-${currentTheme.textMuted} text-xs cursor-pointer hover:text-${currentTheme.text}`}>Admin Notes {payoutNotes ? '(has notes)' : ''}</summary>
                                                <div className="mt-2">
                                                    <textarea value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="Add notes about this payout..." className={`w-full p-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`} rows={2} disabled={payoutStatus.status === 'paid'} />
                                                    {payoutStatus.status !== 'paid' && <button onClick={savePayoutNotes} disabled={savingPayout} className={`mt-1 px-3 py-1 bg-${currentTheme.border} text-${currentTheme.text} rounded text-xs hover:bg-${currentTheme.card}`}>{savingPayout ? 'Saving...' : 'Save Notes'}</button>}
                                                </div>
                                            </details>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                <div className={`p-2 border-b border-${currentTheme.border} bg-${currentTheme.border}/30`}>
                                    <h3 className={`text-${currentTheme.text} font-bold text-sm`}>All Entries</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {slotsEntries.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className={`border-b border-${currentTheme.border}`}>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>#</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Entries</th>
                                                    <th className={`text-right py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Chance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {slotsEntries.map((entry, index) => {
                                                    const chance = ((entry.entries / getTotalEntries()) * 100).toFixed(1)
                                                    const isWinner = slotsPrize?.winner_user_id === entry.user_id
                                                    const isSelected = selectedWinner?.user_id === entry.user_id
                                                    return (
                                                        <tr key={entry.user_id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 ${isWinner ? 'bg-green-500/20' : isSelected ? 'bg-yellow-500/20' : ''}`}>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{index + 1}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>{entry.user.username}{isWinner && <span className="ml-2 text-green-400">🏆</span>}{isSelected && !isWinner && <span className="ml-2 text-yellow-400">⭐</span>}</td>
                                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                            <td className="py-2 px-3 text-right"><span className="text-purple-400 font-bold">🎟️ {entry.entries}</span></td>
                                                            <td className={`py-2 px-3 text-right text-${currentTheme.textMuted} text-xs`}>{chance}%</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                            <p className="text-sm">No entries yet this week</p>
                                            <p className="text-xs mt-1">Entries will appear when players spin the slots</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ===== MATCH TAB ===== */}
            {activeTab === 'match' && (
                <>
                    {loading ? (
                        <div className="animate-pulse space-y-3"><div className={`h-64 bg-${currentTheme.card} rounded`}></div></div>
                    ) : (
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className={`border-b border-${currentTheme.border}`}>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Rank</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Player</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Score</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Prize</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                            <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.length > 0 ? leaderboard.map((entry, index) => {
                                            const rank = index + 1
                                            const badge = getRankBadge(rank)
                                            const payment = payments[entry.id]
                                            const prizeAmount = getPrizeAmount(rank)
                                            return (
                                                <tr key={entry.id} className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                                    <td className="py-2 px-3"><div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${badge.color}`}>{rank <= 3 ? badge.emoji : rank}</div></td>
                                                    <td className={`py-2 px-3 text-${currentTheme.text} font-medium text-xs`}>{entry.user.username}</td>
                                                    <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{entry.user.email}</td>
                                                    <td className={`py-2 px-3 text-${currentTheme.accent} font-bold text-sm`}>{entry.score}</td>
                                                    <td className="py-2 px-3">{prizeAmount > 0 ? <span className="text-green-400 font-semibold text-xs">${prizeAmount}</span> : <span className={`text-${currentTheme.textMuted} text-xs`}>—</span>}</td>
                                                    <td className="py-2 px-3">{prizeAmount > 0 ? <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${payment?.status === 'paid' ? 'bg-green-500/20 text-green-400' : payment?.status === 'queued' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'}`}>{payment?.status === 'paid' ? '✓ Paid' : payment?.status === 'queued' ? '⏳ Queued' : '—'}</span> : '—'}</td>
                                                    <td className="py-2 px-3">
                                                        {prizeAmount > 0 && !payment?.status && <button onClick={() => addToPayoutQueue(entry, rank)} disabled={saving === entry.id} className="px-2 py-1 rounded text-xs font-medium bg-orange-600 text-white hover:bg-orange-500">{saving === entry.id ? '...' : '+ Add to Queue'}</button>}
                                                        {payment?.status === 'queued' && <a href="/admin/payout-queue" className={`text-xs text-${currentTheme.accent} hover:underline`}>Process →</a>}
                                                    </td>
                                                </tr>
                                            )
                                        }) : (
                                            <tr><td colSpan="7" className={`py-8 text-center text-${currentTheme.textMuted}`}><p className="text-sm">No games played this week</p></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ===== ARCHIVE TAB ===== */}
            {activeTab === 'archive' && (
                <>
                    {archiveLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>)}</div>
                            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className={`h-14 bg-${currentTheme.card} rounded`}></div>)}</div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Weeks</p>
                                    <p className="text-xl font-bold text-purple-400">{archiveStats.totalWeeks}</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Games</p>
                                    <p className="text-xl font-bold text-blue-400">{archiveStats.totalGames.toLocaleString()}</p>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                                    <p className={`text-${currentTheme.textMuted} text-xs`}>Prizes Paid</p>
                                    <p className="text-xl font-bold text-green-400">${archiveStats.totalPrizesPaid.toLocaleString()}</p>
                                </div>
                                <div className={`bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 rounded p-3`}>
                                    <p className={`text-${currentTheme.textMuted} text-xs`}>Unique Winners</p>
                                    <p className={`text-xl font-bold text-${currentTheme.accent}`}>{archiveStats.uniqueWinners}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {archive.length > 0 ? archive.map(week => (
                                    <div key={week.week_start} className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden`}>
                                        <button onClick={() => setExpandedWeek(expandedWeek === week.week_start ? null : week.week_start)} className={`w-full px-3 py-2 flex items-center justify-between hover:bg-${currentTheme.border}/50 transition-colors`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 bg-gradient-to-br from-${currentTheme.accent} to-orange-500 rounded flex items-center justify-center`}><span className="text-sm">🏆</span></div>
                                                <div className="text-left">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={`text-${currentTheme.text} font-semibold text-sm`}>{formatWeekRangeFromStr(week.week_start)}</h3>
                                                        {isCurrentWeek(week.week_start) && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded-full">Current</span>}
                                                    </div>
                                                    <p className={`text-${currentTheme.textMuted} text-xs`}>{week.totalGames} games • Best: {week.bestScore}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="hidden md:flex items-center gap-1">
                                                    {week.games.slice(0, 3).map((game, i) => (
                                                        <div key={game.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` : i === 1 ? 'bg-slate-400 text-slate-900' : 'bg-amber-700 text-white'}`} title={game.user.username}>
                                                            {game.user.username?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className={`text-${currentTheme.textMuted} text-xs transition-transform ${expandedWeek === week.week_start ? 'rotate-180' : ''}`}>▼</span>
                                            </div>
                                        </button>
                                        {expandedWeek === week.week_start && (
                                            <div className={`border-t border-${currentTheme.border} p-3`}>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className={`text-${currentTheme.textMuted} text-xs`}>
                                                            <th className="text-left py-1">Rank</th>
                                                            <th className="text-left py-1">Player</th>
                                                            <th className="text-left py-1">Mode</th>
                                                            <th className="text-left py-1">Moves</th>
                                                            <th className="text-left py-1">Time</th>
                                                            <th className="text-left py-1">Score</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {week.games.map((game, index) => (
                                                            <tr key={game.id} className={`border-t border-${currentTheme.border}/50`}>
                                                                <td className="py-1.5"><span className={`w-6 h-6 inline-flex items-center justify-center rounded-full font-bold text-xs ${index === 0 ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` : index === 1 ? 'bg-slate-400 text-slate-900' : index === 2 ? 'bg-amber-700 text-white' : `bg-${currentTheme.border} text-${currentTheme.textMuted}`}`}>{index + 1}</span></td>
                                                                <td className="py-1.5"><p className={`text-${currentTheme.text} font-medium text-xs`}>{game.user.username}</p><p className={`text-${currentTheme.textMuted} text-[10px]`}>{game.user.email}</p></td>
                                                                <td className="py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${game.game_mode === 'easy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{game.game_mode === 'easy' ? '12' : '16'}</span></td>
                                                                <td className={`py-1.5 text-${currentTheme.textMuted} text-xs`}>{game.moves}</td>
                                                                <td className={`py-1.5 text-${currentTheme.textMuted} text-xs`}>{game.time_seconds}s</td>
                                                                <td className="py-1.5"><span className={`text-${currentTheme.accent} font-bold text-xs`}>{game.score}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded p-8 text-center`}>
                                        <p className={`text-${currentTheme.textMuted} text-sm`}>No archived weeks yet</p>
                                        <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>Historical data will appear here as weeks complete</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ===== PUBLIC BOARD TAB ===== */}
            {activeTab === 'board' && (
                <>
                    {boardLoading ? (
                        <div className="animate-pulse space-y-3">
                            <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(i => <div key={i} className={`h-16 bg-${currentTheme.card} rounded`}></div>)}</div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-3">
                                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage what appears on the public /winners page</p>
                                <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">+ Add Manual</button>
                            </div>

                            <div className={`mb-4 p-3 rounded-lg border ${showWinnersPage ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className={`font-medium ${showWinnersPage ? 'text-green-400' : 'text-red-400'}`}>{showWinnersPage ? '✅ Winners Page is LIVE' : '🚫 Winners Page is HIDDEN'}</div>
                                        <div className={`text-xs text-${currentTheme.textMuted}`}>{showWinnersPage ? 'The "Winners" link appears in the Games dropdown menu for all users' : 'The "Winners" link is NOT showing in the Games menu — users cannot see this page'}</div>
                                    </div>
                                    <button onClick={toggleWinnersPageVisibility} disabled={savingVisibility} className={`px-4 py-2 rounded text-sm font-medium ${showWinnersPage ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'} disabled:opacity-50`}>{savingVisibility ? '...' : showWinnersPage ? 'Hide Page' : 'Show Page'}</button>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-4 flex-wrap items-end">
                                <div>
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Type</label>
                                    <select value={filterGameType} onChange={(e) => setFilterGameType(e.target.value)} className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}>
                                        <option value="all">All</option>
                                        <option value="slots">Slots</option>
                                        <option value="match">Match</option>
                                        <option value="manual">Manual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Visibility</label>
                                    <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)} className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}>
                                        <option value="all">All</option>
                                        <option value="visible">Visible</option>
                                        <option value="hidden">Hidden</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Featured</label>
                                    <select value={filterFeatured} onChange={(e) => setFilterFeatured(e.target.value)} className={`px-2 py-1 text-sm rounded border bg-${currentTheme.card} text-${currentTheme.text} border-${currentTheme.border}`}>
                                        <option value="all">All</option>
                                        <option value="featured">Featured</option>
                                        <option value="normal">Normal</option>
                                    </select>
                                </div>
                                <button onClick={loadPublicWinners} className={`px-2 py-1 text-sm rounded border border-${currentTheme.border} text-${currentTheme.text} hover:opacity-80`}>🔄</button>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <div className={`p-3 rounded bg-${currentTheme.card} border border-${currentTheme.border}`}>
                                    <div className={`text-xl font-bold text-${currentTheme.text}`}>{publicWinners.length}</div>
                                    <div className={`text-${currentTheme.textMuted} text-xs`}>Total</div>
                                </div>
                                <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
                                    <div className="text-xl font-bold text-green-400">{publicWinners.filter(w => w.is_visible).length}</div>
                                    <div className={`text-${currentTheme.textMuted} text-xs`}>Visible</div>
                                </div>
                                <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                                    <div className="text-xl font-bold text-yellow-400">{publicWinners.filter(w => w.is_featured).length}</div>
                                    <div className={`text-${currentTheme.textMuted} text-xs`}>Featured</div>
                                </div>
                                <div className="p-3 rounded bg-gray-500/10 border border-gray-500/20">
                                    <div className="text-xl font-bold text-gray-400">{publicWinners.filter(w => !w.is_visible).length}</div>
                                    <div className={`text-${currentTheme.textMuted} text-xs`}>Hidden</div>
                                </div>
                            </div>

                            {filteredPublicWinners.length === 0 ? (
                                <div className={`text-center py-8 rounded bg-${currentTheme.card} text-${currentTheme.textMuted} text-sm`}>No winners found</div>
                            ) : (
                                <div className={`rounded overflow-hidden border bg-${currentTheme.card} border-${currentTheme.border}`}>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className={`bg-${currentTheme.border}/30`}>
                                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>#</th>
                                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Name</th>
                                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Prize</th>
                                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Type</th>
                                                <th className={`text-left p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Week</th>
                                                <th className={`text-center p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Visible</th>
                                                <th className={`text-center p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Featured</th>
                                                <th className={`text-right p-2 text-${currentTheme.textMuted} text-xs font-medium`}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPublicWinners.map((winner, index) => (
                                                <tr key={winner.id} className={`border-t border-${currentTheme.border} ${winner.is_featured ? 'bg-yellow-500/5' : ''}`}>
                                                    <td className="p-2">
                                                        <div className="flex items-center gap-0.5">
                                                            <button onClick={() => moveBoardWinner(winner, 'up')} disabled={index === 0 || saving === winner.id} className={`p-0.5 text-xs text-${currentTheme.textMuted} hover:text-${currentTheme.text} disabled:opacity-30`}>▲</button>
                                                            <button onClick={() => moveBoardWinner(winner, 'down')} disabled={index === filteredPublicWinners.length - 1 || saving === winner.id} className={`p-0.5 text-xs text-${currentTheme.textMuted} hover:text-${currentTheme.text} disabled:opacity-30`}>▼</button>
                                                            <span className={`ml-1 text-xs text-${currentTheme.textMuted}`}>{winner.display_order || index + 1}</span>
                                                        </div>
                                                    </td>
                                                    <td className={`p-2 text-${currentTheme.text}`}>{winner.display_name}{winner.admin_notes && <span className={`ml-1 text-${currentTheme.textMuted}`}>📝</span>}</td>
                                                    <td className={`p-2 text-${currentTheme.text}`}>{winner.display_text}</td>
                                                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${winner.game_type === 'slots' ? 'bg-purple-500/20 text-purple-400' : winner.game_type === 'match' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>{winner.game_type || '?'}</span></td>
                                                    <td className={`p-2 text-${currentTheme.textMuted} text-xs`}>{formatDate(winner.week_start)}</td>
                                                    <td className="p-2 text-center"><button onClick={() => toggleBoardVisibility(winner)} disabled={saving === winner.id} className={`px-2 py-0.5 rounded text-xs ${winner.is_visible ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{saving === winner.id ? '...' : winner.is_visible ? '👁' : '🚫'}</button></td>
                                                    <td className="p-2 text-center"><button onClick={() => toggleFeatured(winner)} disabled={saving === winner.id} className={`px-2 py-0.5 rounded text-xs ${winner.is_featured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{saving === winner.id ? '...' : winner.is_featured ? '⭐' : '☆'}</button></td>
                                                    <td className="p-2 text-right">
                                                        <button onClick={() => openEditModal(winner)} className="text-blue-400 hover:text-blue-300 text-xs mr-2">✏️</button>
                                                        <button onClick={() => deleteBoardWinner(winner)} disabled={saving === winner.id} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}