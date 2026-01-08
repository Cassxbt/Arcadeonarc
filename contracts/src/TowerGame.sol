// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SignatureVerifier} from "./libraries/SignatureVerifier.sol";

interface IARCadeVault {
    function placeBet(address user, uint256 amount) external returns (uint256 nonce);
    function settleBet(address user, uint256 betAmount, uint256 payout) external;
    function generateRandomSeed(address user, uint256 userSeed) external view returns (uint256);
    function balances(address user) external view returns (uint256);
}

/**
 * @title TowerGame
 * @notice 20-row tower climbing game where players pick safe tiles to climb
 * @dev Security features:
 *      - Server-signed outcomes for provable fairness
 *      - Reentrancy protection
 *      - Pausable for emergencies
 *      - Input validation
 */
contract TowerGame is ReentrancyGuard, Ownable, Pausable {
    
    /* --- CONSTANTS --- */
    
    uint256 public constant TOWER_ROWS = 20;
    uint8[20] public TILE_PATTERN = [7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4];
    uint256[20] public MULTIPLIERS; // Pre-calculated with house edge

    IARCadeVault public immutable vault;
    address public serverSigner;
    struct Game {
        uint256 betAmount;
        uint256 startNonce;
        uint8 currentRow;
        bool active;
    }
    
    mapping(address => Game) public games;
    
    /* --- EVENTS --- */
    
    event GameStarted(address indexed player, uint256 betAmount, uint256 nonce);
    event TileRevealed(address indexed player, uint8 row, uint8 tile, bool safe);
    event GameCashedOut(address indexed player, uint8 row, uint256 multiplier, uint256 payout);
    event GameLost(address indexed player, uint8 row);
    
    /* --- ERRORS --- */
    
    error GameAlreadyActive();
    error NoActiveGame();
    error InvalidRow();
    error InvalidTile();
    error InvalidSignature();
    
    /* --- CONSTRUCTOR --- */
    
    constructor(address _vault, address _serverSigner) Ownable(msg.sender) {
        vault = IARCadeVault(_vault);
        serverSigner = _serverSigner;
        
        // Pre-calculate multipliers with 10% house edge
        _calculateMultipliers();
    }
    
    /* --- GAME FUNCTIONS --- */
    
    /**
     * @notice Start a new tower game
     * @param betAmount Amount to bet (in USDC, 6 decimals)
     */
    function startGame(uint256 betAmount) external nonReentrant whenNotPaused {
        if (games[msg.sender].active) revert GameAlreadyActive();
        
        // Place bet through vault
        uint256 nonce = vault.placeBet(msg.sender, betAmount);
        
        games[msg.sender] = Game({
            betAmount: betAmount,
            startNonce: nonce,
            currentRow: 0,
            active: true
        });
        
        emit GameStarted(msg.sender, betAmount, nonce);
    }
    
    /**
     * @notice Reveal a tile and climb (if safe)
     * @param row Row the player is clicking
     * @param tile Tile index the player selected
     * @param deathTile The death tile position (provided by server)
     * @param signature Server signature proving deathTile is authentic
     */
    function revealTile(
        uint8 row,
        uint8 tile,
        uint8 deathTile,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Game storage game = games[msg.sender];
        if (!game.active) revert NoActiveGame();
        if (row != game.currentRow) revert InvalidRow();
        if (tile >= TILE_PATTERN[row]) revert InvalidTile();
        if (deathTile >= TILE_PATTERN[row]) revert InvalidTile();
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            game.startNonce,
            row,
            deathTile
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!SignatureVerifier.verify(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        bool safe = tile != deathTile;
        emit TileRevealed(msg.sender, row, tile, safe);
        
        if (safe) {
            game.currentRow = row + 1;
            // Game continues, player can cash out or click next row
        } else {
            // Player hit death tile - game over, they lose
            game.active = false;
            vault.settleBet(msg.sender, game.betAmount, 0);
            emit GameLost(msg.sender, row);
        }
    }
    
    /**
     * @notice Cash out at current position
     */
    function cashOut() external nonReentrant whenNotPaused {
        Game storage game = games[msg.sender];
        if (!game.active) revert NoActiveGame();
        if (game.currentRow == 0) revert InvalidRow(); // Must climb at least one row
        
        uint256 multiplier = MULTIPLIERS[game.currentRow - 1];
        uint256 payout = (game.betAmount * multiplier) / 10000;
        
        game.active = false;
        vault.settleBet(msg.sender, game.betAmount, payout);
        
        emit GameCashedOut(msg.sender, game.currentRow - 1, multiplier, payout);
    }
    
    /* --- ADMIN FUNCTIONS --- */
    
    function setServerSigner(address _signer) external onlyOwner {
        serverSigner = _signer;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /* --- INTERNAL FUNCTIONS --- */
    
    function _calculateMultipliers() internal {
        uint256 cumulativeProb = 10000; // Start at 100%
        
        for (uint256 i = 0; i < TOWER_ROWS; i++) {
            uint8 tiles = TILE_PATTERN[i];
            // Survival probability for this row
            uint256 survivalRate = ((tiles - 1) * 10000) / tiles;
            cumulativeProb = (cumulativeProb * survivalRate) / 10000;
            
            // Fair multiplier = 1 / probability
            // With 10% house edge = 0.9 * fair multiplier
            if (cumulativeProb > 0) {
                MULTIPLIERS[i] = (10000 * 10000 * 9) / (cumulativeProb * 10);
            } else {
                MULTIPLIERS[i] = 1000000; // Cap at 100x
            }
        }
    }
    

    
    /* --- VIEW FUNCTIONS --- */
    
    function getGameState(address player) external view returns (
        bool active,
        uint256 betAmount,
        uint8 currentRow,
        uint256 currentMultiplier
    ) {
        Game storage game = games[player];
        return (
            game.active,
            game.betAmount,
            game.currentRow,
            game.currentRow > 0 ? MULTIPLIERS[game.currentRow - 1] : 10000
        );
    }
    
    function getMultiplier(uint8 row) external view returns (uint256) {
        require(row < TOWER_ROWS, "Invalid row");
        return MULTIPLIERS[row];
    }
}
