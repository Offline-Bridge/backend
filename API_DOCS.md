---

### Part 4: API Documentation (`API_DOCS.md`)

Create a separate file named `API_DOCS.md` for your frontend developer (and judges).

```markdown
# OfflineBridge API Documentation

Base URL: `http://localhost:3000` (or your Ngrok URL)

## 1. Authentication (OTP)

### Request OTP
Sends a 4-digit verification code to the user via SMS.

* **Endpoint:** `POST /api/otp`
* **Body:**
    ```json
    {
      "phoneNumber": "+2349099999999"
    }
    ```
* **Response:** `{ "status": "success", "message": "OTP sent" }`

### Register / Login
Verifies OTP. If the user is new, creates a wallet. If existing, logs them in. If a "Ghost Account", activates it.

* **Endpoint:** `POST /api/register`
* **Body:**
    ```json
    {
      "phoneNumber": "+2349099999999",
      "otp": "1234",
      "pin": "2580",            // Required for New/Ghost users
      "connectedWallet": "0x...", // Optional: Connects Web3 Wallet
      "firstName": "Danny",       // Optional
      "lastName": "Dev",          // Optional
      "email": "danny@test.com"   // Optional
    }
    ```
* **Response (Success):**
    ```json
    {
      "status": "success",
      "message": "Welcome back",
      "user": {
        "address": "0x123...",
        "balance": "0.5"
      }
    }
    ```
* **Errors:**
    * `400`: Invalid OTP.
    * `409`: Wallet address already linked to another phone number.

---

## 2. User Data

### Get User Profile
Fetches public user data.

* **Endpoint:** `GET /api/user/:phone`
* **Example:** `GET /api/user/+2349099999999`
* **Response:**
    ```json
    {
      "status": "success",
      "user": {
        "phoneNumber": "+2349099999999",
        "address": "0x123...",
        "balance": "10.5",
        "firstName": "Danny",
        "isActive": true
      }
    }
    ```

---

## 3. USSD Gateway

### Handle USSD Session
This endpoint is called by Africa's Talking. It is not meant for the Frontend.

* **Endpoint:** `POST /ussd`
* **Format:** `x-www-form-urlencoded`