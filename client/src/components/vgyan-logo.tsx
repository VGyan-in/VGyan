import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface VGyanLogoProps {
  width?: number;
  height?: number;
}

export function VGyanLogo({ width = 160, height = 110 }: VGyanLogoProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/vgyan_logo.png')}
        style={{
          width,
          height,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
