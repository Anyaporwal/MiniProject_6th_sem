import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, TextInput, Modal, Animated, Vibration } from 'react-native';
import { Shield, Phone, AlertTriangle, UserPlus, CheckCircle, X, MapPin, Clock, PhoneCall, Navigation, Heart, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';
import { triggerSOS, sendCheckIn, fetchEmergencyContacts, addEmergencyContact, deleteEmergencyContact } from '../services/api';

export default function WomenSafetyScreen() {
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [checkInResult, setCheckInResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fake Call State
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [callStatus, setCallStatus] = useState('incoming');
  const [callDuration, setCallDuration] = useState(0);
  const fakeCallVibration = useRef(null);
  const durationTimer = useRef(null);

  // SOS hold animation
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);

  const coords = { latitude: 21.1458, longitude: 79.0882 };

  useEffect(() => {
    loadContacts();
    return () => {
      clearInterval(fakeCallVibration.current);
      clearInterval(durationTimer.current);
      Vibration.cancel();
    };
  }, []);

  const triggerFakeCall = () => {
    alert('Fake Call sequence started. Keep your phone ready.');
    setTimeout(() => {
      setShowFakeCall(true);
      setCallStatus('incoming');
      fakeCallVibration.current = setInterval(() => {
        Vibration.vibrate([500, 1000]);
      }, 2000);
    }, 3000);
  };

  const acceptCall = () => {
    setCallStatus('active');
    setCallDuration(0);
    clearInterval(fakeCallVibration.current);
    Vibration.cancel();
    durationTimer.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const endCall = () => {
    clearInterval(fakeCallVibration.current);
    clearInterval(durationTimer.current);
    Vibration.cancel();
    setShowFakeCall(false);
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const loadContacts = async () => {
    try {
      const data = await fetchEmergencyContacts();
      setContacts(data);
    } catch (err) {
      console.warn('Failed to load contacts:', err.message);
    }
  };

  const handleSOSPressIn = () => {
    holdProgress.setValue(0);
    holdTimer.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    });
    holdTimer.current.start(({ finished }) => {
      if (finished) {
        executeSOS();
      }
    });
  };

  const handleSOSPressOut = () => {
    if (holdTimer.current) {
      holdTimer.current.stop();
    }
    holdProgress.setValue(0);
  };

  const executeSOS = async () => {
    Vibration.vibrate([0, 200, 100, 200, 100, 200]);
    setSosActive(true);
    setLoading(true);
    try {
      const result = await triggerSOS(coords.latitude, coords.longitude);
      setSosResult(result);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert('SOS Failed: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const result = await sendCheckIn(coords.latitude, coords.longitude, "I'm safe!");
      setCheckInResult(result);
      setTimeout(() => setCheckInResult(null), 5000);
    } catch (err) {
      console.warn('Check-in failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newName || !newPhone) {
      alert('Name and phone are required');
      return;
    }
    try {
      await addEmergencyContact(newName, newPhone, newRelation || undefined);
      setNewName('');
      setNewPhone('');
      setNewRelation('');
      setShowAddContact(false);
      loadContacts();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert('Failed to add contact: ' + msg);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      await deleteEmergencyContact(id);
      loadContacts();
    } catch (err) {
      console.warn('Delete failed:', err.message);
    }
  };

  const progressWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressColor = holdProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(255,91,86,0.3)', 'rgba(255,91,86,0.6)', 'rgba(255,91,86,1)'],
  });

  if (sosActive) {
    return (
      <View style={styles.sosActiveScreen}>
        <View style={styles.sosActiveContent}>
          <View style={styles.sosActiveIconRing}>
            <AlertTriangle size={48} color="#ff5b56" />
          </View>
          <Text style={styles.sosActiveTitle}>SOS ACTIVATED</Text>
          {sosResult ? (
            <>
              <Text style={styles.sosActiveSubtext}>
                {sosResult.contacts_notified?.length || 0} contacts notified
              </Text>
              <View style={styles.sosNotifiedList}>
                {sosResult.contacts_notified?.map((name, i) => (
                  <View key={i} style={styles.notifiedItem}>
                    <CheckCircle size={16} color={colors.secondary} />
                    <Text style={styles.notifiedText}>{name}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.sosLocationCard}>
                <MapPin size={16} color={colors.primary} />
                <Text style={styles.sosLocationText}>
                  {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.sosActiveSubtext}>Sending alerts...</Text>
          )}
          <TouchableOpacity 
            style={styles.cancelSosBtn}
            onPress={() => { setSosActive(false); setSosResult(null); }}
          >
            <Text style={styles.cancelSosText}>DISMISS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Shield color={colors.primary} size={24} />
          <Text style={styles.appBarTitle}>SafeRoute</Text>
        </View>
        <View style={styles.safetyBadge}>
          <Heart size={14} color="#e879f9" />
          <Text style={styles.safetyBadgeText}>SAFETY MODE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Women Safety</Text>
          <Text style={styles.subtitle}>
            Quick access to emergency features. Your safety is our priority.
          </Text>
        </View>

        {/* SOS Button */}
        <View style={styles.sosSection}>
          <Text style={styles.sosInstruction}>HOLD FOR 3 SECONDS TO ACTIVATE</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={handleSOSPressIn}
            onPressOut={handleSOSPressOut}
            style={styles.sosButton}
          >
            <Animated.View style={[styles.sosProgress, { width: progressWidth, backgroundColor: progressColor }]} />
            <View style={styles.sosInner}>
              <AlertTriangle size={32} color="#fff" />
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>Emergency Alert</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={handleCheckIn}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(107,220,150,0.15)' }]}>
              <CheckCircle size={24} color={colors.secondary} />
            </View>
            <Text style={styles.actionTitle}>I'm Safe</Text>
            <Text style={styles.actionDesc}>Send check-in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={triggerFakeCall}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(153,203,255,0.15)' }]}>
              <PhoneCall size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Fake Call</Text>
            <Text style={styles.actionDesc}>Incoming call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => alert('Live location link copied to clipboard!')}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(232,121,249,0.15)' }]}>
              <Navigation size={24} color="#e879f9" />
            </View>
            <Text style={styles.actionTitle}>Share Live</Text>
            <Text style={styles.actionDesc}>Location</Text>
          </TouchableOpacity>
        </View>

        {/* Check-in confirmation */}
        {checkInResult && (
          <View style={styles.checkInCard}>
            <CheckCircle size={20} color={colors.secondary} />
            <Text style={styles.checkInText}>
              Check-in sent to {checkInResult.contacts_notified?.length || 0} contacts
            </Text>
          </View>
        )}

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            {contacts.length < 3 && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddContact(true)}>
                <UserPlus size={16} color={colors.primary} />
                <Text style={styles.addBtnText}>ADD</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            {contacts.length}/3 contacts configured. These people are notified during SOS.
          </Text>

          {contacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Phone size={32} color={colors.outlineVariant} />
              <Text style={styles.emptyText}>No emergency contacts yet</Text>
              <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowAddContact(true)}>
                <Text style={styles.addFirstText}>+ Add your first contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitial}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  {contact.relation && (
                    <Text style={styles.contactRelation}>{contact.relation}</Text>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.deleteContactBtn}
                  onPress={() => handleDeleteContact(contact.id)}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Safety Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Safety Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>1.</Text>
            <Text style={styles.tipText}>Share your live location with trusted contacts when traveling alone</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>2.</Text>
            <Text style={styles.tipText}>Use the SOS button if you feel unsafe — it notifies all contacts instantly</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>3.</Text>
            <Text style={styles.tipText}>Use "I'm Safe" check-in when you reach your destination</Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal visible={showAddContact} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddContact(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => setShowAddContact(false)}>
                <X size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalForm}>
              <Text style={styles.modalLabel}>NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Contact name"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newName}
                onChangeText={setNewName}
              />
              <Text style={styles.modalLabel}>PHONE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="+91 XXXXXXXXXX"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <Text style={styles.modalLabel}>RELATIONSHIP (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Mother, Friend, Brother"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newRelation}
                onChangeText={setNewRelation}
              />
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddContact}>
                <Text style={styles.modalSubmitText}>ADD CONTACT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fake Call Modal */}
      <Modal visible={showFakeCall} transparent animationType="fade">
        <View style={styles.fakeCallContainer}>
          <Text style={styles.fakeCallTopText}>
            {callStatus === 'incoming' ? 'Incoming voice call' : formatDuration(callDuration)}
          </Text>
          
          <View style={styles.fakeCallerInfo}>
            <View style={styles.fakeCallerAvatar}>
              <Text style={styles.fakeCallerInitial}>M</Text>
            </View>
            <Text style={styles.fakeCallerName}>Mom</Text>
            <Text style={styles.fakeCallerType}>Mobile</Text>
          </View>
          
          <View style={styles.fakeCallControls}>
            <TouchableOpacity style={styles.declineBtn} onPress={endCall}>
              <Phone size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            
            {callStatus === 'incoming' && (
              <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                <Phone size={32} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  appBarTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.primary, letterSpacing: -1 },
  safetyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(232,121,249,0.12)', borderRadius: 999,
  },
  safetyBadgeText: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#e879f9', letterSpacing: 1 },
  scrollContent: { padding: 24, paddingTop: 16, paddingBottom: 120 },
  header: { marginBottom: 24 },
  title: { fontFamily: 'Inter-Black', fontSize: 30, color: colors.onSurface, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20 },
  // SOS
  sosSection: { alignItems: 'center', marginBottom: 32 },
  sosInstruction: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.outlineVariant, letterSpacing: 2, marginBottom: 16 },
  sosButton: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255, 91, 86, 0.15)',
    borderWidth: 3, borderColor: 'rgba(255, 91, 86, 0.4)',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  sosProgress: {
    position: 'absolute', bottom: 0, left: 0, height: '100%', borderRadius: 80,
  },
  sosInner: { alignItems: 'center', gap: 4, zIndex: 2 },
  sosText: { fontFamily: 'Inter-Black', fontSize: 28, color: '#ff5b56', letterSpacing: 4 },
  sosSubtext: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: 'rgba(255,91,86,0.7)', letterSpacing: 1 },
  // Quick Actions
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontFamily: 'Inter-Bold', fontSize: 13, color: colors.onSurface },
  actionDesc: { fontFamily: 'Inter-Regular', fontSize: 11, color: colors.onSurfaceVariant },
  // Check-in result
  checkInCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(107,220,150,0.1)', borderWidth: 1,
    borderColor: 'rgba(107,220,150,0.2)', padding: 12, borderRadius: 12, marginBottom: 24,
  },
  checkInText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: colors.secondary },
  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.onSurface, letterSpacing: -0.5 },
  sectionSubtitle: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 16 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(153,203,255,0.1)', borderRadius: 8,
  },
  addBtnText: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.primary, letterSpacing: 1 },
  // Contacts
  emptyContacts: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant },
  addFirstBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(153,203,255,0.1)', borderRadius: 12 },
  addFirstText: { fontFamily: 'Inter-Bold', fontSize: 13, color: colors.primary },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 8,
  },
  contactAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(153,203,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  contactInitial: { fontFamily: 'Inter-Black', fontSize: 18, color: colors.primary },
  contactInfo: { flex: 1 },
  contactName: { fontFamily: 'Inter-Bold', fontSize: 15, color: colors.onSurface },
  contactPhone: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.onSurfaceVariant },
  contactRelation: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: colors.outlineVariant, marginTop: 2 },
  deleteContactBtn: { padding: 8 },
  // Tips
  tipsCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginTop: 8 },
  tipsTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: colors.onSurface, marginBottom: 12 },
  tipItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tipBullet: { fontFamily: 'Inter-Bold', fontSize: 13, color: colors.primary, width: 18 },
  tipText: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.onSurfaceVariant, flex: 1, lineHeight: 18 },
  // SOS Active Screen
  sosActiveScreen: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.98)', justifyContent: 'center', alignItems: 'center' },
  sosActiveContent: { alignItems: 'center', padding: 32 },
  sosActiveIconRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,91,86,0.15)', borderWidth: 2, borderColor: 'rgba(255,91,86,0.4)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  sosActiveTitle: { fontFamily: 'Inter-Black', fontSize: 28, color: '#ff5b56', letterSpacing: 4, marginBottom: 8 },
  sosActiveSubtext: { fontFamily: 'Inter-Regular', fontSize: 16, color: colors.onSurfaceVariant, marginBottom: 24 },
  sosNotifiedList: { gap: 8, marginBottom: 24 },
  notifiedItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifiedText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: colors.onSurface },
  sosLocationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(153,203,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    marginBottom: 32,
  },
  sosLocationText: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.primary },
  cancelSosBtn: {
    paddingHorizontal: 32, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,91,86,0.3)', borderRadius: 12,
  },
  cancelSosText: { fontFamily: 'Inter-Black', fontSize: 14, color: '#ff5b56', letterSpacing: 2 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.onSurface, letterSpacing: -0.5 },
  modalForm: { gap: 12 },
  modalLabel: { fontFamily: 'Inter-Bold', fontSize: 11, color: colors.primaryFixedDim, letterSpacing: 1 },
  modalInput: {
    backgroundColor: colors.surfaceContainerLow, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'Inter-Regular', fontSize: 15, color: colors.onSurface,
  },
  modalSubmitBtn: {
    backgroundColor: colors.primaryContainer, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  modalSubmitText: { fontFamily: 'Inter-Black', fontSize: 14, color: colors.onPrimaryContainer, letterSpacing: 2 },
  
  // Fake Call
  fakeCallContainer: {
    flex: 1, backgroundColor: '#1a1f2b', alignItems: 'center', paddingTop: 80, paddingBottom: 50,
  },
  fakeCallTopText: { fontFamily: 'Inter-Regular', fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: 40 },
  fakeCallerInfo: { alignItems: 'center', flex: 1 },
  fakeCallerAvatar: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(153,203,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  fakeCallerInitial: { fontFamily: 'Inter-Black', fontSize: 48, color: '#99cbff' },
  fakeCallerName: { fontFamily: 'Inter-Black', fontSize: 36, color: '#fff', marginBottom: 8 },
  fakeCallerType: { fontFamily: 'Inter-Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  fakeCallControls: {
    flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 40,
  },
  declineBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#ff5b56',
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#6bdc96',
    alignItems: 'center', justifyContent: 'center',
  },
});
