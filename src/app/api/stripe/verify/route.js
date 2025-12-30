import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'placeholder')
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const { sessionId } = await request.json()

        if (!sessionId) {
            return Response.json({ error: 'No session ID provided' }, { status: 400 })
        }

        // Get the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId)

        if (session.payment_status !== 'paid') {
            return Response.json({ error: 'Payment not completed' }, { status: 400 })
        }

        // Find the order by stripe_session_id
        const { data: order, error: findError } = await supabase
            .from('merch_orders')
            .select('*')
            .eq('stripe_session_id', sessionId)
            .single()

        if (findError || !order) {
            return Response.json({ error: 'Order not found' }, { status: 404 })
        }

        // Update the order if not already updated
        if (!order.paid_at) {
            const { error: updateError } = await supabase
                .from('merch_orders')
                .update({
                    status: 'pending',
                    stripe_payment_id: session.payment_intent,
                    paid_at: new Date().toISOString()
                })
                .eq('id', order.id)

            if (updateError) {
                console.error('Order update error:', updateError)
                return Response.json({ error: 'Failed to update order' }, { status: 500 })
            }

            // Update stock if in_stock item
            const { data: item } = await supabase
                .from('merch_items')
                .select('item_type, stock_quantity')
                .eq('id', order.item_id)
                .single()

            if (item?.item_type === 'in_stock' && item.stock_quantity !== null) {
                await supabase
                    .from('merch_items')
                    .update({
                        stock_quantity: item.stock_quantity - 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.item_id)
            }
        }

        return Response.json({ success: true, orderId: order.id })

    } catch (error) {
        console.error('Verification error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}