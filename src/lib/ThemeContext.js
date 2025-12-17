'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const themes = {
    'dark-amber': {
        name: 'Dark Amber (Default)',
        primary: 'amber',
        bg: 'slate-900',
        card: 'slate-800',
        border: 'slate-700',
        accent: 'amber-500',
        accentHover: 'amber-400',
        text: 'white',
        textMuted: 'slate-400',
        mode: 'dark'
    },
    'dark-blue': {
        name: 'Dark Blue',
        primary: 'blue',
        bg: 'slate-900',
        card: 'slate-800',
        border: 'slate-700',
        accent: 'blue-500',
        accentHover: 'blue-400',
        text: 'white',
        textMuted: 'slate-400',
        mode: 'dark'
    },
    'dark-green': {
        name: 'Dark Green',
        primary: 'green',
        bg: 'slate-900',
        card: 'slate-800',
        border: 'slate-700',
        accent: 'emerald-500',
        accentHover: 'emerald-400',
        text: 'white',
        textMuted: 'slate-400',
        mode: 'dark'
    },
    'dark-purple': {
        name: 'Dark Purple',
        primary: 'purple',
        bg: 'slate-900',
        card: 'slate-800',
        border: 'slate-700',
        accent: 'purple-500',
        accentHover: 'purple-400',
        text: 'white',
        textMuted: 'slate-400',
        mode: 'dark'
    },
    'dark-red': {
        name: 'Dark Red',
        primary: 'red',
        bg: 'slate-900',
        card: 'slate-800',
        border: 'slate-700',
        accent: 'rose-500',
        accentHover: 'rose-400',
        text: 'white',
        textMuted: 'slate-400',
        mode: 'dark'
    },
    'light-blue': {
        name: 'Light Blue',
        primary: 'blue',
        bg: 'gray-100',
        card: 'white',
        border: 'gray-200',
        accent: 'blue-600',
        accentHover: 'blue-500',
        text: 'gray-900',
        textMuted: 'gray-500',
        mode: 'light'
    },
    'light-green': {
        name: 'Light Green',
        primary: 'green',
        bg: 'gray-100',
        card: 'white',
        border: 'gray-200',
        accent: 'emerald-600',
        accentHover: 'emerald-500',
        text: 'gray-900',
        textMuted: 'gray-500',
        mode: 'light'
    },
    'light-purple': {
        name: 'Light Purple',
        primary: 'purple',
        bg: 'gray-100',
        card: 'white',
        border: 'gray-200',
        accent: 'purple-600',
        accentHover: 'purple-500',
        text: 'gray-900',
        textMuted: 'gray-500',
        mode: 'light'
    }
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('dark-amber')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadTheme()
    }, [])

    const loadTheme = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'site_theme')
                .single()

            if (data?.setting_value && themes[data.setting_value]) {
                setTheme(data.setting_value)
            }
        } catch (error) {
            console.error('Error loading theme:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateTheme = async (newTheme) => {
        if (!themes[newTheme]) return

        setTheme(newTheme)

        try {
            const { data: existing } = await supabase
                .from('admin_settings')
                .select('id')
                .eq('setting_key', 'site_theme')
                .single()

            if (existing) {
                await supabase
                    .from('admin_settings')
                    .update({ setting_value: newTheme })
                    .eq('setting_key', 'site_theme')
            } else {
                await supabase
                    .from('admin_settings')
                    .insert([{ setting_key: 'site_theme', setting_value: newTheme }])
            }
        } catch (error) {
            console.error('Error saving theme:', error)
        }
    }

    return (
        <ThemeContext.Provider value={{ theme, themes, updateTheme, loading, currentTheme: themes[theme] }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)