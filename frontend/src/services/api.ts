export const API_BASE_URL = 'http://localhost:8000';

export interface FloodInput {
  rainfall: number;
  river_level: number;
  soil_moisture: number;
  elevation: number;
  slope: number;
  drainage_capacity: number;
  historical_floods?: number;
  seismic_activity?: number;
}

export interface LandslideInput {
  rainfall: number;
  soil_moisture: number;
  slope: number;
  elevation: number;
  soil_type?: number;
  land_cover?: number;
  distance_to_river?: number;
  distance_to_road?: number;
  geology?: number;
  ndvi?: number;
  historical_landslide?: number;
}

export interface EarthquakeInput {
  latitude?: number;
  longitude?: number;
  depth: number;
  magnitude: number;
  distance_to_fault: number;
  fault_density?: number;
  historical_earthquakes?: number;
  seismic_activity?: number;
  tectonic_region?: number;
}

export interface PredictionResponse {
  disaster: string;
  risk_score?: number;
  risk_level?: string;
  hazard_score?: number;
  hazard_level?: string;
  model_used: string;
  explanation?: string;
  disclaimer?: string;
}

/**
 * Memeriksa status kesehatan server FastAPI backend
 */
export const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) throw new Error('Gagal terhubung ke backend server');
  return response.json();
};

/**
 * Mengambil status dan metadata seluruh model Machine Learning
 */
export const getModelsStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/models`);
  if (!response.ok) throw new Error('Gagal mengambil status model ML');
  return response.json();
};

/**
 * Mengirim parameter hidrologi untuk estimasi risiko banjir
 */
export const predictFlood = async (data: FloodInput): Promise<PredictionResponse> => {
  const response = await fetch(`${API_BASE_URL}/predict/flood`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Gagal memproses prediksi banjir');
  return response.json();
};

/**
 * Mengirim parameter geoteknik untuk estimasi kerentanan longsor
 */
export const predictLandslide = async (data: LandslideInput): Promise<PredictionResponse> => {
  const response = await fetch(`${API_BASE_URL}/predict/landslide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Gagal memproses prediksi longsor');
  return response.json();
};

/**
 * Mengirim parameter seismik untuk estimasi bahaya gempa
 */
export const predictEarthquake = async (data: EarthquakeInput): Promise<PredictionResponse> => {
  const response = await fetch(`${API_BASE_URL}/predict/earthquake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Gagal memproses estimasi bahaya seismik');
  return response.json();
};