import React from 'react';
import {Text, View} from 'react-native';
import {Button, st, text} from '../ui/kit';

// 03 / Story time. Intro: tonight's story or the family's favorite. Reading: only Bear's voice, no
// words on screen (the child listens, eyes getting heavy). Between chapters the child turns the page.
export type StoryMode = 'intro' | 'reading' | 'page';

type Props = {
  u: number;
  mode: StoryMode;
  eyebrow: string;
  title: string;
  swapLabel: string;
  onPlay: () => void;
  onSwap: () => void;
  onTurn: () => void;
};

export const StoryTime = ({u, mode, eyebrow, title, swapLabel, onPlay, onSwap, onTurn}: Props) => {
  const S = (n: number) => n * u;
  const T = text(u);
  if (mode === 'intro') {
    return (
      <View style={st.fill}>
        <View style={[st.abs, {left: S(56), top: S(56), width: S(400)}]}>
          <Text style={[T.sub, {fontSize: S(16)}]}>{eyebrow}</Text>
          <Text role="heading" style={[T.title, {marginTop: S(8)}]}>
            {title}
          </Text>
          <View style={{marginTop: S(30)}}>
            <Button u={u} label="Play story" icon="play" onPress={onPlay} preferred />
          </View>
          <View style={{marginTop: S(18)}}>
            <Button u={u} label={swapLabel} icon="book" onPress={onSwap} ghost small />
          </View>
        </View>
      </View>
    );
  }

  // Reading: nothing to read. Bear's voice tells the story; the room falls asleep around it.
  return (
    <View style={st.fill}>
      {mode === 'page' && (
        <View style={[st.abs, {left: S(56), bottom: S(56)}]}>
          <Button u={u} label="Turn the page" icon="page" onPress={onTurn} preferred />
        </View>
      )}
    </View>
  );
};
