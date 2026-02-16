'use client';

import { useState, useEffect } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { Lock } from 'lucide-react';

const SESSION_KEY = 'kvideo-settings-unlocked';

export function SettingsPasswordGate({ children }: { children: React.ReactNode }) {
    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [hasEnvSettingsPassword, setHasEnvSettingsPassword] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            const settings = settingsStore.getSettings();
            const sessionUnlocked = sessionStorage.getItem(SESSION_KEY) === 'true';

            const isProtected = (settings.settingsPasswordEnabled && settings.settingsPasswords.length > 0);
            const localLocked = isProtected && !sessionUnlocked;

            if (mounted) {
                setIsLocked(localLocked);
                setIsClient(true);
            }

            // Fetch remote config for env settings password
            try {
                const res = await fetch('/api/config');
                if (!res.ok) throw new Error('Failed to fetch config');
                const data = await res.json();

                if (mounted) {
                    setHasEnvSettingsPassword(data.hasEnvSettingsPassword);

                    const isProtectedNow = (settings.settingsPasswordEnabled && settings.settingsPasswords.length > 0) || data.hasEnvSettingsPassword;
                    setIsLocked(isProtectedNow && !sessionUnlocked);
                }
            } catch (e) {
                console.error('SettingsPasswordGate init failed:', e);
            }
        };

        init();

        return () => { mounted = false; };
    }, []);

    // Subscribe to settings changes (auto-unlock if all passwords removed)
    useEffect(() => {
        const handleSettingsUpdate = () => {
            const settings = settingsStore.getSettings();
            const sessionUnlocked = sessionStorage.getItem(SESSION_KEY) === 'true';
            const isProtected = (settings.settingsPasswordEnabled && settings.settingsPasswords.length > 0) || hasEnvSettingsPassword;

            if (!isProtected) {
                setIsLocked(false);
            } else if (!sessionUnlocked) {
                setIsLocked(true);
            }
        };

        const unsubscribe = settingsStore.subscribe(handleSettingsUpdate);
        return () => unsubscribe();
    }, [hasEnvSettingsPassword]);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsValidating(true);

        const settings = settingsStore.getSettings();

        const setUnlocked = () => {
            sessionStorage.setItem(SESSION_KEY, 'true');
            setIsLocked(false);
            setError(false);
            setIsValidating(false);
        };

        // Check local settings passwords first
        if (settings.settingsPasswords.includes(password)) {
            setUnlocked();
            return;
        }

        // Then check env password via API
        if (hasEnvSettingsPassword) {
            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, type: 'settings' }),
                });
                const data = await res.json();
                if (data.valid) {
                    setUnlocked();
                    return;
                }
            } catch {
                // API error
            }
        }

        // Password didn't match
        setError(true);
        setIsValidating(false);
        const form = document.getElementById('settings-password-form');
        form?.classList.add('animate-shake');
        setTimeout(() => form?.classList.remove('animate-shake'), 500);
    };

    if (!isClient) return null;

    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] bg-[image:var(--bg-image)] text-[var(--text-color)]">
            <div className="w-full max-w-md p-4">
                <form
                    id="settings-password-form"
                    onSubmit={handleUnlock}
                    className="bg-[var(--glass-bg)] backdrop-blur-[25px] saturate-[180%] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-md)] flex flex-col items-center gap-6 transition-all duration-[0.4s] cubic-bezier(0.2,0.8,0.2,1)"
                >
                    <div className="w-16 h-16 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] mb-2 shadow-[var(--shadow-sm)] border border-[var(--glass-border)]">
                        <Lock size={32} />
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">设置已锁定</h2>
                        <p className="text-[var(--text-color-secondary)]">请输入设置密码以继续</p>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(false);
                                }}
                                placeholder="输入密码..."
                                className={`w-full px-4 py-3 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border ${error ? 'border-red-500' : 'border-[var(--glass-border)]'
                                    } focus:outline-none focus:border-[var(--accent-color)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] transition-all duration-[0.4s] cubic-bezier(0.2,0.8,0.2,1) text-[var(--text-color)] placeholder-[var(--text-color-secondary)]`}
                                autoFocus
                            />
                            {error && (
                                <p className="text-sm text-red-500 text-center animate-pulse">
                                    密码错误
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 px-4 bg-[var(--accent-color)] text-white font-bold rounded-[var(--radius-2xl)] hover:translate-y-[-2px] hover:brightness-110 shadow-[var(--shadow-sm)] hover:shadow-[0_4px_8px_var(--shadow-color)] active:translate-y-0 active:scale-[0.98] transition-all duration-200"
                        >
                            解锁设置
                        </button>
                    </div>
                </form>
            </div>
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
        </div>
    );
}
