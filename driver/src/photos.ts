// Taking / choosing photos for the driver application, sized for upload.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/** A local image ready to append to FormData as `{ uri, name, type }`. */
export type PickedPhoto = { uri: string; name: string; type: string };

const MAX_SIDE = 1600; // px, longest side
const MAX_BYTES = 5.5 * 1024 * 1024; // the server accepts up to 6 MB
const OK_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type Source = 'camera' | 'library';

/** "Take photo" / "Choose from gallery" chooser. Resolves null when dismissed. */
function chooseSource(title: string, message?: string): Promise<Source | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: Source | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    Alert.alert(
      title,
      message,
      [
        { text: 'Take photo', onPress: () => finish('camera') },
        { text: 'Choose from gallery', onPress: () => finish('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
      ],
      { cancelable: true, onDismiss: () => finish(null) },
    );
  });
}

async function cameraAllowed() {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const asked = current.canAskAgain ? await ImagePicker.requestCameraPermissionsAsync() : current;
  if (asked.granted) return true;
  Alert.alert('Camera access needed', 'Allow camera access in Settings to take the photo, or choose one from your gallery.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
  return false;
}

/** Resizes to at most 1600 px and re-encodes as JPEG when the picked image is too big or not JPG/PNG/WebP. */
async function prepare(asset: ImagePicker.ImagePickerAsset, field: string): Promise<PickedPhoto> {
  const mime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  const tooLarge = Math.max(asset.width || 0, asset.height || 0) > MAX_SIDE;
  const tooHeavy = (asset.fileSize ?? 0) > MAX_BYTES;
  if (!tooLarge && !tooHeavy && OK_TYPES[mime]) {
    const type = mime === 'image/jpg' ? 'image/jpeg' : mime;
    return { uri: asset.uri, name: `${field}.${OK_TYPES[mime]}`, type };
  }
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (tooLarge) ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: `${field}.jpg`, type: 'image/jpeg' };
}

/**
 * Asks "Take photo / Choose from gallery", then returns the compressed photo (quality 0.6, max 1600 px),
 * or null if the user cancelled. `selfie` opens the front camera where the camera app supports it.
 */
export async function pickPhoto(opts: { field: string; title: string; message?: string; selfie?: boolean }): Promise<PickedPhoto | null> {
  const source = await chooseSource(opts.title, opts.message);
  if (!source) return null;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false, exif: false };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    if (!(await cameraAllowed())) return null;
    result = await ImagePicker.launchCameraAsync({
      ...options,
      cameraType: opts.selfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
  } else {
    // The system photo picker needs no permission on Android 13+ and iOS 14+.
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.length) return null;
  return prepare(result.assets[0], opts.field);
}
