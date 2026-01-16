'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useBridge, type BridgeStep } from '@/lib/useBridge';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { SOURCE_CHAINS, type SourceChainConfig } from '@/lib/cctp-config';
import styles from './BridgeModal.module.css';

interface BridgeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ChevronDown = ({ className }: { className?: string }) => (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const SpinnerIcon = () => (
    <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

const BridgeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4v16" />
        <path d="M20 4v16" />
        <path d="M4 8c4 0 4 4 8 4s4-4 8-4" />
        <path d="M4 12c4 0 4 4 8 4s4-4 8-4" />
    </svg>
);

export function BridgeModal({ isOpen, onClose, onSuccess }: BridgeModalProps) {
    const { primaryWallet } = useDynamicContext();
    const { syncBalanceAfterDeposit } = useGame();
    const { playSound } = useSound();
    const {
        bridge,
        getSourceBalance,
        isLoading,
        error,
        currentStep,
        completedSteps,
        sourceChains,
    } = useBridge();

    const [selectedChain, setSelectedChain] = useState<SourceChainConfig | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [sourceBalance, setSourceBalance] = useState(0);
    const [isFetchingBalance, setIsFetchingBalance] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && sourceChains.length > 0 && !selectedChain) {
            setSelectedChain(sourceChains[0]);
        }
    }, [isOpen, sourceChains, selectedChain]);

    useEffect(() => {
        if (!selectedChain || !primaryWallet?.address) return;

        const fetchBalance = async () => {
            setIsFetchingBalance(true);
            const balance = await getSourceBalance(selectedChain.id);
            setSourceBalance(balance);
            setIsFetchingBalance(false);
        };

        fetchBalance();
    }, [selectedChain, primaryWallet?.address, getSourceBalance]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (currentStep === 'complete') {
            playSound('COIN_DEPOSIT');
            setTimeout(async () => {
                await syncBalanceAfterDeposit();
                onSuccess();
            }, 1500);
        }
    }, [currentStep, playSound, syncBalanceAfterDeposit, onSuccess]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChain || !amount || isLoading) return;

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) return;
        if (amountNum > sourceBalance) return;

        await bridge(selectedChain.id, amount);
    };

    const handleChainSelect = (chain: SourceChainConfig) => {
        setSelectedChain(chain);
        setIsDropdownOpen(false);
        setAmount('');
    };

    if (!isOpen) return null;

    const isInProgress = currentStep === 'bridging';

    return (
        <AnimatePresence>
            <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={isInProgress ? undefined : onClose}
            >
                <motion.div
                    className={styles.modal}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        disabled={isInProgress}
                    >
                        ×
                    </button>

                    <h2 className={styles.title}>
                        <span className={styles.bridgeIcon}><BridgeIcon /></span>
                        Bridge USDC
                    </h2>

                    <p className={styles.subtitle}>
                        Transfer USDC from another chain to Arc Testnet
                    </p>

                    <div className={styles.chainSelector} ref={dropdownRef}>
                        <label className={styles.label}>From Chain</label>
                        <button
                            className={styles.chainButton}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            disabled={isLoading}
                        >
                            {selectedChain ? (
                                <>
                                    <div className={styles.chainInfo}>
                                        <img
                                            src={selectedChain.logo}
                                            alt={selectedChain.name}
                                            className={styles.chainIcon}
                                        />
                                        <span className={styles.chainName}>{selectedChain.name}</span>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className={styles.chevron} />
                                    </motion.div>
                                </>
                            ) : (
                                <span className={styles.placeholder}>Select chain</span>
                            )}
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    className={styles.dropdown}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {sourceChains.map((chain) => (
                                        <button
                                            key={chain.id}
                                            className={`${styles.dropdownItem} ${selectedChain?.id === chain.id ? styles.selected : ''}`}
                                            onClick={() => handleChainSelect(chain)}
                                        >
                                            <img
                                                src={chain.logo}
                                                alt={chain.name}
                                                className={styles.chainIcon}
                                            />
                                            <span className={styles.chainName}>{chain.name}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Available Balance</span>
                        <span className={styles.balanceValue}>
                            {isFetchingBalance ? (
                                <SpinnerIcon />
                            ) : (
                                `$${sourceBalance.toFixed(2)}`
                            )}
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <span className={styles.currency}>$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0.5"
                                max={sourceBalance}
                                step="0.01"
                                className={styles.input}
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setAmount(sourceBalance.toString())}
                                className={styles.maxBtn}
                                disabled={isLoading || sourceBalance === 0}
                            >
                                MAX
                            </button>
                        </div>

                        <div className={styles.quickAmounts}>
                            {[5, 10, 25, 50].map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setAmount(amt.toString())}
                                    className={styles.quickBtn}
                                    disabled={amt > sourceBalance || isLoading}
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>

                        {(isInProgress || completedSteps.length > 0) && (
                            <motion.div
                                className={styles.stepsContainer}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.3 }}
                            >
                                {isInProgress && completedSteps.length === 0 && (
                                    <div className={`${styles.step} ${styles.stepActive}`}>
                                        <div className={styles.stepIndicator}>
                                            <SpinnerIcon />
                                        </div>
                                        <div className={styles.stepContent}>
                                            <span className={styles.stepName}>Processing bridge...</span>
                                        </div>
                                    </div>
                                )}
                                {completedSteps.map((step, index) => (
                                    <div
                                        key={step.name}
                                        className={`${styles.step} ${styles[`step${step.status.charAt(0).toUpperCase() + step.status.slice(1)}`]}`}
                                    >
                                        <div className={styles.stepIndicator}>
                                            {step.status === 'complete' ? (
                                                <CheckIcon />
                                            ) : step.status === 'error' ? (
                                                <span className={styles.stepNumber}>✕</span>
                                            ) : (
                                                <SpinnerIcon />
                                            )}
                                        </div>
                                        <div className={styles.stepContent}>
                                            <span className={styles.stepName}>{step.name}</span>
                                            {step.explorerUrl && (
                                                <a
                                                    href={step.explorerUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.txLink}
                                                >
                                                    View tx <ExternalLinkIcon />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {currentStep === 'complete' && (
                            <motion.div
                                className={styles.successMessage}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <CheckIcon /> Bridge complete! USDC transferred to Arc.
                            </motion.div>
                        )}

                        {error && <p className={styles.error}>{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > sourceBalance}
                            className={styles.submitBtn}
                        >
                            {isLoading ? 'Bridging...' : 'Bridge to Arc'}
                        </button>
                    </form>

                    <p className={styles.note}>
                        Fast Transfer (~30-60s) • Native USDC, no wrapped tokens
                    </p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
