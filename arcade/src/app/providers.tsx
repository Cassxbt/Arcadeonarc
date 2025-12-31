'use client';

import { DynamicProvider } from '@/lib/dynamic';
import { ThemeProvider } from '@/lib/theme';
import { SoundProvider } from '@/lib/sounds';
import { GameProvider } from '@/lib/game-context';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <DynamicProvider>
                <SoundProvider>
                    <GameProvider>
                        {children}
                    </GameProvider>
                </SoundProvider>
            </DynamicProvider>
        </ThemeProvider>
    );
}
