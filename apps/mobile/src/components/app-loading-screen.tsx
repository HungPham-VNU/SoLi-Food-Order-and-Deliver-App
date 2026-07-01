import { useEffect } from 'react';
import { StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const LOGO_SOURCE = require('../../assets/images/logo.png');

const SURFACE = '#fcf9f8';
const PRIMARY = '#0d631b';
const SECONDARY = '#58605b';
const OUTLINE = '#707a6c';
const OUTLINE_VARIANT = '#bfcaba';
const SURFACE_CONTAINER_LOWEST = '#ffffff';
const LOADING_TRACK = '#e8f0e9';
const BAR_WIDTH = 200;

export function AppLoadingScreen() {
  const { width } = useWindowDimensions();
  const phase = useSharedValue(0);
  const pulse = useSharedValue(0);
  const logoSize = width >= 768 ? 176 : 128;

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [phase, pulse]);

  const loadingBarStyle = useAnimatedStyle(() => {
    const progress = phase.value;
    const isExpanding = progress <= 0.5;
    const width = isExpanding
      ? BAR_WIDTH * progress * 2
      : BAR_WIDTH * (1 - progress) * 2;
    const translateX = isExpanding ? 0 : BAR_WIDTH * (progress - 0.5) * 2;

    return {
      width,
      transform: [{ translateX }],
    };
  });

  const logoPulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.05,
    transform: [{ scale: 1 + pulse.value * 0.02 }],
  }));

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        backgroundColor: SURFACE,
      }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <View style={{ height: 64 }} />

      <View
        style={{
          flex: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Animated.View
          style={[
            {
              alignItems: 'center',
              gap: 24,
              width: '100%',
              maxWidth: 384,
            },
            logoPulseStyle,
          ]}
        >
          <View
            style={[
              {
                width: logoSize,
                height: logoSize,
                borderRadius: logoSize / 2,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: OUTLINE_VARIANT,
                backgroundColor: SURFACE_CONTAINER_LOWEST,
                alignItems: 'center',
                justifyContent: 'center',
              },
              { boxShadow: '0 1px 3px rgba(26, 28, 28, 0.08)' } as any,
            ]}
          >
            <Image
              source={LOGO_SOURCE}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              accessibilityLabel="UITFood logo"
            />
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                color: PRIMARY,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                fontSize: 48,
                fontWeight: '700',
                lineHeight: 54,
              }}
            >
              UITFood
            </Text>
            <Text
              style={{
                color: SECONDARY,
                fontFamily: 'Inter_400Regular',
                fontSize: 16,
                lineHeight: 25,
                opacity: 0.8,
                textAlign: 'center',
              }}
            >
              Fresh. Curated. Delivered.
            </Text>
          </View>
        </Animated.View>
      </View>

      <View
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 64,
          gap: 48,
        }}
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: BAR_WIDTH,
              height: 4,
              backgroundColor: LOADING_TRACK,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  backgroundColor: PRIMARY,
                  borderRadius: 999,
                },
                loadingBarStyle,
              ]}
            />
          </View>

          <Text
            style={{
              color: OUTLINE,
              fontFamily: 'Inter_600SemiBold',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 1.4,
              lineHeight: 20,
              opacity: 0.7,
              textTransform: 'uppercase',
            }}
          >
            Loading...
          </Text>
        </View>
      </View>
    </View>
  );
}
