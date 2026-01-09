'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, ChevronDown, Plus, ArrowUpRight } from 'lucide-react';
import styles from './Navbar.module.css';

interface CashierWidgetProps {
    balance: number;
    onDeposit: () => void;
    onWithdraw: () => void;
}

export function CashierWidget({ balance, onDeposit, onWithdraw }: CashierWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={styles.cashierWidget} ref={containerRef}>
            <button
                className={styles.cashierTrigger}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.cashierIcon}>
                    <DollarSign size={16} color="var(--neon-green)" />
                </div>
                <span className={styles.cashierLabel}>Cashier</span>
                <ChevronDown size={14} className={isOpen ? styles.rotate180 : ''} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={styles.cashierDropdown}
                    >
                        <div className={styles.dropdownBalance}>
                            <span className={styles.dropdownLabel}>Current Balance</span>
                            <span className={styles.dropdownValue}>${balance.toFixed(2)}</span>
                        </div>

                        <div className={styles.dropdownActions}>
                            <button
                                onClick={() => { onDeposit(); setIsOpen(false); }}
                                className={styles.dropdownBtnPrimary}
                            >
                                <Plus size={16} />
                                Deposit
                            </button>
                            <button
                                onClick={() => { onWithdraw(); setIsOpen(false); }}
                                className={styles.dropdownBtnSecondary}
                            >
                                <ArrowUpRight size={16} />
                                Withdraw
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
