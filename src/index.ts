import dotenv from "dotenv";
dotenv.config();

import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { ethers, JsonRpcProvider, parseEther, formatEther } from "ethers";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, verificationCodes } from "./db/schema";
// using AES-256-CBC encryption to secure the keys
import { encrypt, decrypt } from "./utils/crypto";
import { sendSMS } from "./listener";

const provider = new JsonRpcProvider("https://sepolia.base.org/");

const app = new Elysia()

  .model({
    ussd: t.Object({
      // sessionId: t.String(),
      // serviceCode: t.String(),
      phoneNumber: t.String(),
      text: t.String(),
    }),
  })
  .use(
    swagger({
      path: "/v1/docs",
      documentation: {
        info: {
          title: "OfflineBridge API",
          version: "1.0.0",
          description: "USSD-to-Blockchain Payment Gateway API",
        },
        tags: [
          { name: "Auth", description: "OTP and Registration" },
          { name: "User", description: "User data and balances" },
          { name: "USSD", description: "Africa's Talking Webhooks" },
        ],
      },
    })
  );

const clean = (str: string) => str.replace(/^\s+/gm, "").trim();

app.post(
  "/ussd",
  async ({ body, set }) => {
    const { phoneNumber, text } = body;

    const args = text ? text.split("*") : [];
    const currentStep = args.length;

    let response = "";

    const user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, phoneNumber),
    });

    if (!user) {
      if (text === "") {
        response = `CON Welcome to OfflineBridge.
            1. Create Wallet`;
      } else if (args[0] === "1") {
        if (args.length === 1) {
          response = `CON Set a 4-digit PIN to secure your wallet:`;
        } else if (args.length === 2) {
          const pin = args[1];

          if (pin.length !== 4 || isNaN(Number(pin))) {
            response = `END Invalid PIN. Must be 4 digits. Dial again.`;
          } else {
            const wallet = ethers.Wallet.createRandom();

            const encryptedPrivateKey = encrypt(wallet.privateKey);

            await db.insert(users).values({
              phoneNumber,
              address: wallet.address.toLowerCase(),
              privateKey: encryptedPrivateKey,
              balance: "0",
              pin,
              isActive: true,
            });

            response = `END Wallet Created!
                    Address: ${wallet.address.substring(0, 6)}...
                    PIN Set. Dial again to transact.`;
          }
        }
      }
    } else if (user && !user.isActive) {
      if (text === "") {
        response = `CON Welcome! You have ${user.balance} ETH waiting for you.
            To claim your funds, please create a 4-digit PIN:`;
      } else {
        const pin = args[0];

        if (pin.length !== 4 || isNaN(Number(pin))) {
          response = `END Invalid PIN. Must be 4 digits. Dial again.`;
        } else {
          await db
            .update(users)
            .set({
              pin,
              isActive: true,
            })
            .where(eq(users.phoneNumber, phoneNumber));

          response = `END Account Activated!
                Funds Claimed: ${user.balance} ETH
                Dial again to use your wallet.`;
        }
      }
    } else {
      if (text === "") {
        response = `CON Welcome back!
            1. Check Balance
            2. Send Money (Internal)
            3. Withdraw (External)`;
      } else if (args[0] === "1") {
        response = `END Balance: ${user.balance} ETH
            Addr: ${user.address.substring(0, 6)}...`;
      } else if (args[0] === "2") {
        if (args.length === 1) {
          response = `CON Enter recipient's phone number:`;
        } else if (args.length === 2) {
          response = `CON Enter amount to send:`;
        } else if (args.length === 3) {
          const recipientPhone = args[1];
          const amount = args[2];

          response = `CON Sending ${amount} ETH to ${recipientPhone}.
                Enter PIN to confirm:`;
        } else if (args.length === 4) {
          const recipientPhone = args[1];
          const amount = args[2];
          const pin = args[3];

          if (pin !== user.pin) {
            response = `END Invalid PIN. Transaction cancelled.`;
          } else if (parseFloat(amount) > parseFloat(user.balance)) {
            response = `END Insufficient balance. You have ${user.balance}.`;
          } else {
            let recipientUser = await db.query.users.findFirst({
              where: eq(users.phoneNumber, recipientPhone),
            });

            if (!recipientUser) {
              const ghostWallet = ethers.Wallet.createRandom();
              const encryptedGhostKey = encrypt(ghostWallet.privateKey);

              const [newUser] = await db
                .insert(users)
                .values({
                  phoneNumber: recipientPhone,
                  address: ghostWallet.address.toLowerCase(),
                  privateKey: encryptedGhostKey,
                  balance: "0",
                  isActive: false,
                  pin: null,
                })
                .returning(); // <--- Important: Returns the created row

              recipientUser = newUser;

              console.log(`👻 Ghost Account created for ${recipientPhone}`);
            }

            const newSenderBal = (
              parseFloat(user.balance) - parseFloat(amount)
            ).toString();
            const newRecipBal = (
              parseFloat(recipientUser.balance) + parseFloat(amount)
            ).toString();

            await db
              .update(users)
              .set({ balance: newSenderBal })
              .where(eq(users.phoneNumber, user.phoneNumber));

            await db
              .update(users)
              .set({ balance: newRecipBal })
              .where(eq(users.phoneNumber, recipientPhone));

            response = `END Sent ${amount} ETH to ${recipientPhone} successfully!
New Balance: ${newSenderBal}
(Recipient notified via SMS)`;
          }
        }
      } else if (args[0] === "3") {
        if (args.length === 1) {
          response = `CON Enter Destination Wallet Address (0x...):`;
        } else if (args.length === 2) {
          response = `CON Enter Amount to Withdraw:`;
        } else if (args.length === 3) {
          const destAddr = args[1];
          const amount = args[2];
          response = `CON Withdrawing ${amount} ETH to ${destAddr.substring(
            0,
            6
          )}...
                
                Network Fee will apply.
                Enter PIN to confirm:`;
        } else if (args.length === 4) {
          const destAddr = args[1];
          const amountStr = args[2];
          const pin = args[3];

          if (user.pin !== pin) {
            response = `END Incorrect PIN.`;
          } else if (parseFloat(user.balance) < parseFloat(amountStr)) {
            response = `END Insufficient Balance in App.`;
          } else {
            try {
              const decryptedPrivateKey = decrypt(user.privateKey);
              const signer = new ethers.Wallet(decryptedPrivateKey, provider);

              const amountWei = parseEther(amountStr);

              const feeData = await provider.getFeeData();
              const gasPrice = feeData.gasPrice || parseEther("0.0000001");
              const estimatedGas = await signer.estimateGas({
                to: destAddr,
                value: amountWei,
              });

              const gasCost = estimatedGas * gasPrice;
              const totalCostWei = amountWei + gasCost;

              const realBalance = await provider.getBalance(signer.address);
              if (realBalance < totalCostWei) {
                response = `END Withdrawal Failed. 
         Insufficient gas. You need ${formatEther(gasCost)} ETH for fees.`;
              } else {
                const tx = await signer.sendTransaction({
                  to: destAddr,
                  value: amountWei,
                });

                const receipt = await tx.wait();

                const actualGasCost = receipt!.gasUsed * receipt!.gasPrice;
                const totalSpentEth = formatEther(amountWei + actualGasCost);

                const newBalance = (
                  parseFloat(user.balance) - parseFloat(totalSpentEth)
                ).toString();

                await db
                  .update(users)
                  .set({ balance: newBalance })
                  .where(eq(users.phoneNumber, user.phoneNumber));

                response = `END Withdrawal Successful!
        Tx: ${tx.hash.substring(0, 6)}...
        Fee: ${formatEther(actualGasCost).substring(0, 8)} ETH
        New Bal: ${newBalance.substring(0, 8)}`;
              }
            } catch (error) {
              console.error(error);
              response = `END Transaction Failed. Network error or invalid address.`;
            }
          }
        }
      }
    }

    set.headers["Content-Type"] = "text/plain";
    return clean(response);
  },
  {
    body: "ussd",
    detail: {
      tags: ["USSD"],
      summary: "USSD Webhook",
      description: "Endpoint for Africa's Talking to push USSD sessions.",
    },
  }
);

