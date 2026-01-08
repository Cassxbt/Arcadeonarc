'use client';

import { DynamicProvider } from '@/lib/dynamic';
import { ThemeProvider } from '@/lib/theme';
import { SoundProvider } from '@/lib/sounds';
import { GameProvider } from '@/lib/game-context';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';
import { AppWrapper } from '@/components/AppWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <DynamicProvider>
                <AuthProvider>
                    <SoundProvider>
                        <GameProvider>
                            <ToastProvider>
                                <AppWrapper>
                                    {children}
                                </AppWrapper>
                            </ToastProvider>
                        </GameProvider>
                    </SoundProvider>
                </AuthProvider>
            </DynamicProvider>
        </ThemeProvider>
    );
}


