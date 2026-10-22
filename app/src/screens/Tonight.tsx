import React from 'react';
import {Text, View} from 'react-native';
import {Button, st, text, Trail, TrailItem} from '../ui/kit';

// 01 / Tonight: what's on the TV at bedtime. One big button; the evening's steps as pictures.
export const Tonight = ({u, minutes, short, trail, onStart, onGrownUps}: {u: number; minutes: number; short: boolean; trail: TrailItem[]; onStart: () => void; onGrownUps: () => void}) => {
  const S = (n: number) => n * u;
  const T = text(u);
  return (
    <View style={st.fill}>
      <View style={[st.abs, {left: S(56), top: S(44)}]}>
        <Text role="heading" style={[T.h2, {fontSize: S(28)}]}>
          Goodnight
        </Text>
        <Text style={[T.sub, {fontSize: S(15), marginTop: S(2)}]}>
          Tonight · {minutes} minutes{short ? ' · a short one' : ''}
        </Text>
        <Text style={[T.title, {marginTop: S(40)}]}>{"Let's get\nready for bed."}</Text>
        <View style={{marginTop: S(30)}}>
          <Button u={u} label="Start bedtime" icon="play" onPress={onStart} preferred />
        </View>
      </View>
      <View style={[st.abs, {left: S(56), bottom: S(40)}]}>
        <Button u={u} label="Grown-ups" icon="people" onPress={onGrownUps} ghost small />
      </View>
      <View style={[st.abs, {right: S(40), bottom: S(30)}]}>
        <Trail u={u} items={trail} />
      </View>
    </View>
  );
};
