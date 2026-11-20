import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { extOf } from './files';

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const fromAsset = (a: Asset | undefined, fallbackName: string): PickedFile | null =>
  a?.uri ? { uri: a.uri, name: a.fileName ?? `${fallbackName}.${extOf(a.type)}`, type: a.type ?? 'image/jpeg' } : null;

async function cameraAllowed() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** Take a photo (records, PAT-14). */
export async function takePhoto(): Promise<PickedFile | null> {
  if (!(await cameraAllowed())) return null;
  const r = await launchCamera({ mediaType: 'photo', quality: 0.7, saveToPhotos: false });
  if (r.didCancel || r.errorCode) return null;
  return fromAsset(r.assets?.[0], 'photo');
}

/** Pick one image from the gallery (records, doctor photo, clinic photos). */
export async function pickImage(): Promise<PickedFile | null> {
  const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 1 });
  if (r.didCancel || r.errorCode) return null;
  return fromAsset(r.assets?.[0], 'image');
}

/** Pick a PDF or image document and copy it into the app cache so it can be uploaded reliably. */
export async function pickDocument(): Promise<PickedFile | null> {
  try {
    const [file] = await pick({ type: [types.pdf, types.images], allowMultiSelection: false });
    if (!file) return null;
    const name = file.name ?? 'document';
    let uri = file.uri;
    try {
      const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: name }], destination: 'cachesDirectory' });
      if (copy.status === 'success') uri = copy.localUri;
    } catch {
      /* upload from the original content uri */
    }
    return { uri, name, type: file.type ?? 'application/pdf' };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}
