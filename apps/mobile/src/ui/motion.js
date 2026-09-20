import React, { useEffect } from 'react';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default Animated;

export function enterDown(delay = 0, duration = 420) {
  return FadeInDown.delay(delay)
    .duration(duration)
    .easing(Easing.out(Easing.cubic));
}

export function enterFade(delay = 0, duration = 380) {
  return FadeIn.delay(delay).duration(duration);
}

export function listEnter(index, step = 45, cap = 10) {
  return enterDown(step * Math.min(index, cap), 380);
}

export function PulseGlow({
  style,
  fromScale = 1,
  toScale = 1.07,
  fromOpacity = 0.1,
  toOpacity = 0.18,
  duration = 1800,
}) {
  const scale = useSharedValue(fromScale);
  const opacity = useSharedValue(fromOpacity);

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    scale.value = withRepeat(
      withSequence(
        withTiming(toScale, { duration, easing: ease }),
        withTiming(fromScale, { duration, easing: ease })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(toOpacity, { duration, easing: ease }),
        withTiming(fromOpacity, { duration, easing: ease })
      ),
      -1,
      false
    );
  }, [duration, fromOpacity, fromScale, opacity, scale, toOpacity, toScale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View pointerEvents="none" style={[style, animStyle]} />;
}
