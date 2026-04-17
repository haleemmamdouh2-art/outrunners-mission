// ── CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://valzolxrsatcpcbrexgd.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_DtFv2pGWDzZzrZKMJxAmEA_wUNJgz7J';
const dbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// ── SESSION & MISSION STATE ───────────────────────────────────────────
let currentUser = null;
let currentMission = null;
let allMissions = [];

async function loadMissions() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_missions?order=mission_date.desc`, { headers: dbHeaders });
        allMissions = await res.json();
        const now = new Date().getTime();

        // ── CATEGORIZE MISSIONS ──
        const upcomingMissions = allMissions
            .filter(m => new Date(m.mission_date).getTime() > now && m.is_active)
            .sort((a,b) => new Date(a.mission_date) - new Date(b.mission_date));
        
        const pastMissions = allMissions
            .filter(m => new Date(m.mission_date).getTime() <= now);

        // Sidebar Context (Closest Run)
        currentMission = upcomingMissions.length > 0 ? upcomingMissions[0] : null;

        if (currentMission) {
            document.getElementById('active-mission-view').style.display = 'block';
            document.getElementById('idle-mission-view').style.display = 'none';
            document.getElementById('mission-stats-container').style.display = 'grid';

            const nextRunLabel = document.getElementById('next-run-label');
            const nextRunName = document.getElementById('next-run-name');
            if (nextRunLabel) nextRunLabel.style.display = 'block';
            if (nextRunName) nextRunName.textContent = currentMission.title;

            const titleEl = document.getElementById('mission-title-display');
            if (titleEl) titleEl.textContent = currentMission.title;
            
            document.getElementById('dist').textContent = currentMission.distance || '—';
            document.getElementById('elev').textContent = currentMission.elevation || '—';

            initCountdown(currentMission.mission_date);
            if (currentMission.gpx_url && currentMission.gpx_url !== 'legacy') {
                try {
                    const gpxRes = await fetch(currentMission.gpx_url);
                    const gpxText = await gpxRes.text();
                    setTimeout(() => initMap(gpxText), 200);
                } catch(e) {}
            } else {
                initMap(null); 
            }
        } else {
            document.getElementById('active-mission-view').style.display = 'none';
            document.getElementById('idle-mission-view').style.display = 'block';
            document.getElementById('mission-stats-container').style.display = 'none';
            if(countdownInterval) clearInterval(countdownInterval);
            if(document.getElementById('next-run-label')) document.getElementById('next-run-label').style.display = 'none';
        }

        // ── RENDER UPCOMING ──
        const uSection = document.getElementById('upcoming-runs-section');
        const uGrid = document.getElementById('upcoming-runs-grid');
        if (upcomingMissions.length > 0) {
            uSection.style.display = 'block';
            uGrid.innerHTML = upcomingMissions.map(m => {
                const d = new Date(m.mission_date);
                const dateStr = d.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
                const timeStr = d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
                return `<div class="upcoming-card" onclick="openMissionModal('${m.id}')">
                    <div class="upcoming-card-map" id="umap-${m.id}"></div>
                    <div class="upcoming-card-info">
                        <div class="upcoming-card-title">${m.title}</div>
                        <div class="upcoming-card-date">📅 ${dateStr} · ⏰ ${timeStr}</div>
                        <div class="upcoming-card-stats">
                            <span>📏 ${m.distance || '—'}K</span>
                            <span>🏔️ ${m.elevation || '—'}M</span>
                        </div>
                        <div class="upcoming-card-cta">View Details & Register →</div>
                    </div>
                </div>`;
            }).join('');
            upcomingMissions.forEach(async m => {
                if (m.gpx_url && m.gpx_url !== 'legacy') {
                    try {
                        const r = await fetch(m.gpx_url);
                        const txt = await r.text();
                        const stats = parseGPXStats(txt);
                        initMiniMap(`umap-${m.id}`, stats.coords);
                    } catch(e) {}
                }
            });
        } else {
            uSection.style.display = 'none';
        }

        // ── RENDER RECENT ──
        const rSection = document.getElementById('recent-activities-section');
        const rGrid = document.getElementById('recent-activities-grid');
        if (pastMissions.length > 0) {
            rSection.style.display = 'block';
            rGrid.innerHTML = pastMissions.map((m, idx) => `
                <div class="activity-card" style="display:flex; gap:20px; align-items:stretch; min-height:180px;">
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                        <div class="activity-title" style="font-size:1.4rem; color:var(--primary-orange);">${m.title}</div>
                        <div style="margin-top:10px; font-size:0.9rem; color:#aaa;">
                            <div style="margin-bottom:5px;">📅 ${new Date(m.mission_date).toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
                            <div style="display:flex; gap:15px; font-weight:bold; color:white;">
                                <span>📏 ${m.distance || '—'}K</span>
                                <span>🏔️ ${m.elevation || '—'}M</span>
                            </div>
                        </div>
                    </div>
                    <div id="past-map-${idx}" style="width:150px;height:150px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;align-self:center;"></div>
                </div>`).join('');
            pastMissions.forEach(async (m, idx) => {
                let src=null;
                if(m.gpx_url && m.gpx_url!=='legacy') try{src=await(await fetch(m.gpx_url)).text();}catch(e){}
                else if(m.gpx_url==='legacy' && typeof GPX_RAW!=='undefined') src=GPX_RAW;
                if(src) initMiniMap(`past-map-${idx}`, parseGPXStats(src).coords);
            });
        } else {
            rSection.style.display = 'none';
        }

        if (typeof renderMissionManager === 'function') renderMissionManager();
    } catch (e) { console.error("Load missions fail:", e); }
}

// ── MISSION MODAL LOGIC ──
let missionDetailMap = null;
let activeModalMissionId = null;

window.openMissionModal = async function(missionId) {
    const m = allMissions.find(x => x.id === missionId);
    if (!m) return;
    activeModalMissionId = missionId;
    const modal = document.getElementById('mission-detail-modal');
    modal.classList.add('active');
    document.getElementById('modal-mission-title').textContent = m.title;
    document.getElementById('modal-mission-date').textContent = new Date(m.mission_date).toLocaleString();
    document.getElementById('modal-dist').textContent = m.distance || '—';
    document.getElementById('modal-elev').textContent = m.elevation || '—';
    document.getElementById('mreg-form-section').style.display = 'block';
    document.getElementById('mreg-login-section').style.display = 'none';
    document.getElementById('mreg-already-section').style.display = 'none';
    document.getElementById('mreg-status').textContent = '';
    if (currentUser) {
        document.getElementById('mreg-name').value = currentUser.name || '';
        document.getElementById('mreg-email').value = currentUser.email || '';
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?email=eq.${encodeURIComponent(currentUser.email)}&mission_id=eq.${missionId}&select=id`, { headers: dbHeaders });
            if ((await res.json()).length > 0) {
                document.getElementById('mreg-form-section').style.display = 'none';
                document.getElementById('mreg-already-section').style.display = 'block';
            }
        } catch(e) {}
    }
    if (missionDetailMap) missionDetailMap.remove();
    missionDetailMap = L.map('mission-full-map').setView([0,0], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(missionDetailMap);
    if (m.gpx_url && m.gpx_url !== 'legacy') {
        try {
            const txt = await(await fetch(m.gpx_url)).text();
            const stats = parseGPXStats(txt);
            const poly = L.polyline(stats.coords, { color:'#FF6B00', weight:4 }).addTo(missionDetailMap);
            missionDetailMap.fitBounds(poly.getBounds(), { padding:[20,20] });
        } catch(e) {}
    }
}

