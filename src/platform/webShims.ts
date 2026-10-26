// Version web : Alert.alert / Alert.prompt de React Native ne font rien dans un navigateur.
// On les remplace par les boîtes natives du navigateur ; sur mobile ce fichier ne fait rien.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  type Btn = { text?: string; style?: string; onPress?: (value?: string) => void };

  (Alert as any).alert = (title: string, message?: string, buttons?: Btn[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = buttons ?? [];
    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    // Deux boutons ou plus : OK = le bouton d'action, Annuler = le bouton « cancel »
    const cancel = list.find((b) => b.style === 'cancel');
    const action = list.find((b) => b !== cancel) ?? list[list.length - 1];
    if (window.confirm(text)) action.onPress?.();
    else cancel?.onPress?.();
  };

  (Alert as any).prompt = (title: string, message?: string, callbackOrButtons?: any) => {
    const value = window.prompt([title, message].filter(Boolean).join('\n\n'));
    if (value === null) return;
    if (typeof callbackOrButtons === 'function') callbackOrButtons(value);
    else {
      const action = (callbackOrButtons as Btn[] | undefined)?.find((b) => b.style !== 'cancel');
      action?.onPress?.(value);
    }
  };
}
