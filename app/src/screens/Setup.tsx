import React from 'react';
import {Image, Text, View} from 'react-native';
import {TVFocusGuideView} from '@amazon-devices/react-native-kepler';
import {CANDLE_SPEEDS, clock, EXTRA, readyAt, Settings, STEP, StepKind} from '../routine';
import {C, FONT} from '../theme';
import {Icon} from '../ui/icons';
import {BEAR_BUNNY, Button, Round, st, text, Toggle} from '../ui/kit';
import {PRESETS} from '../sounds';

// 06 / Parent setup (grown-ups): the family's steps and minutes, when bedtime starts, and whether a
// short routine is allowed on late nights. Done once; the routine is the same every night after that.
// `fromSounds`: back from the Sounds screen, focus returns to the button that opened it.
type Props = {u: number; settings: Settings; fromSounds: boolean; onChange: (patch: Partial<Settings>) => void; onSounds: () => void; onSave: () => void};

const Pill = ({u, children}: {u: number; children: React.ReactNode}) => (
  <View style={{minWidth: 98 * u, height: 32 * u, borderRadius: 10 * u, paddingHorizontal: 12 * u, backgroundColor: C.night, borderWidth: 1.5 * u, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center'}}>{children}</View>
);

export const Setup = ({u, settings, fromSounds, onChange, onSounds, onSave}: Props) => {
  const S = (n: number) => n * u;
  const T = text(u);
  const steps = settings.steps;
  const setStep = (kind: StepKind, patch: Partial<{minutes: number; on: boolean}>) => onChange({steps: steps.map(x => (x.kind === kind ? {...x, ...patch} : x))});
  const missing = EXTRA.filter(k => !steps.some(x => x.kind === k));
  const add = () => {
    // a new step goes before the story, where the getting-ready steps live
    const at = Math.max(0, steps.findIndex(x => x.kind === 'story'));
    const k = missing[0];
    const next = [...steps];
    next.splice(at, 0, {kind: k, minutes: Math.min(2, STEP[k].max), on: true});
    onChange({steps: next});
  };
  const speedAt = Math.max(0, CANDLE_SPEEDS.findIndex(c => c.seconds === settings.candleSeconds));
  const soundIcon = PRESETS.find(p => p.id === settings.preset)?.icon ?? 'sparkle';
  const label = {fontFamily: FONT.body, fontSize: S(15), color: C.ink};

  return (
    <View style={[st.fill, {backgroundColor: C.night}]}>
      <Image source={BEAR_BUNNY} style={[st.abs, {right: S(40), top: S(18), width: S(150), height: S(150)}]} />
      {/* Each column is a focus group: ▶ from a step lands in the right column (where it was last), not on Save. */}
      <TVFocusGuideView autoFocus style={[st.abs, {left: S(44), top: S(34)}]}>
        <Text role="heading" style={T.h2}>
          {"Your family's bedtime"}
        </Text>
        <Text style={[T.body, {color: C.faint, marginTop: S(2)}]}>Every night, the same steps in the same order</Text>
        <View style={{marginTop: S(16), width: S(470)}}>
          {steps.map((x, i) => {
            const m = STEP[x.kind];
            return (
              <View key={x.kind} style={[st.row, {height: S(40), marginBottom: S(5), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, opacity: x.on ? 1 : 0.55}]}>
                <Icon name={m.icon} size={S(22)} ink={C.soft} />
                <Text style={[label, {marginLeft: S(12), flex: 1}]}>{m.setup}</Text>
                <Round u={u} icon="minus" label={`${m.setup}: less time`} onPress={() => setStep(x.kind, {minutes: Math.max(m.min, x.minutes - 1)})} />
                <Text style={[label, {width: S(64), textAlign: 'center'}]}>{x.minutes} min</Text>
                <Round u={u} icon="plus" label={`${m.setup}: more time`} onPress={() => setStep(x.kind, {minutes: Math.min(m.max, x.minutes + 1)})} />
                <View style={{width: S(66), alignItems: 'flex-end'}}>{x.kind !== 'goodnight' && <Toggle u={u} label={`${m.setup} ${x.on ? 'on' : 'off'}`} on={x.on} onChange={v => setStep(x.kind, {on: v})} preferred={i === 0 && !fromSounds} />}</View>
              </View>
            );
          })}
        </View>
        {missing.length > 0 && (
          <View style={{marginTop: S(6)}}>
            <Button u={u} label={`Add a step: ${STEP[missing[0]].setup}`} icon="plus" onPress={add} ghost small />
          </View>
        )}
      </TVFocusGuideView>

      <TVFocusGuideView autoFocus style={[st.abs, {right: S(44), top: S(172), width: S(330)}]}>
        <View style={[st.row, {height: S(46), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, marginBottom: S(8)}]}>
          <Icon name="clock" size={S(20)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), flex: 1}]}>Start routine</Text>
          <Round u={u} icon="minus" label="Start earlier" onPress={() => onChange({start: settings.start - 5})} />
          <View style={{marginHorizontal: S(6)}}>
            <Pill u={u}>
              <Text style={label}>{clock(settings.start)}</Text>
            </Pill>
          </View>
          <Round u={u} icon="plus" label="Start later" onPress={() => onChange({start: settings.start + 5})} />
        </View>
        <View style={[st.row, {height: S(46), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, marginBottom: S(8)}]}>
          <Icon name="sun" size={S(20)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), flex: 1}]}>Ready for bed</Text>
          <Pill u={u}>
            <Text style={label}>{clock(readyAt(settings))}</Text>
          </Pill>
        </View>
        <View style={[st.row, {height: S(46), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, marginBottom: S(8)}]}>
          <Icon name="fire" size={S(20)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), flex: 1}]} numberOfLines={1}>
            Candle
          </Text>
          <Round u={u} icon="minus" label="Candle burns longer" onPress={() => onChange({candleSeconds: CANDLE_SPEEDS[Math.max(0, speedAt - 1)].seconds})} />
          <View style={{marginHorizontal: S(6)}}>
            <Pill u={u}>
              <Text style={[label, {fontSize: S(13)}]}>{CANDLE_SPEEDS[speedAt].label}</Text>
            </Pill>
          </View>
          <Round u={u} icon="plus" label="Candle burns faster" onPress={() => onChange({candleSeconds: CANDLE_SPEEDS[Math.min(CANDLE_SPEEDS.length - 1, speedAt + 1)].seconds})} />
        </View>
        <View style={[st.row, {height: S(46), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, marginBottom: S(8)}]}>
          <Icon name="people" size={S(20)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), flex: 1}]}>Short routine on late nights</Text>
          <Toggle u={u} label="Short routine on late nights" on={settings.short} onChange={v => onChange({short: v})} />
        </View>
        <View style={[st.row, {height: S(46), paddingHorizontal: S(12), borderRadius: S(12), backgroundColor: C.panel, marginBottom: S(16)}]}>
          <Icon name={soundIcon} size={S(20)} ink={C.soft} />
          <Text style={[label, {marginLeft: S(10), flex: 1}]}>{"Tonight's sound"}</Text>
          <Button u={u} label={`${settings.mixName.length > 14 ? settings.mixName.slice(0, 13) + '…' : settings.mixName}  ›`} onPress={onSounds} ghost small preferred={fromSounds} />
        </View>
        <Button u={u} label="Save routine" icon="check" onPress={onSave} />
      </TVFocusGuideView>
    </View>
  );
};
