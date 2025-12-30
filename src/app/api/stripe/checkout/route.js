import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'PLACEHOLDER')

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const { itemId, userId, shippingAddress } = await request.json()

        // Get the item details
        const { data: item, error: itemError } = await supabase
            .from('merch_items')
            .select('*')
            .eq('id', itemId)
            .single()

        if (itemError || !item) {
            return Response.json({ error: 'Item not found' }, { status: 404 })
        }

        // Get user email
        const { data: user } = await supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()

        // Get markup settings
        const { data: settings } = await supabase
            .from('admin_settings')
            .select('setting_key, setting_value')
            .eq('setting_key', 'merch_global_markup')
            .single()

        const globalMarkup = parseFloat(settings?.setting_value) || 3.0
        const markup = item.markup_multiplier || globalMarkup
        const priceInCents = Math.round(item.cost * markup * 100)

        // Create pending order in database
        const orderData = {
            user_id: userId,
            item_id: item.id,
            item_name: item.name,
            item_type: item.item_type,
            bb_cost: 0,
            cash_cost: (priceInCents / 100).toFixed(2),
            actual_cost: item.cost,
            status: 'pending',
            payment_method: 'stripe',
            ordered_at: new Date().toISOString()
        }

        // Add shipping address for physical items
        if (item.item_type !== 'digital_gift_card' && shippingAddress) {
            orderData.shipping_address_line1 = shippingAddress.line1
            orderData.shipping_address_line2 = shippingAddress.line2
            orderData.shipping_city = shippingAddress.city
            orderData.shipping_state = shippingAddress.state
            orderData.shipping_zip = shippingAddress.zip
            orderData.shipping_country = shippingAddress.country
        }

        const { data: order, error: orderError } = await supabase
            .from('merch_orders')
            .insert([orderData])
            .select()
            .single()

        if (orderError) {
            console.error('Order creation error:', orderError)
            return Response.json({ error: 'Failed to create order' }, { status: 500 })
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: user?.email,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name,
                            description: item.description || undefined,
                            images: item.image_url ? [item.image_url] : undefined
                        },
                        unit_amount: priceInCents
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/merch`,
            metadata: {
                order_id: order.id,
                item_id: item.id,
                user_id: userId
            }
        })

        // Update order with Stripe session ID
        await supabase
            .from('merch_orders')
            .update({ stripe_session_id: session.id })
            .eq('id', order.id)

        return Response.json({ url: session.url })

    } catch (error) {
        console.error('Stripe checkout error:', error)
        return Response.json({ error: error.message }, { status: 500 })
    }
}