app.group("/api", (app) =>
  app
    .post(
      "/otp",
      async ({ body, set }) => {
        const { phoneNumber } = body as { phoneNumber: string };

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await db
          .insert(verificationCodes)
          .values({
            phoneNumber,
            code: otp,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: verificationCodes.phoneNumber,
            set: { code: otp, expiresAt },
          });

        console.log(`🔐 Database OTP for ${phoneNumber}: ${otp}`);
        await sendSMS(phoneNumber, `Your OfflineBridge code is: ${otp}`);

        return { status: "success", message: "OTP sent" };
      },
      {
        detail: {
          tags: ["Auth"],
          summary: "Request OTP",
        },
        body: t.Object({
          phoneNumber: t.String(),
        }),
      }
    )
    .post(
      "/register",
      async ({ body, set }) => {
        const {
          phoneNumber,
          otp,
          pin,
          firstName,
          lastName,
          email,
          connectedWallet,
        } = body as any;

        const storedAuth = await db.query.verificationCodes.findFirst({
          where: eq(verificationCodes.phoneNumber, phoneNumber),
        });

        if (
          !storedAuth ||
          storedAuth.code !== otp ||
          new Date() > storedAuth.expiresAt
        ) {
          set.status = 400;
          return { status: "error", message: "Invalid or Expired OTP" };
        }

        if (connectedWallet) {
          const walletOwner = await db.query.users.findFirst({
            where: eq(users.connectedWallet, connectedWallet),
          });

          if (walletOwner && walletOwner.phoneNumber !== phoneNumber) {
            set.status = 409;
            return {
              status: "error",
              message: "Wallet already linked to another account",
            };
          }
        }
        await db
          .delete(verificationCodes)
          .where(eq(verificationCodes.phoneNumber, phoneNumber));

        const user = await db.query.users.findFirst({
          where: eq(users.phoneNumber, phoneNumber),
        });

        // SCENARIO: EXISTING ACTIVE USER (Login)
        if (user && user.isActive) {
          await db
            .update(users)
            .set({
              firstName,
              lastName,
              email,
              connectedWallet: connectedWallet,
            })
            .where(eq(users.phoneNumber, phoneNumber));

          return {
            status: "success",
            message: "Welcome back",
            user: { address: user.address, balance: user.balance },
          };
        }

        // SCENARIO: GHOST ACCOUNT (Activate)
        if (user && !user.isActive) {
          await db
            .update(users)
            .set({
              pin: pin,
              isActive: true,
              firstName,
              lastName,
              email,
              connectedWallet: connectedWallet,
            })
            .where(eq(users.phoneNumber, phoneNumber));

          return {
            status: "success",
            message: "Account Activated",
            user: { address: user.address, balance: user.balance },
          };
        }

        // SCENARIO: NEW USER (Create)
        if (!user) {
          const wallet = ethers.Wallet.createRandom();
          const encryptedPrivateKey = encrypt(wallet.privateKey);

          await db.insert(users).values({
            phoneNumber,
            address: wallet.address.toLowerCase(),
            privateKey: encryptedPrivateKey,
            balance: "0",
            pin,
            isActive: true,
            firstName,
            lastName,
            email,
            connectedWallet: connectedWallet,
          });

          return {
            status: "success",
            message: "Account Created",
            user: { address: wallet.address, balance: "0" },
          };
        }
      },
      {
        detail: {
          tags: ["Auth"],
          summary: "Verify OTP & Create Account",
          description:
            "Verifies the OTP sent to the user and creates a new wallet or logs them in.",
        },
        body: t.Object({
          phoneNumber: t.String(),
          otp: t.String(),
          pin: t.String(),
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          email: t.Optional(t.String()),
          connectedWallet: t.Optional(t.String()),
        }),
      }
    )

    .get(
      "/user/:phone",
      async ({ params, set }) => {
        const phoneNumber = params.phone;

        const user = await db.query.users.findFirst({
          where: eq(users.phoneNumber, phoneNumber),
        });

        if (!user) {
          set.status = 404;
          return { status: "error", message: "User not found" };
        }

        return {
          status: "success",
          user: {
            phoneNumber: user.phoneNumber,
            address: user.address,
            balance: user.balance,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            isActive: user.isActive,
          },
        };
      },
      {
        detail: {
          tags: ["User"],
          summary: "Get User Profile",
        },
        params: t.Object({
          phone: t.String(),
        }),
      }
    )
);

app.get("/", () => "Hello Elysia").listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
