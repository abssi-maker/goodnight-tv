import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import {SvgXml} from '@amazon-devices/react-native-svg';
import {TIME_SCALE} from '../config';
import {C} from '../theme';
import {Icon} from '../ui/icons';
import {Button, st, Trail, TrailItem} from '../ui/kit';

// 02 / Guided routine: one real-world step (teeth, pajamas, the big light…). The ring is a gentle
// guide for how long, never a race: when it runs out nothing happens except Bear saying well done.

const ring = (size: number, frac: number, done: boolean) => {
  const r = 44;
  const c = 2 * Math.PI * r;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
<circle cx="50" cy="50" r="${r}" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="5" fill="#0E1430" fill-opacity="0.35"/>
<circle cx="50" cy="50" r="${r}" stroke="#FBD878" stroke-opacity="0.85" stroke-width="5" fill="none" stroke-linecap="round"
  stroke-dasharray="${(done ? c : c * frac).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 50 50)"/>
</svg>`;
};

type Props = {
  u: number;
  title: string;
  sub: string;
  icon: string;
  minutes: number;
  trail: TrailItem[];
  live: boolean; // Bear has said what to do: only then does the ring start (his hello can be long)
  onHalf?: () => void;
  onEnd: () => void;
  onMore: () => void;
  onDone: () => void;
};

export const Step = ({u, title, sub, icon, minutes, trail, live, onHalf, onEnd, onMore, onDone}: Props) => {
  const S = (n: number) => n * u;
  const [total, setTotal] = useState(minutes * 60);
  const [left, setLeft] = useState(minutes * 60);
  const endsAt = useRef(Date.now() + (minutes * 60 * 1000) / TIME_SCALE);
  const fired = useRef({half: false, end: false});
  const shownAt = useRef(Date.now());
  const [pressed, setPressed] = useState(false);
  const cb = useRef({onHalf, onEnd});
  cb.current = {onHalf, onEnd};

  useEffect(() => {
    if (!live) {
      return;
    }
    endsAt.current = Date.now() + (minutes * 60 * 1000) / TIME_SCALE;
    const id = setInterval(() => {
      const l = Math.max(0, ((endsAt.current - Date.now()) / 1000) * TIME_SCALE);
      setLeft(Math.ceil(l));
      if (!fired.current.half && l <= (minutes * 60) / 2 && minutes >= 2) {
        fired.current.half = true;
        cb.current.onHalf?.();
      }
      if (!fired.current.end && l <= 0) {
        fired.current.end = true;
        cb.current.onEnd();
      }
    }, 250);
    return () => clearInterval(id);
  }, [minutes, live]);

  const more = () => {
    const base = Math.max(Date.now(), endsAt.current);
    endsAt.current = base + 60000 / TIME_SCALE;
    setTotal(t => (left <= 0 ? 60 : t + 60));
    fired.current.end = false;
    onMore();
  };

  // The press shows at once (check, full ring) while Bear says well done. One press per step: a second
  // one, or a press carried over from the step before (a double press), is ignored.
  const finish = () => {
    if (pressed || Date.now() - shownAt.current < 1200) {
      return;
    }
    setPressed(true);
    onDone();
  };

  const done = left <= 0 || pressed;
  const size = S(180);
  return (
    <View style={st.fill}>
      {/* No words and no digits: the step is a picture inside a soft ring that empties as the
          minutes pass (the candle shows the evening; this shows the step). Bear says what to do. */}
      <View style={[st.abs, {left: S(64), top: S(96), width: size, height: size}]} accessible role="heading" aria-label={`${title}. ${sub}. ${done ? 'All done.' : `About ${Math.max(1, Math.ceil(left / 60))} minutes.`}`}>
        <SvgXml xml={ring(180, total ? left / total : 0, done)} width={size} height={size} />
        <View style={[st.fill, {alignItems: 'center', justifyContent: 'center'}]}>
          <View style={{width: S(112), height: S(112), borderRadius: S(56), backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center'}}>
            <Icon name={done ? 'check' : icon} size={S(done ? 56 : 74)} ink={C.honeyInk} />
          </View>
        </View>
      </View>

      <View style={[st.abs, st.row, {left: S(56), bottom: S(46)}]}>
        <Button u={u} label="We're done" icon="check" onPress={finish} preferred />
        <View style={{marginLeft: S(16)}}>
          <Button u={u} label="Need more time" onPress={more} ghost />
        </View>
      </View>

      <View style={[st.abs, {right: S(30), top: S(26)}]}>
        <Trail u={u} items={trail} compact />
      </View>
    </View>
  );
};
