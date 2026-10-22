import React from 'react';
import {Pressable, View} from 'react-native';
import {Button, st} from '../ui/kit';

// 04 / Goodnight, in the candle-lit room. No words on screen: Bear leads three candle breaths
// ("smell the flower… and blow"), then the child presses OK to blow the candle out. If nobody presses
// (already asleep), it goes out by itself. Then black, and only tonight's sound.
type Props = {u: number; mode: 'blow' | 'press' | 'dark'; label: string; onBlow: () => void; onWake: () => void};

export const Goodnight = ({u, mode, label, onBlow, onWake}: Props) => {
  if (mode === 'press') {
    return (
      <View style={[st.abs, {left: 56 * u, bottom: 56 * u}]}>
        <Button u={u} label="Blow out the candle" icon="fire" onPress={onBlow} preferred />
      </View>
    );
  }
  if (mode === 'dark') {
    // the whole dark screen is one quiet button: OK wakes it back to Tonight
    return (
      <Pressable hasTVPreferredFocus onPress={onWake} aria-label={label} style={[st.fill, {backgroundColor: 'transparent'}]}>
        <View />
      </Pressable>
    );
  }
  return null;
};
