import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Card, Row, T } from './ui';
import { Icon } from './Icon';
import { bookings } from '../lib/api';
import { drivingRoute, mapboxToken } from '../lib/geo';
import { connectTrackingSocket } from '../lib/trackingSocket';
import { usePolling } from '../lib/poll';
import { useNow } from '../lib/useNow';
import { C } from '../theme';

type LatLng = { lat: number; lng: number };
type Point = { latitude: number; longitude: number; recorded_at: string };
type Route = { line: string | null; full: string | null; legs: number[] | null };

/** The map page: Leaflet with Mapbox tiles. Drag to move, pinch or double-tap to zoom; the app pushes updates into `window.update`. */
const page = (tiles: string, mapbox: boolean) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;width:100%;background:#E8E4DF}.dot{border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)}</style></head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:true,attributionControl:false}).setView([45.4,-75.7],5);
L.tileLayer(${JSON.stringify(tiles)},${mapbox ? '{maxZoom:19,tileSize:512,zoomOffset:-1}' : '{maxZoom:19}'}).addTo(map);
var car,pick,dest,line,fitted=false;
function icon(c,s){return L.divIcon({className:'',html:'<div class="dot" style="background:'+c+';width:'+s+'px;height:'+s+'px"></div>',iconSize:[s,s],iconAnchor:[s/2,s/2]})}
function dec(str){var i=0,lat=0,lng=0,out=[];while(i<str.length){var b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=(r&1)?~(r>>1):(r>>1);sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lng+=(r&1)?~(r>>1):(r>>1);out.push([lat/1e5,lng/1e5])}return out}
function put(m,ll,c,s){if(!ll){if(m)map.removeLayer(m);return null}if(!m)return L.marker(ll,{icon:icon(c,s)}).addTo(map);m.setLatLng(ll);return m}
window.fit=function(){var g=[];[car,pick,dest].forEach(function(m){if(m)g.push(m.getLatLng())});if(line)line.getLatLngs().forEach(function(p){g.push(p)});if(g.length)map.fitBounds(L.latLngBounds(g),{padding:[40,40],maxZoom:16})};
window.update=function(s){
  pick=put(pick,s.pickup,'#2f6fe4',18);dest=put(dest,s.dest,'#1b1a1f',18);car=put(car,s.car,'#f47a20',26);
  if(s.line){var p=dec(s.line);if(!line)line=L.polyline(p,{color:'#f47a20',weight:5,opacity:.85}).addTo(map);else line.setLatLngs(p)}else if(line){map.removeLayer(line);line=null}
  if(!fitted&&(car||pick||dest)){window.fit();fitted=true}
};
</script></body></html>`;

/**
 * The trip on a map under the live tracking card: the driver's car, the pickup point, the destination, the driving route and the
 * ETA. The map can be dragged and zoomed; the car moves as the driver's phone reports its position, and "Recenter" fits everything
 * back into view. Before the trip starts it shows the planned route.
 */
export function TripMap({ bookingId, running, pickup, destination, full, bottomInset = 12, instanceId }: { bookingId: number; running: boolean; pickup?: LatLng | null; destination?: LatLng | null; full?: boolean; bottomInset?: number; instanceId?: number | null }) {
  const now = useNow(5000);
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [car, setCar] = useState<Point | null>(null);
  const [route, setRoute] = useState<Route>({ line: null, full: null, legs: null });

  useEffect(() => {
    mapboxToken()
      .then(setToken)
      .catch(() => setToken(''));
  }, []);

  const loadCar = useCallback(() => {
    if (!running) return;
    bookings
      .tracking(bookingId)
      .then((p) => p && setCar(p))
      .catch(() => {});
  }, [bookingId, running]);
  useEffect(() => {
    loadCar();
  }, [loadCar]);
  usePolling(loadCar, full ? 5000 : 8000);
  // the live channel moves the car every few seconds; the polling above is the fallback when it is blocked
  useEffect(() => {
    if (!running || !instanceId) return;
    const socket = connectTrackingSocket();
    const join = () => socket.emit('join_ride_tracking', { ride_instance_id: instanceId }, () => {});
    const onUpdate = (p: Point & { ride_instance_id: number }) => p.ride_instance_id === instanceId && setCar(p);
    socket.on('connect', join);
    socket.on('location_update', onUpdate);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('location_update', onUpdate);
    };
  }, [running, instanceId]);

  // route: car -> pickup -> destination while the trip is on, else pickup -> destination
  const pts = [running && car ? { latitude: Number(car.latitude), longitude: Number(car.longitude) } : null, pickup ? { latitude: pickup.lat, longitude: pickup.lng } : null, destination ? { latitude: destination.lat, longitude: destination.lng } : null].filter(
    (p): p is { latitude: number; longitude: number } => !!p,
  );
  const key = pts.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join(';');
  useEffect(() => {
    let on = true;
    drivingRoute(pts).then((r) => on && setRoute(r));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // the page is built once (when the tiles are known); everything after that is pushed into it, so dragging is never interrupted
  const html = useMemo(() => (token === null ? null : token ? page(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`, true) : page('https://tile.openstreetmap.org/{z}/{x}/{y}.png', false)), [token]);
  const state = JSON.stringify({
    pickup: pickup ? [pickup.lat, pickup.lng] : null,
    dest: destination ? [destination.lat, destination.lng] : null,
    car: running && car ? [Number(car.latitude), Number(car.longitude)] : null,
    line: route.full,
  });
  useEffect(() => {
    if (loaded) web.current?.injectJavaScript(`window.update(${state});true;`);
  }, [loaded, state]);

  // ETA from the route legs: [car -> pickup, pickup -> destination] (or the single leg when there is no pickup)
  const legs = route.legs;
  const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let eta = '';
  if (running && car && legs) {
    const toPickup = pickup && legs.length >= 2 ? legs[0] : null;
    const total = legs.reduce((a, b) => a + b, 0);
    const parts = [toPickup !== null && toPickup > 120 ? `Pickup in about ${Math.round(toPickup / 60)} min` : '', destination ? `arriving around ${clock(now + total * 1000)}` : ''].filter(Boolean);
    eta = parts.join(' · ');
  } else if (!running && legs && destination) {
    eta = `Planned trip: about ${Math.max(1, Math.round(legs.reduce((a, b) => a + b, 0) / 60))} min of driving`;
  }
  const age = running && car ? Math.max(0, Math.round((now - new Date(car.recorded_at).getTime()) / 1000)) : null;

  if (full) {
    return (
      <View style={{ flex: 1, backgroundColor: '#E8E4DF' }}>
        {html ? <WebView ref={web} source={{ html }} originWhitelist={['*']} onLoadEnd={() => setLoaded(true)} nestedScrollEnabled overScrollMode="never" scrollEnabled={false} bounces={false} javaScriptEnabled domStorageEnabled style={{ flex: 1, backgroundColor: '#E8E4DF' }} /> : null}
        <Pressable style={[styles.recenter, { top: undefined, bottom: bottomInset, width: 46, height: 46, borderRadius: 23 }]} onPress={() => web.current?.injectJavaScript('window.fit();true;')} accessibilityLabel="Show the whole route" hitSlop={6}>
          <Icon name="target" size={22} color={C.ink2} />
        </Pressable>
        <View style={[styles.etaPill, { bottom: bottomInset }]}>
          <T w="xbold" size={14} color={C.oDeep}>
            {eta || (car ? 'Calculating ETA…' : 'Waiting for the driver’s location…')}
          </T>
          {age !== null ? (
            <T size={11} color={age > 45 ? C.warn : C.good}>
              {age > 45 ? `Last seen ${age >= 120 ? `${Math.round(age / 60)} min` : `${age} s`} ago` : '● Live'}
            </T>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Card style={{ padding: 14, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold">Map</T>
        {age !== null ? (
          <T size={11} color={age > 45 ? C.warn : C.good}>
            {age > 45 ? `Last seen ${age >= 120 ? `${Math.round(age / 60)} min` : `${age} s`} ago` : '● Live'}
          </T>
        ) : null}
      </Row>
      <View style={styles.map}>
        {html ? (
          <WebView
            ref={web}
            source={{ html }}
            originWhitelist={['*']}
            onLoadEnd={() => setLoaded(true)}
            nestedScrollEnabled
            overScrollMode="never"
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1, backgroundColor: '#E8E4DF' }}
          />
        ) : null}
        <Pressable style={styles.recenter} onPress={() => web.current?.injectJavaScript('window.fit();true;')} accessibilityLabel="Show the whole route" hitSlop={6}>
          <Icon name="target" size={18} color={C.ink2} />
        </Pressable>
      </View>
      {eta ? (
        <T w="bold" size={14}>
          ETA: {eta}
        </T>
      ) : null}
      {!running ? (
        <T size={12} color={C.muted}>
          The car appears on the map as soon as the driver starts the trip. Drag and pinch to explore the map.
        </T>
      ) : !car ? (
        <T size={12} color={C.muted}>
          Waiting for the driver&apos;s location…
        </T>
      ) : (
        <T size={12} color={C.muted}>
          Drag and pinch to explore. Tap the target to see the whole route again.
        </T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  map: { height: 300, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E8E4DF' },
  etaPill: { position: 'absolute', left: 12, right: 70, minHeight: 46, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  recenter: { position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
});
