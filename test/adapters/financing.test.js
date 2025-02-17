// Whole-script strict mode syntax
"use strict";

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
const {
  web3,
  toBN,
  fromUtf8,
  advanceTime,
  deployDefaultDao,
  takeChainSnapshot,
  revertChainSnapshot,
  proposalIdGenerator,
  accounts,
  GUILD,
  SHARES,
  sharePrice,
  ETH_TOKEN,
  expect,
} = require("../../utils/DaoFactory.js");

const { checkBalance } = require("../../utils/TestUtils.js");

const remaining = sharePrice.sub(toBN("50000000000000"));
const myAccount = accounts[1];
const applicant = accounts[2];
const newMember = accounts[3];
const expectedGuildBalance = toBN("1200000000000000000");
const proposalCounter = proposalIdGenerator().generator;

function getProposalCounter() {
  return proposalCounter().next().value;
}

describe("Adapter - Financing", () => {
  before("deploy dao", async () => {
    const { dao, adapters, extensions } = await deployDefaultDao(myAccount);
    this.dao = dao;
    this.adapters = adapters;
    this.extensions = extensions;
    this.snapshotId = await takeChainSnapshot();
  });

  beforeEach(async () => {
    await revertChainSnapshot(this.snapshotId);
    this.snapshotId = await takeChainSnapshot();
  });

  it("should be possible to create a financing proposal and get the funds when the proposal pass", async () => {
    const bank = this.extensions.bank;
    const voting = this.adapters.voting;
    const financing = this.adapters.financing;
    const onboarding = this.adapters.onboarding;
    const bankAdapter = this.adapters.bankAdapter;

    let proposalId = getProposalCounter();

    //Add funds to the Guild Bank after sposoring a member to join the Guild
    await onboarding.onboard(
      this.dao.address,
      proposalId,
      newMember,
      SHARES,
      sharePrice.mul(toBN(10)).add(remaining),
      {
        from: myAccount,
        value: sharePrice.mul(toBN(10)).add(remaining),
        gasPrice: toBN("0"),
      }
    );

    //Sponsor the new proposal, vote and process it
    await onboarding.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await voting.submitVote(this.dao.address, proposalId, 1, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    //should not be able to process before the voting period has ended
    try {
      await onboarding.processProposal(this.dao.address, proposalId, {
        from: myAccount,
        gasPrice: toBN("0"),
      });
    } catch (err) {
      expect(err.reason).equal("proposal has not been voted on yet");
    }

    await advanceTime(10000);
    await onboarding.processProposal(this.dao.address, proposalId, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    //Check Guild Bank Balance
    checkBalance(bank, GUILD, ETH_TOKEN, expectedGuildBalance);

    //Create Financing Request
    let requestedAmount = toBN(50000);
    proposalId = getProposalCounter();
    await financing.createFinancingRequest(
      this.dao.address,
      proposalId,
      applicant,
      ETH_TOKEN,
      requestedAmount,
      fromUtf8(""),
      { gasPrice: toBN("0") }
    );

    //Member sponsors the Financing proposal
    await financing.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Member votes on the Financing proposal
    await voting.submitVote(this.dao.address, proposalId, 1, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Check applicant balance before Financing proposal is processed
    checkBalance(bank, applicant, ETH_TOKEN, "0");

    //Process Financing proposal after voting
    await advanceTime(10000);
    await financing.processProposal(this.dao.address, proposalId, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Check Guild Bank balance to make sure the transfer has happened
    checkBalance(
      bank,
      GUILD,
      ETH_TOKEN,
      expectedGuildBalance.sub(requestedAmount)
    );
    //Check the applicant token balance to make sure the funds are available in the bank for the applicant account
    checkBalance(bank, applicant, ETH_TOKEN, requestedAmount);

    const ethBalance = await web3.eth.getBalance(applicant);
    await bankAdapter.withdraw(this.dao.address, applicant, ETH_TOKEN, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    checkBalance(bank, applicant, ETH_TOKEN, 0);
    const ethBalance2 = await web3.eth.getBalance(applicant);
    expect(toBN(ethBalance).add(requestedAmount).toString()).equal(
      ethBalance2.toString()
    );
  });

  it("should not be possible to get the money if the proposal fails", async () => {
    const voting = this.adapters.voting;
    const financing = this.adapters.financing;
    const onboarding = this.adapters.onboarding;

    //Add funds to the Guild Bank after sposoring a member to join the Guild
    let proposalId = getProposalCounter();
    await onboarding.onboard(
      this.dao.address,
      proposalId,
      newMember,
      SHARES,
      sharePrice.mul(toBN(10)).add(remaining),
      {
        from: myAccount,
        value: sharePrice.mul(toBN(10)).add(remaining),
        gasPrice: toBN("0"),
      }
    );

    //Sponsor the new proposal, vote and process it
    await onboarding.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await voting.submitVote(this.dao.address, proposalId, 1, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await advanceTime(10000);

    await onboarding.processProposal(this.dao.address, proposalId, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Create Financing Request
    let requestedAmount = toBN(50000);
    proposalId = "0x2";
    await financing.createFinancingRequest(
      this.dao.address,
      proposalId,
      applicant,
      ETH_TOKEN,
      requestedAmount,
      fromUtf8("")
    );

    //Member sponsors the Financing proposal
    await financing.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Member votes on the Financing proposal
    await voting.submitVote(this.dao.address, proposalId, 2, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    //Process Financing proposal after voting
    await advanceTime(10000);
    try {
      await financing.processProposal(this.dao.address, proposalId, {
        from: myAccount,
        gasPrice: toBN("0"),
      });
    } catch (err) {
      expect(err.reason).equal("proposal needs to pass");
    }
  });

  it("should not be possible to submit a proposal with a token that is not allowed", async () => {
    const voting = this.adapters.voting;
    const financing = this.adapters.financing;
    const onboarding = this.adapters.onboarding;

    let proposalId = getProposalCounter();
    //Add funds to the Guild Bank after sposoring a member to join the Guild
    await onboarding.onboard(
      this.dao.address,
      proposalId,
      newMember,
      SHARES,
      sharePrice.mul(toBN(10)).add(remaining),
      {
        from: myAccount,
        value: sharePrice.mul(toBN(10)).add(remaining),
        gasPrice: toBN("0"),
      }
    );

    //Sponsor the new proposal, vote and process it
    await onboarding.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await voting.submitVote(this.dao.address, proposalId, 1, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await advanceTime(10000);

    await onboarding.processProposal(this.dao.address, proposalId, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    try {
      proposalId = getProposalCounter();
      const invalidToken = "0x6941a80e1a034f57ed3b1d642fc58ddcb91e2596";
      //Create Financing Request with a token that is not allowed
      let requestedAmount = toBN(50000);
      await financing.createFinancingRequest(
        this.dao.address,
        proposalId,
        applicant,
        invalidToken,
        requestedAmount,
        fromUtf8("")
      );
      throw Error(
        "should not be possible to submit a proposal with a token that is not allowed"
      );
    } catch (err) {
      expect(err.reason).equal("token not allowed");
    }
  });

  it("should not be possible to submit a proposal to request funding with an amount.toEqual to zero", async () => {
    const voting = this.adapters.voting;
    const financing = this.adapters.financing;
    const onboarding = this.adapters.onboarding;

    let proposalId = getProposalCounter();
    //Add funds to the Guild Bank after sposoring a member to join the Guild
    await onboarding.onboard(
      this.dao.address,
      proposalId,
      newMember,
      SHARES,
      sharePrice.mul(toBN(10)).add(remaining),
      {
        from: myAccount,
        value: sharePrice.mul(toBN(10)).add(remaining),
        gasPrice: toBN("0"),
      }
    );

    //Sponsor the new proposal, vote and process it
    await onboarding.sponsorProposal(this.dao.address, proposalId, [], {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await voting.submitVote(this.dao.address, proposalId, 1, {
      from: myAccount,
      gasPrice: toBN("0"),
    });
    await advanceTime(10000);

    await onboarding.processProposal(this.dao.address, proposalId, {
      from: myAccount,
      gasPrice: toBN("0"),
    });

    try {
      proposalId = getProposalCounter();
      // Create Financing Request with amount = 0
      let requestedAmount = toBN(0);
      await financing.createFinancingRequest(
        this.dao.address,
        proposalId,
        applicant,
        ETH_TOKEN,
        requestedAmount,
        fromUtf8("")
      );
      throw Error(
        "should not be possible to submit a proposal with an amount == 0"
      );
    } catch (err) {
      expect(err.reason).equal("invalid requested amount");
    }
  });

  it("should not be possible to request funding with an invalid proposal id", async () => {
    const financing = this.adapters.financing;

    try {
      let invalidProposalId = "0x0";
      await financing.createFinancingRequest(
        this.dao.address,
        invalidProposalId,
        applicant,
        ETH_TOKEN,
        toBN(10),
        fromUtf8("")
      );
      throw Error("should not be possible to use proposal id == 0");
    } catch (err) {
      expect(err.reason).equal("invalid proposalId");
    }
  });

  it("should not be possible to reuse a proposalId", async () => {
    const financing = this.adapters.financing;
    const onboarding = this.adapters.onboarding;

    let proposalId = getProposalCounter();

    //Add funds to the Guild Bank after sposoring a member to join the Guild
    await onboarding.onboard(
      this.dao.address,
      proposalId,
      newMember,
      SHARES,
      sharePrice.mul(toBN(10)).add(remaining),
      {
        from: myAccount,
        value: sharePrice.mul(toBN(10)).add(remaining),
        gasPrice: toBN("0"),
      }
    );

    try {
      let reusedProposalId = proposalId;
      await financing.createFinancingRequest(
        this.dao.address,
        reusedProposalId,
        applicant,
        ETH_TOKEN,
        toBN(50000),
        fromUtf8(""),
        { gasPrice: toBN("0") }
      );
      throw Error("should not be possible to create a financing request");
    } catch (err) {
      expect(err.reason).equal("proposalId must be unique");
    }
  });

  it("should not be possible to sponsor proposal that does not exist", async () => {
    try {
      let proposalId = "0x1";
      await this.adapters.financing.sponsorProposal(
        this.dao.address,
        proposalId,
        fromUtf8(""),
        {
          from: myAccount,
          gasPrice: toBN("0"),
        }
      );
      throw Error("should not be possible to sponsor");
    } catch (err) {
      expect(err.reason).equal("proposal does not exist for this dao");
    }
  });

  it("should not be possible to sponsor proposal more than once", async () => {
    let proposalId = getProposalCounter();
    await this.adapters.financing.createFinancingRequest(
      this.dao.address,
      proposalId,
      applicant,
      ETH_TOKEN,
      toBN(50000),
      fromUtf8(""),
      { gasPrice: toBN("0") }
    );

    await this.adapters.financing.sponsorProposal(
      this.dao.address,
      proposalId,
      fromUtf8(""),
      {
        from: myAccount,
        gasPrice: toBN("0"),
      }
    );

    try {
      await this.adapters.financing.sponsorProposal(
        this.dao.address,
        proposalId,
        fromUtf8(""),
        {
          from: myAccount,
          gasPrice: toBN("0"),
        }
      );
    } catch (err) {
      expect(err.reason).equal("flag already set");
    }
  });

  it("should not be possible to process a proposal that does not exist", async () => {
    try {
      let proposalId = getProposalCounter();
      await this.adapters.financing.processProposal(
        this.dao.address,
        proposalId,
        {
          from: myAccount,
          gasPrice: toBN("0"),
        }
      );
      throw Error("should not be possible to process it");
    } catch (err) {
      expect(err.reason).equal("adapter not found");
    }
  });

  it("should not be possible to process a proposal that is not sponsored", async () => {
    let proposalId = getProposalCounter();
    await this.adapters.financing.createFinancingRequest(
      this.dao.address,
      proposalId,
      applicant,
      ETH_TOKEN,
      toBN(50000),
      fromUtf8(""),
      { gasPrice: toBN("0") }
    );

    try {
      await this.adapters.financing.processProposal(
        this.dao.address,
        proposalId,
        {
          from: myAccount,
          gasPrice: toBN("0"),
        }
      );
      throw Error("should not be possible to process");
    } catch (err) {
      expect(err.reason).equal("adapter not found");
    }
  });
});
