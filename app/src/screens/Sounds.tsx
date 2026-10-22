import React, {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';
import {TVFocusGuideView} from '@amazon-devices/react-native-kepler';
import type {Settings} from '../routine';
import {LAYER_IDS, LAYERS, PRESETS} from '../sounds';
import {C, FONT} from '../theme';
import {Icon} from '../ui/icons';
import {Button, Chooser, Slider, st, text, Toggle} from '../ui/kit';

// 05 / Sounds (grown-ups): tonight's sound is a mix. Pick a preset, ask Bear for one in your own
// words ("rain on a tent with a little stream"), then move each layer. What you pick is what you hear.

const Tile = ({u, label, icon, selected, onPress, preferred}: {u: number; label: string; icon: string; selected: boolean; onPress: () => void; preferred: boolean}) => {
  const [focused, setFocused] = useState(false);
  const S = (n: number) => n * u;
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="radio"
      aria-checked={selected}
      aria-label={label}
      style={{
        width: S(64),
        height: S(70),
        marginRight: S(7),
        borderRadius: S(14),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? 'rgba(255,255,255,0.16)' : 'rgba(24,33,63,0.85)',
        borderWidth: S(selected ? 3 : 1.5),
        borderColor: selected ? C.honey : focused ? C.focus : C.panelEdge,
        transform: [{scale: focused ? 1.07 : 1}],
      }}>
      <Icon name={icon} size={S(28)} ink={C.soft} />
      <Text style={{fontFamily: FONT.body, fontSize: S(11), color: C.ink, marginTop: S(4)}} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

type Props = {
  u: number;
  settings: Settings;
  hubOnline: boolean;
  asking: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onAsk: (words: string) => void;
  onSave: () => void;
};

export const Sounds = ({u, settings, hubOnline, asking, onChange, onAsk, onSave}: Props) => {
  const S = (n: number) => n * u;
  const T = text(u);
  const [words, setWords] = useState('');
  const [askFocus, setAskFocus] = useState(false);
  // focus starts on tonight's preset; fixed at mount, so a change below never pulls focus back up
  const [startAt] = useState(() => Math.max(0, PRESETS.findIndex(p => p.id === settings.preset)));
  // A layer turned down to 0 keeps its row while you are here (its slider has focus; removing it would
  // throw focus elsewhere). Zero layers are dropped when the mix is saved.
  const layers = Object.keys(settings.mix).slice(0, 4);
  const missing = LAYER_IDS.filter(id => !layers.includes(id));
  const setLevel = (id: string, v: number) => {
    onChange({mix: {...settings.mix, [id]: v}, preset: 'custom', mixName: settings.preset === 'custom' ? settings.mixName : `My ${settings.mixName.toLowerCase()}`});
  };
  const add = (id: string) => {
    onChange({mix: {...settings.mix, [id]: 0.4}, preset: 'custom', mixName: settings.preset === 'custom' ? settings.mixName : 'My mix'});
  };
  const ask = () => words.trim().length > 2 && !asking && onAsk(words.trim());
  const label = {fontFamily: FONT.body, fontSize: S(15), color: C.ink};

  return (
    <View style={st.fill}>
      <View style={[st.abs, {left: S(44), top: S(28)}]}>
        <Text role="heading" style={T.h2}>
          {"Tonight's sound"}
        </Text>
        <Text style={[T.body, {color: C.faint, marginTop: S(2)}]}>
          {settings.mixName}
          {hubOnline ? '' : ' · recorded sounds play when the Goodnight hub is on'}
        </Text>

        <View style={[st.row, {marginTop: S(10)}]}>
          {PRESETS.map((p, i) => (
            <Tile key={p.id} u={u} label={p.label} icon={p.icon} selected={settings.preset === p.id} preferred={i === startAt} onPress={() => onChange({preset: p.id, mix: p.mix, mixName: p.label})} />
          ))}
        </View>

        {/* The ask box and "Make it" are one focus group: ▶ from the box must land on "Make it". Left to the
            focus engine, a second ▶ jumped up to the presets (the Quiet tile) and OK then picked it (friction #19). */}
        <TVFocusGuideView trapFocusRight style={[st.row, {marginTop: S(12)}]}>
          <View style={[st.row, {width: S(380), height: S(38), borderRadius: S(19), paddingHorizontal: S(14), backgroundColor: 'rgba(24,33,63,0.9)', borderWidth: S(askFocus ? 2 : 1.5), borderColor: askFocus ? C.focus : C.panelEdge}]}>
            <Icon name="sparkle" size={S(16)} ink={C.honey} />
            <TextInput
              value={words}
              onChangeText={setWords}
              onSubmitEditing={ask}
              onFocus={() => setAskFocus(true)}
              onBlur={() => setAskFocus(false)}
              placeholder="Ask for any sound: rain on a tent, a little stream…"
              placeholderTextColor={C.faint}
              returnKeyType="done"
              // Vega's TV keyboard title: documented, but missing from the RN 0.83 types (friction #14)
              {...({auxOptions: "title:Describe tonight's sound"} as object)}
              aria-label="Describe tonight's sound"
              style={{flex: 1, marginLeft: S(8), fontFamily: FONT.body, fontSize: S(14), color: C.ink, paddingVertical: 0}}
            />
          </View>
          <View style={{marginLeft: S(10)}}>
            <Button u={u} label={asking ? 'Composing…' : 'Make it'} icon="sparkle" onPress={ask} ghost small />
          </View>
        </TVFocusGuideView>

        <View style={{marginTop: S(10), width: S(470)}}>
          {layers.length === 0 && <Text style={[T.body, {color: C.faint, height: S(38), lineHeight: S(38)}]}>Quiet: no sound tonight.</Text>}
          {layers.map(id => (
            <View key={id} style={[st.row, {height: S(38)}]}>
              <Icon name={LAYERS[id]?.icon ?? 'sparkle'} size={S(18)} ink={LAYERS[id] ? C.soft : C.honey} />
              <Text style={[label, {marginLeft: S(10), width: S(178)}]} numberOfLines={1}>
                {LAYERS[id]?.label ?? settings.mixName}
              </Text>
              <Slider u={u} label={`${LAYERS[id]?.label ?? settings.mixName} level`} value={settings.mix[id] ?? 0} onChange={v => setLevel(id, v)} width={170} />
            </View>
          ))}
          {layers.length < 4 && missing.length > 0 && (
            <View style={{marginTop: S(2)}}>
              <Chooser u={u} prefix="Add" options={missing.map(id => ({id, label: LAYERS[id].label}))} onPick={add} />
            </View>
          )}
        </View>

        <View style={[st.row, {marginTop: S(8), height: S(36)}]}>
          <Icon name="speaker" size={S(18)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), width: S(60)}]}>Voice</Text>
          <Slider u={u} label="Bear's voice level" value={settings.voice} onChange={v => onChange({voice: v})} width={110} />
          <View style={{width: S(18)}} />
          <Icon name="clock" size={S(18)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(8), marginRight: S(10)}]}>Fade out after 20 min</Text>
          <Toggle u={u} label="Fade the sound out after 20 minutes" on={settings.fadeOut} onChange={v => onChange({fadeOut: v})} />
        </View>

        <View style={{marginTop: S(10)}}>
          <Button u={u} label="Save for bedtime" icon="check" onPress={onSave} />
        </View>
      </View>
    </View>
  );
};
