import { parseAbi } from 'viem';

// ARCadeVault ABI (minimal for frontend interactions)
export const VAULT_ABI = parseAbi([
    // Read functions
    'function balances(address user) view returns (uint256)',
    'function getBalance(address user) view returns (uint256)',
    'function totalDeposited() view returns (uint256)',
    'function houseBalance() view returns (uint256)',
    'function getVaultStats() view returns (uint256 totalDeposited, uint256 houseBalance, uint256 vaultBalance)',
    'function userNonces(address user) view returns (uint256)',

    // Write functions
    'function deposit(uint256 amount)',
    'function withdraw(uint256 amount)',
    'function emergencyWithdraw()',

    // Events
    'event Deposited(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount)',
    'event BetPlaced(address indexed user, address indexed game, uint256 amount)',
    'event BetSettled(address indexed user, address indexed game, uint256 payout, bool won)',
]);

// TowerGame ABI
export const TOWER_ABI = parseAbi([
    // Read
    'function getGameState(address player) view returns (bool active, uint256 betAmount, uint8 currentRow, uint256 currentMultiplier)',
    'function getMultiplier(uint8 row) view returns (uint256)',
    'function TOWER_ROWS() view returns (uint256)',

    // Write
    'function startGame(uint256 betAmount)',
    'function revealTile(uint8 row, uint8 tile, uint8 deathTile, bytes signature)',
    'function cashOut()',

    // Events
    'event GameStarted(address indexed player, uint256 betAmount, uint256 nonce)',
    'event TileRevealed(address indexed player, uint8 row, uint8 tile, bool safe)',
    'event GameCashedOut(address indexed player, uint8 row, uint256 multiplier, uint256 payout)',
    'event GameLost(address indexed player, uint8 row)',
]);

// DiceGame ABI
export const DICE_ABI = parseAbi([
    // Read
    'function calculatePayout(uint256 betAmount, uint8 target, bool betUnder) view returns (uint256 multiplier, uint256 payout)',

    // Write
    'function roll(uint256 betAmount, uint8 target, bool betUnder, uint8 result, bytes signature)',

    // Events
    'event DiceRolled(address indexed player, uint256 betAmount, uint8 target, bool betUnder, uint8 result, bool won, uint256 payout)',
]);

// CannonCrash ABI
export const CRASH_ABI = parseAbi([
    // Read
    'function getBetState(address player) view returns (bool active, uint256 amount, uint256 autoCashout)',

    // Write
    'function placeBet(uint256 betAmount, uint256 autoCashoutMultiplier)',
    'function cashOut(uint256 cashoutMultiplier, uint256 crashPoint, bytes signature)',
    'function reportCrash(uint256 crashPoint, bytes signature)',

    // Events
    'event BetPlaced(address indexed player, uint256 amount, uint256 autoCashout)',
    'event CashedOut(address indexed player, uint256 multiplier, uint256 payout)',
    'event Crashed(address indexed player, uint256 crashPoint)',
]);

// ERC20 (USDC) ABI
export const ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
