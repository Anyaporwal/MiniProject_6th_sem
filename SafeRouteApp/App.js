import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { safeStorage } from './src/services/api';
import { Shield, Map, AlertTriangle, User, Navigation as NavIcon, Heart } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';

import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import RoutePlannerScreen from './src/screens/RoutePlannerScreen';
import ReportScreen from './src/screens/ReportScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WomenSafetyScreen from './src/screens/WomenSafetyScreen';
import { colors } from './src/theme';
import { AuthContext } from './src/context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.tabBarWrapper}>
      <BlurView intensity={90} tint="dark" style={styles.tabBarBlur}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let IconComponent;
          if (route.name === 'Map') IconComponent = Map;
          else if (route.name === 'Route') IconComponent = NavIcon;
          else if (route.name === 'Report') IconComponent = AlertTriangle;
          else if (route.name === 'Safety') IconComponent = Heart;
          else if (route.name === 'Profile') IconComponent = User;

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.8}
              onPress={onPress}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemFocused
              ]}
            >
              <IconComponent 
                color={isFocused ? colors.primary : colors.outlineVariant} 
                size={24} 
                 {...((route.name === 'Report' && isFocused) ? { fill: colors.primary } : {})}
              />
              <Text style={[
                styles.tabLabel, 
                { color: isFocused ? colors.primary : colors.outlineVariant }
              ]}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

// WomenSafetyScreen imported from screens

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Route" component={RoutePlannerScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Safety" component={WomenSafetyScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [userToken, setUserToken] = useState(null);

  const [fontsLoaded] = useFonts({
    'Inter-Light': Inter_300Light,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
    'Inter-Black': Inter_900Black,
  });

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token;
      try {
        token = await safeStorage.getItem('userToken');
      } catch (e) {
        // Restoring token failed
      }
      setUserToken(token);
      setIsLoadingToken(false);
    };

    bootstrapAsync();
  }, []);

  if (isLoadingToken || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ userToken, setUserToken, signOut: () => setUserToken(null) }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.background } }}>
          {userToken == null ? (
             <Stack.Screen name="Login">
              {props => <LoginScreen {...props} setToken={setUserToken} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="MainTabs" component={MainTabs} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  tabBarBlur: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(153, 203, 255, 0.1)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  tabItemFocused: {
    backgroundColor: 'rgba(153, 203, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  tabLabel: {
    fontFamily: 'Inter-Black',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  }
});
