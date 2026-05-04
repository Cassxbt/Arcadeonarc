'use client';

import { useState } from 'react';
import {
    HelpCircle,
    TowerControl,
    Dice6,
    Rocket,
    FerrisWheel,
    Grid3x3,
    ChevronDown,
    Target,
    Zap,
    Lock,
} from '@/components/icons';
import styles from './page.module.css';

interface FAQSection {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

const faqSections: FAQSection[] = [
    {
        id: 'tower',
        title: 'How to Play Tower',
        icon: <TowerControl size={24} style={{ color: 'var(--neon-cyan)' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Objective:</strong> Climb the tower by picking safe tiles. The higher you climb, the bigger the multiplier!</p>
                <h4>How It Works:</h4>
                <ol>
                    <li>Place your bet (0.5 - 100 USDC)</li>
                    <li>Each row has multiple tiles, but one is a death tile</li>
                    <li>Click a tile to reveal if it&apos;s safe or deadly</li>
                    <li>Safe tiles let you climb higher with increasing multipliers</li>
                    <li>Cash out anytime to secure your winnings</li>
                    <li>Hit a death tile and lose your bet!</li>
                </ol>
                <h4>Multiplier Calculation:</h4>
                <p>The multiplier increases based on survival probability. Each row has a different number of tiles (3-7), making some rows riskier than others.</p>
                <p className={styles.formula}>Multiplier = (1 ÷ Cumulative Survival Rate) × 0.9</p>
                <p>The 10% house edge is built into the multiplier calculation.</p>
            </div>
        ),
    },
    {
        id: 'dice',
        title: 'How to Play Dice',
        icon: <Dice6 size={24} style={{ color: 'var(--neon-green)' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Objective:</strong> Predict whether the dice roll will be OVER or UNDER your target number.</p>
                <h4>How It Works:</h4>
                <ol>
                    <li>Place your bet (0.5 - 100 USDC)</li>
                    <li>Set a target number between 2 and 98</li>
                    <li>Choose UNDER or OVER</li>
                    <li>The dice rolls a number from 1-100</li>
                    <li>Win if the result matches your prediction!</li>
                </ol>
                <h4>Multiplier Calculation:</h4>
                <p>Your win chance determines your multiplier. Lower probability = higher payout.</p>
                <p className={styles.formula}>Multiplier = (100 ÷ Win Chance %) × 0.9</p>
                <p><strong>Example:</strong> Target 25, bet UNDER = 24% chance = 3.75x multiplier</p>
            </div>
        ),
    },
    {
        id: 'cannon',
        title: 'How to Play Cannon (Crash)',
        icon: <Rocket size={24} style={{ color: '#ff6b00' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Objective:</strong> Cash out before the cannon explodes! The multiplier rises exponentially — but crash at any moment!</p>
                <h4>How It Works:</h4>
                <ol>
                    <li>Place your bet (0.5 - 100 USDC)</li>
                    <li>Optionally set an auto-cashout multiplier</li>
                    <li>Watch the multiplier climb: 1.00x → 1.50x → 2.00x...</li>
                    <li>Click CASH OUT to secure: bet × current multiplier</li>
                    <li>If it crashes before you cash out, you lose!</li>
                </ol>
                <h4>Crash Probability:</h4>
                <p>The crash point is randomly determined each round. Higher multipliers are exponentially less likely.</p>
                <p className={styles.formula}>~10% crash at 1.00x (instant) | Max payout: 100x</p>
            </div>
        ),
    },
    {
        id: 'wheel',
        title: 'How to Play Wheel',
        icon: <FerrisWheel size={24} style={{ color: 'var(--neon-purple)' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Objective:</strong> Spin the wheel and hope it lands on a high multiplier to win big!</p>
                <h4>How It Works:</h4>
                <ol>
                    <li>Place your bet (0.5 - 100 USDC)</li>
                    <li>Click SPIN to start the wheel</li>
                    <li>The wheel has 20 segments with different multipliers</li>
                    <li>Wait for the wheel to stop on your segment</li>
                    <li>Win instantly if it lands on a multiplier!</li>
                </ol>
                <h4>Segment Distribution:</h4>
                <ul>
                    <li><strong>0x (Loss):</strong> 8 segments (40%)</li>
                    <li><strong>1.5x:</strong> 4 segments (20%)</li>
                    <li><strong>1.8x:</strong> 3 segments (15%)</li>
                    <li><strong>2x:</strong> 2 segments (10%)</li>
                    <li><strong>3x:</strong> 2 segments (10%)</li>
                    <li><strong>5x (Jackpot):</strong> 1 segment (5%)</li>
                </ul>
            </div>
        ),
    },
    {
        id: 'laser',
        title: 'How to Play Gridy Laser',
        icon: <Grid3x3 size={24} style={{ color: 'var(--neon-pink)' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Objective:</strong> Dodge lasers on a shrinking 10×10 grid. Survive as many rounds as possible!</p>
                <h4>How It Works:</h4>
                <ol>
                    <li>Place your bet (0.5 - 100 USDC)</li>
                    <li>Click any cell on the grid to dodge the laser</li>
                    <li>Odd turns destroy a COLUMN, even turns destroy a ROW</li>
                    <li>If your cell is in the destroyed row/column, you lose!</li>
                    <li>Survive to increase your multiplier</li>
                    <li>Cash out anytime after surviving at least one round</li>
                </ol>
                <h4>Multiplier Ladder:</h4>
                <p>The multiplier increases exponentially as you survive more turns:</p>
                <p className={styles.formula}>Turn 1: 1.06x → Turn 10: 3.83x → Turn 18: 95.9x</p>
                <p>The grid shrinks after each attack, making survival progressively riskier!</p>
            </div>
        ),
    },
    {
        id: 'provably-fair',
        title: 'Provably Fair',
        icon: <Target size={24} style={{ color: 'var(--neon-yellow)' }} />,
        content: (
            <div className={styles.faqContent}>
                <p><strong>Every game outcome is verifiable on-chain.</strong></p>
                <h4>How We Ensure Fairness:</h4>
                <ol>
                    <li><strong>Server-Signed Outcomes:</strong> Each game outcome is signed by our server before you make your choice</li>
                    <li><strong>On-Chain Verification:</strong> All bets and payouts are recorded on-chain</li>
                    <li><strong>Immutable Smart Contracts:</strong> Game logic is encoded in audited smart contracts</li>
                    <li><strong>Transparent House Edge:</strong> 10% house edge is openly built into multipliers</li>
                </ol>
                <div className={styles.comingSoon}>
                    <Zap size={20} style={{ color: 'var(--neon-yellow)' }} />
                    <span><strong>Coming Soon:</strong> Chainlink VRF integration for fully decentralized randomness!</span>
                </div>
                <p>Until VRF integration, our server generates random outcomes using a combination of user nonce, block data, and secure server seeds.</p>
            </div>
        ),
    },
    {
        id: 'betting',
        title: 'Betting & Payouts',
        icon: <Zap size={24} style={{ color: 'var(--neon-purple)' }} />,
        content: (
            <div className={styles.faqContent}>
                <h4>Bet Limits:</h4>
                <ul>
                    <li><strong>Minimum Bet:</strong> 0.5 USDC</li>
                    <li><strong>Maximum Bet:</strong> 100 USDC</li>
                    <li><strong>Maximum Payout:</strong> 1,000 USDC per bet</li>
                </ul>
                <h4>House Edge:</h4>
                <p>ARCade operates with a transparent 10% house edge, built into all multiplier calculations.</p>
                <h4>Payouts:</h4>
                <p>All winnings are instantly credited to your vault balance. Withdraw anytime directly to your wallet.</p>
            </div>
        ),
    },
    {
        id: 'security',
        title: 'Security',
        icon: <Lock size={24} style={{ color: 'var(--neon-cyan)' }} />,
        content: (
            <div className={styles.faqContent}>
                <h4>Smart Contract Security:</h4>
                <ul>
                    <li><strong>Reentrancy Protection:</strong> All contracts use OpenZeppelin&apos;s ReentrancyGuard</li>
                    <li><strong>Pausable:</strong> Emergency pause functionality for admin</li>
                    <li><strong>Access Control:</strong> Only authorized game contracts can access the vault</li>
                    <li><strong>Withdrawal Pattern:</strong> Pull over push for safe fund transfers</li>
                </ul>
                <h4>Your Funds:</h4>
                <p>Your USDC is held in the ARCade Vault smart contract. You maintain full custody and can withdraw at any time, even if the platform is paused.</p>
            </div>
        ),
    },
];

export default function FAQPage() {
    const [openSection, setOpenSection] = useState<string | null>('tower');

    const toggleSection = (id: string) => {
        setOpenSection(openSection === id ? null : id);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <HelpCircle size={48} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 20px var(--neon-cyan))' }} />
                <h1 className={styles.title}>FAQ</h1>
                <p className={styles.subtitle}>Learn how to play and win at ARCade</p>
            </div>

            <div className={styles.faqList}>
                {faqSections.map((section) => (
                    <div key={section.id} className={styles.faqItem}>
                        <button
                            className={`${styles.faqHeader} ${openSection === section.id ? styles.faqHeaderOpen : ''}`}
                            onClick={() => toggleSection(section.id)}
                        >
                            <span className={styles.faqIcon}>{section.icon}</span>
                            <span className={styles.faqTitle}>{section.title}</span>
                            <ChevronDown
                                size={24}
                                className={`${styles.chevron} ${openSection === section.id ? styles.chevronOpen : ''}`}
                            />
                        </button>
                        <div className={`${styles.faqBody} ${openSection === section.id ? styles.faqBodyOpen : ''}`}>
                            {section.content}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