function initMissionModal() {
    const modal = document.getElementById('mission-detail-modal');
    document.getElementById('close-mission-modal-btn').onclick = () => modal.classList.remove('active');
    document.getElementById('mreg-switch-login').onclick = (e) => {
        e.preventDefault();
        document.getElementById('mreg-form-section').style.display = 'none';
        document.getElementById('mreg-login-section').style.display = 'block';
    };
    document.getElementById('mreg-back-register').onclick = (e) => {
        e.preventDefault();
        document.getElementById('mreg-login-section').style.display = 'none';
        document.getElementById('mreg-form-section').style.display = 'block';
    };
    document.getElementById('mission-reg-form').onsubmit = async (e) => {
        e.preventDefault();
        const status = document.getElementById('mreg-status');
        const submit = document.getElementById('mreg-submit');
        submit.disabled = true;
        status.textContent = "Registering...";
        const userData = {
            id: crypto.randomUUID(),
            name: document.getElementById('mreg-name').value,
            email: document.getElementById('mreg-email').value,
            password: document.getElementById('mreg-password').value,
            phone: document.getElementById('mreg-phone').value,
            level: document.getElementById('mreg-level').value,
            mission_id: activeModalMissionId
        };
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users`, {
                method: 'POST',
                headers: dbHeaders,
                body: JSON.stringify(userData)
            });
            if (!res.ok) throw new Error("Registration failed. Run SQL update for phone column!");
            currentUser = userData;
            localStorage.setItem('outrunner_session', JSON.stringify(userData));
            status.textContent = "✅ Registered!";
            setTimeout(() => {
                document.getElementById('mreg-form-section').style.display = 'none';
                document.getElementById('mreg-already-section').style.display = 'block';
                loadRoster(); checkSession();
            }, 1000);
        } catch(err) { status.textContent = "❌ " + err.message; } finally { submit.disabled = false; }
    };
    document.getElementById('mreg-cancel-btn').onclick = async () => {
        if (!confirm("Cancel registration?")) return;
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?email=eq.${encodeURIComponent(currentUser.email)}&mission_id=eq.${activeModalMissionId}`, { method: 'DELETE', headers: dbHeaders });
            document.getElementById('mreg-already-section').style.display = 'none';
            document.getElementById('mreg-form-section').style.display = 'block';
            loadRoster(); checkSession();
        } catch(e) { alert("Cancel failed"); }
    };
    document.getElementById('mreg-login-submit').onclick = async () => {
        const email = document.getElementById('mreg-login-email').value;
        const pass = document.getElementById('mreg-login-password').value;
        const status = document.getElementById('mreg-login-status');
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?email=eq.${encodeURIComponent(email)}&select=*`, { headers: dbHeaders });
            const data = await res.json();
            if (data.length === 0 || data[0].password !== pass) throw new Error("Invalid credentials");
            currentUser = data[0];
            localStorage.setItem('outrunner_session', JSON.stringify(currentUser));
            openMissionModal(activeModalMissionId); checkSession(); loadRoster();
        } catch(err) { status.textContent = "❌ " + err.message; }
    };
}

async function checkSession() {
    const saved = localStorage.getItem('outrunner_session');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
        } catch(e) { currentUser = null; }
    }

    const regBtn    = document.getElementById('register-btn');
    const cancelBtn = document.getElementById('cancel-reg-btn');
    const logBtn    = document.getElementById('login-toggle-btn');
    const outBtn    = document.getElementById('logout-btn');
    const admBtn    = document.getElementById('admin-panel-btn');

    if (currentUser) {
        logBtn.style.display  = 'none';
        outBtn.style.display  = 'block';

        const isAdmin = currentUser.email === 'haleemmamdouh2@gmail.com' && currentUser.password === 'haleem@147';
        admBtn.style.display = isAdmin ? 'block' : 'none';

        if (currentMission) {
            // Check if user is already registered for THIS mission
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?email=eq.${encodeURIComponent(currentUser.email)}&mission_id=eq.${currentMission.id}&select=id`, { headers: dbHeaders });
                const data = await res.json();
                if (data && data.length > 0) {
                    // Already registered for this run
                    currentUser._registeredId = data[0].id;
                    localStorage.setItem('outrunner_session', JSON.stringify(currentUser));
                    regBtn.textContent = '\u2705 Registered';
                    regBtn.style.pointerEvents = 'none';
                    regBtn.style.opacity = '0.7';
                    if (cancelBtn) { cancelBtn.style.display = 'block'; }
                } else {
                    // Signed in but NOT registered for this run
                    regBtn.textContent = '\ud83c\udfc3 Register for Run';
                    regBtn.style.pointerEvents = 'auto';
                    regBtn.style.opacity = '1';
                    if (cancelBtn) cancelBtn.style.display = 'none';
                }
            } catch(e) {
                regBtn.textContent = '\ud83c\udfc3 Register for Run';
                if (cancelBtn) cancelBtn.style.display = 'none';
            }
        } else {
            regBtn.textContent = 'Stay Tuned';
            regBtn.style.pointerEvents = 'none';
            regBtn.style.opacity = '0.5';
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    } else {
        logBtn.style.display = 'block';
        outBtn.style.display = 'none';
        admBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';

        if (!currentMission) {
            regBtn.textContent = 'Stay Tuned';
            regBtn.style.pointerEvents = 'none';
            regBtn.style.opacity = '0.5';
        } else {
            regBtn.textContent = '\ud83c\udfc3 Register for Run';
            regBtn.style.pointerEvents = 'auto';
            regBtn.style.opacity = '1';
        }
    }
}

