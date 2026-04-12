import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch, Platform, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Target, Navigation2, Map as MapIcon, AlertTriangle, ChevronDown, Flag } from 'lucide-react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, typography } from '../theme';
import { calculateRoutes } from '../services/api';

const MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY;

const geocodeAddress = async (address) => {
    try {
        const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_API_KEY}`);
        const data = await resp.json();
        if (data.status === 'OK' && data.results.length > 0) {
            return {
                latitude: data.results[0].geometry.location.lat,
                longitude: data.results[0].geometry.location.lng
            };
        }
    } catch (e) {
        console.warn('Google Geocoding error', e);
    }
    return null;
};

export default function RoutePlannerScreen() {
    const [liveLocation, setLiveLocation] = useState(true);
    const [timeMode, setTimeMode] = useState('Auto (Recommended)');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [originSuggestions, setOriginSuggestions] = useState([]);
    const [destSuggestions, setDestSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [routesVisible, setRoutesVisible] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    
    const [routeOptions, setRouteOptions] = useState([]);
    const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
    const [region, setRegion] = useState({ latitude: 21.1458, longitude: 79.0882, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    const mapRef = useRef(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setRegion({ ...region, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
        })();
    }, []);

    const useCurrentLocationAsOrigin = async () => {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setOrigin(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    };

    const fetchPlaces = async (text, setSuggestions) => {
        if (text.length < 3) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_API_KEY}`);
            const data = await response.json();
            if (data.status === 'OK') {
                setSuggestions(data.predictions);
            } else {
                setSuggestions([]);
            }
        } catch (e) {
            console.warn('Autocomplete fetch error:', e);
        }
    };

    const handleOriginChange = (text) => {
        setOrigin(text);
        fetchPlaces(text, setOriginSuggestions);
    };

    const handleDestinationChange = (text) => {
        setDestination(text);
        fetchPlaces(text, setDestSuggestions);
    };

    const selectOrigin = (item) => {
        setOrigin(item.description);
        setOriginSuggestions([]);
    };

    const selectDestination = (item) => {
        setDestination(item.description);
        setDestSuggestions([]);
    };

    const handleGetRoutes = async () => {
        if (!origin || !destination) {
            alert("Please provide both origin and destination.");
            return;
        }
        setLoading(true);
        try {
            let originCoords;
            if (origin.match(/^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/)) {
                const parts = origin.split(/[,\s]+/);
                originCoords = { latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) };
            } else {
                originCoords = await geocodeAddress(origin);
            }
            
            let destCoords;
            if (destination.match(/^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/)) {
                const parts = destination.split(/[,\s]+/);
                destCoords = { latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) };
            } else {
                destCoords = await geocodeAddress(destination);
            }

            if (!originCoords || !destCoords) {
                alert("Could not find coordinates for provided addresses.");
                setLoading(false);
                return;
            }

            const response = await calculateRoutes(originCoords, destCoords, timeMode);
            
            if (response.routes && response.routes.length > 0) {
                setRouteOptions(response.routes);
                setSelectedRouteIdx(0);
                setRoutesVisible(true);
                
                const allCoords = response.routes.flatMap(r => 
                    r.geometry?.coordinates ? r.geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })) : []
                );
                
                if (allCoords.length > 0 && mapRef.current) {
                    mapRef.current.fitToCoordinates(allCoords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
                }
            } else {
                alert("No routes found.");
            }
        } catch (error) {
            console.warn(error);
            alert("Route calculation failed: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* TopAppBar Fake since it's matched in App.js normally, but Planner.html has it fixed */}
            <View style={styles.appBar}>
                <View style={styles.appBarLeft}>
                    <Shield color={colors.primary} size={24} />
                    <Text style={styles.appBarTitle}>SafeRoute</Text>
                </View>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarPlaceholder} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Live Location Header */}
                <View style={styles.liveLocationCard}>
                    <View style={styles.liveLocationDecoration} />
                    <View style={styles.liveLocationTextContainer}>
                        <Text style={styles.liveLocationTitle}>Live Location</Text>
                        <View style={styles.coordinateBadge}>
                            <Target size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.coordinateText}>21.1458° N, 79.0882° E</Text>
                        </View>
                    </View>
                    <Switch
                        value={liveLocation}
                        onValueChange={setLiveLocation}
                        trackColor={{ false: colors.surfaceContainerHighest, true: colors.secondary }}
                        thumbColor="#ffffff"
                    />
                </View>

                {/* Mini Map */}
                <View style={styles.miniMapContainer}>
                    <MapView
                        ref={mapRef}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        style={styles.miniMap}
                        initialRegion={region}
                    >
                        {routesVisible && routeOptions.map((route, idx) => {
                            if (!route.geometry || !route.geometry.coordinates) return null;
                            const path = route.geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                            const isSelected = idx === selectedRouteIdx;
                            const rType = route.type?.toLowerCase();
                            
                            let strokeColor = colors.secondary; 
                            if (rType === 'fastest') strokeColor = colors.primary; 
                            if (rType === 'balanced') strokeColor = colors.tertiaryContainer; 
                            if (rType === 'safest') strokeColor = colors.secondary;

                            
                            return (
                                <Polyline 
                                    key={idx}
                                    coordinates={path}
                                    strokeColor={isSelected ? strokeColor : 'rgba(138, 145, 156, 0.4)'}
                                    strokeWidth={isSelected ? 5 : 3}
                                    zIndex={isSelected ? 10 : 1}
                                />
                            );
                        })}
                        {routesVisible && routeOptions[0]?.geometry?.coordinates && (
                            <>
                                <Marker coordinate={{ latitude: routeOptions[0].geometry.coordinates[0][1], longitude: routeOptions[0].geometry.coordinates[0][0] }} pinColor="green" />
                                <Marker coordinate={{ latitude: routeOptions[0].geometry.coordinates[routeOptions[0].geometry.coordinates.length - 1][1], longitude: routeOptions[0].geometry.coordinates[routeOptions[0].geometry.coordinates.length - 1][0] }} pinColor="red" />
                            </>
                        )}
                    </MapView>
                </View>

                {/* Plan Route Module */}
                <View style={styles.planModule}>
                    <View style={styles.inputStack}>
                         {/* Connection Line */}
                        <View style={styles.iconColumn}>
                            <Target size={20} color={colors.primary} />
                            <View style={styles.connectingLine} />
                            <Navigation2 size={20} color={colors.tertiaryContainer} style={{ transform: [{ rotate: '180deg' }] }} />
                        </View>
                        
                        <View style={[styles.fieldsColumn, { zIndex: 10 }]}>
                            <View style={[styles.inputContainer, { zIndex: 20 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Origin"
                                    placeholderTextColor="rgba(138, 145, 156, 0.5)"
                                    value={origin}
                                    onChangeText={handleOriginChange}
                                />
                                {originSuggestions.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        {originSuggestions.map(item => (
                                            <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => selectOrigin(item)}>
                                                <Text style={styles.suggestionText}>{item.description}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            <View style={[styles.inputContainer, { zIndex: 10 }]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Destination"
                                    placeholderTextColor="rgba(138, 145, 156, 0.5)"
                                    value={destination}
                                    onChangeText={handleDestinationChange}
                                />
                                {destSuggestions.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        {destSuggestions.map(item => (
                                            <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => selectDestination(item)}>
                                                <Text style={styles.suggestionText}>{item.description}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.useLocationBtn} onPress={useCurrentLocationAsOrigin}>
                        <Target size={16} color={colors.primaryFixedDim} />
                        <Text style={styles.useLocationText}>Use My Location as Origin</Text>
                    </TouchableOpacity>

                    <View style={styles.timeModeContainer}>
                        <Text style={styles.label}>TIME MODE</Text>
                        <TouchableOpacity 
                            style={styles.selectWrapper}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Text style={styles.selectText}>{timeMode}</Text>
                            <ChevronDown size={20} color={colors.onSurfaceVariant} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity activeOpacity={0.8} style={{ marginTop: 8 }} onPress={handleGetRoutes} disabled={loading}>
                        <LinearGradient
                            colors={[colors.primary, colors.primaryContainer]}
                            style={styles.getRoutesBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <MapIcon color={colors.onPrimary} size={20} />
                            <Text style={styles.getRoutesText}>{loading ? 'Calculating...' : 'Get Safe Routes'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Route Options List */}
                {routesVisible && (
                  <View style={styles.optionsSection}>
                      <Text style={styles.sectionLabel}>ROUTE OPTIONS</Text>

                      {routeOptions.map((route, idx) => {
                          const isSelected = selectedRouteIdx === idx;
                          const routeType = route.type?.toLowerCase();
                          const isSafest = routeType === 'safest';
                          const isBalanced = routeType === 'balanced';
                          const isFastest = routeType === 'fastest';
                          const safetyScore = 100 - (route.risk_score || 0);
                          const isRisky = route.risk_score > 60;

                          let cardStyle = styles.alternateCard;
                          let deco = null;
                          let badgeStyle = styles.alternateBadge;
                          let TitleIcon = Shield;
                          let iconColor = colors.primaryContainer;
                          let titleLabel = route.label?.toUpperCase() || `ROUTE ${idx + 1}`;

                          if (isSafest) {
                              cardStyle = styles.safestCard;
                              badgeStyle = styles.safestBadge;
                              TitleIcon = Shield;
                              iconColor = colors.secondary;
                              deco = <View style={styles.safestDecoration} />;
                          } else if (isRisky) {
                              cardStyle = styles.riskyCard;
                              badgeStyle = styles.riskyBadge;
                              TitleIcon = AlertTriangle;
                              iconColor = colors.tertiaryContainer;
                          } else if (isBalanced) {
                              TitleIcon = Target;
                              iconColor = colors.tertiaryFixedDim || colors.tertiaryContainer;
                          } else if (isFastest) {
                              TitleIcon = Navigation2;
                              iconColor = colors.primary;
                          }

                          return (
                              <TouchableOpacity 
                                  key={idx} 
                                  style={[styles.routeCard, cardStyle, isSelected ? { borderColor: iconColor, borderWidth: 2 } : {}]} 
                                  activeOpacity={0.7}
                                  onPress={() => setSelectedRouteIdx(idx)}
                              >
                                  {deco}
                                  <View style={styles.cardHeader}>
                                      <View style={styles.cardInfoLeft}>
                                          <Text style={badgeStyle}>{titleLabel}</Text>
                                          <View style={styles.scoreRow}>
                                              <TitleIcon color={iconColor} size={24} />
                                              <Text style={styles.scoreText}>
                                                  {safetyScore.toFixed(0)} 
                                                  <Text style={styles.scoreSubtext}> Safety Score</Text>
                                              </Text>
                                          </View>
                                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 }}>
                                              {route.safety_label} {route.summary ? `• ${route.summary}` : ''}
                                              {route.high_risk_zones > 0 ? ` • ${route.high_risk_zones} Risk Zone${route.high_risk_zones > 1 ? 's' : ''}` : ''}
                                          </Text>

                                      </View>
                                      <View style={styles.cardInfoRight}>
                                          <Text style={styles.timeText}>{Math.round(route.duration_min)} min</Text>
                                          <Text style={styles.distanceText}>{route.distance_km.toFixed(1)} km</Text>
                                      </View>
                                  </View>
                              </TouchableOpacity>
                          );
                      })}
                  </View>
                )}
            </ScrollView>

            <Modal
                visible={showTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Time Mode</Text>
                        {['Auto (Recommended)', 'Day Mode', 'Night Mode'].map(mode => (
                            <TouchableOpacity
                                key={mode}
                                style={styles.modalOption}
                                onPress={() => {
                                    setTimeMode(mode);
                                    setShowTimePicker(false);
                                }}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    timeMode === mode && { color: colors.primary, fontFamily: 'Inter-Bold' }
                                ]}>
                                    {mode}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    miniMapContainer: {
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    miniMap: {
        flex: 1,
        width: '100%',
    },
    appBar: {
        paddingTop: 48,
        paddingHorizontal: 24,
        paddingBottom: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.8)', // slate-900/80
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
    },
    appBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    appBarTitle: {
        fontFamily: 'Inter-Black',
        fontSize: 20,
        color: colors.primary,
        letterSpacing: -1,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(64, 71, 81, 0.3)',
        overflow: 'hidden',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.surfaceContainerHighest,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 120, // To account for the floating bottom bar
        gap: 24,
    },
    liveLocationCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surfaceContainer,
        borderRadius: 12,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 5,
        position: 'relative',
        overflow: 'hidden',
    },
    liveLocationDecoration: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 4,
        backgroundColor: colors.secondary,
    },
    liveLocationTextContainer: {
        gap: 4,
    },
    liveLocationTitle: {
        fontFamily: 'Inter-Bold',
        fontSize: 18,
        color: colors.onSurface,
        letterSpacing: -0.5,
    },
    coordinateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surfaceContainerLow,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    coordinateText: {
        fontFamily: 'Inter-Regular', 
        // We'd ideally use a monospaced font, but Inter works
        fontSize: 14,
        color: colors.onSurfaceVariant,
    },
    planModule: {
        backgroundColor: colors.surfaceContainerHigh,
        padding: 24,
        borderRadius: 12,
        gap: 16,
        zIndex: 10,
    },
    inputStack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        zIndex: 10,
    },
    iconColumn: {
        alignItems: 'center',
        gap: 4,
    },
    connectingLine: {
        width: 2,
        height: 32,
        backgroundColor: 'rgba(64, 71, 81, 0.3)',
    },
    fieldsColumn: {
        flex: 1,
        gap: 12,
        zIndex: 10,
    },
    inputContainer: {
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: 8,
        height: 48,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    input: {
        fontFamily: 'Inter-Regular',
        fontSize: 16,
        color: colors.onSurface,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.surfaceContainer,
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 150,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        zIndex: 100,
        elevation: 10,
    },
    suggestionItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.outlineVariant,
    },
    suggestionText: {
        fontFamily: 'Inter-Regular',
        fontSize: 14,
        color: colors.onSurface,
    },
    useLocationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 4,
        zIndex: -1,
    },
    useLocationText: {
        fontFamily: 'Inter-Bold',
        fontSize: 14,
        color: colors.primaryFixedDim,
    },
    timeModeContainer: {
        gap: 8,
    },
    label: {
        fontFamily: 'Inter-Bold',
        fontSize: 12,
        color: colors.onSurfaceVariant,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    selectWrapper: {
        backgroundColor: colors.surfaceContainerHighest,
        borderRadius: 8,
        height: 48,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectText: {
        fontFamily: 'Inter-Regular',
        fontSize: 16,
        color: colors.onSurface,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.surfaceContainer,
        borderRadius: 12,
        padding: 24,
        width: '80%',
        maxWidth: 320,
    },
    modalTitle: {
        fontFamily: 'Inter-Bold',
        fontSize: 18,
        color: colors.onSurface,
        marginBottom: 16,
    },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.outlineVariant,
    },
    modalOptionText: {
        fontFamily: 'Inter-Regular',
        fontSize: 16,
        color: colors.onSurface,
    },
    getRoutesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 56,
        borderRadius: 12,
        shadowColor: colors.primaryContainer,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10,
    },
    getRoutesText: {
        fontFamily: 'Inter-Black',
        fontSize: 18,
        color: colors.onPrimary,
        letterSpacing: -0.5,
    },
    optionsSection: {
        gap: 16,
    },
    sectionLabel: {
        fontFamily: 'Inter-Black',
        fontSize: 12,
        color: colors.onSurfaceVariant,
        letterSpacing: 1,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
    },
    routeCard: {
        padding: 20,
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    safestCard: {
        backgroundColor: colors.surfaceContainerHigh,
        borderColor: colors.secondary,
        borderWidth: 1,
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 5,
    },
    safestDecoration: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 4,
        backgroundColor: colors.secondary,
    },
    alternateCard: {
        backgroundColor: colors.surfaceContainer,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    riskyCard: {
        backgroundColor: colors.surfaceContainer,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardInfoLeft: {
        gap: 4,
    },
    safestBadge: {
        fontFamily: 'Inter-Black',
        fontSize: 10,
        color: colors.secondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    alternateBadge: {
        fontFamily: 'Inter-Black',
        fontSize: 10,
        color: colors.primaryContainer,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    riskyBadge: {
        fontFamily: 'Inter-Black',
        fontSize: 10,
        color: colors.onSurfaceVariant,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    scoreText: {
        fontFamily: 'Inter-Bold',
        fontSize: 24,
        color: colors.onSurface,
    },
    scoreSubtext: {
        fontFamily: 'Inter-Regular',
        fontSize: 12,
        color: colors.onSurfaceVariant,
    },
    riskyScoreText: {
        fontFamily: 'Inter-Bold',
        fontSize: 14,
        color: colors.tertiaryContainer,
    },
    cardInfoRight: {
        alignItems: 'flex-end',
    },
    timeText: {
        fontFamily: 'Inter-Bold',
        fontSize: 14,
        color: colors.onSurfaceVariant,
    },
    distanceText: {
        fontFamily: 'Inter-Regular',
        fontSize: 12,
        color: colors.onSurfaceVariant,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    tag: {
        backgroundColor: 'rgba(107, 220, 150, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    tagText: {
        fontFamily: 'Inter-Bold',
        fontSize: 10,
        color: colors.secondary,
        textTransform: 'uppercase',
    }
});
