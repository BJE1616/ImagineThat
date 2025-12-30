import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'placeholder')

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const body = await request.text()
        const signature = request.headers.get('stripe-signature')

        let event

        // Verify webhook signature (if webhook secret is configured)
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

            const orderId = session.metadata?.order_id
            const userId = session.metadata?.user_id
            const itemId = session.metadata?.item_id

            if (orderId) {
                // Update order status to paid
                await supabase
                    .from('merch_orders')
                    .update({
                        status: 'pending',
                        stripe_payment_id: session.payment_intent,
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

                console.log('✅ Payment completed for order:', orderId)
            }
        }

        return Response.json({ received: true })

    } catch (error) {
        console.error('Webhook error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}