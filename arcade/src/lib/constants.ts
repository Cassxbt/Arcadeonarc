import { defineChain } from 'viem';

// Arc L1 Testnet Chain Configuration
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Contract Addresses (Arc Testnet - Deployed Dec 30, 2025)
export const CONTRACTS = {
  USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`,
  ARCADE_VAULT: '0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95' as `0x${string}`,
  TOWER_GAME: '0x7d1F094C8B48cBb7E9a017059eeC5a33eD4c243f' as `0x${string}`,
  DICE_GAME: '0xB91ddfe1567c38B259f417604755Dc58cdf73f0C' as `0x${string}`,
  CANNON_CRASH: '0x09e1bC3c33aa0A7e0a68cec3c00C44FD4E2dd5Db' as `0x${string}`,
};

// Game Configuration
export const GAME_CONFIG = {
  // Bet limits (in USDC, 6 decimals)
  MIN_BET: 0.5,   // $0.50
  MAX_BET: 100,   // $100

  // House edge
  HOUSE_EDGE: 0.10, // 10%

  // Tower game
  TOWER_ROWS: 20,
  TOWER_PATTERN: [7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4], // Tiles per row

  // Quick bet amounts
  QUICK_BETS: [1, 5, 10, 25, 50, 100],
};

// Dynamic SDK Environment ID (Live) - This is PUBLIC and safe to expose
// Note: This is NOT the API Token (which starts with dyn_) - API Tokens are secret
export const DYNAMIC_ENVIRONMENT_ID = 'a3744fd0-3794-4b60-a36a-57dbdbda6855';

// API Endpoints
export const API_ENDPOINTS = {
  FAUCET: 'https://faucet.circle.com',
  EXPLORER: 'https://testnet.arcscan.app',
};

// Animation durations (ms)
export const ANIMATION = {
  TILE_REVEAL: 300,
  CANNON_FIRE: 500,
  DICE_ROLL: 1500,
  CASH_OUT: 400,
  WIN_CELEBRATION: 2000,
};

// Sound effects paths
export const SOUNDS = {
  CLICK: '/sounds/click.mp3',
  WIN: '/sounds/win.mp3',
  LOSE: '/sounds/lose.mp3',
  DICE_ROLL: '/sounds/dice-roll.mp3',
  EXPLOSION: '/sounds/explosion.mp3',
  CASH_OUT: '/sounds/cash-out.mp3',
  // New sounds
  COIN_DEPOSIT: '/sounds/coin deposit.mp3',
  COIN_WITHDRAW: '/sounds/coin withdraw.mp3',
  CHIME: '/sounds/chime.mp3',
  SLOT_MACHINE: '/sounds/slot machine.mp3',
};
