export default {
  expo: {
    name: "SafeRouteApp",
    slug: "SafeRouteApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      config: {
        googleMaps: {
          // Read API Key from environment variable
          apiKey: process.env.EXPO_PUBLIC_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow SafeRoute to use your location for safe routing and live tracking."
        }
      ],
      "@react-native-community/datetimepicker"
    ]
  }
};
