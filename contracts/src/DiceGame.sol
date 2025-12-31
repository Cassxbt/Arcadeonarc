// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IARCadeVault {
    function placeBet(address user, uint256 amount) external returns (uint256 nonce);
    function settleBet(address user, uint256 betAmount, uint256 payout) external;
    function generateRandomSeed(address user, uint256 userSeed) external view returns (uint256);
}

/**
 * @title DiceGame
 * @notice Dice game where players bet on a number 1-100 and predict over/under
 * @dev Security features:
 *      - Server-signed outcomes for provable fairness
 *      - Reentrancy protection
 *      - Pausable for emergencies
 *      - Input validation
 */
contract DiceGame is ReentrancyGuard, Ownable, Pausable {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @notice House edge in basis points (1000 = 10%)
    uint256 public constant HOUSE_EDGE_BPS = 1000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // =============================================================
    //                            STORAGE
    // =============================================================
    
    /// @notice Reference to the vault contract
    IARCadeVault public immutable vault;
    
    /// @notice Server address that signs game outcomes
    address public serverSigner;
    
    // =============================================================
    //                            EVENTS
    // =============================================================
    
    event DiceRolled(
        address indexed player,
        uint256 betAmount,
        uint8 target,
        bool betUnder,
        uint8 result,
        bool won,
        uint256 payout
    );
    
    // =============================================================
    //                            ERRORS
    // =============================================================
    
    error InvalidTarget();
    error InvalidResult();
    error InvalidSignature();
    
    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================
    
    constructor(address _vault, address _serverSigner) Ownable(msg.sender) {
        vault = IARCadeVault(_vault);
        serverSigner = _serverSigner;
    }
    
    // =============================================================
    //                       GAME FUNCTIONS
    // =============================================================
    
    /**
     * @notice Place a dice bet and resolve immediately
     * @param betAmount Amount to bet
     * @param target Target number (2-98)
     * @param betUnder True if betting under target, false if over
     * @param result Server-provided dice result (1-100)
     * @param signature Server signature proving result is authentic
     */
    function roll(
        uint256 betAmount,
        uint8 target,
        bool betUnder,
        uint8 result,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Validate inputs
        if (target < 2 || target > 98) revert InvalidTarget();
        if (result < 1 || result > 100) revert InvalidResult();
        
        // Place bet and get nonce
        uint256 nonce = vault.placeBet(msg.sender, betAmount);
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            nonce,
            target,
            betUnder,
            result
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!_verifySignature(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        // Determine win
        bool won;
        if (betUnder) {
            won = result < target;
        } else {
            won = result > target;
        }
        
        // Calculate payout
        uint256 payout = 0;
        if (won) {
            uint256 winChance = betUnder ? (target - 1) : (100 - target);
            // multiplier = (100 / winChance) * 0.9 (house edge)
            // In basis points: (100 * 10000 * 9) / (winChance * 10)
            uint256 multiplierBps = (100 * BPS_DENOMINATOR * 9) / (winChance * 10);
            payout = (betAmount * multiplierBps) / BPS_DENOMINATOR;
        }
        
        // Settle bet
        vault.settleBet(msg.sender, betAmount, payout);
        
        emit DiceRolled(msg.sender, betAmount, target, betUnder, result, won, payout);
    }
    
    // =============================================================
    //                       ADMIN FUNCTIONS
    // =============================================================
    
    function setServerSigner(address _signer) external onlyOwner {
        serverSigner = _signer;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    function _verifySignature(
        bytes32 hash,
        bytes calldata signature,
        address signer
    ) internal pure returns (bool) {
        if (signature.length != 65) return false;
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return false;
        
        return ecrecover(hash, v, r, s) == signer;
    }
    
    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================
    
    /**
     * @notice Calculate potential payout for a bet
     * @param betAmount Bet amount
     * @param target Target number
     * @param betUnder Bet under or over
     * @return multiplierBps Multiplier in basis points
     * @return potentialPayout Potential payout
     */
    function calculatePayout(
        uint256 betAmount,
        uint8 target,
        bool betUnder
    ) external pure returns (uint256 multiplierBps, uint256 potentialPayout) {
        require(target >= 2 && target <= 98, "Invalid target");
        
        uint256 winChance = betUnder ? (target - 1) : (100 - target);
        multiplierBps = (100 * BPS_DENOMINATOR * 9) / (winChance * 10);
        potentialPayout = (betAmount * multiplierBps) / BPS_DENOMINATOR;
        
        return (multiplierBps, potentialPayout);
    }
}
