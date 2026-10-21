import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { getConfig } from './api';
import { openPlayStore } from './store';

/** This build's Android versionCode (0 on web / unknown). */
const versionCode = () => Number(Constants.expoConfig?.android?.versionCode ?? 0);

/**
 * Asks to update from the Play Store once per app start when the server says a newer build is out
 * (CUSTOMER_APP_LATEST_VERSION). Below CUSTOMER_APP_MIN_VERSION the prompt can't be dismissed.
 */
export async function checkForUpdate() {
  if (Platform.OS !== 'android' || !versionCode()) return;
  const c = await getConfig().catch(() => null);
  const latest = c?.appUpdate?.latest ?? 0;
  const min = c?.appUpdate?.min ?? 0;
  if (versionCode() >= latest) return;
  const forced = versionCode() < min;
  const ask = () =>
    Alert.alert(
      forced ? 'Update required' : 'Update available',
      forced ? 'This version of the app no longer works. Please update to keep booking.' : 'A new version of the app is available with improvements and fixes.',
      [
        ...(forced ? [] : [{ text: 'Later', style: 'cancel' as const }]),
        { text: 'Update', onPress: () => openPlayStore().finally(() => forced && setTimeout(ask, 1000)) },
      ],
      { cancelable: !forced },
    );
  ask();
}
