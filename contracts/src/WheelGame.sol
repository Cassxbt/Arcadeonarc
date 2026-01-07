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
 * @title WheelGame
 * @notice 20-segment wheel spin game with multipliers from 0x to 5x
 * @dev Single-transaction game - player spins, server provides outcome
 */
contract WheelGame is ReentrancyGuard, Ownable, Pausable {
    
    /* --- CONSTANTS --- */
    
    /// @notice Total number of segments on the wheel
    uint256 public constant TOTAL_SEGMENTS = 20;
    
    /// @notice Multipliers for each segment in basis points (10000 = 1x)
    /// Distribution: 0x=4, 1.5x=6, 1.8x=4, 2x=3, 3x=2, 5x=1
    uint256[20] public SEGMENT_MULTIPLIERS = [
        0,      // Segment 0: 0x (loss)
        15000,  // Segment 1: 1.5x
        18000,  // Segment 2: 1.8x
        15000,  // Segment 3: 1.5x
        0,      // Segment 4: 0x (loss)
        20000,  // Segment 5: 2x
        15000,  // Segment 6: 1.5x
        30000,  // Segment 7: 3x
        18000,  // Segment 8: 1.8x
        15000,  // Segment 9: 1.5x
        0,      // Segment 10: 0x (loss)
        15000,  // Segment 11: 1.5x
        20000,  // Segment 12: 2x
        18000,  // Segment 13: 1.8x
        50000,  // Segment 14: 5x (jackpot)
        15000,  // Segment 15: 1.5x
        0,      // Segment 16: 0x (loss)
        20000,  // Segment 17: 2x
        30000,  // Segment 18: 3x
        18000   // Segment 19: 1.8x
    ];
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /* --- STORAGE --- */
    
    /// @notice Reference to the vault contract
    IARCadeVault public immutable vault;
    
    /// @notice Server address that signs game outcomes
    address public serverSigner;
    
    /* --- EVENTS --- */
    
    event WheelSpun(
        address indexed player,
        uint256 betAmount,
        uint8 segment,
        uint256 multiplier,
        uint256 payout
    );
    
    /* --- ERRORS --- */
    
    error InvalidSegment();
    error InvalidSignature();
    
    /* --- CONSTRUCTOR --- */
    
    constructor(address _vault, address _serverSigner) Ownable(msg.sender) {
        vault = IARCadeVault(_vault);
        serverSigner = _serverSigner;
    }
    
    /* --- GAME FUNCTIONS --- */
    
    /**
     * @notice Spin the wheel
     * @param betAmount Amount to bet (in USDC, 6 decimals)
     * @param segmentResult The segment the wheel lands on (0-19, from server)
     * @param signature Server signature proving segmentResult is authentic
     */
    function spin(
        uint256 betAmount,
        uint8 segmentResult,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Validate segment
        if (segmentResult >= TOTAL_SEGMENTS) revert InvalidSegment();
        
        // Place bet and get nonce
        uint256 nonce = vault.placeBet(msg.sender, betAmount);
        
        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            nonce,
            segmentResult
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        if (!_verifySignature(ethSignedHash, signature, serverSigner)) {
            revert InvalidSignature();
        }
        
        // Get multiplier and calculate payout
        uint256 multiplier = SEGMENT_MULTIPLIERS[segmentResult];
        uint256 payout = (betAmount * multiplier) / BPS_DENOMINATOR;
        
        // Settle bet
        vault.settleBet(msg.sender, betAmount, payout);
        
        emit WheelSpun(msg.sender, betAmount, segmentResult, multiplier, payout);
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
    
    /* --- VIEW FUNCTIONS --- */
    
    /**
     * @notice Get the multiplier for a specific segment
     * @param segment Segment index (0-19)
     * @return Multiplier in basis points
     */
    function getSegmentMultiplier(uint8 segment) external view returns (uint256) {
        require(segment < TOTAL_SEGMENTS, "Invalid segment");
        return SEGMENT_MULTIPLIERS[segment];
    }
    
    /**
     * @notice Get all segment multipliers
     * @return Array of 20 multipliers in basis points
     */
    function getAllMultipliers() external view returns (uint256[20] memory) {
        return SEGMENT_MULTIPLIERS;
    }
}
