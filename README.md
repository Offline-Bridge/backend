# 🌉 OfflineBridge: The USSD-to-Blockchain Gateway

**Bringing the unbanked on-chain using basic feature phones.**

OfflineBridge is a financial infrastructure that allows users to create crypto wallets, send funds, and withdraw to external addresses using **USSD (GSM protocol)**. It requires no internet access, no smartphone, and bridges the gap between offline users and the Base Layer 2 Blockchain.

## 🚀 Key Features

* **Offline Wallet Creation:** Generates an EVM address via USSD (`*384*...#`).
* **Gasless Internal Transfers:** Instant P2P transfers using phone numbers.
* **Viral Onboarding:** Sending money to a non-registered number creates a "Ghost Account" for them automatically.
* **Real-Time Deposits:** A background listener watches the Blockchain and credits the USSD wallet via SMS notification.
* **Security:** Private keys are encrypted using **AES-256-CBC** before storage.
* **Web Dashboard:** Optional frontend for users to connect their Web3 wallets and manage their identity.

---

## 🛠️ Tech Stack

* **Runtime:** Bun (Fast JavaScript runtime)
* **Framework:** ElysiaJS (High-performance API)
* **Database:** PostgreSQL (Neon) with Drizzle ORM
* **Blockchain:** Base Sepolia (Testnet)
* **SMS/USSD:** Africa's Talking API
* **Tunneling:** Ngrok

---

## ⚙️ Setup & Installation

### 1. Prerequisites
* [Bun](https://bun.sh) installed.
* A PostgreSQL database URL (Local or Neon.tech).
* Africa's Talking Sandbox Account.

### 2. Environment Variables
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Africa's Talking (Sandbox Credentials)
AT_USERNAME="sandbox"
AT_API_KEY="your_at_api_key"

# Security (32-byte Hex String)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY="your_generated_encryption_key"
```

### 3. Intalltion
```bash
bun install
```

### 4. Database Migration
Push the schema to your database:
```bash
bunx drizzle-kit push
```

---

## 🏃‍♂️ Running the Project
We use `concurrently` to run the API Server and the Blockchain Listener simultaneously.
```bash
bun run start:all
```

* **Blue Logs** The API/USSD Server (Port 3000)
* **Magenta Logs** The Blockchain Listener (Watching Base Sepolia)

---

## 🧪 Testing
**1. USSD (via Simulator)**
    * Run ngrok http `3000`
    * Paste the URL into Africa's Talking USSD Sandbox Callback.
    * Launch Simulator and dial your code.

**2. Frontend API**
See `API_DOCS.md` for details on how the frontend connects.

---

## 🛡️ Security Note
This project uses Symmetric Encryption for private key storage.
* Keys are encrypted at rest in the database.
* Keys are decrypted in memory only during a withdrawal transaction.
* Ghost accounts are encrypted immediately upon creation.