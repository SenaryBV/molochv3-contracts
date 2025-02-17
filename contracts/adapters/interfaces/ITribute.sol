pragma solidity ^0.8.0;

import "../../core/DaoRegistry.sol";

// SPDX-License-Identifier: MIT

/**
MIT License

Copyright (c) 2020 Openlaw

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

interface ITribute {
    function provideTribute(
        DaoRegistry dao,
        bytes32 proposalId,
        address applicant,
        address tokenToMint,
        uint256 requestAmount,
        address tokenAddr,
        uint256 tributeAmount
    ) external;

    function provideTributeNFT(
        DaoRegistry dao,
        bytes32 proposalId,
        address nftAddr,
        uint256 nftTokenId,
        uint256 requestedShares
    ) external;

    function sponsorProposal(
        DaoRegistry dao,
        bytes32 proposalId,
        bytes calldata data
    ) external;

    function cancelProposal(DaoRegistry dao, bytes32 proposalId) external;

    function processProposal(DaoRegistry dao, bytes32 proposalId) external;
}
