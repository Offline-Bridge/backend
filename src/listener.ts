import dotenv from "dotenv";
dotenv.config();

import { JsonRpcProvider, formatEther } from "ethers";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

// DELETE or COMMENT OUT these lines:
const credentials = {
    apiKey: process.env.AT_API_KEY!,
    username: process.env.AT_USERNAME || "sandbox",
};

// USE THIS INSTEAD (Replace with your ACTUAL values):
// const credentials = {
//   apiKey:
//     "atsk_9b762cb98d18b34487ca2da029d0b1dfcb725a7da4694de71daab0e95e010e78ac3d0c0c",
//   username: "sandbox", // <--- MUST BE "sandbox" (lowercase)
// };

const AfricasTalking = require("africastalking")(credentials);
const sms = AfricasTalking.SMS;

const provider = new JsonRpcProvider("https://sepolia.base.org");

async function main() {
  console.log("👀 Deposit Listener Started on Base Sepolia...");

    let lastBlock = await provider.getBlockNumber();
//   let lastBlock = 35277715;

  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock <= lastBlock) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      for (let i = lastBlock + 1; i <= currentBlock; i++) {
        await processBlock(i);
        lastBlock = i;
      }
    } catch (error) {
      console.error("Error in loop:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export async function sendSMS(to: string, message: string) {
  try {
    const result = await sms.send({
      to: [to],
      message: message,
    });

    // 🔍 DEBUG: Print the FULL response from Africa's Talking
    console.log(`📩 AT Response:`, JSON.stringify(result, null, 2));
  } catch (error: any) {
    const errorMsg = error.response ? error.response.data : error.message;
    console.error(`❌ SMS Failed: ${errorMsg}`);
  }
}

async function processBlock(blockNumber: number) {
  const block = await provider.getBlock(blockNumber, true);
  if (!block || !block.prefetchedTransactions) return;

  console.log(
    `📦 Processing Block #${blockNumber} (${block.prefetchedTransactions.length} txs)`
  );

  const relevantAddresses = block.prefetchedTransactions
    .map((tx) => tx.to)
    .filter((addr): addr is string => !!addr);

  if (relevantAddresses.length === 0) return;

  const recipients = await db.query.users.findMany({
    where: inArray(users.address, relevantAddresses),
  });

  if (recipients.length === 0) return;

  for (const recipient of recipients) {
    // Find the specific transaction(s) for this user
    const userTxs = block.prefetchedTransactions.filter(
      (tx) => tx.to && tx.to.toLowerCase() === recipient.address.toLowerCase()
    );

    for (const tx of userTxs) {
      const amountEth = formatEther(tx.value);
      console.log(
        `💰 DEPOSIT DETECTED! User: ${recipient.phoneNumber} | Amount: ${amountEth} ETH`
      );

      const currentBalance = parseFloat(recipient.balance);
      const newBalance = (currentBalance + parseFloat(amountEth)).toString();

      await db
        .update(users)
        .set({ balance: newBalance })
        .where(eq(users.phoneNumber, recipient.phoneNumber));
      console.log(`✅ Balance updated: ${currentBalance} -> ${newBalance}`);

      await sendSMS(
        recipient.phoneNumber,
        `Credit Alert! ${amountEth} ETH has been deposited into your OfflineWallet. New Balance: ${newBalance} ETH.`
      );
    }
  }
}

main();
