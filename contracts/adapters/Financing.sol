pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

import "./interfaces/IFinancing.sol";
import "../core/DaoConstants.sol";
import "../core/DaoRegistry.sol";
import "../extensions/bank/Bank.sol";
import "../adapters/interfaces/IVoting.sol";
import "../guards/MemberGuard.sol";
import "../guards/AdapterGuard.sol";

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

contract FinancingContract is
    IFinancing,
    DaoConstants,
    MemberGuard,
    AdapterGuard
{
    struct ProposalDetails {
        address applicant; // the proposal applicant address, can not be a reserved address
        uint256 amount; // the amount requested for funding
        address token; // the token address in which the funding must be sent to
        bytes32 details; // additional details about the financing proposal
    }

    // keeps track of all financing proposals handled by each dao
    mapping(address => mapping(bytes32 => ProposalDetails)) public proposals;

    /**
     * @notice default fallback function to prevent from sending ether to the contract.
     */
    receive() external payable {
        revert("fallback revert");
    }

    /**
     * @notice Creates a financing proposal.
     * @dev Applicant address must not be reserved.
     * @dev Token address must be allowed/supported by the DAO Bank.
     * @dev Requested amount must be greater than zero.
     * @param dao The DAO Address.
     * @param proposalId The proposal id.
     * @param applicant The applicant address.
     * @param token The token to receive the funds.
     * @param amount The desired amount.
     * @param details Additional detais about the financing proposal.
     */
    function createFinancingRequest(
        DaoRegistry dao,
        bytes32 proposalId,
        address applicant,
        address token,
        uint256 amount,
        bytes32 details
    ) external override reentrancyGuard(dao) {
        require(amount > 0, "invalid requested amount");
        BankExtension bank = BankExtension(dao.getExtensionAddress(BANK));
        require(bank.isTokenAllowed(token), "token not allowed");
        require(
            isNotReservedAddress(applicant),
            "applicant using reserved address"
        );
        dao.submitProposal(proposalId);

        ProposalDetails storage proposal = proposals[address(dao)][proposalId];
        proposal.applicant = applicant;
        proposal.amount = amount;
        proposal.details = details;
        proposal.token = token;
    }

    /**
     * @notice Sponsor a financing proposal to start the voting process.
     * @dev Only members of the DAO can sponsor a financing proposal.
     * @param dao The DAO Address.
     * @param proposalId The proposal id.
     * @param data Additional details about the sponsorship process.
     */
    function sponsorProposal(
        DaoRegistry dao,
        bytes32 proposalId,
        bytes memory data
    ) external override reentrancyGuard(dao) {
        IVoting votingContract = IVoting(dao.getAdapterAddress(VOTING));
        address sponsoredBy =
            votingContract.getSenderAddress(
                dao,
                address(this),
                data,
                msg.sender
            );
        _sponsorProposal(dao, proposalId, data, sponsoredBy, votingContract);
    }

    /**
     * @notice Sponsors a financing proposal to start the voting process.
     * @dev Only members of the DAO can sponsor a financing proposal.
     * @param dao The DAO Address.
     * @param proposalId The proposal id.
     * @param data Additional details about the sponsorship process.
     * @param sponsoredBy The address of the sponsoring member.
     * @param votingContract The voting contract used by the DAO.
     */
    function _sponsorProposal(
        DaoRegistry dao,
        bytes32 proposalId,
        bytes memory data,
        address sponsoredBy,
        IVoting votingContract
    ) internal {
        dao.sponsorProposal(proposalId, sponsoredBy, address(votingContract));
        votingContract.startNewVotingForProposal(dao, proposalId, data);
    }

    /**
     * @notice Processing a financing proposal to grant the requested funds.
     * @dev Only proposals that were not processed are accepted.
     * @dev Only proposals that were sponsored are accepted.
     * @dev Only proposals that passed can get processed and have the funds released.
     * @param dao The DAO Address.
     * @param proposalId The proposal id.
     */
    function processProposal(DaoRegistry dao, bytes32 proposalId)
        external
        override
        reentrancyGuard(dao)
    {
        ProposalDetails memory details = proposals[address(dao)][proposalId];

        IVoting votingContract = IVoting(dao.votingAdapter(proposalId));
        require(address(votingContract) != address(0), "adapter not found");

        require(
            votingContract.voteResult(dao, proposalId) ==
                IVoting.VotingState.PASS,
            "proposal needs to pass"
        );
        dao.processProposal(proposalId);
        BankExtension bank = BankExtension(dao.getExtensionAddress(BANK));

        bank.subtractFromBalance(GUILD, details.token, details.amount);
        bank.addToBalance(details.applicant, details.token, details.amount);
    }
}