window.cancelRegistration = async function() {
    if (!currentUser || !currentMission) return;
    if (!confirm('Cancel your registration for this run?')) return;

    try {
        const regId = currentUser._registeredId;
        const url = regId
            ? `${SUPABASE_URL}/rest/v1/outrunners_users?id=eq.${regId}`
            : `${SUPABASE_URL}/rest/v1/outrunners_users?email=eq.${encodeURIComponent(currentUser.email)}&mission_id=eq.${currentMission.id}`;

        await fetch(url, { method: 'DELETE', headers: dbHeaders });
        
        // Update session without _registeredId
        delete currentUser._registeredId;
        localStorage.setItem('outrunner_session', JSON.stringify(currentUser));
        
        await checkSession();
        await loadRoster();
    } catch(e) {
        alert('Could not cancel registration. Please try again.');
    }
}

function logout() {
    localStorage.removeItem('outrunner_session');
    currentUser = null;
    checkSession();
    alert("You have been signed out.");
}

// ── COUNTDOWN ────────────────────────────────────────────────────────
let countdownInterval;
function initCountdown(dateString) {
    if(countdownInterval) clearInterval(countdownInterval);
    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) {
        console.error("Invalid target date for countdown.");
        return;
    }
    const target = targetDate.getTime();
    
    function tick() {
        const now = new Date().getTime();
        const diff = target - now;
        if (diff <= 0) {
            document.getElementById('d').textContent = '00';
            document.getElementById('h').textContent = '00';
            document.getElementById('m').textContent = '00';
            document.getElementById('s').textContent = 'GO!';
            clearInterval(countdownInterval);
            return;
        }
        const days    = Math.floor(diff / 86400000);
        const hours   = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000)  / 60000);
        const seconds = Math.floor((diff % 60000)    / 1000);
        document.getElementById('d').textContent = String(days).padStart(2,'0');
        document.getElementById('h').textContent = String(hours).padStart(2,'0');
        document.getElementById('m').textContent = String(minutes).padStart(2,'0');
        document.getElementById('s').textContent = String(seconds).padStart(2,'0');
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
}

