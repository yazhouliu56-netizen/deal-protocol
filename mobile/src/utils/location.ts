import * as Location from 'expo-location';
import { GeoLocation } from '../types';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<GeoLocation | null> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) return null;

  const loc = await Location.getCurrentPositionAsync({});
  const geocode = await Location.reverseGeocodeAsync({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  });

  const address = geocode.length > 0
    ? `${geocode[0].city || ''} ${geocode[0].street || ''} ${geocode[0].name || ''}`.trim()
    : '未知位置';

  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    address,
  };
}

export async function watchLocation(
  onUpdate: (loc: GeoLocation) => void
): Promise<Location.LocationSubscription | null> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) return null;

  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    (loc) => {
      onUpdate({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: `纬度: ${loc.coords.latitude.toFixed(4)}, 经度: ${loc.coords.longitude.toFixed(4)}`,
      });
    }
  );
}
