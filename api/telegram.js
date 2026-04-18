
const SUPABASE_URL = 'https://qcqyyfnsfyuaaaacddsm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uXs2e5aPzrIL_M2xsYDmWg_hPOUaG1l';
function generateUUID() { return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
const BOT_TOKEN = '8682463984:AAHA2PWT7WtQRskETmOanj0k2b45ZgGfYIs';
const ADMIN_CHAT_ID = '1538316434';
const SITE_URL = 'https://stride-rite.vercel.app';

const dbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// --- DB HELPERS ---
async function dbGet(table, query = 'select=*') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: dbHeaders });
    return await res.json();
}
async function dbInsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: dbHeaders, body: JSON.stringify(data) });
    return await res.json();
}
async function dbPatch(table, col, val, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
        method: 'PATCH', headers: dbHeaders, body: JSON.stringify(data)
    });
}
async function dbUpsert(table, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(data)
    });
}

// --- TELEGRAM ---
async function sendMessage(chatId, text, replyMarkup = null) {
    const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
}

async function handleLiveTrackingMenu(chatId) {
    const rows = await dbGet('live_tracks', 'id=eq.admin');
    const isActive = rows && rows.length > 0 ? rows[0].is_active : false;
    const text = `🏃 *Live Tracking Control*\n\nStatus: ${isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n\nWhen active, the dashboard will show your live location on the map. Share your *Live Location* in this chat after starting.`;
    const replyMarkup = {
        inline_keyboard: [
            [{ text: isActive ? "🛑 Stop Live Run" : "🏁 Start Live Run", callback_data: `live_track_${isActive ? 'stop' : 'start'}` }],
            [{ text: "↩️ Back to Menu", callback_data: "cmd_menu" }]
        ]
    };
    await sendMessage(chatId, text, replyMarkup);
}

async function handleLiveTrackToggle(chatId, active) {
    await dbUpsert('live_tracks', { id: 'admin', is_active: active, updated_at: new Date().toISOString() });
    await sendMessage(chatId, active ? "🎉 *Live Run Started!*\n\n📍 Now, share your *Live Location* using the paperclip menu." : "🛑 *Live Run Stopped.*");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') { res.status(200).send('Alive'); return; }
    try {
        const body = req.body;

        // GPS UPDATES
        const locationMsg = body.edited_message || body.message;
        if (locationMsg && locationMsg.location) {
            const chatId = locationMsg.chat.id.toString();
            if (chatId === ADMIN_CHAT_ID) {
                const { latitude, longitude } = locationMsg.location;
                await dbPatch('live_tracks', 'id', 'admin', {
                    lat: latitude, lng: longitude, updated_at: new Date().toISOString()
                });
            }
            res.status(200).send('ok'); return;
        }

        if (body.callback_query) {
            const cq = body.callback_query;
            const data = cq.data;
            const chatId = cq.message.chat.id.toString();
            if (chatId === ADMIN_CHAT_ID) {
                if (data === 'cmd_live_tracking') await handleLiveTrackingMenu(chatId);
                else if (data === 'live_track_start') await handleLiveTrackToggle(chatId, true);
                else if (data === 'live_track_stop') await handleLiveTrackToggle(chatId, false);
                else if (data === 'cmd_menu') await sendMessage(chatId, "Welcome back!");
            }
            res.status(200).send('ok'); return;
        }

        if (body.message && body.message.text) {
            const chatId = body.message.chat.id.toString();
            if (chatId === ADMIN_CHAT_ID) {
                const text = body.message.text.toLowerCase();
                if (text === '/start' || text === '/menu') {
                    await sendMessage(chatId, "Outrunners Admin Panel", {
                        inline_keyboard: [[{ text: "🏃 Live Tracking", callback_data: "cmd_live_tracking" }]]
                    });
                }
            }
        }
        res.status(200).send('ok');
    } catch (e) {
        res.status(500).send('Error');
    }
}
