## Adapter description and scope

The Onboarding adapter is the process of minting internal tokens in exchange of a specific token at a fixed price.
The tokens sent by a proposer are converted into a proposal that the community votes on. If it passes, the tokens are moved to the guild bank and internal tokens minted, otherwise the proposer can withdraw back his tokens.

You can mint any internal tokens but it is usually to mint either SHARE or LOOT tokens. The onboarding process supports raw ether, and ERC20 tokens tributes. The ERC20 token must be allowed/supported by the Bank.

In case of any failure during the `processProposal` step, the funds are returned to the applicant, and the minted shares burned if needed.

## Adapter workflow

First, a potential new member (or a member who wants to increase his shares) sends tokens to the onboarding adapter.
The adapter is used as an escrow between the DAO and the potential new member.

Sending the tokens means a proposal is submitted (but not sponsored).

If the proposal has not been sponsored yet, the proposer can cancel the proposal and the tokens are sent back to the proposer.

If the proposal is sponsored (only by a member), it is put up for vote.

After the voting period is done, it is time to process the proposal.
If the vote has passed, the tokens are moved to the guild bank and the shares minted (internal tokens).
If it has failed, the money is returned to the proposer.

## Adapter configuration

Each configuration is done based on the token address that needs to be minted.

DAORegistry Access Flags: `SUBMIT_PROPOSAL`, `UPDATE_DELEGATE_KEY`, `NEW_MEMBER`.

Bank Extension Access Flags: `ADD_TO_BALANCE`, `SUB_FROM_BALANCE`.

## Adapter state

### {tokenAddrToMint}.onboarding.chunkSize

How many tokens need to be minted per chunk bought.

### {tokenAddrToMint}.onboarding.sharesPerChunk

How many shares (tokens from tokenAddr) are being minted per chunk.

### {tokenAddrToMint}.onboarding.tokenAddr

In which currency (tokenAddr) should the onboarding take place.

### {tokenAddrToMint}.onboarding.maximumChunks

How many chunks can someone buy max. This helps force decentralization of token holders.

## Adapter state

Onboarding keeps track of every proposal that goes through it as well as the number of tokens that have been minted so far.

### ProposalDetails

For each proposal created through the adapter, we keep track of the following information:

#### id

The proposalId (provided offchain).

#### tokenToMint

Which token needs to be minted if the proposal passes.

#### amount

The amount sent by the proposer.

#### sharesRequested

The amount of internal tokens that needs to be minted to the applicant if the proposal passes.

#### token

What currency has been used in the onboarding process.

We keep this information even though it is part of the configuration to handle the case where the configuration changes while a proposal has been created but not processed yet.

#### applicant

The applicant address.

#### proposer

The proposer address.

### proposals mapping

The proposals are organized by DAO address and then by proposal id.

### shares

Accounting to see the amount of a particular internal token that has been minted for a particular applicant. This is then checked against the maxChunks configuration to determine if the onboarding proposal is allowed or not.

## Functions description and assumptions / checks

### function configKey(address tokenAddrToMint, bytes32 key) returns (bytes32)

This is the function to build the config key for a particular tokenAddrToMint.
It's a pure function.

### function configureDao(DaoRegistry dao, address tokenAddrToMint, uint256 chunkSize, uint256 sharesPerChunk, uint256 maximumChunks, address tokenAddr)

This function configures the adapter for a particular DAO.
The modifier is adapterOnly which means that only if the sender is either a registered adapter of the DAO or if it is in creation mode can it be called.
The function checks that chunkSize, sharesPerChunks and maximumChunks cannot be 0.

**tokenAddr** is being whitelisted in the bank extension as an ERC-20 token
**tokenAddrToMint** is being whitelisted in the bank extension as an internal token

#### dependency

The adapter also needs a Bank extension. So `confgureDao` will fail if no bank extension is found.

### function onboard(DaoRegistry dao, bytes32 proposalId, address payable applicant, address tokenToMint, uint256 tokenAmount)

Onboard submits the proposal but does not sponsor it yet. This is why anyone can call this function.

**tokenAmount** is only relevant if you send ERC-20 tokens. If the payment is done directly in ETH, `msg.value` is being taken into account and the value passed is irrelevant.

The tokens are then kept into escrow in the adapter and a proposal is created.

If the amount sent is not a multiple of sharesPerChunk, the remainder is sent back to the proposer.

This function uses **\_submitMembershipProposal** to create the proposal.

### function sponsorProposal(DaoRegistry dao, bytes32 proposalId, bytes memory data)

### function \_sponsorProposal(DaoRegistry dao, bytes32 proposalId, bytes memory data, address sponsoredBy, IVoting votingContract)

This function can only be called by an active member.

This starts a vote on the proposal to onboard a new member.

**dao.sponsorProposal(proposalId, sponsoredBy)** checks already that the proposal has not been sponsored yet

**voting.startNewVotingForProposal(dao, proposalId, data)** starts the vote process

### function cancelProposal(DaoRegistry dao, bytes32 proposalId)

If a proposal exists but has not been sponsored yet or processed yet, the proposer can cancel it.
Only the proposer can cancel a proposal.

If the proposal is cancelled, it is marked as processed and the tribute is refunded back to the proposer.

### function processProposal(DaoRegistry dao, bytes32 proposalId)

Once the vote on a proposal is finished, it is time to process it. Anybody can call this function.

The function checks that there is a vote in progress for this proposalId and that it has not been processed yet.
If the vote is a success (`PASS`), then we process it by minting the internal tokens and moving the tokens from the adapter to the bank extension.

If the vote is a tie (`TIE`) or failed (`NOT_PASS`), then the funds are returned to the proposer.

Otherwise, the state is invalid and the transaction is reverted (if the vote does not exist or if it is in progress).

### function \_submitMembershipProposal(DaoRegistry dao, bytes32 proposalId, address tokenToMint, address payable applicant, address payable proposer, uint256 value, address token)

### function \_submitMembershipProposalInternal(DaoRegistry dao, bytes32 proposalId, address tokenToMint, address payable newMember, address payable proposer, uint256 sharesRequested, uint256 amount, address token)

This function marks the proposalId as submitted in the DAO and saves the information in the internal adapter state.

### function \_refundTribute(address tokenAddr, address payable proposer, uint256 amount)

It returns a certain amount to the proposer of a certain token address.
It handles whether it's an ERC-20 or simply ETH.

### function \_mintTokensToMember(DaoRegistry dao, address tokenToMint, address memberAddr, uint256 tokenAmount, address payable proposer, address proposalToken, uint256 proposalAmount)

This function mints the tokens to the new member and creates the member data if it doesn't already exist within the DAO.

### Events

- `FailedOnboarding(address applicant, bytes32 cause)`: when there is an overflow while minting new tokens or updating ERC20/ETH token balance in the Bank.
