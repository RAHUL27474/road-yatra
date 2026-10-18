// Custom entry: register the background location and duty-check tasks before expo-router loads, so they
// exist when Android wakes the app in the background (route modules load only when the UI renders).
import './src/location';
import './src/background';
import 'expo-router/entry';
