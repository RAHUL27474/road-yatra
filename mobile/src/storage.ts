// Small key/value store for secrets (the login token). Native: the device keychain / keystore via
// expo-secure-store. The web build uses storage.web.ts instead (SecureStore has no web support).
import * as SecureStore from 'expo-secure-store';

export const getItem = (key: string) => SecureStore.getItemAsync(key);
export const setItem = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteItem = (key: string) => SecureStore.deleteItemAsync(key);