// ── MAP ──────────────────────────────────────────────────────────────
let globalLeafletMap = null;
function initMap(gpxText) {
    if(!gpxText) return;
    try {
        const parser  = new DOMParser();
        const xmlDoc  = parser.parseFromString(gpxText, 'application/xml');
        const points  = xmlDoc.querySelectorAll('trkpt');
        const coords  = [];
        let elevMin = Infinity, elevMax = -Infinity, totalDist = 0;

        points.forEach((pt, i) => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            const eleNode = pt.querySelector('ele');
            const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
            coords.push([lat, lon]);
            if (ele < elevMin) elevMin = ele;
            if (ele > elevMax) elevMax = ele;
            if (i > 0) {
                const prev = coords[i - 1];
                const R = 6371000;
                const dLat = (lat - prev[0]) * Math.PI / 180;
                const dLon = (lon - prev[1]) * Math.PI / 180;
                const a = Math.sin(dLat/2)**2 + Math.cos(prev[0]*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
                totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
        });

        // Update stats only if manual override is missing
        const distEl = document.getElementById('dist');
        const elevEl = document.getElementById('elev');
        if (!currentMission?.distance) distEl.textContent = (totalDist / 1000).toFixed(1);
        if (!currentMission?.elevation) elevEl.textContent = elevMax !== -Infinity ? Math.round(elevMax - elevMin) : 0;

        if (typeof L !== 'undefined') {
            if(globalLeafletMap) {
                globalLeafletMap.remove();
            }
            
            globalLeafletMap = L.map('map', { zoomControl: true, scrollWheelZoom: true });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CARTO',
                maxZoom: 19
            }).addTo(globalLeafletMap);

            const polyline = L.polyline(coords, { color: '#FF6B00', weight: 4, opacity: 0.9 }).addTo(globalLeafletMap);

            if (coords.length > 0) {
                const startIcon = L.divIcon({ html: '<div style="background:#FF6B00;width:14px;height:14px;border-radius:50%;border:2px solid #fff;"></div>', className: '' });
                L.marker(coords[0], { icon: startIcon }).addTo(globalLeafletMap).bindPopup('<b style="color:#FF6B00">START</b>');
                L.marker(coords[coords.length - 1], { icon: startIcon }).addTo(globalLeafletMap).bindPopup('<b style="color:#FF6B00">FINISH</b>');
            }

            globalLeafletMap.fitBounds(polyline.getBounds(), { padding: [30, 30] });
            
            // Force redraw to fix "black map" issue when div was previously hidden
            setTimeout(() => {
                globalLeafletMap.invalidateSize();
            }, 500);
        }
    } catch(err) { console.error("Map issue: ", err); }
}

function parseGPXStats(gpxText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'application/xml');
    const points = xmlDoc.querySelectorAll('trkpt');
    const coords = [];
    let elevMin = Infinity, elevMax = -Infinity, totalDist = 0;

    points.forEach((pt, i) => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleNode = pt.querySelector('ele');
        const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
        coords.push([lat, lon]);
        if (ele < elevMin) elevMin = ele;
        if (ele > elevMax) elevMax = ele;
        if (i > 0) {
            const prev = coords[i - 1];
            const R = 6371000;
            const dLat = (lat - prev[0]) * Math.PI / 180;
            const dLon = (lon - prev[1]) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(prev[0]*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
            totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }
    });

    return {
        distance: (totalDist / 1000).toFixed(1),
        elevation: elevMax !== -Infinity ? Math.round(elevMax - elevMin) : 0,
        coords: coords
    };
}

