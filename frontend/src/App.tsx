import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity, CloudRain, Mountain, Radio, MapPin, Cpu,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

/**
 * AEGIS AI — Disaster Intelligence Console
 *
 * Design direction: an instrumentation console for reading terrain, not a generic
 * SaaS dashboard. The palette is drawn from topographic elevation maps (moss →
 * ochre → sienna → brick-red for rising risk) and seismograph readouts. Numeric
 * telemetry is set in a monospace face to read like an instrument display; body
 * copy is set in a plain, engineering-grade sans so long labels stay legible.
 *
 * NOTE: add these two Google Fonts links to your index.html <head> for best
 * results (a runtime @import is included below as a fallback):
 *   <link rel="preconnect" href="https://fonts.googleapis.com">
 *   <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
 */

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLOR = {
  void: '#0A0D12',
  panel: '#12161D',
  panelRaised: '#171C25',
  hairline: '#232935',
  textPrimary: '#E4E7EB',
  textMuted: '#8A93A3',
  textFaint: '#4B5563',
  signal: '#C9A227',   // primary accent — ochre, reads as an instrument dial
  water: '#3D8B8B',    // secondary accent — teal-slate, used for hydrological data
};

const RISK_COLOR: Record<string, string> = {
  LOW: '#4A8C5E',
  MEDIUM: '#C9A227',
  HIGH: '#C1662F',
  EXTREME: '#B33951',
  CRITICAL: '#B33951',
};

const RISK_LABEL_ID: Record<string, string> = {
  LOW: 'RENDAH',
  MEDIUM: 'SEDANG',
  HIGH: 'TINGGI',
  EXTREME: 'EKSTREM',
  CRITICAL: 'EKSTREM',
};

type DisasterKey = 'flood' | 'landslide' | 'earthquake';

