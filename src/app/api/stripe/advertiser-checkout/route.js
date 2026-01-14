import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    try {
        const { userId, cardId, amount, guaranteedViews } = await request.json()

        // Get user info
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, username')
            .eq('id', userId)
            .single()

        if (userError || !user) {
            return Response.json({ error: 'User not found' }, { status: 404 })
        }

        // Get business card info
        const { data: card, error: cardError } = await supabase
            .from('business_cards')
            .select('business_name, display_name')
            .eq('id', cardId)
            .single()

        if (cardError || !card) {
            return Response.json({ error: 'Business card not found' }, { status: 404 })
        }

        // Check for existing active/queued campaigns
        const { data: existingCampaigns } = await supabase
            .from('ad_campaigns')
            .select('id')
            .eq('user_id', userId)
            .in('status', ['active', 'queued'])

        const hasExisting = existingCampaigns && existingCampaigns.length > 0
        const newStatus = 'pending_payment'

        // Create pending campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('ad_campaigns')
            .insert([{
                user_id: userId,
                business_card_id: cardId,
                payment_method: 'stripe',
                amount_paid: parseInt(amount),
                views_guaranteed: parseInt(guaranteedViews),
                views_from_game: 0,
                views_from_flips: 0,
                bonus_views: 0,
                status: newStatus
            }])
            .select()
            .single()

        if (campaignError) {
            console.error('Campaign creation error:', campaignError)
            return Response.json({ error: 'Failed to create campaign' }, { status: 500 })
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Ad Campaign - Standard',
                            description: `${parseInt(guaranteedViews).toLocaleString()} guaranteed views for ${card.display_name || card.business_name || 'your business'}`
                        },
                        unit_amount: parseInt(amount) * 100
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/advertise/success?session_id={CHECKOUT_SESSION_ID}&campaign_id=${campaign.id}`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/advertise/start`,
            metadata: {
                type: 'ad_campaign',
                campaign_id: campaign.id,
                user_id: userId,
                has_existing: hasExisting ? 'true' : 'false'
            }
        })

        // Update campaign with Stripe session ID
        await supabase
            .from('ad_campaigns')
            .update({ stripe_session_id: session.id })
            .eq('id', campaign.id)

        return Response.json({ url: session.url, campaignId: campaign.id })

    } catch (error) {
        console.error('Advertiser checkout error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}