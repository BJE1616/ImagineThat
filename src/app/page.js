'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function HomePage() {
    const { currentTheme } = useTheme()
    const [user, setUser] = useState(null)

    // Separate state for each animation to prevent re-triggers
    const [strike1Started, setStrike1Started] = useState(false)
    const [smart1Visible, setSmart1Visible] = useState(false)
    const [strike2Started, setStrike2Started] = useState(false)
    const [smart2Visible, setSmart2Visible] = useState(false)

    useEffect(() => {
        checkUser()

        // Animation sequence - 1.5s strikethrough
        const timer1 = setTimeout(() => setStrike1Started(true), 1500)   // First strikethrough
        const timer2 = setTimeout(() => setSmart1Visible(true), 3200)    // First SMART
        const timer3 = setTimeout(() => setStrike2Started(true), 4500)   // Second strikethrough
        const timer4 = setTimeout(() => setSmart2Visible(true), 6200)    // Second SMART

        return () => {
            clearTimeout(timer1)
            clearTimeout(timer2)
            clearTimeout(timer3)
            clearTimeout(timer4)
        }
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
    }

    return (
        <>
            <style jsx global>{`
                @keyframes drawLineOnce {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .strike-line-1 {
                    animation: drawLineOnce 1.5s linear forwards;
                }
                .strike-line-2 {
                    animation: drawLineOnce 1.5s linear forwards;
                }
            `}</style>

            <div className={`min-h-[calc(100vh-48px)] bg-${currentTheme.bg} relative`}>
                {/* Logo - Top Left */}
                <div className="absolute top-6 left-6">
                    <img
                        src="https://ihckzrkcnwnxldupslst.supabase.co/storage/v1/object/public/business-cards/IT%20LOGO.png"
                        alt="Imagine That"
                        className="w-[115px] h-[115px] object-contain"
                        style={{
                            filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.8))'
                        }}
                    />
                </div>

                {/* Centered Tagline */}
                <div className="flex items-center justify-center min-h-[calc(100vh-48px)] px-4">
                    <div className="text-center">
                        <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-${currentTheme.text}`}>
                            Play{' '}

                            {/* First "Stupid" */}
                            <span className="relative inline-block">
                                {/* Stupid with strikethrough - hidden when SMART appears */}
                                {!smart1Visible && (
                                    <span className={`relative transition-colors duration-1000 ${strike1Started ? 'text-gray-500' : ''}`}>
                                        Stupid
                                        {strike1Started && (
                                            <span
                                                className="strike-line-1 absolute left-0 top-1/2 h-1 bg-red-500"
                                                style={{ transform: 'translateY(-50%)' }}
                                            />
                                        )}
                                    </span>
                                )}

                                {/* SMART - and invisible placeholder for spacing */}
                                {smart1Visible && (
                                    <>
                                        <span
                                            className="absolute left-1/2 top-1/2 font-black whitespace-nowrap"
                                            style={{
                                                transform: 'translate(-50%, -50%) rotate(-12deg)',
                                                fontSize: '1.15em',
                                                background: 'linear-gradient(to right, #8B5CF6, #EC4899, #14B8A6)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                WebkitTextStroke: '2px black',
                                                paintOrder: 'stroke fill',
                                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                                            }}
                                        >
                                            SMART
                                        </span>
                                        <span className="invisible">Stupid</span>
                                    </>
                                )}
                            </span>

                            {' '}Games.
                            <br className="sm:hidden" />{' '}
                            Win{' '}

                            {/* Second "Stupid" */}
                            <span className="relative inline-block">
                                {/* Stupid with strikethrough - hidden when SMART appears */}
                                {!smart2Visible && (
                                    <span className={`relative transition-colors duration-1000 ${strike2Started ? 'text-gray-500' : ''}`}>
                                        Stupid
                                        {strike2Started && (
                                            <span
                                                className="strike-line-2 absolute left-0 top-1/2 h-1 bg-red-500"
                                                style={{ transform: 'translateY(-50%)' }}
                                            />
                                        )}
                                    </span>
                                )}

                                {/* SMART - and invisible placeholder for spacing */}
                                {smart2Visible && (
                                    <>
                                        <span
                                            className="absolute left-1/2 top-1/2 font-black whitespace-nowrap"
                                            style={{
                                                transform: 'translate(-50%, -50%) rotate(-12deg)',
                                                fontSize: '1.15em',
                                                background: 'linear-gradient(to right, #8B5CF6, #EC4899, #14B8A6)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                WebkitTextStroke: '2px black',
                                                paintOrder: 'stroke fill',
                                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                                            }}
                                        >
                                            SMART
                                        </span>
                                        <span className="invisible">Stupid</span>
                                    </>
                                )}
                            </span>

                            {' '}Prizes.
                        </h1>
                    </div>
                </div>
            </div>
        </>
    )
}