import { router } from 'expo-router';

/** Back that never throws "GO_BACK was not handled": falls back to Home when there is no history (e.g. after a replace). */
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
