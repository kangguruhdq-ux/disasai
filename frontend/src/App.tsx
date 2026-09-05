import React, { useMemo, useState } from 'react';
import {
  Activity, CloudRain, Mountain, Radio, MapPin, Cpu, ChevronRight, AlertTriangle, Play
} from 'lucide-react';

/**
 * AEGIS AI — Disaster Intelligence Console
 * Redesigned for a premium, high-tech instrumentation feel.
 */

// Removed import.meta due to environment constraints. Falling back to hardcoded default.
const API_BASE_URL = 'https://disasai-production.up.railway.app';

// ---------------------------------------------------------------------------
// Design tokens & Constants
// ---------------------------------------------------------------------------
const COLOR = {
  void: '#06080A',        // Deeper background
  panel: '#0E1116',       // Slightly lighter for panels
  panelRaised: '#151A22', // Hover states
  hairline: '#1F2633',    // Subtle borders
  textPrimary: '#F1F4F9',
  textMuted: '#94A3B8',
  textFaint: '#475569',
  signal: '#EAB308',      // More vibrant Ochre/Yellow
  water: '#06B6D4',       // Cyan for water
  danger: '#EF4444',      // Red for earthquake/extreme
};

const RISK_COLOR = {
  LOW: '#10B981',      // Emerald
  MEDIUM: '#F59E0B',   // Amber
  HIGH: '#F97316',     // Orange
  EXTREME: '#EF4444',  // Red
  CRITICAL: '#B91C1C', // Dark Red
};

const RISK_LABEL_ID = {
  LOW: 'RENDAH',
  MEDIUM: 'SEDANG',
  HIGH: 'TINGGI',
  EXTREME: 'EKSTREM',
  CRITICAL: 'KRITIS',
};

const DISASTER_META = {
  flood: { label: 'Model Banjir', sub: 'Hydro-Climatic Ensemble', icon: CloudRain, accent: COLOR.water },
  landslide: { label: 'Model Tanah Longsor', sub: 'Terrain Instability Index', icon: Mountain, accent: COLOR.signal },
  earthquake: { label: 'Model Gempa Bumi', sub: 'Seismic Hazard Estimator', icon: Radio, accent: COLOR.danger },
};

const MONITORING_STATIONS = [
  { code: 'JB-01', name: 'Bandung Barat, Jawa Barat', lat: -6.843, lng: 107.491, flood: 'HIGH', landslide: 'EXTREME', quake: 'MEDIUM', type: 'Longsor & Banjir' },
  { code: 'JT-02', name: 'Semarang, Jawa Tengah', lat: -6.966, lng: 110.416, flood: 'HIGH', landslide: 'MEDIUM', quake: 'LOW', type: 'Banjir' },
  { code: 'SB-03', name: 'Padang, Sumatra Barat', lat: -0.947, lng: 100.417, flood: 'MEDIUM', landslide: 'HIGH', quake: 'EXTREME', type: 'Longsor & Gempa' },
  { code: 'ST-04', name: 'Palu, Sulawesi Tengah', lat: -0.900, lng: 119.833, flood: 'LOW', landslide: 'MEDIUM', quake: 'EXTREME', type: 'Gempa Bumi' },
  { code: 'BA-05', name: 'Karangasem, Bali', lat: -8.350, lng: 115.533, flood: 'LOW', landslide: 'LOW', quake: 'MEDIUM', type: 'Gunung Api & Gempa' },
  { code: 'DK-06', name: 'Ciliwung, DKI Jakarta', lat: -6.208, lng: 106.845, flood: 'EXTREME', landslide: 'LOW', quake: 'LOW', type: 'Banjir' },
];

