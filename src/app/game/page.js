'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function GamePage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [cards, setCards] = useState([])
    const [flippedCards, setFlippedCards] = useState([])
    const [matchedPairs, setMatchedPairs] = useState([])
    const [moves, setMoves] = useState(0)
    const [gameStarted, setGameStarted] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            // Check if user is logged in (optional - game works for everyone)
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)
            await loadCards()
        } catch (error) {
            console.error('Error:', error)
            await loadCards() // Load cards anyway even if not logged in
        } finally {
            setLoading(false)
        }
    }

    const loadCards = async () => {
        try {
            const { data, error } = await supabase
                .from('business_cards')
                .select('*')
                .limit(6)

            if (error) throw error

            // Create pairs of cards
            const cardPairs = [...data, ...data].map((card, index) => ({
                ...card,
                uniqueId: index,
                isFlipped: false,
                isMatched: false
            }))

            // Shuffle cards
            const shuffled = cardPairs.sort(() => Math.random() - 0.5)
            setCards(shuffled)
        } catch (error) {
            console.error('Error loading cards:', error)
        }
    }

    const startGame = () => {
        setGameStarted(true)
        setMoves(0)
        setMatchedPairs([])
        setFlippedCards([])
        loadCards()
    }

    const handleCardClick = (clickedCard) => {
        if (!gameStarted) return
        if (flippedCards.length === 2) return
        if (flippedCards.some(card => card.uniqueId === clickedCard.uniqueId)) return
        if (matchedPairs.includes(clickedCard.id)) return

        const newFlipped = [...flippedCards, clickedCard]
        setFlippedCards(newFlipped)

        if (newFlipped.length === 2) {
            setMoves(moves + 1)

            // Check for match
            if (newFlipped[0].id === newFlipped[1].id) {
                setMatchedPairs([...matchedPairs, newFlipped[0].id])
                setTimeout(() => setFlippedCards([]), 500)
            } else {
                setTimeout(() => setFlippedCards([]), 1000)
            }
        }
    }

    const isCardFlipped = (card) => {
        return flippedCards.some(c => c.uniqueId === card.uniqueId) || matchedPairs.includes(card.id)
    }

    const isGameComplete = () => {
        return matchedPairs.length === 6 && gameStarted
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-gray-600">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Memory Card Game</h1>
                    <div className="flex gap-4">
                        {user ? (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                            >
                                Back to Dashboard
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => router.push('/auth/login')}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => router.push('/auth/register')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Sign Up
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {!user && !gameStarted && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-6 py-4 rounded-lg mb-6">
                        <p className="text-center">
                            <strong>Want to advertise your business?</strong>
                            <button
                                onClick={() => router.push('/auth/register')}
                                className="ml-2 underline hover:text-blue-900"
                            >
                                Sign up now!
                            </button>
                        </p>
                    </div>
                )}

                {!gameStarted && (
                    <div className="text-center py-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">
                            Match the Business Cards!
                        </h2>
                        <p className="text-lg text-gray-600 mb-8">
                            Find matching pairs of business cards. Click two cards to flip them over.
                        </p>
                        <button
                            onClick={startGame}
                            className="px-8 py-4 bg-indigo-600 text-white text-lg rounded-md hover:bg-indigo-700"
                        >
                            Start Game
                        </button>
                    </div>
                )}

                {gameStarted && (
                    <>
                        <div className="bg-white rounded-lg shadow p-6 mb-6">
                            <div className="flex justify-between items-center">
                                <div className="text-lg">
                                    <span className="font-bold">Moves:</span> {moves}
                                </div>
                                <div className="text-lg">
                                    <span className="font-bold">Matches:</span> {matchedPairs.length} / 6
                                </div>
                                <button
                                    onClick={startGame}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    New Game
                                </button>
                            </div>
                        </div>

                        {isGameComplete() && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg mb-6 text-center">
                                <h3 className="text-2xl font-bold mb-2">🎉 Congratulations!</h3>
                                <p className="text-lg mb-4">You completed the game in {moves} moves!</p>
                                {!user && (
                                    <p className="text-base">
                                        <strong>Love the game?</strong>{' '}
                                        <button
                                            onClick={() => router.push('/auth/register')}
                                            className="underline hover:text-green-900"
                                        >
                                            Sign up to advertise your business!
                                        </button>
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {cards.map((card) => (
                                <div
                                    key={card.uniqueId}
                                    onClick={() => handleCardClick(card)}
                                    className="relative h-48 cursor-pointer"
                                >
                                    {!isCardFlipped(card) ? (
                                        <div className="w-full h-full bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow">
                                            <span className="text-6xl text-white">?</span>
                                        </div>
                                    ) : (
                                        card.card_type === 'uploaded' && card.image_url ? (
                                            <div className="w-full h-full rounded-lg shadow-lg overflow-hidden">
                                                <img
                                                    src={card.image_url}
                                                    alt="Business Card"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full h-full rounded-lg p-4 flex flex-col justify-between border-2 shadow-lg"
                                                style={{ backgroundColor: card.card_color || '#fff' }}
                                            >
                                                <div>
                                                    <h3 className="font-bold text-lg mb-2" style={{ color: '#1F2937' }}>{card.title}</h3>
                                                    {card.message && (
                                                        <p className="text-sm line-clamp-2" style={{ color: '#4B5563' }}>{card.message}</p>
                                                    )}
                                                </div>
                                                <div className="text-xs space-y-1" style={{ color: '#6B7280' }}>
                                                    <p>{card.phone}</p>
                                                    <p>{card.email}</p>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}