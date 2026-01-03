'use client';

import { DynamicProvider } from '@/lib/dynamic';
import { ThemeProvider } from '@/lib/theme';
import { SoundProvider } from '@/lib/sounds';
import { GameProvider } from '@/lib/game-context';
import { AppWrapper } from '@/components/AppWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <DynamicProvider>
                <SoundProvider>
                    <GameProvider>
                        <AppWrapper>
                            {children}
                        </AppWrapper>
                    </GameProvider>
                </SoundProvider>
            </DynamicProvider>
        </ThemeProvider>
    );
}
