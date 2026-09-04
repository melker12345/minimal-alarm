module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-gesture-handler|react-native-vector-icons|react-native-safe-area-context|react-native-paper)/)',
  ],
};
