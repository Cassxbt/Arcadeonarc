// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ARCadeVault
 * @author ARCade Team
 * @notice Central vault for managing user deposits, game bets, and payouts
 * @dev Security features:
 *      - ReentrancyGuard on all external state-changing functions
 *      - Pausable for emergency stops
 *      - Access control for game contracts
 *      - Withdrawal pattern (pull over push)
 *      - Conservative balance checks
 */
contract ARCadeVault is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           CONSTANTS
    // =============================================================

    /// @notice USDC token address on Arc testnet
    IERC20 public immutable USDC;
    
    /// @notice Minimum bet amount (0.5 USDC = 500000 with 6 decimals)
    uint256 public constant MIN_BET = 500_000;
    
    /// @notice Maximum bet amount (100 USDC = 100000000 with 6 decimals)
    uint256 public constant MAX_BET = 100_000_000;
    
    /// @notice Maximum payout per settlement (1000 USDC)
    uint256 public constant MAX_PAYOUT = 1000_000_000;
    
    /// @notice House edge in basis points (1000 = 10%)
    uint256 public constant HOUSE_EDGE_BPS = 1000;
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // =============================================================
    //                            STORAGE
    // =============================================================

    /// @notice User USDC balances in the vault
    mapping(address => uint256) public balances;
    
    /// @notice Authorized game contracts that can debit/credit balances
    mapping(address => bool) public authorizedGames;
    
    /// @notice House balance (accumulated fees)
    uint256 public houseBalance;
    
    /// @notice Total value locked in vault
    uint256 public totalDeposited;
    
    /// @notice Nonce for randomness (per user)
    mapping(address => uint256) public userNonces;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event GameAuthorized(address indexed game, bool authorized);
    event BetPlaced(address indexed user, address indexed game, uint256 amount);
    event BetSettled(address indexed user, address indexed game, uint256 payout, bool won);
    event HouseWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    // =============================================================
    //                            ERRORS
    // =============================================================

    error ZeroAmount();
    error InsufficientBalance();
    error BetTooSmall();
    error BetTooLarge();
    error UnauthorizedGame();
    error TransferFailed();
    error InvalidAddress();
    error PayoutTooLarge();
    error InsufficientLiquidity();

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /**
     * @notice Initialize the vault with USDC token address
     * @param _usdc USDC token contract address
     */
    constructor(address _usdc) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        USDC = IERC20(_usdc);
    }

    // =============================================================
    //                       USER FUNCTIONS
    // =============================================================

    /**
     * @notice Deposit USDC into the vault
     * @param amount Amount of USDC to deposit (6 decimals)
     * @dev User must approve this contract first
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        
        // Transfer USDC from user to vault
        // SafeERC20 handles revert on failure
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        
        // Credit user balance
        balances[msg.sender] += amount;
        totalDeposited += amount;
        
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC from the vault
     * @param amount Amount of USDC to withdraw (6 decimals)
     * @dev Uses pull pattern - user initiates withdrawal
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        // Debit user balance BEFORE transfer (CEI pattern)
        balances[msg.sender] -= amount;
        totalDeposited -= amount;
        
        // Transfer USDC to user
        USDC.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Get user's current balance
     * @param user Address to check
     * @return User's USDC balance in vault
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    // =============================================================
    //                       GAME FUNCTIONS
    // =============================================================

    /**
     * @notice Place a bet (called by authorized game contracts)
     * @param user User placing the bet
     * @param amount Bet amount in USDC
     * @dev Only authorized game contracts can call this
     */
    function placeBet(address user, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 nonce) 
    {
        if (!authorizedGames[msg.sender]) revert UnauthorizedGame();
        if (amount < MIN_BET) revert BetTooSmall();
        if (amount > MAX_BET) revert BetTooLarge();
        if (balances[user] < amount) revert InsufficientBalance();
        
        // Debit user balance
        balances[user] -= amount;
        
        // Increment nonce for randomness
        nonce = ++userNonces[user];
        
        emit BetPlaced(user, msg.sender, amount);
        
        return nonce;
    }

    /**
     * @notice Settle a bet (called by authorized game contracts)
     * @param user User who placed the bet
     * @param betAmount Original bet amount
     * @param payout Amount to pay user (0 if lost)
     * @dev Payout includes original bet if won
     */
    function settleBet(address user, uint256 betAmount, uint256 payout) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (!authorizedGames[msg.sender]) revert UnauthorizedGame();
        if (user == address(0)) revert InvalidAddress();
        if (payout > MAX_PAYOUT) revert PayoutTooLarge();
        
        if (payout > 0) {
            // Check vault has sufficient liquidity
            uint256 vaultBalance = USDC.balanceOf(address(this));
            uint256 obligations = totalDeposited - houseBalance;
            if (vaultBalance < obligations + payout) revert InsufficientLiquidity();
            
            // User won - credit their balance
            balances[user] += payout;
            
            // House takes edge from the bet (already deducted in multiplier calculation)
            // The payout is already calculated with house edge built in
            emit BetSettled(user, msg.sender, payout, true);
        } else {
            // User lost - house takes the bet
            houseBalance += betAmount;
            emit BetSettled(user, msg.sender, 0, false);
        }
    }

    /**
     * @notice Generate server-side randomness seed for a user
     * @param user User address
     * @param userSeed User-provided seed (optional, can be 0)
     * @return Random seed combining server and user inputs
     * @dev This is for testnet. For mainnet, integrate Chainlink VRF
     */
    function generateRandomSeed(address user, uint256 userSeed) 
        external 
        view 
        returns (uint256) 
    {
        // Combine multiple sources of entropy
        // Note: block.prevrandao is not reliable on Arc, using blockhash instead
        return uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            user,
            userNonces[user],
            userSeed,
            address(this)
        )));
    }

    // =============================================================
    //                       ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Authorize or deauthorize a game contract
     * @param game Address of the game contract
     * @param authorized Whether to authorize or deauthorize
     */
    function setGameAuthorization(address game, bool authorized) 
        external 
        onlyOwner 
    {
        if (game == address(0)) revert InvalidAddress();
        authorizedGames[game] = authorized;
        emit GameAuthorized(game, authorized);
    }

    /**
     * @notice Withdraw house profits
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawHouseBalance(address to, uint256 amount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > houseBalance) revert InsufficientBalance();
        
        houseBalance -= amount;
        USDC.safeTransfer(to, amount);
        
        emit HouseWithdrawn(to, amount);
    }

    /**
     * @notice Pause all vault operations
     * @dev For emergency use only
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause vault operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal for users when paused
     * @dev Allows users to withdraw even when paused (safety feature)
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        if (amount == 0) revert InsufficientBalance();
        
        balances[msg.sender] = 0;
        totalDeposited -= amount;
        
        USDC.safeTransfer(msg.sender, amount);
        
        emit EmergencyWithdraw(msg.sender, amount);
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Check if vault has enough liquidity to cover potential payouts
     * @param maxPayout Maximum potential payout
     * @return true if vault can cover the payout
     */
    function canCoverPayout(uint256 maxPayout) external view returns (bool) {
        uint256 vaultBalance = USDC.balanceOf(address(this));
        uint256 obligations = totalDeposited - houseBalance;
        return vaultBalance >= obligations + maxPayout;
    }

    /**
     * @notice Get vault statistics
     * @return _totalDeposited Total user deposits
     * @return _houseBalance Accumulated house profits
     * @return _vaultBalance Actual USDC in vault
     */
    function getVaultStats() 
        external 
        view 
        returns (
            uint256 _totalDeposited,
            uint256 _houseBalance,
            uint256 _vaultBalance
        ) 
    {
        return (
            totalDeposited,
            houseBalance,
            USDC.balanceOf(address(this))
        );
    }
}
