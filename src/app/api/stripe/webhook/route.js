import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    try {
        const body = await request.text()
        const signature = request.headers.get('stripe-signature')

        let event

        // Verify webhook signature
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            try {
                event = stripe.webhooks.constructEvent(
                    body,
                    signature,
                    process.env.STRIPE_WEBHOOK_SECRET
                )
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message)
                return Response.json({ error: 'Invalid signature' }, { status: 400 })
            }
        } else {
            // For testing without webhook secret
            event = JSON.parse(body)
        }

        // Handle the event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            const paymentType = session.metadata?.type

            // ===== AD CAMPAIGN PAYMENT =====
            if (paymentType === 'ad_campaign') {
                const campaignId = session.metadata?.campaign_id
                const userId = session.metadata?.user_id
                const hasExisting = session.metadata?.has_existing === 'true'

                if (campaignId) {
                    // Determine status: queued if they have existing active campaigns, otherwise active
                    const newStatus = hasExisting ? 'queued' : 'active'

                    // Update campaign status
                    await supabase
                        .from('ad_campaigns')
                        .update({
                            status: newStatus,
                            payment_id: session.payment_intent,
                            paid_at: new Date().toISOString()
                        })
                        .eq('id', campaignId)

                    // Get user info for email
                    const { data: userData } = await supabase
                        .from('users')
                        .select('email, username, first_name')
                        .eq('id', userId)
                        .single()

                    // Get campaign info for email
                    const { data: campaignData } = await supabase
                        .from('ad_campaigns')
                        .select('views_guaranteed, amount_paid')
                        .eq('id', campaignId)
                        .single()

                    // Send confirmation email
                    if (userData?.email) {
                        try {
                            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/send-email`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: newStatus === 'active' ? 'campaign_activated' : 'campaign_queued',
                                    to: userData.email,
                                    data: {
                                        first_name: userData.first_name || userData.username,
                                        username: userData.username,
                                        views: campaignData?.views_guaranteed || 1000,
                                        amount: campaignData?.amount_paid || 100
                                    }
                                })
                            })
                        } catch (emailError) {
                            console.error('Campaign email error:', emailError)
                        }
                    }

                    // Create notification
                    await supabase
                        .from('notifications')
                        .insert([{
                            user_id: userId,
                            type: 'campaign_paid',
                            title: '✅ Payment Received!',
                            message: newStatus === 'active'
                                ? 'Your ad campaign is now live!'
                                : 'Your ad campaign is queued and will go live when your current campaign ends.'
                        }])

                    console.log('✅ Ad campaign payment completed:', campaignId, 'Status:', newStatus)
                }
            }
            // ===== MERCH ORDER PAYMENT =====
            else {
                const orderId = session.metadata?.order_id
                const userId = session.metadata?.user_id
                const itemId = session.metadata?.item_id

                if (orderId) {
                    // Update order status to pending (paid, awaiting fulfillment)
                    await supabase
                        .from('merch_orders')
                        .update({
                            status: 'pending',
                            payment_id: session.payment_intent,
                            paid_at: new Date().toISOString()
                        })
                        .eq('id', orderId)

                    // Update stock if in_stock item
                    const { data: item } = await supabase
                        .from('merch_items')
                        .select('item_type, stock_quantity')
                        .eq('id', itemId)
                        .single()

                    if (item?.item_type === 'in_stock' && item.stock_quantity !== null) {
                        await supabase
                            .from('merch_items')
                            .update({
                                stock_quantity: item.stock_quantity - 1,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', itemId)
                    }

                    console.log('✅ Merch payment completed for order:', orderId)
                }
            }
        }

        return Response.json({ received: true })

    } catch (error) {
        console.error('Webhook error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}