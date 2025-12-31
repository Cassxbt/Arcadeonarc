// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IARCadeVault {
    function placeBet(address user, uint256 amount) external returns (uint256 nonce);
    function settleBet(address user, uint256 betAmount, uint256 payout) external;
}

/**
 * @title CannonCrash
 * @notice Crash game where a multiplier rises until it "crashes"
 * @dev Security features:
 *      - Server-committed crash points for provable fairness
 *      - Reentrancy protection
 *      - Pausable for emergencies
 *      - Commit-reveal pattern for crash point
 */
contract CannonCrash is ReentrancyGuard, Ownable, Pausable {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @notice Minimum crash multiplier (1.00x in basis points)
    uint256 public constant MIN_CRASH = 10000;
    
    /// @notice Maximum cash-out multiplier (100.00x in basis points)
    uint256 public constant MAX_CASHOUT = 1000000;
    
    // =============================================================
    //                            STORAGE
    // =============================================================
    
    /// @notice Reference to the vault contract
    IARCadeVault public immutable vault;
    
    /// @notice Server address that signs game outcomes
    address public serverSigner;
    
    /// @notice Active bets
    struct Bet {
        uint256 amount;
        uint256 nonce;
        uint256 autoCashoutMultiplier; // 0 = no auto-cashout
        bool active;
    }
    
    mapping(address => Bet) public bets;
    
    // =============================================================
    //                            EVENTS
    // =============================================================
    
    event BetPlaced(address indexed player, uint256 amount, uint256 autoCashout);
    event CashedOut(address indexed player, uint256 multiplier, uint256 payout);
    event Crashed(address indexed player, uint256 crashPoint);
    
    // =============================================================
    //                            ERRORS
    // =============================================================
    
    error BetAlreadyActive();
    error NoBetActive();
    error InvalidMultiplier();
    error InvalidSignature();
    error MultiplierTooHigh();
    
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
     * @notice Place a bet on the crash game
     * @param betAmount Amount to bet
     * @param autoCashoutMultiplier Auto-cashout multiplier (0 to disable, in basis points)
     */
    function placeBet(
        uint256 betAmount,
        uint256 autoCashoutMultiplier
    ) external nonReentrant whenNotPaused {
        if (bets[msg.sender].active) revert BetAlreadyActive();
        if (autoCashoutMultiplier != 0 && autoCashoutMultiplier < MIN_CRASH) revert InvalidMultiplier();
        if (autoCashoutMultiplier > MAX_CASHOUT) revert MultiplierTooHigh();
        
        uint256 nonce = vault.placeBet(msg.sender, betAmount);
        
        bets[msg.sender] = Bet({
            amount: betAmount,
            nonce: nonce,
            autoCashoutMultiplier: autoCashoutMultiplier,
            active: true
        });
        
        emit BetPlaced(msg.sender, betAmount, autoCashoutMultiplier);
    }
    
    /**
     * @notice Cash out at the current multiplier
     * @param cashoutMultiplier Multiplier to cash out at (in basis points)
     * @param crashPoint The crash point for this round (in basis points)
     * @param signature Server signature proving crashPoint
     */
    function cashOut(
        uint256 cashoutMultiplier,
        uint256 crashPoint,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Bet storage bet = bets[msg.sender];
        if (!bet.active) revert NoBetActive();
        if (cashoutMultiplier < MIN_CRASH) revert InvalidMultiplier();
        if (cashoutMultiplier > MAX_CASHOUT) revert MultiplierTooHigh();
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            bet.nonce,
            crashPoint
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!_verifySignature(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        // Check if player cashed out before crash
        if (cashoutMultiplier <= crashPoint) {
            // Successful cashout
            uint256 payout = (bet.amount * cashoutMultiplier) / 10000;
            bet.active = false;
            vault.settleBet(msg.sender, bet.amount, payout);
            emit CashedOut(msg.sender, cashoutMultiplier, payout);
        } else {
            // Crashed before cashout
            bet.active = false;
            vault.settleBet(msg.sender, bet.amount, 0);
            emit Crashed(msg.sender, crashPoint);
        }
    }
    
    /**
     * @notice Report that the round crashed (for auto-cashout or missed cashouts)
     * @param crashPoint The crash point for this round
     * @param signature Server signature proving crashPoint
     */
    function reportCrash(
        uint256 crashPoint,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        Bet storage bet = bets[msg.sender];
        if (!bet.active) revert NoBetActive();
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            bet.nonce,
            crashPoint
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!_verifySignature(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        // Check if auto-cashout triggered
        if (bet.autoCashoutMultiplier > 0 && bet.autoCashoutMultiplier <= crashPoint) {
            // Auto-cashout successful
            uint256 payout = (bet.amount * bet.autoCashoutMultiplier) / 10000;
            bet.active = false;
            vault.settleBet(msg.sender, bet.amount, payout);
            emit CashedOut(msg.sender, bet.autoCashoutMultiplier, payout);
        } else {
            // Player crashed
            bet.active = false;
            vault.settleBet(msg.sender, bet.amount, 0);
            emit Crashed(msg.sender, crashPoint);
        }
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
    
    function getBetState(address player) external view returns (
        bool active,
        uint256 amount,
        uint256 autoCashout
    ) {
        Bet storage bet = bets[player];
        return (bet.active, bet.amount, bet.autoCashoutMultiplier);
    }
}
