'use client'

import { useState, useRef, useEffect } from 'react'

// ===== REUSABLE TOOLTIP COMPONENT =====
// Usage: <Tooltip text="Your explanation here">Label Text</Tooltip>

export default function Tooltip({ children, text }) {
    const [isVisible, setIsVisible] = useState(false)
    const [position, setPosition] = useState({ vertical: 'top', horizontal: 'left' })
    const tooltipRef = useRef(null)
    const iconRef = useRef(null)

    // Calculate position when tooltip becomes visible
    useEffect(() => {
        if (isVisible && tooltipRef.current && iconRef.current) {
            const tooltipRect = tooltipRef.current.getBoundingClientRect()
            const iconRect = iconRef.current.getBoundingClientRect()
            const viewportWidth = window.innerWidth

            // Vertical: prefer top, use bottom if not enough space above
            const vertical = iconRect.top - tooltipRect.height - 8 < 0 ? 'bottom' : 'top'

            // Horizontal: check both edges
            let horizontal = 'left'

            // If tooltip would go off right edge when left-aligned, try right-align
            if (iconRect.left + tooltipRect.width > viewportWidth - 16) {
                horizontal = 'right'
            }

            // If tooltip would go off left edge when right-aligned, use left-align
            if (horizontal === 'right' && iconRect.right - tooltipRect.width < 16) {
                horizontal = 'left'
            }

            setPosition({ vertical, horizontal })
        }
    }, [isVisible])

    // Close tooltip when clicking outside (for mobile)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (iconRef.current && !iconRef.current.contains(event.target)) {
                setIsVisible(false)
            }
        }

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isVisible])

    const handleToggle = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsVisible(!isVisible)
    }

    return (
        <span className="inline-flex items-center gap-1.5">
            {/* Label text */}
            {children}

            {/* Info icon wrapper - this is the positioning anchor */}
            <span className="relative inline-flex">
                <button
                    ref={iconRef}
                    type="button"
                    onClick={handleToggle}
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={() => setIsVisible(false)}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white text-[10px] font-bold cursor-help transition-colors flex-shrink-0"
                    aria-label="More info"
                >
                    i
                </button>

                {/* Tooltip bubble - positioned relative to icon */}
                {isVisible && (
                    <span
                        ref={tooltipRef}
                        className={`absolute z-50 px-3 py-2 text-xs text-white bg-slate-900 border border-slate-600 rounded-lg shadow-lg whitespace-normal ${position.vertical === 'top'
                                ? 'bottom-full mb-2'
                                : 'top-full mt-2'
                            } ${position.horizontal === 'right'
                                ? 'right-0'
                                : 'left-0'
                            }`}
                        style={{ width: '220px' }}
                    >
                        {text}
                        {/* Arrow */}
                        <span
                            className={`absolute w-2 h-2 bg-slate-900 border-slate-600 transform rotate-45 ${position.vertical === 'top'
                                    ? 'top-full -mt-1 border-r border-b'
                                    : 'bottom-full -mb-1 border-l border-t'
                                } ${position.horizontal === 'right'
                                    ? 'right-3'
                                    : 'left-3'
                                }`}
                        />
                    </span>
                )}
            </span>
        </span>
    )
}