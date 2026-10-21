import { useSyncExternalStore } from 'react'
import { getLanguage, subscribeLanguage } from '../i18n/runtime'
/** Changer de langue ne remonte ni le document Yjs ni le canevas. */
export function useLanguage() { return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage) }
