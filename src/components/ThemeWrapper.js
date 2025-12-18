'use client'

import { useTheme } from '@/lib/ThemeContext'

export default function ThemeWrapper({ children }) {
    const { currentTheme, loading } = useTheme()

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900">
                {children}
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} text-${currentTheme.text}`}>
            {children}
        </div>
    )
}