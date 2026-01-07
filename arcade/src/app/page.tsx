'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TowerControl,
  Dice6,
  Rocket,
  Zap,
  Target,
  DollarSign,
  Lock,
  Twitter,
  MessageCircle,
  Play,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Wallet,
  CircleDashed,
  FerrisWheel,
  Grid3x3,
} from '@/components/icons';
import { GameSelector } from '@/components/GameSelector';
import { GameCarousel } from '@/components/GameCarousel';
import { useStats } from '@/lib/useStats';
import styles from './page.module.css';

const games = [
  {
    id: 'tower',
    name: 'Tower',
    icon: TowerControl,
    iconColor: '#05d9e8',
    description: 'Pick the safe tile to climb. One wrong move and you lose it all!',
    multiplier: 'Up to 109x',
    color: '#05d9e8',
  },
  {
    id: 'dice',
    name: 'Dice',
    icon: Dice6,
    iconColor: '#39ff14',
    description: 'Set your target, roll the dice. Higher risk = higher reward.',
    multiplier: 'Up to 99x',
    color: '#39ff14',
  },
  {
    id: 'crash',
    name: 'Cannon',
    icon: Rocket,
    iconColor: '#ff6b00',
    description: 'Watch the multiplier rise. Cash out before the BOOM!',
    multiplier: 'Unlimited',
    color: '#ff6b00',
  },
  {
    id: 'wheel',
    name: 'Wheel',
    icon: FerrisWheel,
    iconColor: '#9d4edd',
    description: 'Spin the wheel and land on multipliers up to 5x!',
    multiplier: 'Up to 5x',
    color: '#9d4edd',
  },
  {
    id: 'laser',
    name: 'Gridy Laser',
    icon: Grid3x3,
    iconColor: '#ff2a6d',
    description: 'Dodge lasers on a 10×10 grid. Survive for massive multipliers!',
    multiplier: 'Up to 95x',
    color: '#ff2a6d',
  },
];

export default function Home() {
  const [showGameSelector, setShowGameSelector] = useState(false);
  const stats = useStats();

  const handleStartPlaying = () => {
    setShowGameSelector(true);
  };

  return (
    <div className={styles.container}>
      {/* Game Selector Animation Overlay */}
      {showGameSelector && (
        <GameSelector onClose={() => setShowGameSelector(false)} />
      )}

      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={styles.arcadeTitle}>ARCADE</h1>
        <h2 className={styles.title}>
          Play. Win. <span className={styles.highlight}>Earn USDC.</span>
        </h2>
        <p className={styles.subtitle}>
          Fast, fair, and fun crypto gaming on Arc L1
        </p>
        <div className={styles.heroButtons}>
          <button onClick={handleStartPlaying} className={styles.primaryBtn}>
            <Play size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Start Playing
          </button>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryBtn}
          >
            <Wallet size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Get Test USDC
          </a>
        </div>
      </section>

      {/* Games Carousel */}
      <section className={styles.gamesSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.selectorArrowLeft}>
            <ChevronRight size={24} />
          </span>
          Select Your Game
          <span className={styles.selectorArrowRight}>
            <ChevronLeft size={24} />
          </span>
        </h2>
        <GameCarousel games={games} />
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <Zap size={36} style={{ color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 12px var(--neon-yellow))' }} />
          </div>
          <h3>Instant Payouts</h3>
          <p>Win and withdraw immediately. No waiting.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <Target size={36} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 12px var(--neon-pink))' }} />
          </div>
          <h3>Provably Fair</h3>
          <p>Every outcome is verifiable on-chain.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <DollarSign size={36} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 12px var(--neon-green))' }} />
          </div>
          <h3>USDC Native</h3>
          <p>No volatile tokens. Play with stablecoins.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>
            <Lock size={36} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 12px var(--neon-cyan))' }} />
          </div>
          <h3>Secure</h3>
          <p>Smart contracts audited and battle-tested.</p>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>${stats.totalUsdcWon.toLocaleString()}</div>
          <div className={styles.statLabel}>Total Won</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.totalGamesPlayed.toLocaleString()}</div>
          <div className={styles.statLabel}>Games Played</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.mostPreferredGame?.game || '-'}</div>
          <div className={styles.statLabel}>Most Played</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>${stats.biggestWin?.amount.toLocaleString() || '0'}</div>
          <div className={styles.statLabel}>Biggest Win</div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="https://twitter.com/ArcadeOnArc" target="_blank" rel="noopener noreferrer">
            <Twitter size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Twitter
          </a>
          <a href="https://discord.com/invite/arcnetwork" target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Discord
          </a>
        </div>
        <p>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc L1</a> by Circle</p>
        <p className={styles.disclaimer}>
          Demo mode available • Play responsibly • 18+ only
        </p>
      </footer>
    </div>
  );
}
