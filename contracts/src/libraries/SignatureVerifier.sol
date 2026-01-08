// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SignatureVerifier {
    function verify(
        bytes32 ethSignedHash,
        bytes memory signature,
        address signer
    ) internal pure returns (bool) {
        if (signature.length != 65) return false;
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) v += 27;
        
        return ecrecover(ethSignedHash, v, r, s) == signer;
    }
}
