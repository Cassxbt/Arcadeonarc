// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SignatureVerifier} from "./libraries/SignatureVerifier.sol";

interface IARCadeVault {
    function placeBet(address user, uint256 amount) external returns (uint256 nonce);
    function settleBet(address user, uint256 betAmount, uint256 payout) external;
}

/**
 * @title GridyLaser
 * @notice 10x10 grid survival game with alternating column/row laser attacks
 * @dev Multi-turn game - survive more rounds for higher multipliers (up to 95x+)
 *      - Turn 1: Column destroyed
 *      - Turn 2: Row destroyed
 *      - Pattern alternates...
 *      - 4% house edge applied to all multipliers
 */
contract GridyLaser is ReentrancyGuard, Ownable, Pausable {
    
    /* --- CONSTANTS --- */
    
    uint256 public constant GRID_SIZE = 10;
    uint256 public constant MAX_TURNS = 18;
    uint256 public constant HOUSE_EDGE_BPS = 400;  // 4%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256[18] public MULTIPLIERS; // Pre-calculated with house edge

    IARCadeVault public immutable vault;
    address public serverSigner;
    struct Game {
        uint256 betAmount;
        uint256 startNonce;
        uint8 currentTurn;
        uint16 destroyedColumns; // Bitmask for 10 columns
        uint16 destroyedRows;    // Bitmask for 10 rows
        bool active;
    }
    
    mapping(address => Game) public games;
    
    /* --- EVENTS --- */
    
    event GameStarted(address indexed player, uint256 betAmount, uint256 nonce);
    event CellSelected(address indexed player, uint8 turn, uint8 row, uint8 col, bool survived, uint8 destroyed);
    event GameLasered(address indexed player, uint8 turn, uint256 lostAmount);
    event GameCashedOut(address indexed player, uint8 turn, uint256 multiplier, uint256 payout);
    
    /* --- ERRORS --- */
    
    error GameAlreadyActive();
    error NoActiveGame();
    error InvalidCell();
    error InvalidTurn();
    error InvalidSignature();
    error CellAlreadyDestroyed();
    error MustSurviveOneTurn();
    
    /* --- CONSTRUCTOR --- */
    
    constructor(address _vault, address _serverSigner) Ownable(msg.sender) {
        vault = IARCadeVault(_vault);
        serverSigner = _serverSigner;
        
        // Pre-calculate multipliers with 4% house edge
        _calculateMultipliers();
    }
    
    /* --- GAME FUNCTIONS --- */
    
    /**
     * @notice Start a new Gridy Laser game
     * @param betAmount Amount to bet (in USDC, 6 decimals)
     */
    function startGame(uint256 betAmount) external nonReentrant whenNotPaused {
        if (games[msg.sender].active) revert GameAlreadyActive();
        
        // Place bet through vault
        uint256 nonce = vault.placeBet(msg.sender, betAmount);
        
        games[msg.sender] = Game({
            betAmount: betAmount,
            startNonce: nonce,
            currentTurn: 0,
            destroyedColumns: 0,
            destroyedRows: 0,
            active: true
        });
        
        emit GameStarted(msg.sender, betAmount, nonce);
    }
    
    /**
     * @notice Select a cell and reveal the laser attack
     * @param row Row position (0-9)
     * @param col Column position (0-9)
     * @param laserTarget Which column or row gets lasered (0-9)
     * @param signature Server signature proving laserTarget is authentic
     */
    function selectCell(
        uint8 row,
        uint8 col,
        uint8 laserTarget,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Game storage game = games[msg.sender];
        if (!game.active) revert NoActiveGame();
        if (row >= GRID_SIZE || col >= GRID_SIZE) revert InvalidCell();
        if (laserTarget >= GRID_SIZE) revert InvalidCell();
        
        // Check if the cell position is valid (not in destroyed col/row)
        if (_isBitSet(game.destroyedColumns, col)) revert CellAlreadyDestroyed();
        if (_isBitSet(game.destroyedRows, row)) revert CellAlreadyDestroyed();
        
        uint8 turn = game.currentTurn;
        bool isColumnAttack = (turn % 2 == 0); // Even turns = column, Odd = row
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            game.startNonce,
            turn,
            laserTarget
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!SignatureVerifier.verify(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        // Determine if player survives
        bool survived;
        if (isColumnAttack) {
            survived = (col != laserTarget);
            game.destroyedColumns = game.destroyedColumns | uint16(1 << laserTarget);
        } else {
            survived = (row != laserTarget);
            game.destroyedRows = game.destroyedRows | uint16(1 << laserTarget);
        }
        
        emit CellSelected(msg.sender, turn, row, col, survived, laserTarget);
        
        if (survived) {
            game.currentTurn = turn + 1;
            // Game continues - player can cash out or continue
        } else {
            // Player got lasered - game over
            game.active = false;
            vault.settleBet(msg.sender, game.betAmount, 0);
            emit GameLasered(msg.sender, turn, game.betAmount);
        }
    }
    
    /**
     * @notice Cash out at current multiplier
     */
    function cashOut() external nonReentrant whenNotPaused {
        Game storage game = games[msg.sender];
        if (!game.active) revert NoActiveGame();
        if (game.currentTurn == 0) revert MustSurviveOneTurn();
        
        uint256 multiplier = MULTIPLIERS[game.currentTurn - 1];
        uint256 payout = (game.betAmount * multiplier) / BPS_DENOMINATOR;
        
        game.active = false;
        vault.settleBet(msg.sender, game.betAmount, payout);
        
        emit GameCashedOut(msg.sender, game.currentTurn - 1, multiplier, payout);
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
    
    /**
     * @notice Calculate multipliers using the formula:
     *         Base = 1 / (1 - 1/remaining)
     *         Cumulative = Base1 * Base2 * ...
     *         Final = Cumulative * 0.96 (4% house edge)
     */
    function _calculateMultipliers() internal {
        // Precision: use 1e18 for intermediate calculations
        uint256 cumulative = 1e18;
        uint256 colsRemaining = GRID_SIZE;
        uint256 rowsRemaining = GRID_SIZE;
        
        for (uint256 i = 0; i < MAX_TURNS; i++) {
            bool isColumnTurn = (i % 2 == 0);
            uint256 remaining;
            
            if (isColumnTurn) {
                remaining = colsRemaining;
                colsRemaining--;
            } else {
                remaining = rowsRemaining;
                rowsRemaining--;
            }
            
            // Base multiplier = remaining / (remaining - 1) = 1 / (1 - 1/remaining)
            // In fixed point: (remaining * 1e18) / (remaining - 1)
            uint256 base = (remaining * 1e18) / (remaining - 1);
            cumulative = (cumulative * base) / 1e18;
            
            // Apply 4% house edge (multiply by 0.96 = 9600/10000)
            uint256 withEdge = (cumulative * (BPS_DENOMINATOR - HOUSE_EDGE_BPS)) / BPS_DENOMINATOR;
            
            // Convert to basis points (multiply by 10000, divide by 1e18)
            MULTIPLIERS[i] = (withEdge * BPS_DENOMINATOR) / 1e18;
        }
    }
    
    function _isBitSet(uint16 bitmap, uint8 position) internal pure returns (bool) {
        return (bitmap & (1 << position)) != 0;
    }
    

    
    /* --- VIEW FUNCTIONS --- */
    
    /**
     * @notice Get current game state
     */
    function getGameState(address player) external view returns (
        bool active,
        uint256 betAmount,
        uint8 currentTurn,
        uint16 destroyedColumns,
        uint16 destroyedRows,
        uint256 currentMultiplier
    ) {
        Game storage game = games[player];
        return (
            game.active,
            game.betAmount,
            game.currentTurn,
            game.destroyedColumns,
            game.destroyedRows,
            game.currentTurn > 0 ? MULTIPLIERS[game.currentTurn - 1] : BPS_DENOMINATOR
        );
    }
    
    /**
     * @notice Get multiplier for a specific turn
     */
    function getMultiplier(uint8 turn) external view returns (uint256) {
        require(turn < MAX_TURNS, "Invalid turn");
        return MULTIPLIERS[turn];
    }
    
    /**
     * @notice Check if a column is destroyed
     */
    function isColumnDestroyed(address player, uint8 col) external view returns (bool) {
        return _isBitSet(games[player].destroyedColumns, col);
    }
    
    /**
     * @notice Check if a row is destroyed
     */
    function isRowDestroyed(address player, uint8 row) external view returns (bool) {
        return _isBitSet(games[player].destroyedRows, row);
    }
}
