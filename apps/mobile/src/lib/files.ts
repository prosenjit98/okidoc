import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { session } from './api';
import { API_BASE } from './config';

const cacheDir = () => ReactNativeBlobUtil.fs.dirs.CacheDir;
const safeName = (n: string) => n.replace(/[^\w.-]+/g, '_');
const fileUrl = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

/** Download an authenticated file (records, register CSV) to cache and open it with the system viewer / share sheet. */
export async function openAuthedFile(path: string, filename: string, mimeType?: string) {
  const token = session.get()?.accessToken;
  const dest = `${cacheDir()}/${safeName(filename)}`;
  const res = await ReactNativeBlobUtil.config({ path: dest, fileCache: true }).fetch('GET', `${API_BASE}${path}`, token ? { Authorization: `Bearer ${token}` } : {});
  const status = res.info().status;
  if (status >= 400) throw new Error(status === 403 ? 'You do not have access to this file' : 'Could not download the file');
  const type = mimeType ?? (res.info().headers?.['content-type'] as string | undefined) ?? 'application/octet-stream';
  if (Platform.OS === 'android') {
    try {
      // Opens PDF / image viewers directly when one is installed.
      await ReactNativeBlobUtil.android.actionViewIntent(res.path() ?? dest, type);
      return;
    } catch {
      /* fall back to share sheet */
    }
  }
  await Share.open({ url: fileUrl(res.path() ?? dest), type, filename: safeName(filename), failOnCancel: false });
}

/** Write text (e.g. data export JSON) to cache and open the share sheet. */
export async function shareTextFile(filename: string, text: string, mimeType = 'application/json') {
  const dest = `${cacheDir()}/${safeName(filename)}`;
  await ReactNativeBlobUtil.fs.writeFile(dest, text, 'utf8');
  await Share.open({ url: fileUrl(dest), type: mimeType, filename: safeName(filename), failOnCancel: false });
}

/** Share a local image (e.g. a captured poster). */
export async function shareImage(uri: string, title: string) {
  await Share.open({ url: fileUrl(uri.replace(/^file:\/\//, '')), type: 'image/png', title, failOnCancel: false });
}

export const extOf = (mime?: string | null) => (mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
