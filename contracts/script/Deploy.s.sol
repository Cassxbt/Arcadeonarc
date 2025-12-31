// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ARCadeVault} from "../src/ARCadeVault.sol";
import {TowerGame} from "../src/TowerGame.sol";
import {DiceGame} from "../src/DiceGame.sol";
import {CannonCrash} from "../src/CannonCrash.sol";

contract DeployARCade is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Vault
        ARCadeVault vault = new ARCadeVault(USDC);
        console.log("Vault:", address(vault));
        
        // Deploy Games
        TowerGame tower = new TowerGame(address(vault), deployer);
        console.log("Tower:", address(tower));
        
        DiceGame dice = new DiceGame(address(vault), deployer);
        console.log("Dice:", address(dice));
        
        CannonCrash crash = new CannonCrash(address(vault), deployer);
        console.log("Crash:", address(crash));
        
        // Authorize games
        vault.setGameAuthorization(address(tower), true);
        vault.setGameAuthorization(address(dice), true);
        vault.setGameAuthorization(address(crash), true);
        
        vm.stopBroadcast();
    }
}
