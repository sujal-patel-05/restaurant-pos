import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export function InstallAppButton() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
            setIsInstalled(true);
            return;
        }

        const onBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
    };

    if (isInstalled || !deferredPrompt) {
        return null;
    }

    return (
        <button
            type="button"
            className="btn btn-secondary"
            onClick={handleInstall}
            title="Install POS App"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
        >
            <Download size={15} />
            Install App
        </button>
    );
}

export default InstallAppButton;
