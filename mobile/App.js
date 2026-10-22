import React, { useRef, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function App() {
  const [host, setHost] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('Not connected');
  const [state, setState] = useState({ liveText: '', next: '', library: [], avatar: false });
  const [open, setOpen] = useState(null); // opened library item
  const ws = useRef(null);

  const connect = () => {
    try { ws.current && ws.current.close(); } catch {}
    const s = new WebSocket(`ws://${host.trim()}`);
    ws.current = s;
    setStatus('Connecting…');
    s.onopen = () => s.send(JSON.stringify({ type: 'hello', pin: pin.trim() }));
    s.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'state') { setState(m.state); setStatus('Connected'); }
    };
    s.onclose = () => setStatus('Disconnected. Check the address and PIN.');
    s.onerror = () => setStatus('Could not reach the computer. Use the same Wi-Fi.');
  };
  const send = (cmd, extra = {}) => ws.current && ws.current.readyState === 1 &&
    ws.current.send(JSON.stringify({ type: 'cmd', cmd, ...extra }));

  const Btn = ({ label, onPress, primary }) => (
    <TouchableOpacity style={[st.btn, primary && st.primary]} onPress={onPress}>
      <Text style={[st.btnText, primary && { color: '#1b1100' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.root}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={st.h1}>Gen3D Remote</Text>
        <Text style={st.mute}>{status}</Text>
        <TextInput style={st.input} placeholder="Computer address, e.g. 192.168.1.20:8787"
          placeholderTextColor="#9a93a8" value={host} onChangeText={setHost} autoCapitalize="none" />
        <TextInput style={st.input} placeholder="PIN shown on the computer" placeholderTextColor="#9a93a8"
          value={pin} onChangeText={setPin} keyboardType="number-pad" />
        <Btn label="Connect" onPress={connect} primary />

        <View style={st.screen}><Text style={st.live}>{state.liveText || 'Screen is clear'}</Text></View>
        {!!state.next && <Text style={st.mute}>Next: {state.next}</Text>}

        <View style={st.row}>
          <Btn label="Previous" onPress={() => send('prev')} />
          <Btn label="Next" onPress={() => send('next')} />
        </View>
        <View style={st.row}>
          <Btn label="Take live" onPress={() => send('take')} primary />
          <Btn label="Clear" onPress={() => send('clear')} />
          <Btn label={state.avatar ? 'Hide presenter' : 'Show presenter'} onPress={() => send('avatar')} />
        </View>

        <Text style={st.h2}>Library</Text>
        {state.library.map((it, i) => (
          <View key={i}>
            <Btn label={it.title} onPress={() => setOpen(open === i ? null : i)} />
            {open === i && it.slides.map((s, j) => (
              <TouchableOpacity key={j} style={st.slide} onPress={() => send('goto', { tab: it.tab, item: it.item, slide: j })}>
                <Text style={{ color: '#efeae0' }} numberOfLines={3}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12111a' },
  h1: { color: '#efeae0', fontSize: 22, fontWeight: '700' },
  h2: { color: '#efeae0', fontSize: 16, fontWeight: '700', marginTop: 8 },
  mute: { color: '#9a93a8' },
  input: { backgroundColor: '#1b1a26', color: '#efeae0', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#302d42' },
  btn: { backgroundColor: '#1b1a26', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#302d42', flex: 1, alignItems: 'center' },
  primary: { backgroundColor: '#ff8a2b', borderColor: '#ff8a2b' },
  btnText: { color: '#efeae0', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  screen: { backgroundColor: '#0a0910', borderRadius: 8, padding: 16, minHeight: 110, justifyContent: 'center' },
  live: { color: '#f6f1e7', fontSize: 18, textAlign: 'center' },
  slide: { backgroundColor: '#0a0910', borderRadius: 6, padding: 12, marginTop: 6 }
});
