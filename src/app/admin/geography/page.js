'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function IPGeographyPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [hasAccess, setHasAccess] = useState(false)
    const [activeTab, setActiveTab] = useState('map')

    // Data
    const [ipLogs, setIpLogs] = useState([])
    const [users, setUsers] = useState({})
    const [stats, setStats] = useState({
        totalLogs: 0,
        uniqueUsers: 0,
        uniqueIPs: 0,
        countries: [],
        cities: []
    })
    const [fraudAlerts, setFraudAlerts] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)

    // Sorting for User List
    const [sortField, setSortField] = useState('lastLogin')
    const [sortDir, setSortDir] = useState('desc')

    // Time filters
    const [statsTimeFilter, setStatsTimeFilter] = useState('all')
    const [fraudTimeFilter, setFraudTimeFilter] = useState('all')

    // Globe
    const globeRef = useRef(null)
    const globeInstanceRef = useRef(null)

    useEffect(() => {
        checkAccess()
    }, [])

    useEffect(() => {
        if (hasAccess) {
            loadData()
        }
    }, [hasAccess])

    useEffect(() => {
        if (hasAccess && activeTab === 'map' && ipLogs.length > 0 && Object.keys(users).length > 0) {
            initGlobe()
        }
    }, [hasAccess, activeTab, ipLogs, users])

    const checkAccess = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('id, email, role')
                .eq('id', user.id)
                .single()

            setCurrentUser(userData)

            const { data: setting } = await supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'ip_map_visible_to')
                .single()

            const visibleTo = setting?.setting_value || 'super_admin'

            if (visibleTo === 'super_admin' && userData?.role === 'super_admin') {
                setHasAccess(true)
            } else if (visibleTo === 'admin' && ['super_admin', 'admin'].includes(userData?.role)) {
                setHasAccess(true)
            } else if (visibleTo === 'all_admins' && userData?.role) {
                setHasAccess(true)
            }

        } catch (error) {
            console.error('Error checking access:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadData = async () => {
        try {
            const { data: logs, error } = await supabase
                .from('user_ip_logs')
                .select('*')
                .not('latitude', 'is', null)
                .order('created_at', { ascending: false })

            if (error) throw error

            setIpLogs(logs || [])

            const userIds = [...new Set(logs?.map(l => l.user_id) || [])]

            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, first_name, last_name, created_at')
                    .in('id', userIds)

                const usersMap = {}
                usersData?.forEach(u => {
                    usersMap[u.id] = u
                })
                setUsers(usersMap)
            }

            calculateStats(logs || [])
            findFraudAlerts(logs || [])

        } catch (error) {
            console.error('Error loading data:', error)
        }
    }

    const calculateStats = (logs) => {
        const uniqueUsers = new Set(logs.map(l => l.user_id)).size
        const uniqueIPs = new Set(logs.map(l => l.ip_address)).size

        const countryCount = {}
        logs.forEach(l => {
            if (l.country) {
                countryCount[l.country] = (countryCount[l.country] || 0) + 1
            }
        })
        const countries = Object.entries(countryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }))

        const cityCount = {}
        logs.forEach(l => {
            if (l.city) {
                const key = `${l.city}, ${l.country_code || ''}`
                cityCount[key] = (cityCount[key] || 0) + 1
            }
        })
        const cities = Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }))

        setStats({
            totalLogs: logs.length,
            uniqueUsers,
            uniqueIPs,
            countries,
            cities
        })
    }

    const findFraudAlerts = (logs) => {
        const ipUsers = {}
        logs.forEach(l => {
            if (!ipUsers[l.ip_address]) {
                ipUsers[l.ip_address] = new Set()
            }
            ipUsers[l.ip_address].add(l.user_id)
        })

        const alerts = Object.entries(ipUsers)
            .filter(([ip, users]) => users.size > 1 && ip !== '::1' && ip !== '127.0.0.1')
            .map(([ip, userSet]) => ({
                ip,
                userIds: Array.from(userSet),
                count: userSet.size
            }))
            .sort((a, b) => b.count - a.count)

        setFraudAlerts(alerts)
    }

    // Filter logs by time period
    const filterLogsByTime = (logs, timeFilter) => {
        const now = new Date()

        if (timeFilter === 'today') {
            const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
            return logs.filter(log => new Date(log.created_at) >= oneDayAgo)
        } else if (timeFilter === 'week') {
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
            return logs.filter(log => new Date(log.created_at) >= oneWeekAgo)
        } else if (timeFilter === 'month') {
            const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
            return logs.filter(log => new Date(log.created_at) >= oneMonthAgo)
        }
        return logs
    }

    // Get filtered stats
    const getFilteredStats = () => {
        const filteredLogs = filterLogsByTime(ipLogs, statsTimeFilter)

        const countryCount = {}
        filteredLogs.forEach(l => {
            if (l.country) {
                countryCount[l.country] = (countryCount[l.country] || 0) + 1
            }
        })
        const countries = Object.entries(countryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }))

        const cityCount = {}
        filteredLogs.forEach(l => {
            if (l.city) {
                const key = `${l.city}, ${l.country_code || ''}`
                cityCount[key] = (cityCount[key] || 0) + 1
            }
        })
        const cities = Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }))

        return { countries, cities, totalLogins: filteredLogs.length }
    }

    // Get filtered fraud alerts
    const getFilteredFraudAlerts = () => {
        const filteredLogs = filterLogsByTime(ipLogs, fraudTimeFilter)

        const ipUsers = {}
        const ipLastSeen = {}

        filteredLogs.forEach(l => {
            if (!ipUsers[l.ip_address]) {
                ipUsers[l.ip_address] = new Set()
                ipLastSeen[l.ip_address] = l.created_at
            }
            ipUsers[l.ip_address].add(l.user_id)
            if (new Date(l.created_at) > new Date(ipLastSeen[l.ip_address])) {
                ipLastSeen[l.ip_address] = l.created_at
            }
        })

        return Object.entries(ipUsers)
            .filter(([ip, users]) => users.size > 1 && ip !== '::1' && ip !== '127.0.0.1')
            .map(([ip, userSet]) => ({
                ip,
                userIds: Array.from(userSet),
                count: userSet.size,
                lastSeen: ipLastSeen[ip]
            }))
            .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    }

    const initGlobe = async () => {
        if (globeInstanceRef.current) {
            globeInstanceRef.current = null
            if (globeRef.current) {
                globeRef.current.innerHTML = ''
            }
        }

        if (typeof window !== 'undefined' && !window.THREE) {
            await new Promise((resolve) => {
                const script = document.createElement('script')
                script.src = 'https://unpkg.com/three@0.152.0/build/three.min.js'
                script.onload = resolve
                document.head.appendChild(script)
            })
        }

        if (typeof window !== 'undefined' && !window.Globe) {
            await new Promise((resolve) => {
                const script = document.createElement('script')
                script.src = 'https://unpkg.com/globe.gl@2.27.0/dist/globe.gl.min.js'
                script.onload = resolve
                document.head.appendChild(script)
            })
        }

        await new Promise(resolve => setTimeout(resolve, 100))

        if (!globeRef.current || !window.Globe) return

        const locationGroups = {}
        ipLogs.forEach(log => {
            if (log.latitude && log.longitude) {
                const key = `${log.latitude.toFixed(2)},${log.longitude.toFixed(2)}`
                if (!locationGroups[key]) {
                    locationGroups[key] = {
                        lat: log.latitude,
                        lng: log.longitude,
                        city: log.city,
                        country: log.country,
                        users: new Set(),
                        logins: 0
                    }
                }
                locationGroups[key].users.add(log.user_id)
                locationGroups[key].logins++
            }
        })

        const pins = Object.values(locationGroups).map(loc => {
            const userList = Array.from(loc.users).map(uid => {
                const u = users[uid]
                return u ? (u.username || u.email || 'Unknown') : 'Unknown'
            })

            return {
                lat: loc.lat,
                lng: loc.lng,
                city: loc.city || 'Unknown',
                country: loc.country || '',
                users: userList,
                userCount: loc.users.size,
                logins: loc.logins,
                size: Math.min(0.3 + (loc.logins * 0.05), 0.8),
                altitude: 0
            }
        })

        const countryLabels = [...new Set(pins.map(p => p.country).filter(Boolean))].map(country => {
            const pin = pins.find(p => p.country === country)
            return {
                lat: pin.lat,
                lng: pin.lng,
                text: country
            }
        })

        const globe = window.Globe()
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            .polygonsData([])
            .polygonCapColor(() => 'rgba(0,0,0,0)')
            .polygonSideColor(() => 'rgba(0,0,0,0)')
            .polygonStrokeColor(() => '#ffcc00')
            .polygonAltitude(0.001)
            .pointsData(pins)
            .pointLat('lat')
            .pointLng('lng')
            .pointAltitude('altitude')
            .pointRadius('size')
            .pointColor(() => '#ef4444')
            .pointLabel(d => `
                <div style="background: rgba(0,0,0,0.85); padding: 12px; border-radius: 8px; color: white; font-size: 12px; border: 1px solid #facc15;">
                    <strong style="color: #facc15;">${d.city}, ${d.country}</strong><br/>
                    <hr style="margin: 6px 0; border-color: #444;"/>
                    <strong>Users (${d.userCount}):</strong><br/>
                    ${d.users.join('<br/>')}
                    <hr style="margin: 6px 0; border-color: #444;"/>
                    <small>Total logins: ${d.logins}</small>
                </div>
            `)
            .labelsData(countryLabels)
            .labelLat('lat')
            .labelLng('lng')
            .labelText('text')
            .labelSize(0.8)
            .labelColor(() => '#ffffff')
            .labelResolution(2)
            .labelAltitude(0.01)
            .width(globeRef.current.offsetWidth)
            .height(500)
            (globeRef.current)

        globe.pointOfView({ lat: 39.8, lng: -98.5, altitude: 2 }, 1000)

        fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
            .then(res => res.json())
            .then(countries => {
                globe.polygonsData(countries.features)
            })

        const controls = globe.controls()
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.5

        controls.addEventListener('start', () => {
            controls.autoRotate = false
        })

        globeInstanceRef.current = globe

        const handleResize = () => {
            if (globeRef.current && globeInstanceRef.current) {
                globeInstanceRef.current.width(globeRef.current.offsetWidth)
            }
        }
        window.addEventListener('resize', handleResize)
    }

    const getUserList = () => {
        const userAgg = {}
        ipLogs.forEach(log => {
            if (!userAgg[log.user_id]) {
                userAgg[log.user_id] = {
                    userId: log.user_id,
                    logins: 0,
                    lastLogin: null,
                    city: null,
                    country: null,
                    countryCode: null
                }
            }
            userAgg[log.user_id].logins++
            if (!userAgg[log.user_id].lastLogin || new Date(log.created_at) > new Date(userAgg[log.user_id].lastLogin)) {
                userAgg[log.user_id].lastLogin = log.created_at
                userAgg[log.user_id].city = log.city
                userAgg[log.user_id].country = log.country
                userAgg[log.user_id].countryCode = log.country_code
            }
        })

        return Object.values(userAgg).sort((a, b) => {
            let aVal, bVal
            if (sortField === 'lastLogin') {
                aVal = new Date(a.lastLogin || 0)
                bVal = new Date(b.lastLogin || 0)
            } else if (sortField === 'logins') {
                aVal = a.logins
                bVal = b.logins
            } else if (sortField === 'user') {
                aVal = (users[a.userId]?.username || users[a.userId]?.email || '').toLowerCase()
                bVal = (users[b.userId]?.username || users[b.userId]?.email || '').toLowerCase()
            } else if (sortField === 'location') {
                aVal = (a.city || '').toLowerCase()
                bVal = (b.city || '').toLowerCase()
            }

            if (sortDir === 'asc') {
                return aVal > bVal ? 1 : -1
            } else {
                return aVal < bVal ? 1 : -1
            }
        })
    }

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <span className="ml-1 text-gray-500">↕</span>
        return <span className="ml-1 text-yellow-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
    }

    const TimeFilterButtons = ({ value, onChange }) => (
        <div className="flex gap-2 mb-4">
            {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'all', label: 'All Time' }
            ].map(filter => (
                <button
                    key={filter.key}
                    onClick={() => onChange(filter.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${value === filter.key
                            ? 'bg-yellow-500 text-black'
                            : `bg-${currentTheme.card} text-${currentTheme.textMuted} border border-${currentTheme.border} hover:bg-${currentTheme.border}`
                        }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    )

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now - date
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    const getCountryFlag = (countryCode) => {
        if (!countryCode) return '🌍'
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0))
        return String.fromCodePoint(...codePoints)
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    if (!hasAccess) {
        return (
            <div className="p-4">
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
                    <h2 className="font-bold text-lg mb-2">🚫 Access Denied</h2>
                    <p>You don't have permission to view User Geography.</p>
                </div>
            </div>
        )
    }

    const filteredFraudAlerts = getFilteredFraudAlerts()

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>🌍 User Geography</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Registered users and their login locations</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Logins Tracked</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.totalLogs.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Unique Users</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.uniqueUsers.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Unique IPs</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.uniqueIPs.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Fraud Alerts</p>
                    <p className={`text-xl font-bold ${fraudAlerts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {fraudAlerts.length}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {['map', 'list', 'stats', 'fraud'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                            : `bg-${currentTheme.card} text-${currentTheme.textMuted} hover:bg-${currentTheme.border}`
                            }`}
                    >
                        {tab === 'map' && '🌐 Registered Users'}
                        {tab === 'list' && `📋 User List (${getUserList().length})`}
                        {tab === 'stats' && '📊 Stats'}
                        {tab === 'fraud' && `🚨 Fraud ${fraudAlerts.length > 0 ? `(${fraudAlerts.length})` : ''}`}
                    </button>
                ))}
            </div>

            {activeTab === 'map' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                    {ipLogs.filter(l => l.latitude).length === 0 ? (
                        <div className="p-8 text-center">
                            <p className={`text-${currentTheme.textMuted}`}>No location data yet.</p>
                            <p className={`text-${currentTheme.textMuted} text-sm mt-2`}>Locations will appear as users log in from real IPs (not localhost).</p>
                        </div>
                    ) : (
                        <div ref={globeRef} style={{ height: '500px', width: '100%' }}></div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                    <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('user')}>User<SortIcon field="user" /></th>
                                    <th className="text-left py-2 px-3">Email</th>
                                    <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('location')}>Location<SortIcon field="location" /></th>
                                    <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('logins')}>Logins<SortIcon field="logins" /></th>
                                    <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('lastLogin')}>Last Login<SortIcon field="lastLogin" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {getUserList().length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                            No user data yet
                                        </td>
                                    </tr>
                                ) : (
                                    getUserList().map(row => {
                                        const user = users[row.userId]
                                        return (
                                            <tr
                                                key={row.userId}
                                                className={`border-t border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 cursor-pointer`}
                                                onClick={() => setSelectedUser(selectedUser === row.userId ? null : row.userId)}
                                            >
                                                <td className={`py-2 px-3 text-${currentTheme.text} font-medium`}>
                                                    {user?.username || 'Unknown'}
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                    {user?.email || '-'}
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.text}`}>
                                                    {getCountryFlag(row.countryCode)} {row.city || 'Unknown'}{row.country ? `, ${row.country}` : ''}
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                    {row.logins}
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                    {formatDate(row.lastLogin)}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'stats' && (
                <>
                    <TimeFilterButtons value={statsTimeFilter} onChange={setStatsTimeFilter} />
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                            <h3 className={`text-${currentTheme.text} font-bold mb-3`}>🌍 Top Countries</h3>
                            {getFilteredStats().countries.length === 0 ? (
                                <p className={`text-${currentTheme.textMuted} text-sm`}>No data for this period</p>
                            ) : (
                                <div className="space-y-2">
                                    {getFilteredStats().countries.map((c, i) => (
                                        <div key={c.name} className="flex items-center justify-between">
                                            <span className={`text-${currentTheme.text}`}>
                                                {i + 1}. {c.name}
                                            </span>
                                            <span className={`text-${currentTheme.textMuted} text-sm`}>
                                                {c.count} logins
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                            <h3 className={`text-${currentTheme.text} font-bold mb-3`}>🏙️ Top Cities</h3>
                            {getFilteredStats().cities.length === 0 ? (
                                <p className={`text-${currentTheme.textMuted} text-sm`}>No data for this period</p>
                            ) : (
                                <div className="space-y-2">
                                    {getFilteredStats().cities.map((c, i) => (
                                        <div key={c.name} className="flex items-center justify-between">
                                            <span className={`text-${currentTheme.text}`}>
                                                {i + 1}. {c.name}
                                            </span>
                                            <span className={`text-${currentTheme.textMuted} text-sm`}>
                                                {c.count} logins
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'fraud' && (
                <>
                    <TimeFilterButtons value={fraudTimeFilter} onChange={setFraudTimeFilter} />
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                        {filteredFraudAlerts.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-4xl mb-2">✅</p>
                                <p className={`text-${currentTheme.text} font-medium`}>No fraud alerts</p>
                                <p className={`text-${currentTheme.textMuted} text-sm mt-1`}>No IPs with multiple user accounts detected for this period</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                            <th className="text-left py-2 px-3">IP Address</th>
                                            <th className="text-left py-2 px-3"># Accounts</th>
                                            <th className="text-left py-2 px-3">Users</th>
                                            <th className="text-left py-2 px-3">Last Seen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFraudAlerts.map(alert => (
                                            <tr key={alert.ip} className={`border-t border-${currentTheme.border}/50`}>
                                                <td className={`py-2 px-3 text-${currentTheme.text} font-mono`}>
                                                    {alert.ip}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">
                                                        {alert.count} accounts
                                                    </span>
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                    {alert.userIds.map(uid => {
                                                        const u = users[uid]
                                                        return u?.username || u?.email || uid
                                                    }).join(', ')}
                                                </td>
                                                <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                    {formatDate(alert.lastSeen)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className={`mt-4 text-${currentTheme.textMuted} text-xs`}>
                <p>📍 Location data is captured on login/registration. Localhost IPs (::1, 127.0.0.1) don't have location data.</p>
                <p className="mt-1">🌐 Drag to rotate the globe. Hover over red markers to see user details.</p>
            </div>
        </div>
    )
}