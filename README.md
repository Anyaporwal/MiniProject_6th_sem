# 🚨 Crime Hotspot Prediction and Public Safety Alert System

An AI-powered Public Safety Web Application that predicts crime-prone areas using Machine Learning and provides safer routing, real-time alerts, and emergency safety features.

This project combines **React Native + Expo (Mobile App)** with **FastAPI (Backend)** and **DBSCAN clustering** to detect, visualize, and respond to high-risk crime zones.

---

## ⚙️ Project Structure

- `SafeRouteApp/`: The mobile frontend application built with React Native and Expo.
- `backend/`: The FastAPI backend serving risk maps, routing, and user data.
- `data/`: Datasets used for crime clustering and hotspot generation.

---

## 🚀 Installation & Setup

### 🔹 1. Backend Setup
1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```
2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. **Install dependencies:**
   ```bash
   pip install fastapi uvicorn sqlalchemy requests pandas tabulate scikit-learn passlib python-multipart python-jose[cryptography]
   ```
4. **Configure Environment:**
   Create a `.env` file in the `backend/` directory with necessary configurations (Database URL, Secret Keys).

### 🔹 2. Mobile App Setup (SafeRouteApp)
1. **Navigate to the app directory:**
   ```bash
   cd SafeRouteApp
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Install Expo CLI (if not already installed):**
   ```bash
   npm install -g expo-cli
   ```

---

## 🏃 Running the Application

### 🔹 Start the Backend
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
The API will be available at `http://localhost:8000`. You can access documentation at `http://localhost:8000/docs`.

### 🔹 Start the Mobile App
```bash
cd SafeRouteApp
npx expo start
```
Use the **Expo Go** app on your phone or an emulator to scan the QR code and run the application.

---

## 🧪 Testing & Validation

### 🔹 Backend Stress Tests
We have implemented a comprehensive stress test for the risk routing engine that tests all city hotspots.
1. **Run Hotspot Stress Test:**
   ```bash
   cd backend
   python c:\Users\aloka\.gemini\antigravity\brain\f5976c0d-11e4-45a5-a9b2-fcbb81c33da9\scratch\test_hotspots.py
   ```
   *Note: Ensure the local server is running before starting the test.*

### 🔹 API Endpoint Testing
You can run automated endpoint tests to verify authentication and routing logic:
```bash
cd backend
python test_endpoints.py
python test_api_http.py
```

---

## 🧠 Project Overview

The system analyzes historical crime datasets using **DBSCAN clustering** to detect crime hotspots and visualize them on an interactive map.

Users can:

- View risk heatmaps (Day/Night mode)
- Request safer routes avoiding high-risk areas
- Report incidents
- Receive safety alerts
- Enable women safety features with emergency support

---

## ⚙️ Tech Stack

### 🔹 Frontend
- React Native
- Expo
- React Navigation
- Lucide Icons

### 🔹 Backend
- FastAPI
- Python
- SQLite / SQLAlchemy
- DBSCAN (Scikit-learn)
- OSRM (Routing Engine)

---

# 🌟 Core Features

### 🚗 Request Safe Route
- Enter origin & destination
- Calculates risk score using Gaussian decay around hotspots.
- Automatically compares **Safest**, **Balanced**, and **Fastest** routes.
- **Dynamic Weighting**: Uses a 40% Peak / 60% Mean composite risk formula to reward detours.

### 🛡️ Women Safety Mode
- Emergency Live-Location sharing.
- SOS button for immediate contact notification.
- High-risk zone entry alerts.

---

# 🤖 Machine Learning Component

- **DBSCAN Clustering**: Identifies dense crime regions from historical data.
- **Time-Aware Scoring**: Automatically scales risk by $0.7\times$ during the day and $1.6\times$ at night.
- **Gaussian Risk Decay**: Uses smooth probability distributions ($\sigma = 0.75 \times radius$) to assess risk near hotspot boundaries.

---

# 🎯 Project Goal

To build an intelligent public safety system that:
- Reduces exposure to crime-prone areas.
- Provides safer, human-centric navigation.
- Enhances women’s safety using smart detection.
- Provides real-world impact through data-driven risk assessment.
