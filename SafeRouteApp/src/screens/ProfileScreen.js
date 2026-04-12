import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import { Shield, User, Mail, Bell, Moon, MapPin, LogOut, ChevronRight, Edit3, Save, AlertTriangle, CheckCircle, Settings } from 'lucide-react-native';
import { colors } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { fetchProfile, updateProfile, fetchAlertSettings, updateAlertSettings, logout } from '../services/api';

export default function ProfileScreen() {
  const { signOut } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Alert settings
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [showSettingsSection, setShowSettingsSection] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
      setEditEmail(data.email || '');
    } catch (err) {
      console.warn('Failed to load profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ email: editEmail });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      console.warn('Failed to update profile:', err.message);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      signOut();
    } catch (err) {
      signOut();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
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
        <TouchableOpacity onPress={() => setShowSettingsSection(!showSettingsSection)}>
          <Settings size={22} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.avatarGlow} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.username || 'User'}</Text>
            <View style={styles.profileEmailRow}>
              <Mail size={14} color={colors.onSurfaceVariant} />
              <Text style={styles.profileEmail}>{profile?.email || 'No email'}</Text>
            </View>
            <View style={styles.joinedRow}>
              <Text style={styles.joinedText}>
                Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <AlertTriangle size={20} color={colors.danger} />
            <Text style={styles.statValue}>{profile?.incident_count || 0}</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </View>
          <View style={styles.statCard}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.statValue}>{profile?.routes_calculated || 0}</Text>
            <Text style={styles.statLabel}>Routes</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={20} color={colors.secondary} />
            <Text style={styles.statValue}>{profile?.checkins || 0}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
        </View>

        {/* Edit Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Edit3 size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <User size={18} color={colors.onSurfaceVariant} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>USERNAME</Text>
                <Text style={styles.detailValue}>{profile?.username}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Mail size={18} color={colors.onSurfaceVariant} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>EMAIL</Text>
                {editing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      value={editEmail}
                      onChangeText={setEditEmail}
                      placeholder="Enter email"
                      placeholderTextColor={colors.outlineVariant}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <ActivityIndicator size={16} color={colors.onPrimaryContainer} />
                      ) : (
                        <Save size={16} color={colors.onPrimaryContainer} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.detailValue}>{profile?.email}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Alert Settings */}
        {showSettingsSection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alert Settings</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Bell size={18} color={colors.primary} />
                  <View>
                    <Text style={styles.settingLabel}>Risk Alert Threshold</Text>
                    <Text style={styles.settingDesc}>
                      Get alerted when DCTI score exceeds {alertThreshold}/100
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.thresholdRow}>
                {[40, 60, 80].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.thresholdBtn, alertThreshold === val && styles.thresholdBtnActive]}
                    onPress={() => setAlertThreshold(val)}
                  >
                    <Text style={[styles.thresholdText, alertThreshold === val && styles.thresholdTextActive]}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {[
            { icon: Moon, label: 'Dark Mode', value: 'Always On', color: '#a78bfa' },
            { icon: Bell, label: 'Notifications', value: 'Enabled', color: '#f59e0b' },
            { icon: MapPin, label: 'Default City', value: 'Nagpur', color: colors.primary },
          ].map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <item.icon size={20} color={item.color} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuValue}>{item.value}</Text>
              </View>
              <ChevronRight size={18} color={colors.outlineVariant} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SafeRoute v2.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingText: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant, marginTop: 12 },
  appBar: {
    paddingTop: 48, paddingHorizontal: 24, paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 50,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarTitle: { fontFamily: 'Inter-Black', fontSize: 20, color: colors.primary, letterSpacing: -1 },
  scrollContent: { padding: 24, paddingTop: 16, paddingBottom: 120 },
  // Profile Card
  profileCard: {
    alignItems: 'center', padding: 32,
    backgroundColor: '#1e293b', borderRadius: 20, marginBottom: 16,
  },
  avatarContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(153,203,255,0.15)',
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  avatarGlow: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(153,203,255,0.06)',
  },
  avatarText: { fontFamily: 'Inter-Black', fontSize: 28, color: colors.primary },
  profileInfo: { alignItems: 'center' },
  profileName: { fontFamily: 'Inter-Black', fontSize: 24, color: colors.onSurface, letterSpacing: -0.5, marginBottom: 4 },
  profileEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  profileEmail: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurfaceVariant },
  joinedRow: { marginTop: 4 },
  joinedText: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.outlineVariant },
  // Stats
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 6,
  },
  statValue: { fontFamily: 'Inter-Black', fontSize: 22, color: colors.onSurface },
  statLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter-Black', fontSize: 18, color: colors.onSurface, letterSpacing: -0.5, marginBottom: 12 },
  // Detail Card
  detailCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  detailInfo: { flex: 1 },
  detailLabel: { fontFamily: 'Inter-Bold', fontSize: 10, color: colors.outlineVariant, letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: colors.onSurface },
  divider: { height: 1, backgroundColor: 'rgba(64, 71, 81, 0.15)', marginVertical: 8 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: {
    flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: 'Inter-Regular', fontSize: 14, color: colors.onSurface,
  },
  saveBtn: { backgroundColor: colors.primaryContainer, padding: 8, borderRadius: 8 },
  // Settings
  settingsCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingLabel: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.onSurface },
  settingDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant },
  thresholdRow: { flexDirection: 'row', gap: 10 },
  thresholdBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow, borderWidth: 1.5, borderColor: 'transparent',
  },
  thresholdBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(153,203,255,0.1)' },
  thresholdText: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.onSurfaceVariant },
  thresholdTextActive: { color: colors.primary },
  // Menu
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 8,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuInfo: { flex: 1 },
  menuLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: colors.onSurface },
  menuValue: { fontFamily: 'Inter-Regular', fontSize: 12, color: colors.onSurfaceVariant },
  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderWidth: 1.5, borderColor: 'rgba(255,91,86,0.2)',
    borderRadius: 12, marginTop: 16,
  },
  logoutText: { fontFamily: 'Inter-Bold', fontSize: 14, color: colors.danger },
  versionText: {
    fontFamily: 'Inter-Regular', fontSize: 12, color: colors.outlineVariant,
    textAlign: 'center', marginTop: 16,
  },
});
