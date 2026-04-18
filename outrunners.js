// Outrunners Community UK - Dashboard Logic

// --- Map Initialization ---
let map;
let gpxLayer;

function initMap() {
    map = L.map('map').setView([51.505, -0.09], 13); // Default to London

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

// --- GPX Handling ---
document.getElementById('gpxUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('fileName').innerText = `File: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        const gpxContent = e.target.result;
        if (gpxLayer) map.removeLayer(gpxLayer);

        gpxLayer = new L.GPX(gpxContent, {
            async: true,
            marker_options: {
                startIconUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-icon-start.png',
                endIconUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-icon-end.png',
                shadowUrl: 'https://raw.githubusercontent.com/mpetazzoni/leaflet-gpx/master/pin-shadow.png'
            },
            polyline_options: {
                color: '#39FF14',
                opacity: 0.8,
                weight: 5,
                lineCap: 'round'
            }
        }).on('loaded', function(e) {
            map.fitBounds(e.target.getBounds());
        }).addTo(map);
    };
    reader.readAsText(file);
});

// --- Split Calculator ---
const SplitCalculator = {
    targetInput: document.getElementById('targetTime'),
    paceOutput: document.getElementById('requiredPace'),
    statusText: document.getElementById('statusText'),
    paceCard: document.getElementById('paceCard'),

    init() {
        this.targetInput.addEventListener('input', () => this.calculate());
        this.calculate();
    },

    calculate() {
        const timeStr = this.targetInput.value;
        const totalSeconds = this.parseTimeToSeconds(timeStr);
        if (!totalSeconds || totalSeconds <= 0) {
            this.paceOutput.innerText = "--:--";
            this.statusText.innerText = "INVALID TIME";
            return;
        }

        const distance = 18;
        const secondsPerKm = totalSeconds / distance;
        const paceStr = this.secondsToPace(secondsPerKm);
        this.paceOutput.innerText = `${paceStr}/km`;

        if (secondsPerKm <= 240) {
            this.statusText.innerText = "ELITE ZONE: CRUSHING IT";
            this.statusText.style.color = "#39FF14";
            this.paceCard.classList.add('success-zone');
        } else {
            this.statusText.innerText = "GRIND ZONE: KEEP PUSHING";
            this.statusText.style.color = "#ffffff";
            this.paceCard.classList.remove('success-zone');
        }
    },

    parseTimeToSeconds(str) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
        return null;
    },

    secondsToPace(s) {
        const mins = Math.floor(s / 60);
        const secs = Math.round(s % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

// --- Supabase Config ---
const SUPABASE_URL = 'https://qcqyyfnsfyuaaaacddsm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uXs2e5aPzrIL_M2xsYDmWg_hPOUaG1l';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Live Tracking Service ---
const LiveTrackingService = {
    marker: null,
    indicator: document.getElementById('liveIndicator'),

    init() {
        this.fetchStatus();
        supabase.channel('live_tracking_channel')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'live_tracks', filter: 'id=eq.admin' }, 
                (payload) => this.handleUpdate(payload.new)
            )
            .subscribe();
    },

    async fetchStatus() {
        const { data } = await supabase.from('live_tracks').select('*').eq('id', 'admin').single();
        if (data) this.handleUpdate(data);
    },

    handleUpdate(data) {
        if (data.is_active) {
            this.indicator.style.display = 'block';
            this.updateMarker(data.lat, data.lng);
        } else {
            this.indicator.style.display = 'none';
            if (this.marker) {
                map.removeLayer(this.marker);
                this.marker = null;
            }
        }
    },

    updateMarker(lat, lng) {
        const pos = [lat, lng];
        if (!this.marker) {
            const runnerIcon = L.divIcon({
                className: 'live-runner-icon',
                html: `<div style="background:var(--neon-green); width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 15px var(--neon-green); animation: pulse-neon 2s infinite;"></div>`,
                iconSize: [26, 26]
            });
            this.marker = L.marker(pos, { icon: runnerIcon }).addTo(map);
        } else {
            this.marker.setLatLng(pos);
        }
    }
};

window.onload = () => {
    initMap();
    SplitCalculator.init();
    LiveTrackingService.init();
};