// ── MINI-MAP ─────────────────────────────────────────────────────────
function initMiniMap(elementId, coords) {
    if (!coords || coords.length === 0) return;
    const el = document.getElementById(elementId);
    if (!el) return;
    // Destroy any previous Leaflet instance on this element
    if (el._leaflet_id) { try { el._leaflet_map?.remove(); } catch(e){} }
    const miniMap = L.map(elementId, { 
        zoomControl: false, 
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
    });
    el._leaflet_map = miniMap;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(miniMap);
    const polyline = L.polyline(coords, { color: '#FF6B00', weight: 2.5 }).addTo(miniMap);
    miniMap.fitBounds(polyline.getBounds(), { padding: [5, 5] });
}

// ── ROSTER ───────────────────────────────────────────────────────────
async function loadRoster() {
    const listPublic = document.getElementById('participant-list');
    const listAdmin = document.getElementById('admin-list');
    const countPublic = document.getElementById('roster-count');
    const countAdmin = document.getElementById('admin-count');
    
    if (!currentMission) {
        if(listPublic) listPublic.innerHTML = '<p style="font-size:0.8rem;color:#888;text-align:center;padding:10px;">No active mission.</p>';
        if(listAdmin) listAdmin.innerHTML = '<p style="font-size:0.8rem;color:#888;text-align:center;padding:10px;">No active mission.</p>';
        if(countPublic) countPublic.textContent = '0';
        if(countAdmin) countAdmin.textContent = '0';
        return;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?select=id,name,level,email&mission_id=eq.${currentMission.id}`, { headers: dbHeaders });
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();

        const dataLength = data ? data.length : 0;
        if(countPublic) countPublic.textContent = dataLength;
        if(countAdmin) countAdmin.textContent = dataLength;

        if (dataLength === 0) {
            if(listPublic) listPublic.innerHTML = '<p style="font-size:0.8rem;color:#888;text-align:center;padding:10px;">Be the first to register! 🔥</p>';
            if(listAdmin) listAdmin.innerHTML = '<p style="font-size:0.8rem;color:#888;text-align:center;padding:10px;">Empty roster.</p>';
            return;
        }

        if(listPublic) {
            listPublic.innerHTML = data.map(p => `
                <div class="participant-item">
                    <span class="participant-name">🏃 ${p.name.split(' ')[0]}</span>
                    <span class="participant-pace">${p.level}</span>
                </div>
            `).join('');
        }
        
        if(listAdmin) {
            listAdmin.innerHTML = data.map(p => `
                <div class="admin-item" id="admin-user-${p.id}">
                    <div>
                        <div style="font-weight:700;">${p.name} <span style="font-size:0.7rem;color:#888;margin-left:5px;">${p.email}</span></div>
                        <div style="font-size:0.8rem;color:var(--primary-orange);">${p.level}</div>
                    </div>
                    <button class="btn-remove" onclick="removeRunner('${p.id}')">Remove</button>
                </div>
            `).join('');
        }
        
    } catch (e) {
        if(listPublic) listPublic.innerHTML = '<p style="font-size:0.8rem;color:#888;text-align:center;">Could not load roster.</p>';
        if(listAdmin) listAdmin.innerHTML = '<p style="color:#ff4444;text-align:center;">Could not load roster.</p>';
    }
}

// ── REGISTRATION & LOGIN ─────────────────────────────────────────────
function initRegistration() {
    const openBtn   = document.getElementById('register-btn');
    const logBtn    = document.getElementById('login-toggle-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const cancelBtn = document.getElementById('cancel-reg-btn');

    if (openBtn) {
        openBtn.onclick = () => {
            if (currentMission) {
                openMissionModal(currentMission.id);
            }
        };
    }

    if (logBtn) {
        logBtn.onclick = () => {
            if (currentMission) {
                openMissionModal(currentMission.id);
                // Switch to login section in modal
                document.getElementById('mreg-form-section').style.display = 'none';
                document.getElementById('mreg-login-section').style.display = 'block';
            }
        };
    }

    if (logoutBtn) logoutBtn.onclick = logout;
    if (cancelBtn) {
        cancelBtn.onclick = async () => {
            if (currentMission) {
                activeModalMissionId = currentMission.id;
                document.getElementById('mreg-cancel-btn').click();
            }
        };
    }
}

}

// ── GALLERY ──────────────────────────────────────────────────────────
async function loadGalleryData() {
    const grid = document.getElementById('gallery-grid');
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_gallery?select=*&order=created_at.desc`, { headers: dbHeaders });
        const data = await res.json();
        
        if (!data || data.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:#888; width:100%; grid-column:1/-1; padding-top:40px;">No memories uploaded yet. Be the first!</p>';
            return;
        }

        grid.innerHTML = data.map(item => {
            const isVideo = item.media_type && item.media_type.startsWith('video');
            const content = isVideo 
                ? `<video src="${item.media_url}" class="media-img" controls muted></video>`
                : `<img src="${item.media_url}" class="media-img" alt="Run snapshot" loading="lazy">`;
                
            return `
                <div class="media-card" style="cursor:pointer;" onclick="openLightbox('${item.media_url}', ${isVideo})">
                    ${content}
                    <div class="media-badge">📸 ${item.uploader_name}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        grid.innerHTML = '<p style="text-align:center;color:#ff4444; width:100%; grid-column:1/-1;">Failed to load gallery.</p>';
    }
}

function initGallery() {
    const openBtn = document.getElementById('open-gallery-btn');
    const modal = document.getElementById('gallery-modal');
    const closeBtn = document.getElementById('close-gallery-btn');
    
    const uploadSection = document.getElementById('gallery-upload-section');
    const loginPrompt = document.getElementById('gallery-login-prompt');
    const fileInput = document.getElementById('media-upload');
    const statusEl = document.getElementById('upload-status');

    if(openBtn) {
        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
            if (currentUser) {
                uploadSection.style.display = 'block';
                loginPrompt.style.display = 'none';
            } else {
                uploadSection.style.display = 'none';
                loginPrompt.style.display = 'block';
            }
            loadGalleryData();
        });
    }

    if(closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if(modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

    // ── Drag & Drop Multiple File Uploads ──
    const handleFiles = async (files) => {
        if(!files || files.length === 0 || !currentUser) return;
        
        let fileArray = Array.from(files);
        if(fileArray.length > 50) {
            statusEl.textContent = '❌ Limit is 50 files at once! Truncating list...';
            statusEl.style.color = '#ff4444';
            fileArray = fileArray.slice(0, 50);
            await new Promise(r => setTimeout(r, 2000));
        }

        uploadSection.style.pointerEvents = 'none';
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            statusEl.textContent = `Uploading file ${i + 1} of ${fileArray.length}... ⏳`;
            statusEl.style.color = 'var(--text-muted)';
            
            try {
                // 1. Upload to Supabase Storage
                const safename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const uniqueFileName = `${Date.now()}_${i}_${safename}`;
                
                const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/run_media/${uniqueFileName}`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': file.type || 'application/octet-stream'
                    },
                    body: file
                });

                if(!uploadRes.ok) throw new Error("Storage upload failed.");

                // 2. Get Public URL
                const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/run_media/${uniqueFileName}`;

                // 3. Save to database
                const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_gallery`, {
                    method: 'POST',
                    headers: dbHeaders,
                    body: JSON.stringify({
                        uploader_name: currentUser.name,
                        media_url: publicUrl,
                        media_type: file.type || 'image/jpeg'
                    })
                });

                if(!dbRes.ok) throw new Error("Failed to save gallery entry.");
                successCount++;
            } catch(err) {
                console.error("Failed on file:", file.name, err);
                failCount++;
            }
        }
        
        uploadSection.style.pointerEvents = 'auto';
        fileInput.value = ''; // clear
        
        statusEl.textContent = `Upload complete! ✅ (${successCount} success, ${failCount} failed)`;
        statusEl.style.color = failCount === 0 ? '#FF6B00' : '#ffa500';
        
        setTimeout(() => { if (statusEl.textContent.includes('Upload complete')) statusEl.textContent = ''; }, 4000);
        
        // Refresh gallery after batch is done
        loadGalleryData();
    };

    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }

    if (uploadSection) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadSection.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadSection.addEventListener(eventName, () => uploadSection.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadSection.addEventListener(eventName, () => uploadSection.classList.remove('dragover'), false);
        });

        uploadSection.addEventListener('drop', (e) => {
            handleFiles(e.dataTransfer.files);
        }, false);
    }
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────
window.openLightbox = function(url, isVideo) {
    const modal = document.getElementById('lightbox-modal');
    const imgObj = document.getElementById('lightbox-img');
    const vidObj = document.getElementById('lightbox-video');
    const downBtn = document.getElementById('download-lightbox-btn');
    
    if (isVideo) {
        imgObj.style.display = 'none';
        vidObj.style.display = 'block';
        vidObj.src = ''; // reset
        vidObj.src = url;
    } else {
        vidObj.style.display = 'none';
        vidObj.pause();
        imgObj.style.display = 'block';
        imgObj.src = url;
    }
    
    downBtn.onclick = async () => {
        try {
            downBtn.textContent = "Downloading... ⏳";
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = url.split('/').pop() || 'download';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            downBtn.textContent = "⬇️ Download Media";
        } catch(e) {
            window.open(url, '_blank'); // fallback
            downBtn.textContent = "⬇️ Download Media";
        }
    };
    
    modal.classList.add('active');
}

