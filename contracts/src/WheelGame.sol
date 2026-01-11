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
 * @notice 20-segment wheel spin game
 */
contract WheelGame is ReentrancyGuard, Ownable, Pausable {

    uint256 public constant TOTAL_SEGMENTS = 20;

    uint256[20] public SEGMENT_MULTIPLIERS = [
        0, 11000, 0, 13000, 0, 11000, 22000, 0, 13000, 11000,
        0, 15000, 0, 13000, 35000, 11000, 0, 22000, 0, 15000
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
