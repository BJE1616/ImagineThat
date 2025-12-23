'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function IPGeographyPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [hasAccess, setHasAccess] = useState(false)
    const [activeTab, setActiveTab] = useState('map') // 'map', 'list', 'fraud', 'stats'

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

    // Map
    const mapRef = useRef(null)
    const mapInstanceRef = useRef(null)
    const markersRef = useRef([])

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
            initMap()
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

            // Check permission setting
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
            // Load IP logs with location data
            const { data: logs, error } = await supabase
                .from('user_ip_logs')
                .select('*')
                .not('latitude', 'is', null)
                .order('created_at', { ascending: false })

            if (error) throw error

            setIpLogs(logs || [])

            // Get unique user IDs
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

            // Calculate stats
            calculateStats(logs || [])

            // Find fraud alerts (IPs with multiple users)
            findFraudAlerts(logs || [])

        } catch (error) {
            console.error('Error loading data:', error)
        }
    }

    const calculateStats = (logs) => {
        const uniqueUsers = new Set(logs.map(l => l.user_id)).size
        const uniqueIPs = new Set(logs.map(l => l.ip_address)).size

        // Count by country
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

        // Count by city
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
        // Group by IP
        const ipUsers = {}
        logs.forEach(l => {
            if (!ipUsers[l.ip_address]) {
                ipUsers[l.ip_address] = new Set()
            }
            ipUsers[l.ip_address].add(l.user_id)
        })

        // Find IPs with multiple users
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

    const initMap = async () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
        }

        // Dynamically load Leaflet
        if (typeof window !== 'undefined' && !window.L) {
            // Add CSS
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(link)

            // Add JS
            await new Promise((resolve) => {
                const script = document.createElement('script')
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
                script.onload = resolve
                document.head.appendChild(script)
            })

            // Add marker cluster CSS
            const clusterCss = document.createElement('link')
            clusterCss.rel = 'stylesheet'
            clusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css'
            document.head.appendChild(clusterCss)

            const clusterDefaultCss = document.createElement('link')
            clusterDefaultCss.rel = 'stylesheet'
            clusterDefaultCss.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css'
            document.head.appendChild(clusterDefaultCss)

            // Add marker cluster JS
            await new Promise((resolve) => {
                const script = document.createElement('script')
                script.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'
                script.onload = resolve
                document.head.appendChild(script)
            })
        }

        // Wait a tick for Leaflet to be ready
        await new Promise(resolve => setTimeout(resolve, 100))

        if (!mapRef.current || !window.L) return

        const L = window.L

        // Create map
        const map = L.map(mapRef.current).setView([39.8283, -98.5795], 4) // Center on USA

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map)

        mapInstanceRef.current = map

        // Create marker cluster group
        const markers = L.markerClusterGroup()

        // Group logs by location for aggregation
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

        // Add markers
        Object.values(locationGroups).forEach(loc => {
            const userList = Array.from(loc.users).map(uid => {
                const u = users[uid]
                return u ? (u.username || u.email || 'Unknown') : 'Unknown'
            }).join('<br>')

            const popup = `
                <div style="min-width: 150px;">
                    <strong>${loc.city || 'Unknown'}, ${loc.country || ''}</strong><br>
                    <hr style="margin: 5px 0;">
                    <strong>Users (${loc.users.size}):</strong><br>
                    ${userList}<br>
                    <hr style="margin: 5px 0;">
                    <small>Total logins: ${loc.logins}</small>
                </div>
            `

            const marker = L.marker([loc.lat, loc.lng])
                .bindPopup(popup)

            markers.addLayer(marker)
        })

        map.addLayer(markers)

        // Fit bounds if we have markers
        if (Object.keys(locationGroups).length > 0) {
            const bounds = markers.getBounds()
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] })
            }
        }
    }

    const getUserLogins = (userId) => {
        return ipLogs.filter(l => l.user_id === userId)
    }

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

    // Aggregate users for list view
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
        return Object.values(userAgg).sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
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

    return (
        <div className="p-4">
            {/* Header */}
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>🌍 User Geography</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Track where your users are coming from</p>
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
                        {tab === 'map' && '🗺️ Map'}
                        {tab === 'list' && '📋 User List'}
                        {tab === 'stats' && '📊 Stats'}
                        {tab === 'fraud' && `🚨 Fraud ${fraudAlerts.length > 0 ? `(${fraudAlerts.length})` : ''}`}
                    </button>
                ))}
            </div>

            {/* Map Tab */}
            {activeTab === 'map' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                    {ipLogs.filter(l => l.latitude).length === 0 ? (
                        <div className="p-8 text-center">
                            <p className={`text-${currentTheme.textMuted}`}>No location data yet.</p>
                            <p className={`text-${currentTheme.textMuted} text-sm mt-2`}>Locations will appear as users log in from real IPs (not localhost).</p>
                        </div>
                    ) : (
                        <div ref={mapRef} style={{ height: '500px', width: '100%' }}></div>
                    )}
                </div>
            )}

            {/* User List Tab */}
            {activeTab === 'list' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                    <th className="text-left py-2 px-3">User</th>
                                    <th className="text-left py-2 px-3">Email</th>
                                    <th className="text-left py-2 px-3">Location</th>
                                    <th className="text-left py-2 px-3">Logins</th>
                                    <th className="text-left py-2 px-3">Last Login</th>
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

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Top Countries */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h3 className={`text-${currentTheme.text} font-bold mb-3`}>🌍 Top Countries</h3>
                        {stats.countries.length === 0 ? (
                            <p className={`text-${currentTheme.textMuted} text-sm`}>No data yet</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.countries.map((c, i) => (
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

                    {/* Top Cities */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h3 className={`text-${currentTheme.text} font-bold mb-3`}>🏙️ Top Cities</h3>
                        {stats.cities.length === 0 ? (
                            <p className={`text-${currentTheme.textMuted} text-sm`}>No data yet</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.cities.map((c, i) => (
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
            )}

            {/* Fraud Tab */}
            {activeTab === 'fraud' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                    {fraudAlerts.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-4xl mb-2">✅</p>
                            <p className={`text-${currentTheme.text} font-medium`}>No fraud alerts</p>
                            <p className={`text-${currentTheme.textMuted} text-sm mt-1`}>No IPs with multiple user accounts detected</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                        <th className="text-left py-2 px-3">IP Address</th>
                                        <th className="text-left py-2 px-3"># Accounts</th>
                                        <th className="text-left py-2 px-3">Users</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fraudAlerts.map(alert => (
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Info */}
            <div className={`mt-4 text-${currentTheme.textMuted} text-xs`}>
                <p>📍 Location data is captured on login/registration. Localhost IPs (::1, 127.0.0.1) don't have location data.</p>
            </div>
        </div>
    )
}