function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const closeBtn = document.getElementById('close-lightbox-btn');
    const vidObj = document.getElementById('lightbox-video');

    if(closeBtn) closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        vidObj.pause();
    });
    if(modal) modal.addEventListener('click', e => { 
        if (e.target === modal) {
            modal.classList.remove('active');
            vidObj.pause();
        }
    });
}

// ── ADMIN PANEL ──────────────────────────────────────────────────────
function initAdminPanel() {
    const adminBtn = document.getElementById('admin-panel-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeBtn = document.getElementById('close-admin-btn');
    const adminList = document.getElementById('admin-list');
    const adminCount = document.getElementById('admin-count');
    const exportBtn = document.getElementById('export-excel-btn');
    
    let currentData = [];

    // TABS
    const tabRunners = document.getElementById('admin-tab-runners');
    const tabMissions = document.getElementById('admin-tab-missions');
    const viewRunners = document.getElementById('admin-view-runners');
    const viewMissions = document.getElementById('admin-view-missions');

    if(tabRunners && tabMissions) {
        tabRunners.addEventListener('click', () => {
            tabRunners.classList.add('active');
            tabMissions.classList.remove('active');
            tabRunners.style.background = 'rgba(255,107,0,1)';
            tabMissions.style.background = 'rgba(255,255,255,0.1)';
            viewRunners.style.display = 'block';
            viewMissions.style.display = 'none';
        });
        tabMissions.addEventListener('click', () => {
            tabMissions.classList.add('active');
            tabRunners.classList.remove('active');
            tabMissions.style.background = 'rgba(255,107,0,1)';
            tabRunners.style.background = 'rgba(255,255,255,0.1)';
            viewMissions.style.display = 'block';
            viewRunners.style.display = 'none';
        });
    }

    if(adminBtn) adminBtn.addEventListener('click', async () => {
        adminModal.classList.add('active');
        adminList.innerHTML = '<p style="text-align:center;color:#888;">Loading Roster...</p>';
        try {
            // Only fetch users for the CURRENT mission if one exists, otherwise fetch all? 
            // Wait, admin should see current mission runners.
            const url = currentMission 
                ? `${SUPABASE_URL}/rest/v1/outrunners_users?select=*&mission_id=eq.${currentMission.id}`
                : `${SUPABASE_URL}/rest/v1/outrunners_users?select=*`;
            
            const res = await fetch(url, { headers: dbHeaders });
            currentData = await res.json();
            
            adminCount.textContent = currentData.length || 0;
            if(!currentData || currentData.length === 0) {
                adminList.innerHTML = '<p style="text-align:center;color:#888;">Empty roster.</p>';
                return;
            }

            adminList.innerHTML = currentData.map(p => `
                <div class="admin-item" id="admin-user-${p.id}">
                    <div>
                        <div style="font-weight:700;">${p.name} <span style="font-size:0.7rem;color:#888;margin-left:5px;">${p.email}</span></div>
                        <div style="font-size:0.8rem;color:var(--primary-orange);">${p.level}</div>
                    </div>
                    <button class="btn-remove" onclick="removeRunner('${p.id}')">Remove</button>
                </div>
            `).join('');
        } catch(e) {
            adminList.innerHTML = '<p style="color:#ff4444;text-align:center;">Failed to load data.</p>';
        }
    });

    if(closeBtn) closeBtn.addEventListener('click', () => adminModal.classList.remove('active'));
    
    // ── MISSION MANAGER (CRUD) ──
    const missionForm = document.getElementById('create-mission-form');
    const missionStatus = document.getElementById('mission-create-status');
    const submitMissBtn = document.getElementById('submit-mission-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const missionListEl = document.getElementById('admin-mission-list');

    window.renderMissionManager = function() {
        if (!missionListEl) return;
        if (allMissions.length === 0) {
            missionListEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.8rem;">No missions found.</p>';
            return;
        }

        missionListEl.innerHTML = allMissions.map(m => `
            <div class="manage-mission-item">
                <div class="manage-mission-info">
                    <div style="font-weight:700; color:white;">${m.title}</div>
                    <div style="font-size:0.75rem; color:#888;">${new Date(m.mission_date).toLocaleDateString()}</div>
                </div>
                <div class="manage-mission-actions">
                    <button class="manage-btn manage-btn-edit" onclick="editMission('${m.id}')">Edit</button>
                    <button class="manage-btn manage-btn-delete" onclick="deleteMission('${m.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    };

    window.editMission = function(id) {
        const m = allMissions.find(x => x.id === id);
        if (!m) return;
        
        document.getElementById('edit-mission-id').value = m.id;
        document.getElementById('new-mission-title').value = m.title;
        
        // Format date for datetime-local input
        const d = new Date(m.mission_date);
        const pad = (n) => String(n).padStart(2, '0');
        const formattedDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('new-mission-date').value = formattedDate;
        
        document.getElementById('new-mission-dist').value = m.distance || '';
        document.getElementById('new-mission-elev').value = m.elevation || '';
        
        submitMissBtn.textContent = "Update Mission";
        cancelEditBtn.style.display = 'block';
        missionStatus.textContent = "Editing Mission: " + m.title;
        missionStatus.style.color = "var(--primary-orange)";
        
        // Switch to missions tab if not already
        tabMissions.click();
    };

    window.cancelEdit = function() {
        missionForm.reset();
        document.getElementById('edit-mission-id').value = '';
        submitMissBtn.textContent = "Save Mission";
        cancelEditBtn.style.display = 'none';
        missionStatus.textContent = '';
    };

    if(cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    window.deleteMission = async function(id) {
        if (!confirm("Are you sure? This will delete the mission and all its data!")) return;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_missions?id=eq.${id}`, {
                method: 'DELETE',
                headers: dbHeaders
            });
            if (!res.ok) throw new Error("Delete failed");
            window.location.reload();
        } catch(e) { alert("Error deleting mission."); }
    };

    if(missionForm) {
        missionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = document.getElementById('edit-mission-id').value;
            const mTitle = document.getElementById('new-mission-title').value.trim();
            const mDate = document.getElementById('new-mission-date').value;
            const mDist = document.getElementById('new-mission-dist').value.trim();
            const mElev = document.getElementById('new-mission-elev').value.trim();
            const mFile = document.getElementById('new-mission-gpx').files[0];
            
            submitMissBtn.disabled = true;
            missionStatus.textContent = "Saving Mission... ⏳";
            
            try {
                let gpxPublicUrl = null;
                
                // Only upload if a new file is provided
                if (mFile) {
                    missionStatus.textContent = "Uploading GPX... ⏳";
                    const safename = mFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const uniqueFileName = `${Date.now()}_${safename}`;
                    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/mission_gpx/${uniqueFileName}`, {
                        method: 'POST',
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/gpx+xml' },
                        body: mFile
                    });
                    if(!uploadRes.ok) throw new Error("GPX upload failed.");
                    gpxPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/mission_gpx/${uniqueFileName}`;
                }

                const missionData = {
                    title: mTitle,
                    mission_date: new Date(mDate).toISOString(),
                    distance: mDist || null,
                    elevation: mElev || null,
                    is_active: true
                };
                if (gpxPublicUrl) missionData.gpx_url = gpxPublicUrl;

                let dbRes;
                if (editId) {
                    // UPDATE
                    dbRes = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_missions?id=eq.${editId}`, {
                        method: 'PATCH',
                        headers: dbHeaders,
                        body: JSON.stringify(missionData)
                    });
                } else {
                    // CREATE
                    if (!gpxPublicUrl) throw new Error("GPX file required for new missions");
                    dbRes = await fetch(`${SUPABASE_URL}/rest/v1/outrunners_missions`, {
                        method: 'POST',
                        headers: dbHeaders,
                        body: JSON.stringify(missionData)
                    });
                }

                if(!dbRes.ok) throw new Error("Database save failed.");
                
                missionStatus.style.color = "#FF6B00";
                missionStatus.textContent = editId ? "Mission Updated! ✅" : "Mission Created! ✅";
                
                setTimeout(() => window.location.reload(), 1500);
            } catch(error) {
                console.error(error);
                missionStatus.style.color = "#ff4444";
                missionStatus.textContent = "Error: " + error.message;
                submitMissBtn.disabled = false;
            }
        });
    }

    // Initial render of mission list
    renderMissionManager();
    
    // EXPORT TO EXCEL
    if(exportBtn) exportBtn.addEventListener('click', () => {
        if(currentData.length === 0) return alert("Nothing to export.");
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Name,Email,Pace,Registration Date\n";
        
        currentData.forEach(row => {
            const date = new Date(row.created_at).toLocaleDateString();
            csvContent += `"${row.name}","${row.email}","${row.level}","${date}"\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Outrunners_Roster.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

window.removeRunner = async function(id) {
    if(!confirm("Are you sure you want to remove this runner?")) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/outrunners_users?id=eq.${id}`, { 
            method: 'DELETE', 
            headers: dbHeaders 
        });
        document.getElementById(`admin-user-${id}`).remove();
        loadRoster(); // Update sidebar roster instantly
    } catch(e) {
        alert("Failed to remove runner.");
    }
}

// ── INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadMissions();   
    await checkSession();   
    initRegistration();
    initMissionModal(); // Initialize the new modal logic
    initGallery();
    initLightbox();
    initAdminPanel();
    loadRoster();
});
