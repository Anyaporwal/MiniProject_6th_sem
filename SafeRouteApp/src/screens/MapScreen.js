import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { Shield, Moon, Sun, Plus, Minus, Navigation, Info, Eye, AlertTriangle } from 'lucide-react-native';
import { colors, typography } from '../theme';
import { fetchHeatmap, checkRisk } from '../services/api';

const { width, height } = Dimensions.get('window');

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#060e20" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#131b2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a919c" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#dae2fd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#c0c7d2" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#171f33" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3449" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#404751" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#222a3d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#001d34" }] },
];

const RISK_COLORS = {
  high:     { fill: 'rgba(255, 180, 171, 0.15)', stroke: '#ffb4ab', dot: '#ffb4ab' },
  critical: { fill: 'rgba(255, 91, 86, 0.2)',    stroke: '#ff5b56', dot: '#ff5b56' },
  moderate: { fill: 'rgba(245, 158, 11, 0.15)',   stroke: '#f59e0b', dot: '#fcd34d' },
  low:      { fill: 'rgba(107, 220, 150, 0.15)',  stroke: '#6bdc96', dot: '#6bdc96' },
};

export default function MapScreen() {
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: 21.1458,
    longitude: 79.0882,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('auto');
  const [resolvedMode, setResolvedMode] = useState(new Date().getHours() >= 20 || new Date().getHours() <= 6 ? 'night' : 'day');
  const [isNight, setIsNight] = useState(new Date().getHours() >= 20 || new Date().getHours() <= 6);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [riskDetail, setRiskDetail] = useState(null);
  const [checkingRisk, setCheckingRisk] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');

  const goToCurrentLocation = async () => {
    setLocationStatus('loading');
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access location was denied');
      setLocationStatus('error');
      return;
    }
    try {
      let userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
      setRegion({
        ...region,
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude
      });
      setLocationStatus('idle');
    } catch (err) {
      alert("Could not fetch location. Ensure GPS is enabled.");
      setLocationStatus('error');
    }
  };

  useEffect(() => {
    loadHotspots();
  }, [mode]);

  const loadHotspots = async () => {
    setLoading(true);
    try {
      const data = await fetchHeatmap(mode);
      setHotspots(data.points || []);
      
      // Sync UI theme with backend resolution if in auto mode
      if (mode === 'auto' && data.mode) {
        setResolvedMode(data.mode);
        setIsNight(data.mode === 'night');
      } else {
        setResolvedMode(mode === 'auto' ? resolvedMode : mode);
      }
    } catch (err) {
      console.warn('Failed to load hotspots:', err.message);
      setHotspots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = async (hotspot) => {
    setSelectedHotspot(hotspot);
    setCheckingRisk(true);
    try {
      const dcti = await checkRisk(hotspot.latitude, hotspot.longitude);
      setRiskDetail(dcti);
    } catch (err) {
      console.warn('Risk check failed:', err.message);
    } finally {
      setCheckingRisk(false);
    }
  };

  const toggleMode = () => {
    const newNight = !isNight;
    setIsNight(newNight);
    setMode(newNight ? 'night' : 'day');
  };

  const totalCrimes = hotspots.reduce((acc, h) => acc + (h.count || 0), 0);
  const riskCounts = {
    critical: hotspots.filter(h => h.risk_level === 'critical').length,
    high: hotspots.filter(h => h.risk_level === 'high').length,
    moderate: hotspots.filter(h => h.risk_level === 'moderate').length,
    low: hotspots.filter(h => h.risk_level === 'low').length,
  };

  const zoomIn = () => {
    mapRef.current?.animateToRegion({
      ...region,
      latitudeDelta: region.latitudeDelta / 2,
      longitudeDelta: region.longitudeDelta / 2,
    }, 300);
  };

  const zoomOut = () => {
    mapRef.current?.animateToRegion({
      ...region,
      latitudeDelta: region.latitudeDelta * 2,
      longitudeDelta: region.longitudeDelta * 2,
    }, 300);
  };

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <View style={styles.headerLeft}>
          <Shield color={colors.primary} size={24} />
          <Text style={styles.headerTitle}>SafeRoute</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.themeToggle} onPress={toggleMode}>
            <View style={isNight ? styles.themeBtnInactive : styles.themeBtnActive}>
              <Sun size={14} color={isNight ? colors.onSurfaceVariant : colors.onPrimaryContainer} />
            </View>
            <View style={isNight ? styles.themeBtnActive : styles.themeBtnInactive}>
              <Moon size={14} color={isNight ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Main Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        customMapStyle={isNight ? darkMapStyle : []}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {hotspots.map((hotspot, index) => {
          const risk = hotspot.risk_level || 'moderate';
          const riskColor = RISK_COLORS[risk] || RISK_COLORS.moderate;
          const weight = hotspot.weight || 5;
          // Metrically-aware radius approximation: higher weights/counts look larger
          const radius = Math.max(150, Math.min(weight * 45, 700));

          return (
            <React.Fragment key={`hotspot-${index}`}>
              <Circle
                center={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
                radius={radius}
                fillColor={riskColor.fill}
                strokeColor={riskColor.stroke}
                strokeWidth={1}
              />
              <Marker
                coordinate={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
                onPress={() => handleMarkerPress(hotspot)}
                tracksViewChanges={false} // Optimization
              >
                <View style={styles.markerContainer}>
                  <View style={[styles.glowRing, { 
                    backgroundColor: riskColor.dot, 
                    opacity: 0.15, 
                    width: 30 + weight * 5, 
                    height: 30 + weight * 5 
                  }]} />
                  <View style={[styles.markerCore, { 
                    backgroundColor: `${riskColor.dot}44`, 
                    borderColor: riskColor.dot,
                    width: 24 + weight,
                    height: 24 + weight,
                    borderRadius: (24 + weight) / 2
                  }]}>
                    <View style={[styles.markerDot, { 
                      backgroundColor: riskColor.dot,
                      width: 6 + weight / 2,
                      height: 6 + weight / 2,
                      borderRadius: (6 + weight / 2) / 2
                    }]} />
                  </View>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Floating Map Controls */}
      <View style={styles.floatingControls}>
        <BlurView intensity={50} tint="dark" style={styles.zoomControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomIn}>
            <Plus size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity style={styles.controlBtn} onPress={zoomOut}>
            <Minus size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </BlurView>
        <TouchableOpacity style={styles.locationBtn} onPress={goToCurrentLocation}>
          {locationStatus === 'loading' ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Navigation size={20} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>

      {/* DCTI Risk Detail Panel */}
      {riskDetail && (
        <View style={styles.riskDetailWrapper}>
          <BlurView intensity={80} tint="dark" style={styles.riskDetailPanel}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setRiskDetail(null); setSelectedHotspot(null); }}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
            <View style={styles.riskScoreRow}>
              <View style={[styles.riskBadge, {
                backgroundColor: riskDetail.risk_level === 'critical' ? 'rgba(255,91,86,0.2)' :
                  riskDetail.risk_level === 'high' ? 'rgba(255,180,171,0.2)' :
                  riskDetail.risk_level === 'moderate' ? 'rgba(245,158,11,0.2)' : 'rgba(107,220,150,0.2)'
              }]}>
                <AlertTriangle 
                  size={16} 
                  color={riskDetail.risk_level === 'critical' ? '#ff5b56' :
                    riskDetail.risk_level === 'high' ? '#ffb4ab' :
                    riskDetail.risk_level === 'moderate' ? '#f59e0b' : '#6bdc96'} 
                />
                <Text style={[styles.riskBadgeText, {
                  color: riskDetail.risk_level === 'critical' ? '#ff5b56' :
                    riskDetail.risk_level === 'high' ? '#ffb4ab' :
                    riskDetail.risk_level === 'moderate' ? '#f59e0b' : '#6bdc96'
                }]}>{riskDetail.risk_level.toUpperCase()}</Text>
              </View>
              <Text style={styles.riskScoreValue}>{riskDetail.dcti_score}</Text>
              <Text style={styles.riskScoreLabel}>/100</Text>
              
              {riskDetail.weather_factored && (
                <View style={styles.weatherBadge}>
                  <Sun size={12} color={colors.secondary} />
                  <Text style={styles.weatherBadgeText}>WEATHER SYNC</Text>
                </View>
              )}
            </View>

            {/* Primary Threats Tags */}
            <View style={styles.threatsRow}>
              {riskDetail.primary_threats.map((threat, idx) => (
                <View key={idx} style={styles.threatTag}>
                  <Text style={styles.threatTagText}>{threat.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Factor Breakdown */}
            <View style={styles.factorGrid}>
              {Object.entries(riskDetail.risk_factors).map(([key, factor]) => (
                <View key={key} style={styles.factorItem}>
                  <View style={styles.factorLabelRow}>
                    <Text style={styles.factorName}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.factorScore}>{Math.round(factor.contribution)}</Text>
                  </View>
                  <View style={styles.factorBarBg}>
                    <View style={[styles.factorBarFill, { 
                      width: `${Math.min(factor.score, 100)}%`,
                      backgroundColor: factor.score > 70 ? colors.danger : 
                                      factor.score > 40 ? '#f59e0b' : colors.primary
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Recommendations */}
            {riskDetail.recommendations?.length > 0 && (
              <View style={styles.recsSection}>
                <Text style={styles.recsTitle}>SAFETY GUIDANCE</Text>
                {riskDetail.recommendations.slice(0, 3).map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <Shield size={10} color={colors.primary} />
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </BlurView>
        </View>
      )}

      {/* Bottom Sheet */}
      <View style={styles.sheetWrapper}>
        <BlurView intensity={70} tint="dark" style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Crime Hotspots – Nagpur</Text>
              <View style={styles.hotspotsLoadedRow}>
                <View style={styles.pulsingDot} />
                <Text style={styles.hotspotsSubtitle}>
                  {loading ? 'Analyzing clusters...' : `${hotspots.length} clusters · ${totalCrimes.toLocaleString()} events`}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.infoBtn} onPress={loadHotspots}>
              {loading ? (
                <ActivityIndicator size={16} color={colors.primary} />
              ) : (
                <Info size={20} color={colors.onSurfaceVariant} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bentoGrid}>
            <View style={[styles.bentoItem, { backgroundColor: 'rgba(255, 91, 86, 0.15)' }]}>
              <View style={[styles.bentoDot, { backgroundColor: '#ff5b56', shadowColor: '#ff5b56' }]} />
              <Text style={styles.bentoLabel}>CRITICAL</Text>
              <Text style={styles.bentoValue}>{riskCounts.critical}</Text>
            </View>
            <View style={styles.bentoItem}>
              <View style={[styles.bentoDot, { backgroundColor: colors.danger, shadowColor: colors.danger }]} />
              <Text style={styles.bentoLabel}>HIGH RISK</Text>
              <Text style={styles.bentoValue}>{riskCounts.high}</Text>
            </View>
            <View style={styles.bentoItem}>
              <View style={[styles.bentoDot, { backgroundColor: '#f59e0b', shadowColor: '#f59e0b' }]} />
              <Text style={styles.bentoLabel}>MEDIUM</Text>
              <Text style={styles.bentoValue}>{riskCounts.moderate}</Text>
            </View>
            <View style={styles.bentoItem}>
              <View style={[styles.bentoDot, { backgroundColor: colors.secondary, shadowColor: colors.secondary }]} />
              <Text style={styles.bentoLabel}>LOW RISK</Text>
              <Text style={styles.bentoValue}>{riskCounts.low}</Text>
            </View>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <Eye size={18} color={colors.primary} />
              <Text style={styles.legendText}>{isNight ? 'Night Mode' : 'Day Mode'}</Text>
            </View>
            <TouchableOpacity style={styles.detailsBtn} onPress={toggleMode}>
              <Text style={styles.detailsBtnText}>Switch to {isNight ? 'Day' : 'Night'}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    position: 'absolute', top: 0, width: '100%',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 50,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.primary, letterSpacing: -1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  themeToggle: {
    flexDirection: 'row', backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 999, padding: 4, alignItems: 'center',
  },
  themeBtnInactive: { padding: 6, borderRadius: 999, backgroundColor: 'rgba(30, 41, 59, 0.5)' },
  themeBtnActive: {
    padding: 6, borderRadius: 999, backgroundColor: colors.primaryContainer,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  map: { ...StyleSheet.absoluteFillObject },
  markerContainer: { justifyContent: 'center', alignItems: 'center' },
  glowRing: { position: 'absolute', borderRadius: 999 },
  markerCore: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  markerDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10,
  },
  floatingControls: { position: 'absolute', top: 100, left: 24, zIndex: 10, gap: 16 },
  zoomControls: {
    borderRadius: 12, padding: 12, gap: 12,
    borderWidth: 1, borderColor: 'rgba(64, 71, 81, 0.1)', overflow: 'hidden',
  },
  controlBtn: { padding: 8, borderRadius: 8 },
  controlDivider: { height: 1, backgroundColor: 'rgba(64, 71, 81, 0.2)', marginHorizontal: 4 },
  locationBtn: {
    backgroundColor: colors.primary, padding: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  // Risk Detail Panel
  riskDetailWrapper: {
    position: 'absolute', top: 100, right: 16, left: 80, zIndex: 40,
  },
  riskDetailPanel: {
    borderRadius: 16, padding: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(64, 71, 81, 0.2)',
  },
  closeBtn: { position: 'absolute', top: 8, right: 12, zIndex: 10 },
  closeBtnText: { fontSize: 24, color: colors.onSurfaceVariant, fontFamily: 'Inter-Bold' },
  riskScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  riskBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  riskBadgeText: { fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 1 },
  riskScoreValue: { fontFamily: 'Inter-Black', fontSize: 28, color: colors.onSurface },
  riskScoreLabel: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant },
  factorGrid: { gap: 8, marginBottom: 12 },
  factorItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factorName: { fontFamily: 'Inter-Bold', fontSize: 8, color: colors.onSurfaceVariant, flex: 1, letterSpacing: 0.5 },
  factorBarBg: { height: 4, backgroundColor: colors.surfaceContainerHighest, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  factorBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  factorScore: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.onSurfaceVariant, textAlign: 'right' },
  factorLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  weatherBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(153, 203, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(153, 203, 255, 0.2)',
  },
  weatherBadgeText: { fontFamily: 'Inter-Bold', fontSize: 8, color: colors.secondary },
  threatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  threatTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  threatTagText: { fontFamily: 'Inter-Bold', fontSize: 8, color: colors.onSurfaceVariant },
  recsTitle: { fontFamily: 'Inter-Bold', fontSize: 9, color: colors.primary, marginBottom: 8, letterSpacing: 1 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  recText: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.onSurfaceVariant, flex: 1, lineHeight: 14 },
  // Bottom Sheet
  sheetWrapper: { position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 20 },
  bottomSheet: {
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(64, 71, 81, 0.15)',
    padding: 24, overflow: 'hidden',
  },
  sheetHandle: { width: 48, height: 6, backgroundColor: colors.surfaceContainerHighest, borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  sheetTitle: { fontFamily: 'Inter-Bold', fontSize: 24, color: colors.onSurface, letterSpacing: -0.5 },
  hotspotsLoadedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pulsingDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: colors.secondary },
  hotspotsSubtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant },
  infoBtn: { padding: 8, backgroundColor: 'rgba(45, 52, 73, 0.5)', borderRadius: 999 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  bentoItem: {
    width: '48%', backgroundColor: 'rgba(19, 27, 46, 0.4)', borderRadius: 16,
    padding: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8
  },
  bentoDot: {
    width: 8, height: 8, borderRadius: 4, marginBottom: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 12,
  },
  bentoLabel: { fontFamily: 'Inter-Bold', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.onSurfaceVariant },
  bentoValue: { fontFamily: 'Inter-Black', fontSize: 16, color: colors.onSurface },
  legendRow: {
    marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(64, 71, 81, 0.1)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontFamily: 'Inter-Bold', fontSize: 12, color: colors.onSurfaceVariant },
  detailsBtn: { backgroundColor: 'rgba(153, 203, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  detailsBtnText: { fontFamily: 'Inter-Bold', fontSize: 12, color: colors.primary },
});