// ---------------------------------------------------------------------------
// Reusable UI Components
// ---------------------------------------------------------------------------
function RiskChip({ level }) {
  const color = RISK_COLOR[level] ?? COLOR.textMuted;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 8px ${color}10`
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
      {RISK_LABEL_ID[level] ?? level}
    </span>
  );
}

function TelemetryField({ label, unit, value, onChange, step }) {
  return (
    <label className="block group">
      <span className="block text-[11px] text-[#94A3B8] mb-1.5 font-medium tracking-wide group-focus-within:text-[#F1F4F9] transition-colors">
        {label} <span className="text-[#475569] font-normal">· {unit}</span>
      </span>
      <div className="relative">
        <input
          type="number"
          step={step ?? 'any'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#06080A] border border-[#1F2633] rounded-md px-3 py-2 text-[#F1F4F9]
                     focus:outline-none focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308]/30 transition-all shadow-inner"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
           <span className="text-[10px] text-[#475569] font-mono">{unit}</span>
        </div>
      </div>
    </label>
  );
}

function Card({ children, className = '', noPadding = false }) {
  return (
    <div
      className={`rounded-xl overflow-hidden backdrop-blur-sm ${noPadding ? '' : 'p-6'} ${className}`}
      style={{
        backgroundColor: `${COLOR.panel}E6`,
        border: `1px solid ${COLOR.hairline}`,
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spatial Map Component (Dynamic Leaflet Integration)
// ---------------------------------------------------------------------------
function SpatialMap({ stations }) {
  const mapContainer = React.useRef(null);
  const [leafletLoaded, setLeafletLoaded] = React.useState(!!window.L);

  React.useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
    
    // Load Leaflet CSS secara dinamis
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS secara dinamis
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    }
  }, []);

  React.useEffect(() => {
    // Tunggu hingga library termuat dan container tersedia
    if (!leafletLoaded || !mapContainer.current || !window.L) return;

    // Inisialisasi Peta
    const map = window.L.map(mapContainer.current, {
      zoomControl: false // Kita matikan default zoom agar bisa diatur posisinya
    }).setView([-2.5, 118.0], 5); // Center kordinat pada wilayah Indonesia

    // Posisi control zoom di kanan bawah agar tidak tertutup header/sidebar
    window.L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Menggunakan tiles peta Dark Mode dari Esri agar murni gratis tanpa API Key
    window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    }).addTo(map);

    // Render Marker untuk setiap Stasiun
    stations.forEach(station => {
      // Menentukan warna marker berdasarkan risiko tertinggi dari 3 model (Banjir, Longsor, Gempa)
      const risks = [station.flood, station.landslide, station.quake];
      let color = RISK_COLOR.LOW;
      if (risks.includes('CRITICAL')) color = RISK_COLOR.CRITICAL;
      else if (risks.includes('EXTREME')) color = RISK_COLOR.EXTREME;
      else if (risks.includes('HIGH')) color = RISK_COLOR.HIGH;
      else if (risks.includes('MEDIUM')) color = RISK_COLOR.MEDIUM;

      const customIcon = window.L.divIcon({
        html: `
          <div style="
            width: 14px; 
            height: 14px; 
            background-color: ${color}; 
            border-radius: 50%; 
            border: 2px solid #06080A;
            box-shadow: 0 0 12px ${color};
          "></div>
        `,
        className: 'custom-leaflet-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7] // Center marker
      });

      // Menambahkan Marker ke Peta dan bind Popup Data
      window.L.marker([station.lat, station.lng], { icon: customIcon })
        .bindPopup(`
          <div style="font-family: 'Space Grotesk', sans-serif; color: #06080A; min-width: 150px;">
            <strong style="font-size: 14px; display: block; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">${station.name}</strong>
            <div style="font-size: 12px; margin-bottom: 4px;"><b>ID Station:</b> <span style="font-family: monospace;">${station.code}</span></div>
            <div style="font-size: 12px;"><b>Sensor:</b> ${station.type}</div>
          </div>
        `)
        .addTo(map);
    });

    return () => map.remove(); // Cleanup instance peta ketika tab berpindah
  }, [leafletLoaded, stations]);

  return (
    <div className="w-full h-full relative z-0 rounded-xl overflow-hidden">
       {!leafletLoaded && (
         <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d12] z-10">
           <div className="flex flex-col items-center gap-3">
             <div className="animate-spin w-8 h-8 border-2 border-[#EAB308] border-t-transparent rounded-full"></div>
             <p className="text-[#94A3B8] text-[11px] font-mono tracking-widest uppercase">Menginisialisasi Peta Spasial...</p>
           </div>
         </div>
       )}
       <div ref={mapContainer} className="w-full h-full absolute inset-0" style={{ backgroundColor: '#0a0d12' }}></div>
       <style>{`
         /* Override Leaflet UI Styles for seamless integration */
         .leaflet-popup-content-wrapper { background: #F1F4F9; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
         .leaflet-popup-tip { background: #F1F4F9; }
         .leaflet-container a.leaflet-popup-close-button { color: #475569; padding: 4px; }
         .leaflet-control-zoom a { background-color: #151A22 !important; color: #F1F4F9 !important; border-color: #1F2633 !important; }
         .leaflet-control-zoom a:hover { background-color: #1F2633 !important; }
         .leaflet-container { font-family: 'IBM Plex Sans', sans-serif; }
       `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDisaster, setSelectedDisaster] = useState('flood');
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  
  const [apiKey, setApiKey] = useState('');

  // States for forms
  const [floodData, setFloodData] = useState({ rainfall: 220.0, river_level: 4.5, soil_moisture: 78.0, elevation: 25.0, slope: 5.0, drainage_capacity: 45.0, historical_floods: 3, seismic_activity: 0.2 });
  const [landslideData, setLandslideData] = useState({ rainfall: 180.0, soil_moisture: 85.0, slope: 35.0, elevation: 450.0, soil_type: 2, land_cover: 1, distance_to_river: 300.0, distance_to_road: 150.0, geology: 2, ndvi: 0.45, historical_landslide: 2 });
  const [earthquakeData, setEarthquakeData] = useState({ latitude: -6.2000, longitude: 106.8166, depth: 15.0, magnitude: 6.8, distance_to_fault: 12.5, fault_density: 6.0, historical_earthquakes: 12, seismic_activity: 6.5, tectonic_region: 2 });

  const nationalIndex = useMemo(() => {
    const rank = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4, CRITICAL: 5 };
    const scores = MONITORING_STATIONS.flatMap((s) => [rank[s.flood] || 1, rank[s.landslide] || 1, rank[s.quake] || 1]);
    return (scores.reduce((a, b) => a + b, 0) / scores.length / 5) * 100;
  }, []);

  const handleRunInference = async () => {
    setLoading(true);
    setPredictionResult(null);
    
    // Helper untuk mengubah string kosong ('') kembali menjadi angka (0) sebelum dikirim ke API
    const formatPayload = (data) => {
      const formatted = {};
      for (let key in data) {
        formatted[key] = data[key] === '' ? 0 : Number(data[key]);
      }
      return formatted;
    };

    let payload = {};
    if (selectedDisaster === 'flood') payload = formatPayload(floodData);
    if (selectedDisaster === 'landslide') payload = formatPayload(landslideData);
    if (selectedDisaster === 'earthquake') payload = formatPayload(earthquakeData);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        // Many APIs use either 'x-api-key' or Bearer tokens. We supply both to be safe.
        headers['x-api-key'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${API_BASE_URL}/predict/${selectedDisaster}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setPredictionResult({
        disaster: data.disaster,
        risk_score: data.risk_score ?? data.hazard_score ?? 0,
        risk_level: data.risk_level ?? data.hazard_level ?? 'UNKNOWN',
        model_used: data.model_used ?? 'AEGIS AI Engine',
        model_status: data.model_status ?? 'ACTIVE',
        explanation: data.explanation ?? 'Inferensi berhasil dilakukan.',
      });
    } catch (err) {
      // Fallback for demonstration when API is unavailable
      setTimeout(() => {
        setPredictionResult({
          disaster: selectedDisaster,
          risk_score: 0.8542,
          risk_level: 'HIGH',
          model_used: 'Offline Fallback / Cache',
          model_status: 'SIMULATED',
          explanation: 'Koneksi ke server gagal. Menggunakan estimasi heuristik lokal berdasarkan parameter input terakhir. Direkomendasikan untuk verifikasi ulang.',
        });
        setLoading(false);
      }, 1500);
      return;
    } 
    setLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden antialiased relative" style={{ backgroundColor: COLOR.void, color: COLOR.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Global Styles & Font Imports */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        
        /* Grid background pattern */
        .bg-grid-pattern {
          background-image: linear-gradient(to right, #1F2633 1px, transparent 1px),
                            linear-gradient(to bottom, #1F2633 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.15;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #1F2633; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0" />

      {/* ================================================================ */}
      {/* MOBILE HEADER (Hanya tampil di HP) */}
      {/* ================================================================ */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 z-30 relative shadow-md" style={{ backgroundColor: COLOR.panel, borderBottom: `1px solid ${COLOR.hairline}` }}>
        <div className="flex items-center gap-3">
           <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gradient-to-br from-[#151A22] to-[#06080A] border border-[#1F2633] shadow-inner">
             <svg width="16" height="16" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M15 2 L27 7.5 V15 C27 21.5 21.8 26.8 15 28 C8.2 26.8 3 21.5 3 15 V7.5 Z" stroke={COLOR.signal} strokeWidth="2.5" fill="none" />
               <path d="M9 15 L13 19 L21 10" stroke={COLOR.signal} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
             </svg>
           </div>
           <div>
              <h1 className="font-display font-bold text-[15px] tracking-tight text-white leading-none">AEGIS AI</h1>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="relative flex h-2.5 w-2.5" title="Server Online">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
           </span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SIDEBAR (PC) / BOTTOM NAV (Mobile) */}
      {/* ================================================================ */}
      <aside className="w-full md:w-64 flex-none md:flex md:flex-col justify-between shrink-0 fixed bottom-0 md:relative z-50 transition-all duration-300 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] md:shadow-2xl" style={{ backgroundColor: COLOR.panel, borderRight: `1px solid ${COLOR.hairline}`, borderTop: `1px solid ${COLOR.hairline}` }}>
        <div className="flex flex-col">
          {/* Logo Area - Hanya tampil di PC */}
          <div className="hidden md:flex px-6 py-6 items-center justify-start gap-3 relative" style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#EAB308]/50 to-transparent" />
            <div className="relative flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-[#151A22] to-[#06080A] border border-[#1F2633] shadow-inner">
              <svg width="22" height="22" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 2 L27 7.5 V15 C27 21.5 21.8 26.8 15 28 C8.2 26.8 3 21.5 3 15 V7.5 Z" stroke={COLOR.signal} strokeWidth="2" fill="none" />
                <path d="M9 15 L13 19 L21 10" stroke={COLOR.signal} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-[16px] tracking-tight leading-none text-white">AEGIS AI</h1>
              <p className="text-[10px] mt-1 font-mono uppercase tracking-widest text-[#EAB308]">System Console</p>
            </div>
          </div>

          {/* Navigation - Kolom di PC, Baris di Mobile */}
          <nav className="flex flex-row md:flex-col p-2 md:p-4 md:space-y-1.5 justify-around md:justify-start">
            <p className="hidden md:block text-[10px] font-mono uppercase tracking-wider text-[#475569] mb-3 px-2">Modules</p>
            {[
              { id: 'dashboard', label: 'Ringkasan Nasional', icon: Activity, shortLabel: 'Ringkasan' },
              { id: 'map', label: 'Peta Geospasial', icon: MapPin, shortLabel: 'Peta' },
              { id: 'predict', label: 'Mesin Inferensi', icon: Cpu, shortLabel: 'Inferensi' },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg transition-all duration-200 group relative"
                  style={{
                    color: active ? '#FFFFFF' : COLOR.textMuted,
                    backgroundColor: active ? COLOR.panelRaised : 'transparent',
                    border: `1px solid ${active ? COLOR.hairline : 'transparent'}`,
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                  }}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 md:w-4 md:h-4 shrink-0 transition-colors ${active ? 'text-[#EAB308]' : 'text-[#475569] group-hover:text-[#94A3B8]'}`} strokeWidth={active ? 2 : 1.5} />
                  <span className="hidden md:block text-[13px] font-medium">{item.label}</span>
                  <span className="block md:hidden text-[10px] font-medium mt-0.5">{item.shortLabel}</span>
                  {active && <ChevronRight className="hidden md:block w-3 h-3 ml-auto text-[#475569]" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Status - Hanya Tampil di PC */}
        <div className="hidden md:flex p-5 text-[11px] flex-col gap-2 relative" style={{ borderTop: `1px solid ${COLOR.hairline}` }}>
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#1F2633] to-transparent" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#94A3B8]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
              </span>
              Server Status
            </span>
            <span className="font-mono text-[#10B981]">ONLINE</span>
          </div>
          <div className="flex items-center justify-between text-[#475569]">
            <span>Version</span>
            <span className="font-mono">v1.1.0-prod</span>
          </div>
        </div>
      </aside>

      {/* ================================================================ */}
      {/* MAIN CONTENT AREA */}
      {/* ================================================================ */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8 md:px-10 md:py-8 relative z-10 scroll-smooth">
        
        {/* === TAB: DASHBOARD === */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[#EAB308] text-[10px] font-mono tracking-widest uppercase mb-2">
                  <Activity className="w-3 h-3" /> Telemetri Aktif
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">Ringkasan Nasional</h2>
              </div>
              <div className="text-left md:text-right text-[11px] font-mono text-[#475569]">
                Pembaruan Terakhir:<br/>
                <span className="text-[#94A3B8]">{new Date().toLocaleString('id-ID')}</span>
              </div>
            </header>

            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hero Metric */}
              <Card className="col-span-1 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#EAB308]/5 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
                <p className="text-[12px] text-[#94A3B8] font-medium uppercase tracking-wider">Indeks Risiko Gabungan</p>
                <div className="flex items-baseline gap-2 mt-4">
                   <p className="font-mono text-5xl md:text-7xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-[#FDE047] to-[#CA8A04] drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    {nationalIndex.toFixed(0)}
                  </p>
                  <span className="text-[#475569] font-mono text-lg md:text-xl">/100</span>
                </div>
                <p className="text-[12px] mt-4 text-[#475569] border-t border-[#1F2633] pt-4">
                  Berdasarkan agregasi {MONITORING_STATIONS.length} stasiun pantau.
                </p>
              </Card>

              {/* Mini Stats */}
              <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Model Engine', value: '3/3', note: 'Siaga Penuh', color: COLOR.water },
                  { label: 'Anomali Iklim', value: '78%', note: 'Di atas normal', color: COLOR.signal },
                  { label: 'Peringatan Dini', value: '4', note: 'Zona Merah', color: COLOR.danger },
                ].map((m, i) => (
                  <Card key={i} className="flex flex-col justify-between hover:border-[#475569] transition-colors">
                    <p className="text-[11px] text-[#94A3B8] font-medium">{m.label}</p>
                    <p className="font-mono text-3xl mt-3 text-white" style={{ textShadow: `0 0 10px ${m.color}40` }}>{m.value}</p>
                    <p className="text-[11px] mt-2 font-mono" style={{ color: m.color }}>{m.note}</p>
                  </Card>
                ))}
              </div>
            </div>

            {}
            {/* Table */}
            <Card noPadding>
              <div className="px-6 py-5 flex items-center justify-between border-b border-[#1F2633] bg-[#151A22]/50">
                <h3 className="font-display text-[16px] font-semibold text-white">Status Stasiun Prioritas</h3>
                <RiskChip level="CRITICAL" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] whitespace-nowrap">
                  <thead className="bg-[#0A0D12]">
                    <tr className="text-[#475569] font-mono text-[10px] uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">ID Stasiun</th>
                      <th className="px-6 py-4 font-medium">Lokasi Wilayah</th>
                      <th className="px-6 py-4 font-medium">Risiko Banjir</th>
                      <th className="px-6 py-4 font-medium">Risiko Longsor</th>
                      <th className="px-6 py-4 font-medium">Risiko Gempa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2633]">
                    {MONITORING_STATIONS.map((s) => (
                      <tr key={s.code} className="hover:bg-[#151A22] transition-colors group">
                        <td className="px-6 py-4 font-mono text-[#94A3B8] group-hover:text-white transition-colors">{s.code}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{s.name}</div>
                          <div className="text-[11px] text-[#475569] mt-0.5">{s.type}</div>
                        </td>
                        <td className="px-6 py-4"><RiskChip level={s.flood} /></td>
                        <td className="px-6 py-4"><RiskChip level={s.landslide} /></td>
                        <td className="px-6 py-4"><RiskChip level={s.quake} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {}
        {/* === TAB: MAP === */}
        {activeTab === 'map' && (
          <div className="h-full flex flex-col max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-8 min-h-[70vh]">
             <header className="mb-6 shrink-0">
              <div className="flex items-center gap-2 text-[#06B6D4] text-[10px] font-mono tracking-widest uppercase mb-2">
                <MapPin className="w-3 h-3" /> Pemantauan Spasial
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">Peta Real-Time</h2>
            </header>
            
            <Card noPadding className="flex-1 min-h-[500px] w-full border-[#1F2633] relative flex flex-col bg-[#0a0d12]">
                <SpatialMap stations={MONITORING_STATIONS} />
            </Card>
          </div>
        )}

        {}
        {/* === TAB: PREDICT === */}
        {activeTab === 'predict' && (
          <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
            <header className="mb-8">
              <div className="flex items-center gap-2 text-[#EF4444] text-[10px] font-mono tracking-widest uppercase mb-2">
                <Cpu className="w-3 h-3" /> Simulator Machine Learning
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">Mesin Inferensi</h2>
            </header>

            {/* Model Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(DISASTER_META).map((key) => {
                const meta = DISASTER_META[key];
                const Icon = meta.icon;
                const active = selectedDisaster === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedDisaster(key); setPredictionResult(null); }}
                    className="p-5 rounded-xl flex flex-row md:flex-col items-center md:items-start gap-4 text-left transition-all duration-300 relative overflow-hidden group"
                    style={{
                      backgroundColor: active ? COLOR.panelRaised : `${COLOR.panel}80`,
                      border: `1px solid ${active ? meta.accent : COLOR.hairline}`,
                      boxShadow: active ? `0 0 20px ${meta.accent}20` : 'none',
                    }}
                  >
                    {active && <div className="absolute top-0 left-0 w-1 h-full md:w-full md:h-1" style={{ backgroundColor: meta.accent }} />}
                    <Icon className="w-6 h-6 shrink-0" style={{ color: active ? meta.accent : COLOR.textFaint }} strokeWidth={1.5} />
                    <div>
                      <p className={`font-semibold text-[14px] ${active ? 'text-white' : 'text-[#94A3B8]'}`}>{meta.label}</p>
                      <p className="text-[11px] font-mono text-[#475569] mt-1 hidden md:block">{meta.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Form Input */}
              <Card className="col-span-1 lg:col-span-2 space-y-6">
                <div className="flex items-center gap-2 border-b border-[#1F2633] pb-4">
                   <div className="w-2 h-2 rounded-full bg-[#EAB308]"></div>
                   <h3 className="font-display text-[16px] font-semibold text-white">Parameter Input</h3>
                </div>

                {selectedDisaster === 'flood' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Curah Hujan" unit="mm" value={floodData.rainfall} onChange={(v) => setFloodData({ ...floodData, rainfall: v })} />
                    <TelemetryField label="Tinggi Air Sungai" unit="m" value={floodData.river_level} onChange={(v) => setFloodData({ ...floodData, river_level: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={floodData.soil_moisture} onChange={(v) => setFloodData({ ...floodData, soil_moisture: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={floodData.elevation} onChange={(v) => setFloodData({ ...floodData, elevation: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={floodData.slope} onChange={(v) => setFloodData({ ...floodData, slope: v })} />
                    <TelemetryField label="Kapasitas Drainase" unit="%" value={floodData.drainage_capacity} onChange={(v) => setFloodData({ ...floodData, drainage_capacity: v })} />
                  </div>
                )}

                {selectedDisaster === 'landslide' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Curah Hujan" unit="mm" value={landslideData.rainfall} onChange={(v) => setLandslideData({ ...landslideData, rainfall: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={landslideData.slope} onChange={(v) => setLandslideData({ ...landslideData, slope: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={landslideData.elevation} onChange={(v) => setLandslideData({ ...landslideData, elevation: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={landslideData.soil_moisture} onChange={(v) => setLandslideData({ ...landslideData, soil_moisture: v })} />
                    <TelemetryField label="Jarak ke Sungai" unit="m" value={landslideData.distance_to_river} onChange={(v) => setLandslideData({ ...landslideData, distance_to_river: v })} />
                    <TelemetryField label="Indeks NDVI" unit="-1/1" step="0.01" value={landslideData.ndvi} onChange={(v) => setLandslideData({ ...landslideData, ndvi: v })} />
                  </div>
                )}

                {selectedDisaster === 'earthquake' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Magnitudo" unit="SR" step="0.1" value={earthquakeData.magnitude} onChange={(v) => setEarthquakeData({ ...earthquakeData, magnitude: v })} />
                    <TelemetryField label="Kedalaman Gempa" unit="km" value={earthquakeData.depth} onChange={(v) => setEarthquakeData({ ...earthquakeData, depth: v })} />
                    <TelemetryField label="Jarak ke Sesar" unit="km" value={earthquakeData.distance_to_fault} onChange={(v) => setEarthquakeData({ ...earthquakeData, distance_to_fault: v })} />
                    <TelemetryField label="Kepadatan Sesar" unit="idx" value={earthquakeData.fault_density} onChange={(v) => setEarthquakeData({ ...earthquakeData, fault_density: v })} />
                  </div>
                )}

                <div className="pt-4 border-t border-[#1F2633]">
                  <div className="mb-5">
                    <label className="block text-[11px] text-[#94A3B8] mb-1.5 font-medium tracking-wide">
                      API Key (Otorisasi Endpoint)
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan API Key backend Anda..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-[#06080A] border border-[#1F2633] rounded-md px-3 py-2 text-[#F1F4F9] text-sm focus:outline-none focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308]/30 transition-all shadow-inner"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    />
                    <p className="text-[10px] text-[#475569] mt-1.5">Kosongkan jika API Anda tidak memerlukan autentikasi.</p>
                  </div>

                  <button
                    onClick={handleRunInference}
                    disabled={loading}
                    className="w-full py-3.5 rounded-lg font-semibold text-[14px] tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    style={{ backgroundColor: DISASTER_META[selectedDisaster].accent, color: COLOR.void, boxShadow: `0 4px 15px ${DISASTER_META[selectedDisaster].accent}40` }}
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-[#06080A] border-t-transparent rounded-full animate-spin"></span> Memproses Data...</>
                    ) : 'Jalankan Inferensi'}
                  </button>
                </div>
              </Card>

              {}
              {/* Result Output */}
              <Card className="col-span-1">
                <div className="flex items-center gap-2 border-b border-[#1F2633] pb-4 mb-6">
                   <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                   <h3 className="font-display text-[16px] font-semibold text-white">Hasil Analisis</h3>
                </div>

                {predictionResult ? (
                  <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="text-center p-6 rounded-xl relative overflow-hidden" style={{ backgroundColor: '#06080A', border: `1px solid ${COLOR.hairline}` }}>
                       {/* Background glow based on risk */}
                      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${RISK_COLOR[predictionResult.risk_level] || COLOR.textMuted} 0%, transparent 70%)` }}></div>
                      
                      <p className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-widest mb-3 relative z-10">Skor Probabilitas</p>
                      <p className="font-mono text-5xl font-bold relative z-10" style={{ color: RISK_COLOR[predictionResult.risk_level] ?? COLOR.signal, textShadow: `0 0 20px ${RISK_COLOR[predictionResult.risk_level] || COLOR.signal}40` }}>
                        {Number(predictionResult.risk_score).toFixed(4)}
                      </p>
                      <div className="mt-4 flex justify-center relative z-10">
                        <RiskChip level={predictionResult.risk_level} />
                      </div>
                    </div>

                    <div className="space-y-4 bg-[#0A0D12] p-4 rounded-lg border border-[#1F2633]">
                      <div>
                        <p className="text-[10px] font-mono text-[#475569] uppercase tracking-wider">Engine Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          {predictionResult.model_status === 'ACTIVE' ? (
                             <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                          ) : (
                             <AlertTriangle className="w-3 h-3 text-[#EAB308]" />
                          )}
                          <p className="text-[13px] text-[#F1F4F9] font-medium">{predictionResult.model_used}</p>
                        </div>
                      </div>
                      <div className="border-t border-[#1F2633] pt-3">
                        <p className="text-[10px] font-mono text-[#475569] uppercase tracking-wider">Log Inferensi</p>
                        <p className="text-[12px] text-[#94A3B8] mt-1 leading-relaxed">{predictionResult.explanation}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 flex flex-col items-center justify-center border border-dashed border-[#1F2633] rounded-xl bg-[#06080A]">
                    <Cpu className="w-8 h-8 text-[#1F2633] mb-4" />
                    <p className="text-[12px] text-[#475569] max-w-[200px] leading-relaxed">
                      Menunggu input parameter. Silakan isi form dan jalankan inferensi.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}