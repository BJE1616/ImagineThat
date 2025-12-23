import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
    try {
        const { userId, eventType } = await request.json()

        if (!userId || !eventType) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Get IP from headers
        const headersList = await headers()
        const forwardedFor = headersList.get('x-forwarded-for')
        const realIp = headersList.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'

        // Get geolocation data from free API
        let geoData = {
            city: null,
            region: null,
            country: null,
            country_code: null,
            latitude: null,
            longitude: null
        }

        if (ip && ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
            try {
                const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country,countryCode,lat,lon`)
                const geoJson = await geoResponse.json()

                if (geoJson.status === 'success') {
                    geoData = {
                        city: geoJson.city,
                        region: geoJson.regionName,
                        country: geoJson.country,
                        country_code: geoJson.countryCode,
                        latitude: geoJson.lat,
                        longitude: geoJson.lon
                    }
                }
            } catch (geoError) {
                console.log('Geolocation lookup failed:', geoError)
            }
        }

        // Save to database
        const { error } = await supabase
            .from('user_ip_logs')
            .insert([{
                user_id: userId,
                ip_address: ip,
                city: geoData.city,
                region: geoData.region,
                country: geoData.country,
                country_code: geoData.country_code,
                latitude: geoData.latitude,
                longitude: geoData.longitude,
                event_type: eventType
            }])

        if (error) {
            console.error('Error saving IP log:', error)
            return Response.json({ error: 'Failed to save IP log' }, { status: 500 })
        }

        return Response.json({ success: true })
    } catch (error) {
        console.error('IP logging error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
}