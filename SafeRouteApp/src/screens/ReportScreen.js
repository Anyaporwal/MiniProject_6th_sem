import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Modal, FlatList, Image } from 'react-native';
import { Shield, ChevronDown, MapPin, Calendar, Clock, Camera, Check, AlertTriangle, ChevronLeft, Image as ImageIcon, X } from 'lucide-react-native';
import { colors } from '../theme';
import { submitReport, fetchMyIncidents, uploadIncidentPhotos } from '../services/api';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
const CRIME_TYPES = [
  { value: 'theft', label: 'Theft', icon: '💰' },
  { value: 'assault', label: 'Assault', icon: '👊' },
  { value: 'harassment', label: 'Harassment', icon: '⚠️' },
  { value: 'vandalism', label: 'Vandalism', icon: '🔨' },
  { value: 'suspicious', label: 'Suspicious Activity', icon: '👁️' },
  { value: 'other', label: 'Other', icon: '📋' },
];

const SEVERITIES = [
  { value: 'minor', label: 'Minor', color: colors.secondary },
  { value: 'moderate', label: 'Moderate', color: '#f59e0b' },
  { value: 'serious', label: 'Serious', color: colors.danger },
];

export default function ReportScreen() {
  const [crimeType, setCrimeType] = useState('theft');
  const [severity, setSeverity] = useState('moderate');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSeverityPicker, setShowSeverityPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Default to Nagpur center but allow updates via expo-location
  const [coords, setCoords] = useState({ latitude: 21.1458, longitude: 79.0882 });
  const [photos, setPhotos] = useState([]);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  const MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY;

  const reverseGeocode = async (latitude, longitude) => {
    try {
        const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${MAPS_API_KEY}`);
        const data = await resp.json();
        if (data.status === 'OK' && data.results.length > 0) {
            return data.results[0].formatted_address;
        }
    } catch (e) {
        console.warn('Google Reverse Geocoding error', e);
    }
    return null;
  };

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

  const fetchPlaces = async (text) => {
      if (text.length < 3) {
          setLocationSuggestions([]);
          return;
      }
      try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_API_KEY}`);
          const data = await response.json();
          if (data.status === 'OK') {
              setLocationSuggestions(data.predictions);
          } else {
              setLocationSuggestions([]);
          }
      } catch (e) {
          console.warn('Autocomplete fetch error:', e);
      }
  };

  const handleLocationChange = (text) => {
      setLocationName(text);
      fetchPlaces(text);
  };

  const selectLocation = async (item) => {
      setLocationName(item.description);
      setLocationSuggestions([]);
      const newCoords = await geocodeAddress(item.description);
      if (newCoords) {
          setCoords(newCoords);
      }
  };

  const fetchCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      
      const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      if (address) {
          setLocationName(address);
      } else {
          setLocationName(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
      }
    } catch (error) {
      alert('Error fetching location: ' + error.message);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotos([...photos, result.assets[0]]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotos([...photos, result.assets[0]]);
    }
  };

  const selectedType = CRIME_TYPES.find(t => t.value === crimeType);
  const selectedSeverity = SEVERITIES.find(s => s.value === severity);

  const handleSubmit = async () => {
    if (!crimeType || !severity || !locationName || !description || !occurredAt) {
      alert("Please fill in all mandatory fields: Incident Type, Severity, Location, Date/Time, and Description.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        crime_type: crimeType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        description,
        severity,
        is_anonymous: isAnonymous,
        location_name: locationName,
        occurred_at: occurredAt.toISOString(),
      };
      const result = await submitReport(payload);
      
      if (photos.length > 0 && result.id) {
        await uploadIncidentPhotos(result.id, photos.map(p => ({
          uri: p.uri,
          name: p.fileName || `photo_${Date.now()}.jpg`,
          type: p.mimeType || 'image/jpeg',
        })));
      }

      setReferenceNumber(result.reference_number);
      setSubmitted(true);
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      alert("Failed to submit report: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCrimeType('theft');
    setSeverity('moderate');
    setLocationName('');
    setDescription('');
    setPhotos([]);
    setOccurredAt(new Date());
    setIsAnonymous(false);
    setSubmitted(false);
    setReferenceNumber('');
  };

  const loadMyReports = async () => {
    setShowHistory(true);
    setLoadingReports(true);
    try {
      const reports = await fetchMyIncidents();
      setMyReports(reports);
    } catch (err) {
      console.warn('Failed to load reports:', err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  if (showHistory) {
    return (
      <View style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowHistory(false)}>
            <ChevronLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>My Reports</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loadingReports ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : myReports.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertTriangle size={48} color={colors.outlineVariant} />
              <Text style={styles.emptyText}>No reports submitted yet</Text>
            </View>
          ) : (
            myReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportRef}>{report.reference_number}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: report.status === 'submitted' ? 'rgba(153,203,255,0.15)' :
                      report.status === 'verified' ? 'rgba(107,220,150,0.15)' : 'rgba(245,158,11,0.15)'
                  }]}>
                    <Text style={[styles.statusText, {
                      color: report.status === 'submitted' ? colors.primary :
                        report.status === 'verified' ? colors.secondary : '#f59e0b'
                    }]}>{report.status?.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.reportType}>{report.crime_type} — {report.severity}</Text>
                {report.description ? (
                  <Text style={styles.reportDesc} numberOfLines={2}>{report.description}</Text>
                ) : null}
                {report.location_name ? (
                  <View style={styles.reportLocationRow}>
                    <MapPin size={12} color={colors.onSurfaceVariant} />
                    <Text style={styles.reportLocation}>{report.location_name}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Shield color={colors.primary} size={24} />
          <Text style={styles.appBarTitleMain}>SafeRoute</Text>
        </View>
        <TouchableOpacity onPress={loadMyReports} style={styles.historyBtn}>
          <Text style={styles.historyBtnText}>MY REPORTS</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Report an Incident</Text>
            <Text style={styles.subtitle}>
              Your report helps keep Nagpur safe. Information is shared anonymously with local authorities.
            </Text>
          </View>

          <View style={styles.formSection}>
            {/* Incident Type Picker */}
            <View style={styles.card}>
              <Text style={styles.label}>INCIDENT TYPE</Text>
              <TouchableOpacity style={styles.inputContainerActive} onPress={() => setShowTypePicker(true)}>
                <Text style={styles.inputText}>{selectedType?.icon} {selectedType?.label}</Text>
                <ChevronDown size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Severity Picker */}
            <View style={styles.card}>
              <Text style={styles.label}>SEVERITY</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.severityBtn, severity === s.value && { borderColor: s.color, backgroundColor: `${s.color}20` }]}
                    onPress={() => setSeverity(s.value)}
                  >
                    <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.severityText, severity === s.value && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location */}
            <View style={styles.card}>
              <View style={styles.descHeader}>
                <Text style={styles.label}>LOCATION</Text>
                <TouchableOpacity onPress={fetchCurrentLocation}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>USE LIVE LOCATION</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, { zIndex: 20 }]}>
                <MapPin size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter street or landmark"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={locationName}
                  onChangeText={handleLocationChange}
                />
                {locationSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        {locationSuggestions.map(item => (
                            <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => selectLocation(item)}>
                                <Text style={styles.suggestionText}>{item.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
              </View>
              <View style={styles.coordsRow}>
                <Text style={styles.coordsText}>
                  GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </Text>
              </View>
            </View>

            {/* DateTime Bento */}
            <View style={styles.bentoGrid}>
              <TouchableOpacity style={[styles.card, styles.bentoItem]} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.label}>DATE</Text>
                <View style={styles.inputContainerActive}>
                  <Calendar size={20} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
                  <Text style={styles.inputText}>{occurredAt.toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.bentoItem]} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.label}>TIME</Text>
                <View style={styles.inputContainerActive}>
                  <Clock size={20} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
                  <Text style={styles.inputText}>{occurredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={occurredAt}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selectedDate) setOccurredAt(selectedDate);
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={occurredAt}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (event.type === 'set' && selectedDate) setOccurredAt(selectedDate);
                }}
              />
            )}

            {/* Photos */}
            <View style={styles.card}>
              <View style={styles.descHeader}>
                <Text style={styles.label}>PHOTOS (OPTIONAL)</Text>
                <Text style={styles.charCount}>{photos.length}/3</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                {photos.length < 3 && (
                  <>
                    <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                      <Camera size={24} color={colors.primary} />
                      <Text style={styles.photoBtnText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                      <ImageIcon size={24} color={colors.primary} />
                      <Text style={styles.photoBtnText}>Gallery</Text>
                    </TouchableOpacity>
                  </>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {photos.map((photo, index) => (
                    <View key={index} style={{ position: 'relative', marginRight: 8 }}>
                      <Image source={{ uri: photo.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                      <TouchableOpacity 
                        style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 2 }}
                        onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                      >
                        <X size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Description */}
            <View style={styles.card}>
              <View style={styles.descHeader}>
                <Text style={styles.label}>DESCRIPTION</Text>
                <Text style={[styles.charCount, description.length > 450 && { color: colors.danger }]}>
                  {description.length}/500
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Provide details about the incident..."
                placeholderTextColor={colors.onSurfaceVariant}
                multiline
                numberOfLines={4}
                maxLength={500}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>

            {/* Anonymous Toggle */}
            <TouchableOpacity 
              style={[styles.anonToggle, isAnonymous && styles.anonToggleActive]} 
              onPress={() => setIsAnonymous(!isAnonymous)}
            >
              <View style={[styles.anonCheckbox, isAnonymous && styles.anonCheckboxChecked]}>
                {isAnonymous && <Check size={14} color={colors.onPrimary} />}
              </View>
              <View>
                <Text style={styles.anonTitle}>Submit Anonymously</Text>
                <Text style={styles.anonDesc}>Your identity won't be linked to this report</Text>
              </View>
            </TouchableOpacity>

            {/* Submit */}
            <View style={styles.submitSection}>
              <TouchableOpacity 
                style={[styles.submitBtn, (loading || submitted) && styles.submitBtnDisabled]} 
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={loading || submitted}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'SUBMITTING...' : submitted ? 'SUBMITTED' : 'SUBMIT REPORT'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Success Card */}
            {submitted && (
              <View style={styles.successCard}>
                <View style={styles.successIconBox}>
                  <Check size={20} color={colors.onSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Report Submitted Successfully</Text>
                  <Text style={styles.successSubtext}>Ref: {referenceNumber}</Text>
                </View>
                <TouchableOpacity onPress={resetForm} style={styles.newReportBtn}>
                  <Text style={styles.newReportText}>NEW</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Type Picker Modal */}
      <Modal visible={showTypePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Incident Type</Text>
            {CRIME_TYPES.map((type) => (
              <TouchableOpacity 
                key={type.value} 
                style={[styles.modalItem, crimeType === type.value && styles.modalItemActive]}
                onPress={() => { setCrimeType(type.value); setShowTypePicker(false); }}
              >
                <Text style={styles.modalItemText}>{type.icon} {type.label}</Text>
                {crimeType === type.value && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    paddingTop: 48, paddingHorizontal: 24, paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 50,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarTitleMain: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.primary, letterSpacing: -1 },
  appBarTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: colors.onSurface },
  backBtn: { padding: 8 },
  historyBtn: {
    paddingHorizontal: 12, paddingVertical: 6, 
    backgroundColor: 'rgba(153, 203, 255, 0.1)', borderRadius: 8,
  },
  historyBtnText: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.primary, letterSpacing: 1 },
  scrollContent: { padding: 24, paddingTop: 16, paddingBottom: 120 },
  header: { marginBottom: 32 },
  title: { fontFamily: 'Inter-Black', fontSize: 30, color: colors.onSurface, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20 },
  formSection: { gap: 16 },
  card: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12 },
  label: { fontFamily: 'Inter-Bold', fontSize: 12, color: colors.primaryFixedDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  inputContainerActive: {
    flexDirection: 'row', backgroundColor: colors.surfaceContainerLow, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'space-between',
  },
  inputContainer: {
    flexDirection: 'row', backgroundColor: colors.surfaceContainerLow, borderRadius: 8,
    paddingHorizontal: 16, alignItems: 'center',
  },
  inputIcon: { marginRight: 12 },
  inputText: { fontFamily: 'Inter-Regular', fontSize: 16, color: colors.onSurface, flex: 1 },
  textInput: { fontFamily: 'Inter-Regular', fontSize: 16, color: colors.onSurface, flex: 1, paddingVertical: 12 },
  textArea: {
    minHeight: 100, backgroundColor: colors.surfaceContainerLow, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  coordsRow: { marginTop: 8 },
  coordsText: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.outlineVariant },
  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontFamily: 'Inter-Bold', fontSize: 11, color: colors.outlineVariant },
  severityRow: { flexDirection: 'row', gap: 10 },
  severityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, borderWidth: 1.5,
    borderColor: colors.surfaceContainerHighest, backgroundColor: colors.surfaceContainerLow,
  },
  severityDot: { width: 10, height: 10, borderRadius: 5 },
  severityText: { fontFamily: 'Inter-Bold', fontSize: 12, color: colors.onSurfaceVariant },
  bentoGrid: { flexDirection: 'row', gap: 16 },
  bentoItem: { flex: 1 },
  // Anonymous toggle
  anonToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1e293b', padding: 16, borderRadius: 12,
  },
  anonToggleActive: { borderWidth: 1, borderColor: 'rgba(153,203,255,0.3)' },
  anonCheckbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center',
  },
  anonCheckboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  anonTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.onSurface },
  anonDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant },
  submitSection: { paddingTop: 16 },
  submitBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 12,
    paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryContainer, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 25, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: 'Inter-Black', fontSize: 14, color: colors.onPrimaryContainer, letterSpacing: 2, textTransform: 'uppercase' },
  successCard: {
    flexDirection: 'row', backgroundColor: 'rgba(107, 220, 150, 0.1)',
    borderWidth: 1, borderColor: 'rgba(107, 220, 150, 0.2)',
    padding: 16, borderRadius: 12, alignItems: 'center', gap: 16, marginTop: 32,
  },
  successIconBox: { backgroundColor: colors.secondary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.secondary, marginBottom: 4 },
  successSubtext: { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(107, 220, 150, 0.7)' },
  newReportBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(107,220,150,0.2)', borderRadius: 8 },
  newReportText: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.secondary, letterSpacing: 1 },
  // Report History
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 16, color: colors.onSurfaceVariant },
  photoBtn: {
    flex: 1, backgroundColor: colors.surfaceContainerHighest, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4
  },
  photoBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: colors.onSurfaceVariant },
  reportCard: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reportRef: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 0.5 },
  reportType: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: colors.onSurface, marginBottom: 4, textTransform: 'capitalize' },
  reportDesc: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 6 },
  reportLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reportLocation: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.onSurface, marginBottom: 20, letterSpacing: -0.5 },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4,
  },
  modalItemActive: { backgroundColor: 'rgba(153,203,255,0.1)' },
  modalItemText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: colors.onSurface },
  // Autocomplete
  suggestionsContainer: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: colors.surfaceContainer, borderRadius: 8, marginTop: 4,
    maxHeight: 150, borderWidth: 1, borderColor: colors.outlineVariant, zIndex: 100, elevation: 10,
  },
  suggestionItem: {
    paddingVertical: 12, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant,
  },
  suggestionText: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurface },
});
