// Custom entry: register the background booking check before expo-router loads, so the task exists when
// Android wakes the app in the background (route modules load only when the UI renders).
import './src/background';
import 'expo-router/entry';
