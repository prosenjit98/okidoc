/**
 * Okidoc — bare React Native entry point.
 * @format
 */
import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import { registerBackgroundPushHandler } from './src/lib/push';
import App from './src/App';
import { name as appName } from './app.json';

// Must be registered outside of the React tree (FCM headless / background messages).
registerBackgroundPushHandler();

AppRegistry.registerComponent(appName, () => App);
