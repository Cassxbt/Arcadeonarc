'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useVault } from '@/lib/useVault';
import { useGame } from '@/lib/game-context';
import { useSound } from '@/lib/sounds';
import { CircleDollarSign, Building2, CircleCheck } from './icons';
import styles from './DepositModal.module.css';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'deposit' | 'withdraw';
}

export function DepositModal({ isOpen, onClose, mode }: DepositModalProps) {
    const { primaryWallet } = useDynamicContext();
    const { getVaultBalance, getWalletBalance, deposit, withdraw, isLoading, error } = useVault();
    const { refreshBalance, syncBalanceAfterDeposit, balance: serverBalance } = useGame();
    const { playSound } = useSound();

    const [amount, setAmount] = useState('');
    const [walletBalance, setWalletBalance] = useState(0);
    const [vaultBalance, setVaultBalance] = useState(0);
    const [success, setSuccess] = useState(false);

    // Fetch balances on open
    useEffect(() => {
        if (isOpen && primaryWallet?.address) {
            const fetchBalances = async () => {
                const address = primaryWallet.address as `0x${string}`;
                const [wallet, vault] = await Promise.all([
                    getWalletBalance(address),
                    getVaultBalance(address),
                ]);
                setWalletBalance(wallet);
                setVaultBalance(vault);
            };
            fetchBalances();
        }
    }, [isOpen, primaryWallet?.address, getWalletBalance, getVaultBalance]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) return;

        let result: boolean;
        if (mode === 'deposit') {
            result = await deposit(amountNum);
            if (result) {
                // Sync vault balance to server after successful deposit
                await syncBalanceAfterDeposit();
            }
        } else {
            try {
                const reserveResponse = await fetch('/api/balance/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: primaryWallet?.address,
                        amount: amountNum,
                    }),
                });

                if (!reserveResponse.ok) {
                    const data = await reserveResponse.json();
                    throw new Error(data.error || 'Withdrawal reservation failed');
                }

                result = await withdraw(amountNum);

                await fetch('/api/balance/withdraw', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: primaryWallet?.address,
                        amount: amountNum,
                        action: result ? 'confirm' : 'cancel',
                    }),
                });
            } catch (err) {
                console.error('Withdrawal error:', err);
                result = false;
            }
        }

        if (result) {
            setSuccess(true);
            playSound(mode === 'deposit' ? 'COIN_DEPOSIT' : 'COIN_WITHDRAW');

            // Refresh game context balance
            await refreshBalance();

            // Refresh modal's vault and wallet balances to show updated values
            if (primaryWallet?.address) {
                const address = primaryWallet.address as `0x${string}`;
                const [wallet, vault] = await Promise.all([
                    getWalletBalance(address),
                    getVaultBalance(address),
                ]);
                setWalletBalance(wallet);
                setVaultBalance(vault);
            }

            setTimeout(() => {
                setSuccess(false);
                setAmount('');
                onClose();
            }, 1500);
        }
    };

    const maxAmount = mode === 'deposit' ? walletBalance : vaultBalance;

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>×</button>

                <h2 className={styles.title}>
                    {mode === 'deposit' ? (
                        <>
                            <CircleDollarSign size={28} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-green)' }} />
                            Deposit USDC
                        </>
                    ) : (
                        <>
                            <Building2 size={28} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-cyan)' }} />
                            Withdraw USDC
                        </>
                    )}
                </h2>

                <div className={styles.balances}>
                    <div className={styles.balanceItem}>
                        <span>Wallet Balance</span>
                        <span className={styles.balanceValue}>${walletBalance.toFixed(2)}</span>
                    </div>
                    <div className={styles.balanceItem}>
                        <span>Vault Balance</span>
                        <span className={styles.balanceValue}>${vaultBalance.toFixed(2)}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <span className={styles.currency}>$</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            min="0.5"
                            max={maxAmount}
                            step="0.01"
                            className={styles.input}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setAmount(maxAmount.toString())}
                            className={styles.maxBtn}
                        >
                            MAX
                        </button>
                    </div>

                    <div className={styles.quickAmounts}>
                        {[5, 10, 25, 50].map(amt => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setAmount(amt.toString())}
                                className={styles.quickBtn}
                                disabled={amt > maxAmount}
                            >
                                ${amt}
                            </button>
                        ))}
                    </div>

                    {error && <p className={styles.error}>{error}</p>}
                    {success && (
                        <p className={styles.success}>
                            <CircleCheck size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-green)' }} />
                            Transaction successful!
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !amount || parseFloat(amount) <= 0}
                        className={styles.submitBtn}
                    >
                        {isLoading ? 'Processing...' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
                    </button>
                </form>

                <p className={styles.note}>
                    {mode === 'deposit'
                        ? 'Deposit USDC from your wallet to play games.'
                        : 'Withdraw USDC from your vault to your wallet.'}
                </p>
            </div>
        </div>
    );
}
