import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

let memoryStorage = {};

export const safeStorage = {
    getItem: async (key) => {
        try {
            if (typeof AsyncStorage !== 'undefined') {
                const val = await AsyncStorage.getItem(key);
                if (val !== null) return val;
            }
        } catch (e) {
            console.warn("AsyncStorage get error fallback to memory", e);
        }
        return memoryStorage[key] || null;
    },
    setItem: async (key, value) => {
        try {
            if (typeof AsyncStorage !== 'undefined') {
                await AsyncStorage.setItem(key, value);
                return;
            }
        } catch (e) {
            console.warn("AsyncStorage set error fallback to memory", e);
        }
        memoryStorage[key] = value;
    },
    removeItem: async (key) => {
        try {
            if (typeof AsyncStorage !== 'undefined') {
                await AsyncStorage.removeItem(key);
                return;
            }
        } catch (e) {
            console.warn("AsyncStorage remove error fallback to memory", e);
        }
        delete memoryStorage[key];
    }
};

// Using adb reverse, the phone's 127.0.0.1 routes directly to the computer over USB
const API_URL = 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(
    async (config) => {
        const token = await safeStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Auth ────────────────────────────────────────────────────────
export const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/api/v1/auth/login', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token } = response.data;
    await safeStorage.setItem('userToken', access_token);
    return access_token;
};

export const register = async (username, email, password) => {
    const response = await api.post('/api/v1/auth/register', { username, email, password });
    return response.data;
};

export const logout = async () => {
    await safeStorage.removeItem('userToken');
};

// ── User Profile ────────────────────────────────────────────────
export const fetchProfile = async () => {
    const response = await api.get('/api/v1/users/me');
    return response.data;
};

export const updateProfile = async (data) => {
    const response = await api.patch('/api/v1/users/me', data);
    return response.data;
};

// ── Risk & Heatmap ──────────────────────────────────────────────
export const fetchHeatmap = async (mode = 'auto') => {
    const response = await api.get('/api/v1/risk/heatmap', { params: { mode } });
    return response.data;
};

export const checkRisk = async (latitude, longitude) => {
    const response = await api.post('/api/v1/risk/check', { latitude, longitude });
    return response.data;
};

export const fetchHotspots = async (mode = 'night') => {
    const response = await api.get(`/api/v1/risk/hotspots/${mode}`);
    return response.data;
};

// ── Routes ──────────────────────────────────────────────────────
export const calculateRoutes = async (origin, destination, timeMode = 'Auto (Recommended)') => {
    const backendOrigin = { lat: origin.latitude, lon: origin.longitude };
    const backendDest = { lat: destination.latitude, lon: destination.longitude };
    
    let timePref = 'auto';
    if (timeMode === 'Day Mode') timePref = 'day';
    else if (timeMode === 'Night Mode') timePref = 'night';
    
    const response = await api.post('/api/v1/routes/calculate', {
        origin: backendOrigin, 
        destination: backendDest, 
        preferences: { time_mode: timePref }
    });
    return response.data;
};

// ── Incidents ───────────────────────────────────────────────────
export const submitReport = async (reportData) => {
    const response = await api.post('/api/v1/incidents/', reportData);
    return response.data;
};

export const uploadIncidentPhotos = async (incidentId, photos) => {
    const formData = new FormData();
    photos.forEach((photo, index) => {
        formData.append('files', {
            uri: photo.uri,
            type: photo.type || 'image/jpeg',
            name: photo.fileName || `photo_${index}.jpg`,
        });
    });
    const response = await api.post(`/api/v1/incidents/${incidentId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const fetchMyIncidents = async (skip = 0, limit = 20) => {
    const response = await api.get('/api/v1/incidents/me', { params: { skip, limit } });
    return response.data;
};

export const fetchNearbyIncidents = async (latitude, longitude, radius_km = 0.5) => {
    const response = await api.get('/api/v1/incidents/nearby', {
        params: { latitude, longitude, radius_km }
    });
    return response.data;
};

// ── Safety / SOS ────────────────────────────────────────────────
export const triggerSOS = async (latitude, longitude) => {
    const response = await api.post('/api/v1/safety/sos', { latitude, longitude });
    return response.data;
};

export const sendCheckIn = async (latitude, longitude, message = "I'm Safe") => {
    const response = await api.post('/api/v1/safety/checkin', { latitude, longitude, message });
    return response.data;
};

export const fetchEmergencyContacts = async () => {
    const response = await api.get('/api/v1/safety/contacts');
    return response.data;
};

export const addEmergencyContact = async (name, phone, relation) => {
    const response = await api.post('/api/v1/safety/contacts', { name, phone, relation });
    return response.data;
};

export const deleteEmergencyContact = async (contactId) => {
    await api.delete(`/api/v1/safety/contacts/${contactId}`);
};

export const fetchSOSHistory = async () => {
    const response = await api.get('/api/v1/safety/sos-history');
    return response.data;
};

// ── Alerts ──────────────────────────────────────────────────────
export const fetchAlertHistory = async () => {
    const response = await api.get('/api/v1/alerts/history');
    return response.data;
};

export const fetchAlertSettings = async () => {
    const response = await api.get('/api/v1/alerts/settings');
    return response.data;
};

export const updateAlertSettings = async (settings) => {
    const response = await api.post('/api/v1/alerts/settings', settings);
    return response.data;
};

export default api;
