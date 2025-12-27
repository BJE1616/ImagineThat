'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminIndexPage() {
    const router = useRouter()
    const { currentTheme } = useTheme()
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        checkAccessAndRedirect()
    }, [])

    const checkAccessAndRedirect = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/admin/login')
                return
            }

            // Get user role
            const { data: userData } = await supabase
                .from('users')
                .select('is_admin, role')
                .eq('id', user.id)
                .single()

            if (!userData?.is_admin) {
                router.push('/dashboard')
                return
            }

            const role = userData.role || 'support'

            // Super admin always has health access
            if (role === 'super_admin') {
                router.push('/admin/health')
                return
            }

            // Check health dashboard permission for other roles
            const { data: healthPerm } = await supabase
                .from('admin_financial_permissions')
                .select(role)
                .eq('metric_key', 'health_dashboard_access')
                .single()

            // Redirect based on permission
            if (healthPerm && healthPerm[role] === true) {
                router.push('/admin/health')
            } else {
                router.push('/admin/dashboard')
            }

        } catch (error) {
            console.error('Error checking access:', error)
            router.push('/admin/dashboard')
        }
    }

    return (
        <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
            <div className="flex flex-col items-center gap-4">
                <div className={`w-12 h-12 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                <p className={`text-${currentTheme.textMuted} font-medium`}>Loading admin panel...</p>
            </div>
        </div>
    )
}