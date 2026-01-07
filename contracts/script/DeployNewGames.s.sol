// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {WheelGame} from "../src/WheelGame.sol";
import {GridyLaser} from "../src/GridyLaser.sol";

interface IARCadeVault {
    function setGameAuthorization(address game, bool authorized) external;
}

/**
 * @title DeployNewGames
 * @notice Deploy WheelGame and GridyLaser to existing vault
 * @dev Uses existing vault at 0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95
 */
contract DeployNewGames is Script {
    // Existing vault address
    address constant VAULT = 0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer/Signer:", deployer);
        console.log("Vault:", VAULT);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy WheelGame
        WheelGame wheel = new WheelGame(VAULT, deployer);
        console.log("WheelGame:", address(wheel));
        
        // Deploy GridyLaser
        GridyLaser laser = new GridyLaser(VAULT, deployer);
        console.log("GridyLaser:", address(laser));
        
        // Authorize games on vault
        IARCadeVault vault = IARCadeVault(VAULT);
        vault.setGameAuthorization(address(wheel), true);
        vault.setGameAuthorization(address(laser), true);
        
        console.log("Both games authorized on vault!");
        
        vm.stopBroadcast();
    }
}
