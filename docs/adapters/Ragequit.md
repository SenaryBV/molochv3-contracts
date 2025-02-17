## Adapter description and scope

Ragequit is the process in which a member of the DAO decides to opt out of the DAO for any given reason.

This implementation of ragequit adapter does not cover the case in which the member is put in jail before updating the internal balance - as it happens in Moloch V2 to disincentivize the behavior in which members vote Yes on proposals that are essentially bad for the future of the DAO, and right after that they quit with their funds.

It also does not check if the member has voted Yes on a proposal that is not processed yet, and does not keep track of the latest proposal that was voted Yes on.

The main goal is to give the members the freedom to choose when it is the best time to withdraw their funds without any additional preconditions, except for the fact that they need to have enough shares to be converted to funds. Members do not need to convert all their shares/loot at once.

## Adapter workflow

In order to opt out of the DAO, the member needs to indicate the amount of shares and/or loots that the member has decided to burn (to convert back into a token value).

The proportional shares and/or loots are burned when the member provides the tokens in which one expects to receive the funds. The funds are deducted from the internal DAO bank balance, and added to the member's internal balance.

If the member provides at least one invalid token, e.g: a token that is not supported/allowed by the DAO, the entire ragequit process is canceled/reverted. By default the adapter expects that the token array is sorted in ascending order. This is done to test for duplicates, and each token needs to be smaller than the next one, otherwise the transaction is reverted.
In addition to that, if the member provides a long list of tokens that may cause issues due to the block size limit, it is expected that the transaction returns a failure, so it can be retried in another run with a fewer tokens.

Once the ragequit process is completed, the funds are deducted from the bank, added to the member's internal balance, and an event called `MemberRagequit` is emitted.

## Adapter configuration

Tokens that are provided by the member have to be allowed/supported by the DAO.

The member/advisor needs to have enough shares and/or loot in order to convert it to funds.

DAORegistry Access Flags:

Bank Extension Access Flags: `WITHDRAW`, `INTERNAL_TRANSFER`, `SUB_FROM_BALANCE`, `ADD_TO_BALANCE`.

## Adapter state

There is no state tracking for this adapter.

## Dependencies and interactions (internal / external)

- BankExtension

  - checks the member's balance.
  - subtracts the member's balance.
  - transfers the funds from the DAO account to the member's account taking into consideration the provided tokens.
  - checks if the provided token is supported/allowed by the DAO.

- DaoRegistry

  - checks if the message sender is actually a member or an advisor of the DAO.

- FairShareHelper

  - calculates the amount of funds to be returned to the member based on the provided numbers of shares and/or loot, and current balance of the Guild.

## Functions description and assumptions / checks

### receive() external payable

```solidity
    /**
     * @notice default fallback function to prevent from sending ether to the contract.
     */
    receive() external payable
```

### function ragequit

```solidity
    /**
     * @notice Allows a member or advisor of the DAO to opt out by burning the proportional amount of shares/loot of the member.
     * @notice Anyone is allowed to call this function, but only members and advisors that have shares are able to execute the entire ragequit process.
     * @notice The array of token needs to be sorted in ascending order before executing this call, otherwise the transaction will fail.
     * @dev The sum of sharesToBurn and lootToBurn have to be greater than zero.
     * @dev The member becomes an inactive member of the DAO once all the shares/loot are burned.
     * @dev If the member provides an invalid/not allowed token, the entire processed is reverted.
     * @dev If no tokens are informed, the transaction is reverted.
     * @param dao The dao address that the member is part of.
     * @param sharesToBurn The amount of shares of the member that must be converted into funds.
     * @param lootToBurn The amount of loot of the member that must be converted into funds.
     * @param tokens The array of tokens that the funds should be sent to.
     */
    function ragequit(
        DaoRegistry dao,
        uint256 sharesToBurn,
        uint256 lootToBurn,
        address[] memory tokens
    ) external
```

### function \_prepareRagequit

```solidity
    /**
     * @notice Subtracts from the internal member's account the proportional shares and/or loot.
     * @param memberAddr The member address that wants to burn the shares and/or loot.
     * @param sharesToBurn The amount of shares of the member that must be converted into funds.
     * @param lootToBurn The amount of loot of the member that must be converted into funds.
     * @param tokens The array of tokens that the funds should be sent to.
     * @param bank The bank extension.
     */
    function _prepareRagequit(
        address memberAddr,
        uint256 sharesToBurn,
        uint256 lootToBurn,
        address[] calldata tokens,
        BankExtension bank
    ) internal
```

### function \_burnShares

```solidity
    /**
     * @notice Subtracts from the bank's account the proportional shares and/or loot,
     * @notice and transfers the funds to the member's internal account based on the provided tokens.
     * @param memberAddr The member address that wants to burn the shares and/or loot.
     * @param sharesToBurn The amount of shares of the member that must be converted into funds.
     * @param lootToBurn The amount of loot of the member that must be converted into funds.
     * @param initialTotalSharesAndLoot The sum of shares and loot before internal transfers.
     * @param tokens The array of tokens that the funds should be sent to.
     * @param bank The bank extension.
     */
    function _burnShares(
        address memberAddr,
        uint256 sharesToBurn,
        uint256 lootToBurn,
        uint256 initialTotalSharesAndLoot,
        address[] memory tokens,
        BankExtension bank
    ) internal
```

## Events

### event MemberRagequit

```solidity
    /**
     * @notice Event emitted when a member of the DAO executes a ragequit
     * with all or parts of the member's shares/loot.
     */
    event MemberRagequit(
        address memberAddr,
        uint256 burnedShares,
        uint256 burnedLoot,
        uint256 initialTotalSharesAndLoot)
```
