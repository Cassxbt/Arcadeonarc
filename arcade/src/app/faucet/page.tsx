'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Droplets, ChevronDown, Check, AlertCircle, ExternalLink } from '@/components/icons';
import styles from './page.module.css';

interface FaucetChain {
    id: string;
    name: string;
    logo: string;
    explorer: string;
}

const FAUCET_CHAINS: FaucetChain[] = [
    { id: 'ARC-TESTNET', name: 'Arc Testnet', logo: '/chains/arc.svg', explorer: 'https://testnet.arcscan.app' },
    { id: 'ETH-SEPOLIA', name: 'Ethereum Sepolia', logo: '/chains/ethereum.svg', explorer: 'https://sepolia.etherscan.io' },
    { id: 'BASE-SEPOLIA', name: 'Base Sepolia', logo: '/chains/base.svg', explorer: 'https://sepolia.basescan.org' },
    { id: 'ARB-SEPOLIA', name: 'Arbitrum Sepolia', logo: '/chains/arbitrum.svg', explorer: 'https://sepolia.arbiscan.io' },
    { id: 'OP-SEPOLIA', name: 'OP Sepolia', logo: '/chains/optimism.svg', explorer: 'https://sepolia-optimism.etherscan.io' },
    { id: 'AVAX-FUJI', name: 'Avalanche Fuji', logo: '/chains/avalanche.svg', explorer: 'https://testnet.snowtrace.io' },
];

type FaucetStatus = 'idle' | 'loading' | 'success' | 'error';

export default function FaucetPage() {
    const { primaryWallet } = useDynamicContext();
    const [selectedChain, setSelectedChain] = useState<FaucetChain>(FAUCET_CHAINS[0]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [status, setStatus] = useState<FaucetStatus>('idle');
    const [message, setMessage] = useState('');

    const walletAddress = primaryWallet?.address;

    const handleChainSelect = (chain: FaucetChain) => {
        setSelectedChain(chain);
        setIsDropdownOpen(false);
        setStatus('idle');
        setMessage('');
    };

    const handleRequest = async () => {
        if (!walletAddress) {
            setStatus('error');
            setMessage('Please connect your wallet first');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch('/api/faucet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: walletAddress,
                    blockchain: selectedChain.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setStatus('error');
                setMessage(data.error || 'Request failed');
                return;
            }

            setStatus('success');
            setMessage('10 USDC sent to your wallet!');
        } catch {
            setStatus('error');
            setMessage('Network error. Please try again.');
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest(`.${styles.chainSelector}`)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={styles.container}>
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className={styles.header}>
                    <div className={styles.iconWrapper}>
                        <Droplets size={32} />
                    </div>
                    <h1 className={styles.title}>USDC Faucet</h1>
                    <p className={styles.subtitle}>Get testnet USDC to play ARCade games</p>
                </div>

                <div className={styles.chainSelector}>
                    <label className={styles.label}>Select Network</label>
                    <button
                        className={styles.chainButton}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={status === 'loading'}
                    >
                        <div className={styles.chainInfo}>
                            <img src={selectedChain.logo} alt={selectedChain.name} className={styles.chainIcon} />
                            <span className={styles.chainName}>{selectedChain.name}</span>
                        </div>
                        <motion.div animate={{ rotate: isDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={20} />
                        </motion.div>
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
                                {FAUCET_CHAINS.map((chain) => (
                                    <button
                                        key={chain.id}
                                        className={`${styles.dropdownItem} ${selectedChain.id === chain.id ? styles.selected : ''}`}
                                        onClick={() => handleChainSelect(chain)}
                                    >
                                        <img src={chain.logo} alt={chain.name} className={styles.chainIcon} />
                                        <span className={styles.chainName}>{chain.name}</span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className={styles.walletInfo}>
                    <label className={styles.label}>Your Wallet</label>
                    <div className={styles.addressBox}>
                        {walletAddress ? (
                            <span className={styles.address}>
                                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            </span>
                        ) : (
                            <span className={styles.noWallet}>Connect wallet to continue</span>
                        )}
                    </div>
                </div>

                <div className={styles.amountBox}>
                    <span className={styles.amountLabel}>You will receive</span>
                    <span className={styles.amount}>10 USDC</span>
                </div>

                <AnimatePresence mode="wait">
                    {status === 'success' && (
                        <motion.div
                            className={styles.successMessage}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Check size={20} />
                            <span>{message}</span>
                            <a
                                href={`${selectedChain.explorer}/address/${walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.explorerLink}
                            >
                                View on Explorer <ExternalLink size={14} />
                            </a>
                        </motion.div>
                    )}
                    {status === 'error' && (
                        <motion.div
                            className={styles.errorMessage}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <AlertCircle size={20} />
                            <span>{message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    className={styles.requestBtn}
                    onClick={handleRequest}
                    disabled={!walletAddress || status === 'loading'}
                >
                    {status === 'loading' ? (
                        <span className={styles.loadingText}>Requesting...</span>
                    ) : (
                        'Request USDC'
                    )}
                </button>

                <p className={styles.note}>
                    Limit: 1 request per network every 24 hours
                </p>
            </motion.div>
        </div>
    );
}
