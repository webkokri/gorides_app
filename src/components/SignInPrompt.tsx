import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { Btn, T } from './ui';
import { C } from '../theme';

/** Shown instead of account screens when nobody is signed in. */
export function SignInPrompt({ title = 'Sign in to GORIDES', body = 'Log in or create an account to book seats, publish rides and message your driver.' }: { title?: string; body?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <Logo size={72} />
      <T w="display" size={28} style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T color={C.muted} style={{ textAlign: 'center' }}>
        {body}
      </T>
      <Btn label="Log in" onPress={() => router.push({ pathname: '/signin', params: { mode: 'in' } })} style={{ alignSelf: 'stretch' }} />
      <Btn label="Create an account" kind="out" onPress={() => router.push({ pathname: '/signin', params: { mode: 'up' } })} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
