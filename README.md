# 🚨 Crime Hotspot Prediction and Public Safety Alert System

An AI-powered Public Safety Web Application that predicts crime-prone areas using Machine Learning and provides safer routing, real-time alerts, and emergency safety features.

This project combines **React + Leaflet (Frontend)** with **FastAPI (Backend)** and **DBSCAN clustering** to detect, visualize, and respond to high-risk crime zones.

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
- React.js
- Leaflet.js (Interactive Maps)
- CSS (Professional UI)

### 🔹 Backend
- FastAPI
- Python
- DBSCAN (Scikit-learn)
- GeoJSON Processing

---

# 🌟 Core Features

---


### 🔐 Register / Login
- Secure user authentication
- Personalized safety preferences
- User-specific alert system

---

### 🗺️ View Risk Heatmap
- Interactive Leaflet map
- Crime hotspot visualization
- Red zones indicate high crime areas
- Day / Night risk mode
- Auto detection based on system time

---

### 🚗 Request Safe Route
- Enter origin & destination
- Fetches multiple routes using OSRM
- Calculates risk score using hotspot intersections
- Automatically selects safest route
- Displays:
  - Distance
  - Duration
  - Risk Score

---

### 🚨 Report Incident
- Users can report crime events
- Submit:
  - Title
  - Description
  - Location
  - Severity level
- Can be used to update backend hotspot data

---

### 📘 View Safety Tips
- Displays essential public safety guidelines
- Night travel awareness
- Emergency contact suggestions
- Public transport safety advice

---

### 🔔 Receive Safety Alerts for High Risk Zone Area
- Real-time alert when user enters high-risk zone
- Uses geolocation monitoring
- Push notifications / visual alerts
- Dynamic alert based on Day/Night risk model

---

### 🛡️ Enable Women Safety Mode

A dedicated smart safety system designed for enhanced personal protection.

Includes:

#### 📲 Emergency Contact Notification
- Sends immediate alert to trusted contacts
- Shares live location
- One-click emergency activation

#### 📍 Isolation Detection
- Detects when user is in:
  - Low crowd density area
  - High crime zone
  - Night hours
- Automatically triggers precaution alert

---

# 🤖 Machine Learning Component

- DBSCAN clustering identifies dense crime regions
- Generates GeoJSON hotspot polygons
- Separate Day and Night models
- Risk score calculated using Turf.js spatial intersection

---

# 🗺️ Routing Intelligence

- Uses OSRM public routing API
- Fetches alternative routes
- Computes:
  - Crime hotspot intersection count
  - Route risk score
- Selects safest route (not just shortest)

---

# 🔮 Future Enhancements

- Real-time crime data streaming
- Police station proximity indicator
- Crowd density integration
- SOS voice activation
- AI-based predictive alert system

---

# 📊 System Workflow

1. Crime dataset → DBSCAN clustering
2. GeoJSON hotspot generation
3. FastAPI serves hotspot data
4. React + Leaflet displays heatmap
5. Routing engine evaluates risk
6. Alert system monitors user location

---

# 🎯 Project Goal

To build an intelligent public safety system that:

- Reduces exposure to crime-prone areas
- Provides safer navigation
- Empowers users with real-time alerts
- Enhances women’s safety using smart detection

---

# 🏆 Outcome

A full-stack AI-driven safety platform combining:

✔ Machine Learning  
✔ Geospatial Analysis  
✔ Smart Routing  
✔ Real-time Alerts  
✔ Emergency Support  

Built with a focus on real-world public safety impact.
