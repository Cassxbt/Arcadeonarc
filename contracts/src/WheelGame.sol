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
 * @title WheelGame
 * @notice 20-segment wheel spin game with multipliers from 0x to 5x
 * @dev Single-transaction game - player spins, server provides outcome
 */
contract WheelGame is ReentrancyGuard, Ownable, Pausable {
    
    /* --- CONSTANTS --- */
    
    /// @notice Total number of segments on the wheel
    uint256 public constant TOTAL_SEGMENTS = 20;
    
    /// @notice Multipliers for each segment in basis points (10000 = 1x)
    /// Distribution: 0x=8, 1.1x=4, 1.3x=3, 1.5x=2, 2.2x=2, 3.5x=1
    /// Expected RTP: 96% (4% house edge)
    uint256[20] public SEGMENT_MULTIPLIERS = [
        0,      // Segment 0: 0x (loss)
        11000,  // Segment 1: 1.1x
        0,      // Segment 2: 0x (loss)
        13000,  // Segment 3: 1.3x
        0,      // Segment 4: 0x (loss)
        15000,  // Segment 5: 1.5x
        11000,  // Segment 6: 1.1x
        0,      // Segment 7: 0x (loss)
        22000,  // Segment 8: 2.2x
        11000,  // Segment 9: 1.1x
        0,      // Segment 10: 0x (loss)
        13000,  // Segment 11: 1.3x
        0,      // Segment 12: 0x (loss)
        15000,  // Segment 13: 1.5x
        35000,  // Segment 14: 3.5x (jackpot)
        11000,  // Segment 15: 1.1x
        0,      // Segment 16: 0x (loss)
        13000,  // Segment 17: 1.3x
        0,      // Segment 18: 0x (loss)
        22000   // Segment 19: 2.2x
    ];
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    IARCadeVault public immutable vault;
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
        
        if (!SignatureVerifier.verify(ethSignedHash, signature, serverSigner)) {
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
