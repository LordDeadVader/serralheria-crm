import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const getPrompt = () => (window as unknown as { __installPrompt?: InstallEvent }).__installPrompt;

/** Estado da instalação do CRM como aplicativo (PWA). */
export function useInstall() {
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [canPrompt, setCanPrompt] = useState(!!getPrompt());
  const [installed, setInstalled] = useState(standalone);

  useEffect(() => {
    const on = () => setCanPrompt(!!getPrompt());
    const done = () => setInstalled(true);
    window.addEventListener('installprompt', on);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('installprompt', on);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  async function install() {
    const p = getPrompt();
    if (!p) return false;
    await p.prompt();
    const r = await p.userChoice;
    (window as unknown as { __installPrompt?: InstallEvent }).__installPrompt = undefined;
    setCanPrompt(false);
    if (r.outcome === 'accepted') setInstalled(true);
    return r.outcome === 'accepted';
  }

  return { installed, canPrompt, ios: ios && !installed, install };
}
