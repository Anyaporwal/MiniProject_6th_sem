import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Mail, Lock, Eye, EyeOff, Fingerprint, Key } from 'lucide-react-native';
import { colors, typography } from '../theme';
import { login, register } from '../services/api';

export default function LoginScreen({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    try {
      if (!email || !password) {
        alert("Please enter email and password.");
        return;
      }
      if (isRegistering) {
        const username = email.split('@')[0]; // Quick username from email
        await register(username, email, password);
        // Automatically login after successful registration
        const access_token = await login(email, password);
        setToken(access_token);
      } else {
        const access_token = await login(email, password);
        setToken(access_token);
      }
    } catch (error) {
      console.warn("Auth Error", error.response?.data || error);
      let errorMsg = error.message;
      if (error.response?.data?.detail) {
        const d = error.response.data.detail;
        if (Array.isArray(d)) {
          errorMsg = d.map(e => e.msg).join(', ');
        } else {
          errorMsg = d;
        }
      }
      alert("Auth failed: " + errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Background Element Approximations */}
        <View style={[styles.heroBlob, styles.heroBlobTop]} />
        <View style={[styles.heroBlob, styles.heroBlobBottom]} />

        <View style={styles.mainContainer}>
          {/* Brand Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              style={styles.iconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Shield color={colors.onPrimary} size={32} />
            </LinearGradient>
            <Text style={styles.title}>SafeRoute</Text>
            <Text style={styles.subtitle}>THE DIGITAL GUARDIAN</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.authCard}>
            {/* Tab Toggle */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, !isRegistering && styles.tabButtonActive]}
                onPress={() => setIsRegistering(false)}
              >
                <Text style={[styles.tabText, !isRegistering && styles.tabTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, isRegistering && styles.tabButtonActive]}
                onPress={() => setIsRegistering(true)}
              >
                <Text style={[styles.tabText, isRegistering && styles.tabTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Login Form */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View style={styles.inputWrapper}>
                  <Mail color={colors.outline} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(138, 145, 156, 0.5)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <TouchableOpacity>
                    <Text style={styles.forgotPassword}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputWrapper}>
                  <Lock color={colors.outline} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(138, 145, 156, 0.5)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff color={colors.outline} size={20} /> : <Eye color={colors.outline} size={20} />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.rememberContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]} />
                <Text style={styles.rememberText}>Stay protected on this device</Text>
              </TouchableOpacity>

              {/* Primary CTA */}
              <TouchableOpacity onPress={handleAuth} activeOpacity={0.8} style={{ marginTop: 16 }}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryContainer]}
                  style={styles.ctaButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.ctaText}>{isRegistering ? 'SECURE REGISTER' : 'SECURE LOGIN'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Social/Alternative Auth */}
            <View style={styles.verificationSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VERIFICATION METHODS</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.methodsGrid}>
                <TouchableOpacity style={styles.methodButton}>
                  <Fingerprint color={colors.primary} size={20} />
                  <Text style={styles.methodText}>Biometrics</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.methodButton}>
                  <Key color={colors.primary} size={20} />
                  <Text style={styles.methodText}>Passkey</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <View style={styles.encryptedBadge}>
              <Shield color={colors.secondary} size={18} />
              <Text style={styles.encryptedText}>END-TO-END ENCRYPTED ACCESS</Text>
            </View>
            <Text style={styles.footerDisclaimer}>
              By entering, you agree to our <Text style={styles.footerLink}>Privacy Standards</Text> and <Text style={styles.footerLink}>Citizen Protocol</Text>.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  heroBlob: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.2, // Simulate heavy blur opacity
  },
  heroBlobTop: {
    backgroundColor: colors.primary,
    top: -50,
    left: -50,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100, // Approximating blur-[120px]
    elevation: 20,
  },
  heroBlobBottom: {
    backgroundColor: colors.secondary,
    bottom: -50,
    right: -50,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    elevation: 20,
  },
  mainContainer: {
    width: '100%',
    maxWidth: 440,
    gap: 32,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter-Black',
    fontSize: 28, // text-3xl approx
    letterSpacing: -1,
    color: colors.primary, // Using primary since gradient text isn't trivial in RN without MaskedView
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },
  authCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 32, // rounded-[2rem]
    padding: 32, // p-8
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    padding: 6,
    borderRadius: 16,
    marginBottom: 32,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primaryContainer,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  tabText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    letterSpacing: -0.5,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 4,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  forgotPassword: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: colors.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    height: 52,
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.onSurface,
    height: '100%',
    paddingRight: 16,
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  ctaText: {
    fontFamily: 'Inter-Black',
    fontSize: 14,
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  verificationSection: {
    marginTop: 40,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(64, 71, 81, 0.3)', // outlineVariant/30
  },
  dividerText: {
    marginHorizontal: 16,
    fontFamily: 'Inter-Black',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(138, 145, 156, 0.6)', // outline/60
  },
  methodsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: 14,
    borderRadius: 12,
  },
  methodText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: colors.onSurface,
  },
  footer: {
    alignItems: 'center',
    gap: 24,
    marginTop: 16,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(107, 220, 150, 0.1)', // secondary/10
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  encryptedText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  footerDisclaimer: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(192, 199, 210, 0.6)', // onSurfaceVariant/60
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  footerLink: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  }
});
