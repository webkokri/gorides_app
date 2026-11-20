import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Icon } from './Icon';
import { T } from './ui';
import { drivingRoute, mapboxToken } from '../lib/geo';
import { DriverTrip, Stop } from '../lib/route';
import { C } from '../theme';

type Pax = { name: string; seats: number; pickup: string; done: boolean };
type Marker = { n: number; name: string; lat: number; lng: number; pax: Pax[]; done: boolean };

/** Leaflet page: A = start, numbered pickup stops (tap for the passengers), star = destination, car = the driver. Drag and pinch freely. */
const page = (tiles: string, mapbox: boolean) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;width:100%;background:#E8E4DF;font-family:-apple-system,Roboto,sans-serif}
.pin{width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}
.car{width:22px;height:22px;border-radius:50%;background:#2f6fe4;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,228,.25)}
.pp{font-size:13px;line-height:1.35}.pp b{font-size:14px}.pp i{color:#777;font-style:normal}</style></head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:false}).setView([45.4,-75.7],5);
L.tileLayer(${JSON.stringify(tiles)},${mapbox ? '{maxZoom:19,tileSize:512,zoomOffset:-1}' : '{maxZoom:19}'}).addTo(map);
var layer=L.layerGroup().addTo(map),line,me,fitted=false,pts=[];
function pin(t,c,ll,html){var m=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="pin" style="background:'+c+'">'+t+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(layer);if(html)m.bindPopup(html,{closeButton:false,maxWidth:230});pts.push(ll);return m}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function dec(str){var i=0,lat=0,lng=0,out=[];while(i<str.length){var b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=(r&1)?~(r>>1):(r>>1);sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lng+=(r&1)?~(r>>1):(r>>1);out.push([lat/1e5,lng/1e5])}return out}
window.fit=function(){var g=pts.slice();if(me)g.push(me.getLatLng());if(line)line.getLatLngs().forEach(function(p){g.push(p)});if(g.length)map.fitBounds(L.latLngBounds(g),{padding:[44,44],maxZoom:16})};
window.update=function(s){
  layer.clearLayers();pts=[];
  if(s.origin)pin('A','#2f6fe4',[s.origin.lat,s.origin.lng],'<div class="pp"><b>Start</b><br>'+esc(s.origin.name)+'</div>');
  s.stops.forEach(function(k){
    var who=k.pax.map(function(p){return '<b>'+esc(p.name)+'</b>'+(p.done?' ✓':'')+'<br><i>'+p.seats+' seat'+(p.seats>1?'s':'')+(p.pickup?' · '+esc(p.pickup):'')+'</i>'}).join('<hr style="border:0;border-top:1px solid #eee;margin:6px 0">');
    pin(k.n,k.done?'#8a8a8a':'#f47a20',[k.lat,k.lng],'<div class="pp"><b>Stop '+k.n+'</b> · '+esc(k.name)+'<br>'+(who||'<i>No passenger</i>')+'</div>');
  });
  if(s.dest)pin('★','#1b1a1f',[s.dest.lat,s.dest.lng],'<div class="pp"><b>Destination</b><br>'+esc(s.dest.name)+'</div>');
  if(s.line){var p=dec(s.line);if(!line)line=L.polyline(p,{color:'#f47a20',weight:5,opacity:.85}).addTo(map);else line.setLatLngs(p)}else if(line){map.removeLayer(line);line=null}
  if(s.me){if(!me)me=L.marker(s.me,{icon:L.divIcon({className:'',html:'<div class="car"></div>',iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:1000}).addTo(map);else me.setLatLng(s.me)}else if(me){map.removeLayer(me);me=null}
  if(!fitted&&pts.length){window.fit();fitted=true}
};
</script></body></html>`;

/**
 * The driver's trip map. Start (A), every pickup as a numbered stop (tap one to see who is picked up there), the destination (star)
 * and the driving line start -> stops -> destination. Once the trip runs, the driver's own position is shown and the line starts
 * from it and skips the passengers already picked up. Drag and pinch to explore; the target button fits the whole trip again and
 * the arrow in the bottom-right corner opens the trip in Google Maps (or Apple Maps) for turn-by-turn navigation.
 */
export function DriverMap({ trip, running, done, onNavigate, onTouch, full, bottomInset = 12, height = 360, onLegs }: { trip: DriverTrip; running: boolean; done: number[]; onNavigate: () => void; onTouch?: (down: boolean) => void; full?: boolean; bottomInset?: number; height?: number; onLegs?: (legs: number[] | null) => void }) {
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    mapboxToken()
      .then(setToken)
      .catch(() => setToken(''));
  }, []);

  // the driver's own position while the trip runs
  useEffect(() => {
    if (!running) return;
    let sub: Location.LocationSubscription | null = null;
    let off = false;
    Location.getForegroundPermissionsAsync()
      .then(async (p) => {
        if (!p.granted || off) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, (l) => setMe({ lat: l.coords.latitude, lng: l.coords.longitude }));
        if (off) sub.remove();
      })
      .catch(() => {});
    return () => {
      off = true;
      sub?.remove();
    };
  }, [running]);

  // one numbered marker per pickup point, in pickup order, with the passengers picked up there
  const markers = useMemo<Marker[]>(() => {
    const out: Marker[] = [];
    const same = (a: Stop, b: Stop) => Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
    for (const p of trip.passengers) {
      if (!p.stop) continue;
      let m = out.find((x) => same(x, p.stop as Stop));
      if (!m) {
        m = { n: out.length + 1, name: p.stop.name, lat: p.stop.lat, lng: p.stop.lng, pax: [], done: false };
        out.push(m);
      }
      m.pax.push({ name: p.name, seats: p.seats, pickup: p.pickupName, done: done.includes(p.bookingId) });
    }
    // a ride with published pickup points but no located passengers still shows its stops
    if (!out.length) trip.stops.forEach((s, i) => out.push({ n: i + 1, name: s.name, lat: s.lat, lng: s.lng, pax: [], done: false }));
    out.forEach((m) => (m.done = m.pax.length > 0 && m.pax.every((p) => p.done)));
    return out;
  }, [trip, done]);

  // the line: start (or the driver's position) -> pickups still to do -> destination
  const key = JSON.stringify([running && me ? [me.lat.toFixed(3), me.lng.toFixed(3)] : null, markers.map((m) => [m.lat, m.lng, m.done]), trip.origin, trip.destination]);
  useEffect(() => {
    let on = true;
    const todo = markers.filter((m) => !m.done);
    const pts = [running && me ? me : trip.origin, ...todo, trip.destination].filter((p): p is { lat: number; lng: number } => !!p).map((p) => ({ latitude: p.lat, longitude: p.lng }));
    drivingRoute(pts).then((r) => {
      if (!on) return;
      setLine(r.full);
      onLegs?.(r.legs);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const html = useMemo(() => (token === null ? null : token ? page(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`, true) : page('https://tile.openstreetmap.org/{z}/{x}/{y}.png', false)), [token]);
  const state = JSON.stringify({
    origin: trip.origin,
    dest: trip.destination,
    stops: markers,
    line,
    me: running && me ? [me.lat, me.lng] : null,
  });
  useEffect(() => {
    if (loaded) web.current?.injectJavaScript(`window.update(${state});true;`);
  }, [loaded, state]);

  return (
    <View style={full ? styles.full : [styles.map, { height }]} onTouchStart={() => onTouch?.(true)} onTouchEnd={() => onTouch?.(false)} onTouchCancel={() => onTouch?.(false)}>
      {html ? (
        <WebView ref={web} source={{ html }} originWhitelist={['*']} onLoadEnd={() => setLoaded(true)} nestedScrollEnabled overScrollMode="never" scrollEnabled={false} bounces={false} javaScriptEnabled domStorageEnabled style={{ flex: 1, backgroundColor: '#E8E4DF' }} />
      ) : (
        <View style={styles.empty}>
          <T size={13} color={C.muted}>
            Loading the map…
          </T>
        </View>
      )}
      <View style={[styles.zoom, full && { top: 70 }]}>
        <Pressable style={styles.btn} onPress={() => web.current?.injectJavaScript('map.zoomIn();true;')} accessibilityLabel="Zoom in" hitSlop={4}>
          <T w="bold" size={20} color={C.ink2}>
            +
          </T>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => web.current?.injectJavaScript('map.zoomOut();true;')} accessibilityLabel="Zoom out" hitSlop={4}>
          <T w="bold" size={22} color={C.ink2}>
            −
          </T>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => web.current?.injectJavaScript('window.fit();true;')} accessibilityLabel="Show the whole trip" hitSlop={4}>
          <Icon name="target" size={18} color={C.ink2} />
        </Pressable>
      </View>
      <Pressable style={[styles.nav, { bottom: bottomInset }]} onPress={onNavigate} accessibilityLabel="Open the route in a maps app">
        <Icon name="nav" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#E8E4DF' },
  map: { height: 360, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E8E4DF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoom: { position: 'absolute', top: 10, right: 10, gap: 8 },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  nav: { position: 'absolute', right: 12, bottom: 12, width: 52, height: 52, borderRadius: 26, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
});
