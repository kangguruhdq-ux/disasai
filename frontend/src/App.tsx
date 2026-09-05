import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity, CloudRain, Mountain, Radio, MapPin, Cpu, ChevronRight, AlertTriangle
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

/**
 * AEGIS AI — Disaster Intelligence Console
 * Redesigned for a premium, high-tech instrumentation feel.
 */

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://disasai-production.up.railway.app';

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

const RISK_COLOR: Record<string, string> = {
  LOW: '#10B981',      // Emerald
  MEDIUM: '#F59E0B',   // Amber
  HIGH: '#F97316',     // Orange
  EXTREME: '#EF4444',  // Red
  CRITICAL: '#B91C1C', // Dark Red
};

const RISK_LABEL_ID: Record<string, string> = {
  LOW: 'RENDAH',
  MEDIUM: 'SEDANG',
  HIGH: 'TINGGI',
  EXTREME: 'EKSTREM',
  CRITICAL: 'KRITIS',
};

type DisasterKey = 'flood' | 'landslide' | 'earthquake';

const DISASTER_META: Record<DisasterKey, { label: string; sub: string; icon: React.ElementType; accent: string }> = {
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
function RiskChip({ level }: { level: string }) {
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

function TelemetryField({ label, unit, value, onChange, step }: any) {
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
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
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

function Card({ children, className = '', noPadding = false }: { children: React.ReactNode; className?: string, noPadding?: boolean }) {
  return (
    <div
      className={`rounded-xl overflow-hidden backdrop-blur-sm ${noPadding ? '' : 'p-6'} ${className}`}
      style={{
        backgroundColor: `${COLOR.panel}E6`, // Slight transparency
        border: `1px solid ${COLOR.hairline}`,
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'predict'>('dashboard');
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterKey>('flood');
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  // States for forms
  const [floodData, setFloodData] = useState({ rainfall: 220.0, river_level: 4.5, soil_moisture: 78.0, elevation: 25.0, slope: 5.0, drainage_capacity: 45.0, historical_floods: 3, seismic_activity: 0.2 });
  const [landslideData, setLandslideData] = useState({ rainfall: 180.0, soil_moisture: 85.0, slope: 35.0, elevation: 450.0, soil_type: 2, land_cover: 1, distance_to_river: 300.0, distance_to_road: 150.0, geology: 2, ndvi: 0.45, historical_landslide: 2 });
  const [earthquakeData, setEarthquakeData] = useState({ latitude: -6.2000, longitude: 106.8166, depth: 15.0, magnitude: 6.8, distance_to_fault: 12.5, fault_density: 6.0, historical_earthquakes: 12, seismic_activity: 6.5, tectonic_region: 2 });

  const nationalIndex = useMemo(() => {
    const rank: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };
    const scores = MONITORING_STATIONS.flatMap((s) => [rank[s.flood], rank[s.landslide], rank[s.quake]]);
    return (scores.reduce((a, b) => a + b, 0) / scores.length / 4) * 100;
  }, []);

  const handleRunInference = async () => {
    setLoading(true);
    setPredictionResult(null);
    let payload = {};
    if (selectedDisaster === 'flood') payload = floodData;
    if (selectedDisaster === 'landslide') payload = landslideData;
    if (selectedDisaster === 'earthquake') payload = earthquakeData;

    try {
      const res = await fetch(`${API_BASE_URL}/predict/${selectedDisaster}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setPredictionResult({
        disaster: selectedDisaster,
        risk_score: 0.85,
        risk_level: 'HIGH',
        model_used: 'Offline Fallback',
        model_status: 'SIMULATED',
        explanation: 'Koneksi ke server gagal. Menggunakan estimasi heuristik lokal.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden antialiased relative" style={{ backgroundColor: COLOR.void, color: COLOR.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
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

        /* Leaflet Dark mode overrides */
        .leaflet-container { background: #06080A !important; font-family: 'IBM Plex Sans', sans-serif !important; }
        .leaflet-popup-content-wrapper { background: #0E1116 !important; color: #F1F4F9 !important; border: 1px solid #1F2633; border-radius: 8px;}
        .leaflet-popup-tip { background: #0E1116 !important; border-top: 1px solid #1F2633; border-left: 1px solid #1F2633;}
      `}</style>

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0" />

      {/* ================================================================ */}
      {/* SIDEBAR */}
      {/* ================================================================ */}
      <aside className="w-64 flex flex-col justify-between shrink-0 relative z-10 shadow-2xl" style={{ backgroundColor: COLOR.panel, borderRight: `1px solid ${COLOR.hairline}` }}>
        <div>
          {/* Logo Area */}
          <div className="px-6 py-6 flex items-center gap-3 relative" style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#EAB308]/50 to-transparent" />
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#151A22] to-[#06080A] border border-[#1F2633] shadow-inner">
              <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
                <path d="M15 2 L27 7.5 V15 C27 21.5 21.8 26.8 15 28 C8.2 26.8 3 21.5 3 15 V7.5 Z" stroke={COLOR.signal} strokeWidth="2" fill="none" />
                <path d="M9 15 L13 19 L21 10" stroke={COLOR.signal} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-[16px] tracking-tight leading-none text-white">AEGIS AI</h1>
              <p className="text-[10px] mt-1 font-mono uppercase tracking-widest text-[#EAB308]">System Console</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#475569] mb-3 px-2">Modules</p>
            {[
              { id: 'dashboard', label: 'Ringkasan Nasional', icon: Activity },
              { id: 'map', label: 'Peta Geospasial', icon: MapPin },
              { id: 'predict', label: 'Mesin Inferensi', icon: Cpu },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group"
                  style={{
                    color: active ? '#FFFFFF' : COLOR.textMuted,
                    backgroundColor: active ? COLOR.panelRaised : 'transparent',
                    border: `1px solid ${active ? COLOR.hairline : 'transparent'}`,
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  <Icon className={`w-4 h-4 transition-colors ${active ? 'text-[#EAB308]' : 'text-[#475569] group-hover:text-[#94A3B8]'}`} strokeWidth={active ? 2 : 1.5} />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 ml-auto text-[#475569]" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Status */}
        <div className="p-5 text-[11px] flex flex-col gap-2 relative" style={{ borderTop: `1px solid ${COLOR.hairline}` }}>
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
      <main className="flex-1 overflow-y-auto px-10 py-8 relative z-10 scroll-smooth">
        
        {/* === TAB: DASHBOARD === */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#EAB308] text-[10px] font-mono tracking-widest uppercase mb-2">
                  <Activity className="w-3 h-3" /> Telemetri Aktif
                </div>
                <h2 className="font-display text-3xl font-bold text-white tracking-tight">Ringkasan Nasional</h2>
              </div>
              <div className="text-right text-[11px] font-mono text-[#475569]">
                Pembaruan Terakhir:<br/>
                <span className="text-[#94A3B8]">{new Date().toLocaleString('id-ID')}</span>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hero Metric */}
              <Card className="col-span-1 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#EAB308]/5 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
                <p className="text-[12px] text-[#94A3B8] font-medium uppercase tracking-wider">Indeks Risiko Gabungan</p>
                <div className="flex items-baseline gap-2 mt-4">
                   <p className="font-mono text-7xl font-semibold text-transparent bg-clip-text bg-gradient-to-b from-[#FDE047] to-[#CA8A04] drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    {nationalIndex.toFixed(0)}
                  </p>
                  <span className="text-[#475569] font-mono text-xl">/100</span>
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

        {/* === TAB: MAP === */}
        {activeTab === 'map' && (
          <div className="h-full flex flex-col max-w-[1200px] mx-auto animate-in fade-in duration-500">
             <header className="mb-6">
              <div className="flex items-center gap-2 text-[#06B6D4] text-[10px] font-mono tracking-widest uppercase mb-2">
                <MapPin className="w-3 h-3" /> Pemantauan Spasial
              </div>
              <h2 className="font-display text-3xl font-bold text-white tracking-tight">Peta Real-Time</h2>
            </header>
            
            <Card noPadding className="flex-1 min-h-[500px] border-[#1F2633] relative">
              <div className="absolute inset-0 z-0 bg-[#06080A] animate-pulse"></div> {/* Loading placeholder */}
              <MapContainer center={[-2.548926, 118.014863]} zoom={5} className="h-full w-full relative z-10" zoomControl={false}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {MONITORING_STATIONS.map((st) => (
                  <Marker key={st.code} position={[st.lat, st.lng]} icon={customMarkerIcon}>
                    <Popup className="custom-popup">
                      <div className="p-1">
                        <p className="text-[10px] font-mono text-[#EAB308] mb-1">{st.code}</p>
                        <h4 className="font-bold text-sm text-white">{st.name}</h4>
                        <p className="text-xs text-[#94A3B8] mt-1 border-t border-[#1F2633] pt-1">{st.type}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Card>
          </div>
        )}

        {/* === TAB: PREDICT === */}
        {activeTab === 'predict' && (
          <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
              <div className="flex items-center gap-2 text-[#EF4444] text-[10px] font-mono tracking-widest uppercase mb-2">
                <Cpu className="w-3 h-3" /> Simulator Machine Learning
              </div>
              <h2 className="font-display text-3xl font-bold text-white tracking-tight">Mesin Inferensi</h2>
            </header>

            {/* Model Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(DISASTER_META) as DisasterKey[]).map((key) => {
                const meta = DISASTER_META[key];
                const Icon = meta.icon;
                const active = selectedDisaster === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedDisaster(key); setPredictionResult(null); }}
                    className="p-5 rounded-xl flex flex-col gap-4 text-left transition-all duration-300 relative overflow-hidden group"
                    style={{
                      backgroundColor: active ? COLOR.panelRaised : `${COLOR.panel}80`,
                      border: `1px solid ${active ? meta.accent : COLOR.hairline}`,
                      boxShadow: active ? `0 0 20px ${meta.accent}20` : 'none',
                    }}
                  >
                    {active && <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: meta.accent }} />}
                    <Icon className="w-6 h-6" style={{ color: active ? meta.accent : COLOR.textFaint }} strokeWidth={1.5} />
                    <div>
                      <p className={`font-semibold text-[14px] ${active ? 'text-white' : 'text-[#94A3B8]'}`}>{meta.label}</p>
                      <p className="text-[11px] font-mono text-[#475569] mt-1">{meta.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Form Input */}
              <Card className="col-span-2 space-y-6">
                <div className="flex items-center gap-2 border-b border-[#1F2633] pb-4">
                   <div className="w-2 h-2 rounded-full bg-[#EAB308]"></div>
                   <h3 className="font-display text-[16px] font-semibold text-white">Parameter Input</h3>
                </div>

                {selectedDisaster === 'flood' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Curah Hujan" unit="mm" value={floodData.rainfall} onChange={(v: any) => setFloodData({ ...floodData, rainfall: v })} />
                    <TelemetryField label="Tinggi Air Sungai" unit="m" value={floodData.river_level} onChange={(v: any) => setFloodData({ ...floodData, river_level: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={floodData.soil_moisture} onChange={(v: any) => setFloodData({ ...floodData, soil_moisture: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={floodData.elevation} onChange={(v: any) => setFloodData({ ...floodData, elevation: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={floodData.slope} onChange={(v: any) => setFloodData({ ...floodData, slope: v })} />
                    <TelemetryField label="Kapasitas Drainase" unit="%" value={floodData.drainage_capacity} onChange={(v: any) => setFloodData({ ...floodData, drainage_capacity: v })} />
                  </div>
                )}

                {selectedDisaster === 'landslide' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Curah Hujan" unit="mm" value={landslideData.rainfall} onChange={(v: any) => setLandslideData({ ...landslideData, rainfall: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={landslideData.slope} onChange={(v: any) => setLandslideData({ ...landslideData, slope: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={landslideData.elevation} onChange={(v: any) => setLandslideData({ ...landslideData, elevation: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={landslideData.soil_moisture} onChange={(v: any) => setLandslideData({ ...landslideData, soil_moisture: v })} />
                    <TelemetryField label="Jarak ke Sungai" unit="m" value={landslideData.distance_to_river} onChange={(v: any) => setLandslideData({ ...landslideData, distance_to_river: v })} />
                    <TelemetryField label="Indeks NDVI" unit="-1/1" step="0.01" value={landslideData.ndvi} onChange={(v: any) => setLandslideData({ ...landslideData, ndvi: v })} />
                  </div>
                )}

                {selectedDisaster === 'earthquake' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <TelemetryField label="Magnitudo" unit="SR" step="0.1" value={earthquakeData.magnitude} onChange={(v: any) => setEarthquakeData({ ...earthquakeData, magnitude: v })} />
                    <TelemetryField label="Kedalaman Gempa" unit="km" value={earthquakeData.depth} onChange={(v: any) => setEarthquakeData({ ...earthquakeData, depth: v })} />
                    <TelemetryField label="Jarak ke Sesar" unit="km" value={earthquakeData.distance_to_fault} onChange={(v: any) => setEarthquakeData({ ...earthquakeData, distance_to_fault: v })} />
                    <TelemetryField label="Kepadatan Sesar" unit="idx" value={earthquakeData.fault_density} onChange={(v: any) => setEarthquakeData({ ...earthquakeData, fault_density: v })} />
                  </div>
                )}

                <div className="pt-4 border-t border-[#1F2633]">
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
                      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${RISK_COLOR[predictionResult.risk_level]} 0%, transparent 70%)` }}></div>
                      
                      <p className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-widest mb-3 relative z-10">Skor Probabilitas</p>
                      <p className="font-mono text-5xl font-bold relative z-10" style={{ color: RISK_COLOR[predictionResult.risk_level] ?? COLOR.signal, textShadow: `0 0 20px ${RISK_COLOR[predictionResult.risk_level]}40` }}>
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
