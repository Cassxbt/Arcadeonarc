'use client';

import { useGame } from '@/lib/game-context';
import { UsernameModal } from './UsernameModal';

export function AppWrapper({ children }: { children: React.ReactNode }) {
    const { showUsernameModal, setShowUsernameModal, refetchUser } = useGame();

    const handleUsernameComplete = async () => {
        setShowUsernameModal(false);
        await refetchUser();
    };

    return (
        <>
            {children}
            <UsernameModal
                isOpen={showUsernameModal}
                onComplete={handleUsernameComplete}
            />
        </>
    );
}
