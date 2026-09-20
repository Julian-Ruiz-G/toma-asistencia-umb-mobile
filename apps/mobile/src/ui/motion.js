import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default Animated;

export function enterDown() {
  return undefined;
}

export function enterFade() {
  return undefined;
}

export function listEnter() {
  return undefined;
}

export function PulseGlow({
  style,
  fromScale = 1,
  toScale = 1.05,
  fromOpacity = 0.1,
  toOpacity = 0.18,
  duration = 2000,
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