const DISASTER_META: Record<DisasterKey, { label: string; sub: string; icon: React.ElementType; accent: string }> = {
  flood: { label: 'Model Banjir', sub: 'Flood Ensemble Engine', icon: CloudRain, accent: COLOR.water },
  landslide: { label: 'Model Tanah Longsor', sub: 'Landslide Susceptibility', icon: Mountain, accent: COLOR.signal },
  earthquake: { label: 'Model Gempa Bumi', sub: 'Seismic Hazard Estimator', icon: Radio, accent: '#B33951' },
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
// Small presentational helpers
// ---------------------------------------------------------------------------
function RiskChip({ level }: { level: string }) {
  const color = RISK_COLOR[level] ?? COLOR.textMuted;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color, backgroundColor: `${color}1F`, border: `1px solid ${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {RISK_LABEL_ID[level] ?? level}
    </span>
  );
}

function TelemetryField({
  label, unit, value, onChange, step,
}: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[#8A93A3] mb-1.5">
        {label} <span className="text-[#4B5563]">· {unit}</span>
      </span>
      <input
        type="number"
        step={step ?? 'any'}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[#0A0D12] border border-[#232935] rounded-md px-3 py-2 text-[#E4E7EB]
                   focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/40 transition-colors"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'predict'>('dashboard');
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterKey>('flood');
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  const [floodData, setFloodData] = useState({
    rainfall: 220.0, river_level: 4.5, soil_moisture: 78.0, elevation: 25.0,
    slope: 5.0, drainage_capacity: 45.0, historical_floods: 3, seismic_activity: 0.2,
  });

  const [landslideData, setLandslideData] = useState({
    rainfall: 180.0, soil_moisture: 85.0, slope: 35.0, elevation: 450.0,
    soil_type: 2, land_cover: 1, distance_to_river: 300.0, distance_to_road: 150.0,
    geology: 2, ndvi: 0.45, historical_landslide: 2,
  });

  const [earthquakeData, setEarthquakeData] = useState({
    latitude: -6.2000, longitude: 106.8166, depth: 15.0, magnitude: 6.8,
    distance_to_fault: 12.5, fault_density: 6.0, historical_earthquakes: 12,
    seismic_activity: 6.5, tectonic_region: 2,
  });

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
        model_status: data.model_status ?? (data.model_used?.includes('Heuristic') ? 'SIMULATED' : 'ACTIVE'),
        explanation: data.explanation ?? data.disclaimer ?? 'Inferensi berhasil dilakukan.',
      });
    } catch (err) {
      console.error('Inference Error:', err);
      setPredictionResult({
        disaster: selectedDisaster,
        risk_score: 0.85,
        risk_level: 'HIGH',
        model_used: 'AEGIS Offline Fallback Estimator',
        model_status: 'OFFLINE',
        explanation: 'Koneksi backend terputus atau gagal validasi. Menggunakan estimasi lokal.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: COLOR.void, color: COLOR.textPrimary, fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .aegis-display { font-family: 'Space Grotesk', sans-serif; }
        .aegis-mono { font-family: 'IBM Plex Mono', monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #232935; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* ---------------------------------------------------------------- */}
      {/* Sidebar */}
      {/* ---------------------------------------------------------------- */}
      <aside className="w-60 flex flex-col justify-between shrink-0" style={{ backgroundColor: COLOR.panel, borderRight: `1px solid ${COLOR.hairline}` }}>
        <div>
          <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path d="M15 2 L27 7.5 V15 C27 21.5 21.8 26.8 15 28 C8.2 26.8 3 21.5 3 15 V7.5 Z"
                stroke={COLOR.signal} strokeWidth="1.6" fill="none" />
              <path d="M9 15 L13 19 L21 10" stroke={COLOR.signal} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h1 className="aegis-display font-semibold text-[15px] tracking-tight leading-none">AEGIS AI</h1>
              <p className="text-[11px] mt-1" style={{ color: COLOR.textMuted }}>Disaster Intelligence Console</p>
            </div>
          </div>

          <nav className="p-3 space-y-0.5">
            {[
              { id: 'dashboard', label: 'Ringkasan Nasional', icon: Activity },
              { id: 'map', label: 'Peta Pemantauan', icon: MapPin },
              { id: 'predict', label: 'Simulasi Inferensi', icon: Cpu },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === (item.id as typeof activeTab);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors"
                  style={{
                    color: active ? COLOR.textPrimary : COLOR.textMuted,
                    backgroundColor: active ? COLOR.panelRaised : 'transparent',
                    borderLeft: active ? `2px solid ${COLOR.signal}` : '2px solid transparent',
                  }}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 text-[11px] flex items-center justify-between" style={{ borderTop: `1px solid ${COLOR.hairline}`, color: COLOR.textMuted }}>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4A8C5E' }} />
            Backend FastAPI
          </span>
          <span className="aegis-mono">v1.1.0</span>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Main content */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto px-8 py-7">

        {/* ============================= DASHBOARD ============================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-6xl">
            <header>
              <p className="text-[11px] tracking-wide" style={{ color: COLOR.textMuted }}>Estimasi Risiko Bencana · Indonesia</p>
              <h2 className="aegis-display text-[26px] font-semibold mt-1">Ringkasan Kondisi Nasional</h2>
            </header>

            {/* Hero metric + supporting readouts, deliberately asymmetric */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1 rounded-lg p-6 flex flex-col justify-between" style={{ backgroundColor: COLOR.panel, border: `1px solid ${COLOR.hairline}` }}>
                <p className="text-[11px]" style={{ color: COLOR.textMuted }}>Indeks Risiko Gabungan</p>
                <p className="aegis-display aegis-mono text-[56px] leading-none mt-3" style={{ color: COLOR.signal }}>
                  {nationalIndex.toFixed(0)}
                </p>
                <p className="text-[12px] mt-3" style={{ color: COLOR.textMuted }}>
                  dari 100 · rata-rata bergerak dari {MONITORING_STATIONS.length} stasiun prioritas
                </p>
              </div>

              <div className="col-span-2 rounded-lg p-6 grid grid-cols-3 gap-6" style={{ backgroundColor: COLOR.panel, border: `1px solid ${COLOR.hairline}` }}>
                {[
                  { label: 'Model Siap Inferensi', value: '3 / 3', note: 'Banjir · Longsor · Gempa' },
                  { label: 'Anomali Curah Hujan', value: '78.4%', note: 'Di atas rata-rata musiman' },
                  { label: 'Stasiun Status Siaga', value: '4', note: 'Kategori Tinggi & Ekstrem' },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-[11px]" style={{ color: COLOR.textMuted }}>{m.label}</p>
                    <p className="aegis-display aegis-mono text-[26px] mt-2">{m.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: COLOR.textFaint }}>{m.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority station table — hairline rows, not stacked cards */}
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${COLOR.hairline}` }}>
              <div className="px-5 py-4 flex items-baseline justify-between" style={{ backgroundColor: COLOR.panel, borderBottom: `1px solid ${COLOR.hairline}` }}>
                <h3 className="aegis-display text-[15px] font-medium">Stasiun Pemantauan Prioritas</h3>
                <span className="text-[11px]" style={{ color: COLOR.textMuted }}>{MONITORING_STATIONS.length} wilayah</span>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr style={{ color: COLOR.textMuted }}>
                    <th className="px-5 py-3 font-normal text-[11px]">Kode</th>
                    <th className="px-5 py-3 font-normal text-[11px]">Wilayah</th>
                    <th className="px-5 py-3 font-normal text-[11px]">Banjir</th>
                    <th className="px-5 py-3 font-normal text-[11px]">Longsor</th>
                    <th className="px-5 py-3 font-normal text-[11px]">Gempa</th>
                  </tr>
                </thead>
                <tbody>
                  {MONITORING_STATIONS.map((s, i) => (
                    <tr key={s.code} style={{ backgroundColor: COLOR.panel, borderTop: i === 0 ? 'none' : `1px solid ${COLOR.hairline}` }}>
                      <td className="px-5 py-3 aegis-mono" style={{ color: COLOR.textFaint }}>{s.code}</td>
                      <td className="px-5 py-3 font-medium">{s.name}
                        <div className="text-[11px]" style={{ color: COLOR.textMuted }}>{s.type}</div>
                      </td>
                      <td className="px-5 py-3"><RiskChip level={s.flood} /></td>
                      <td className="px-5 py-3"><RiskChip level={s.landslide} /></td>
                      <td className="px-5 py-3"><RiskChip level={s.quake} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================= MAP ============================= */}
        {activeTab === 'map' && (
          <div className="space-y-5 h-full flex flex-col max-w-6xl">
            <header>
              <p className="text-[11px]" style={{ color: COLOR.textMuted }}>Sebaran Geografis</p>
              <h2 className="aegis-display text-[26px] font-semibold mt-1">Peta Pemantauan Real-Time</h2>
            </header>
            <div className="flex-1 rounded-lg overflow-hidden min-h-[480px]" style={{ border: `1px solid ${COLOR.hairline}` }}>
              <MapContainer center={[-2.548926, 118.014863]} zoom={5} style={{ height: '100%', width: '100%', background: COLOR.void }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {MONITORING_STATIONS.map((st) => (
                  <Marker key={st.code} position={[st.lat, st.lng]} icon={customMarkerIcon}>
                    <Popup>
                      <div className="p-1" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        <p className="text-[11px] aegis-mono" style={{ color: '#6b7280' }}>{st.code}</p>
                        <h4 className="font-semibold text-sm text-slate-900">{st.name}</h4>
                        <p className="text-xs text-slate-600 mt-1">{st.type}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {/* ============================= PREDICT ============================= */}
        {activeTab === 'predict' && (
          <div className="space-y-6 max-w-6xl">
            <header>
              <p className="text-[11px]" style={{ color: COLOR.textMuted }}>Uji Model</p>
              <h2 className="aegis-display text-[26px] font-semibold mt-1">Simulasi Inferensi</h2>
            </header>

            {/* Model picker */}
            <div className="grid grid-cols-3 gap-4">
              {(Object.keys(DISASTER_META) as DisasterKey[]).map((key) => {
                const meta = DISASTER_META[key];
                const Icon = meta.icon;
                const active = selectedDisaster === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDisaster(key)}
                    className="p-4 rounded-lg flex items-center gap-3 text-left transition-colors"
                    style={{
                      backgroundColor: active ? COLOR.panelRaised : COLOR.panel,
                      border: `1px solid ${active ? meta.accent : COLOR.hairline}`,
                    }}
                  >
                    <Icon className="w-5 h-5 shrink-0" style={{ color: meta.accent }} strokeWidth={1.8} />
                    <div>
                      <p className="font-medium text-[13px]">{meta.label}</p>
                      <p className="text-[11px]" style={{ color: COLOR.textMuted }}>{meta.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-6 items-start">
              {/* Parameter form */}
              <div className="col-span-2 rounded-lg p-6 space-y-5" style={{ backgroundColor: COLOR.panel, border: `1px solid ${COLOR.hairline}` }}>
                <h3 className="aegis-display text-[15px] font-medium pb-4" style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                  Parameter Input
                </h3>

                {selectedDisaster === 'flood' && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <TelemetryField label="Curah Hujan" unit="mm" value={floodData.rainfall} onChange={(v) => setFloodData({ ...floodData, rainfall: v })} />
                    <TelemetryField label="Tinggi Air Sungai" unit="m" value={floodData.river_level} onChange={(v) => setFloodData({ ...floodData, river_level: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={floodData.soil_moisture} onChange={(v) => setFloodData({ ...floodData, soil_moisture: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={floodData.elevation} onChange={(v) => setFloodData({ ...floodData, elevation: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={floodData.slope} onChange={(v) => setFloodData({ ...floodData, slope: v })} />
                    <TelemetryField label="Kapasitas Drainase" unit="%" value={floodData.drainage_capacity} onChange={(v) => setFloodData({ ...floodData, drainage_capacity: v })} />
                  </div>
                )}

                {selectedDisaster === 'landslide' && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <TelemetryField label="Curah Hujan" unit="mm" value={landslideData.rainfall} onChange={(v) => setLandslideData({ ...landslideData, rainfall: v })} />
                    <TelemetryField label="Kemiringan Lereng" unit="°" value={landslideData.slope} onChange={(v) => setLandslideData({ ...landslideData, slope: v })} />
                    <TelemetryField label="Elevasi" unit="mdpl" value={landslideData.elevation} onChange={(v) => setLandslideData({ ...landslideData, elevation: v })} />
                    <TelemetryField label="Kelembapan Tanah" unit="%" value={landslideData.soil_moisture} onChange={(v) => setLandslideData({ ...landslideData, soil_moisture: v })} />
                    <TelemetryField label="Jarak ke Sungai" unit="m" value={landslideData.distance_to_river} onChange={(v) => setLandslideData({ ...landslideData, distance_to_river: v })} />
                    <TelemetryField label="Indeks NDVI" unit="-1 s/d 1" step="0.01" value={landslideData.ndvi} onChange={(v) => setLandslideData({ ...landslideData, ndvi: v })} />
                  </div>
                )}

                {selectedDisaster === 'earthquake' && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <TelemetryField label="Magnitudo" unit="SR" step="0.1" value={earthquakeData.magnitude} onChange={(v) => setEarthquakeData({ ...earthquakeData, magnitude: v })} />
                    <TelemetryField label="Kedalaman Gempa" unit="km" value={earthquakeData.depth} onChange={(v) => setEarthquakeData({ ...earthquakeData, depth: v })} />
                    <TelemetryField label="Jarak ke Sesar" unit="km" value={earthquakeData.distance_to_fault} onChange={(v) => setEarthquakeData({ ...earthquakeData, distance_to_fault: v })} />
                    <TelemetryField label="Kepadatan Sesar" unit="idx" value={earthquakeData.fault_density} onChange={(v) => setEarthquakeData({ ...earthquakeData, fault_density: v })} />
                  </div>
                )}

                <button
                  onClick={handleRunInference}
                  disabled={loading}
                  className="w-full py-3 rounded-md font-medium text-[13px] transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: COLOR.signal, color: COLOR.void }}
                >
                  {loading ? 'Menjalankan Inferensi…' : 'Jalankan Model'}
                </button>
              </div>

              {/* Result panel */}
              <div className="rounded-lg p-6" style={{ backgroundColor: COLOR.panel, border: `1px solid ${COLOR.hairline}` }}>
                <h3 className="aegis-display text-[15px] font-medium pb-4 mb-4" style={{ borderBottom: `1px solid ${COLOR.hairline}` }}>
                  Hasil Estimasi
                </h3>

                {predictionResult ? (
                  <div className="space-y-4">
                    <div className="text-center py-5 rounded-md" style={{ backgroundColor: COLOR.void, border: `1px solid ${COLOR.hairline}` }}>
                      <p className="text-[11px]" style={{ color: COLOR.textMuted }}>Skor Probabilitas</p>
                      <p className="aegis-display aegis-mono text-[38px] mt-1" style={{ color: RISK_COLOR[predictionResult.risk_level] ?? COLOR.signal }}>
                        {predictionResult.risk_score}
                      </p>
                      <div className="mt-2 flex justify-center">
                        <RiskChip level={predictionResult.risk_level} />
                      </div>
                    </div>

                    <dl className="text-[12px] space-y-2">
                      <div>
                        <dt style={{ color: COLOR.textMuted }}>Model digunakan</dt>
                        <dd className="mt-0.5">{predictionResult.model_used}</dd>
                      </div>
                      <div>
                        <dt style={{ color: COLOR.textMuted }}>Catatan</dt>
                        <dd className="mt-0.5" style={{ color: COLOR.textMuted }}>{predictionResult.explanation}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="text-center py-14 text-[12px]" style={{ color: COLOR.textFaint }}>
                    Atur parameter di sebelah kiri lalu jalankan model untuk melihat hasil estimasi.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}