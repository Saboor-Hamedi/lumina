# Lumina Monetization & Offline Licensing Guide
**Selling Lumina in Indonesia with QRIS, GoPay, DANA & Cryptographic Offline Keys**

---

## 1. Executive Summary

Lumina is a privacy-first, local-first markdown note-taking app. The best business model for local-first desktop apps is **perpetual/lifetime licensing with offline cryptographic activation** (the exact model used by **Typora**, **Sublime Text**, **Tower Git**, and **Novlr**).

* **Zero recurring server costs:** You don't need to run or pay for a 24/7 license authentication server.
* **Frictionless Indonesian checkout:** Users scan a single **QRIS** code using **GoPay**, **DANA**, **OVO**, **ShopeePay**, or any mobile banking app (BCA, Mandiri, BRI).
* **Mathematically impossible to forge:** Using asymmetric cryptography (`Ed25519`), no cracker can create a key generator ("keygen").
* **Permanent customer ownership:** If a customer formats their computer or uninstalls Lumina, they just re-paste their email and key from their receipt.

---

## 2. Indonesian Market Pricing Strategy

In Indonesia, consumers and developers are willing to pay for high-quality native tools, but software priced above Rp 500.000 suffers heavy purchase drop-off.

### Recommended Pricing Tiers

| License Tier | Price (IDR) | Equivalent (USD) | Target Audience | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Lifetime** | **Rp 199.000 – Rp 249.000** | ~$13 – $16 | Developers, Knowledge Workers | Sweet spot. No hesitation purchase. |
| **Early Bird / Promo** | **Rp 149.000** | ~$9.50 | First 100–500 buyers | Builds momentum & word of mouth. |
| **Student Discount** | **Rp 99.000** | ~$6.50 | University / High School | Massive volume in Indonesia. |
| **Commercial / Team** | **Rp 499.000 / seat** | ~$32 | Companies / Freelance agencies | Includes commercial use rights. |

---

## 3. How Indonesian Payment Works (No Direct Bank Deals)

You do **not** need to negotiate contracts with GoPay, DANA, or banks individually. You use an Indonesian **Payment Aggregator / Gateway**.

In Indonesia, **QRIS (Quick Response Code Indonesian Standard)** is universally accepted:
* One QR code handles **GoPay**, **DANA**, **OVO**, **LinkAja**, **ShopeePay**, and all mobile banking apps (**BCA Mobile**, **Livin' Mandiri**, **BRImo**, **CIMB Niaga**).

### Top Recommended Gateways

#### Option A: Mayar.id (Recommended for 100% No-Backend Launch)
* **Website:** [mayar.id](https://mayar.id)
* **Best for:** Selling digital software licenses and digital downloads.
* **Why it shines:** Built-in digital product fulfillment. You upload a batch of license keys, and Mayar automatically emails one unique key to the buyer immediately after payment confirmation.
* **KYC Requirements:** Indonesian KTP + NPWP + Bank Account (Perorangan / Individual account, no PT/CV required).
* **Payment Methods:** QRIS, GoPay, DANA, ShopeePay, Virtual Accounts (BCA, Mandiri, BNI, BRI), Credit Cards.

#### Option B: Midtrans Snap
* **Website:** [midtrans.com](https://midtrans.com) (GoTo Group)
* **Best for:** Custom automated webhooks if you want a branded checkout popup.
* **Why it shines:** Industry standard in Indonesia with reliable developer APIs.

---

## 4. How Offline Cryptographic Licensing Works

Instead of the app pinging a server on every startup to ask *"Is this user paid?"*, offline licensing uses **Asymmetric Public-Key Cryptography (Ed25519)**:

```
[ DEVELOPER'S PRIVATE COMPUTER ]
  Secret Private Key (KEEP SAFE - NEVER SHARE!)
           │
           │  Signs: "budi@gmail.com"
           ▼
  License Key: "LUMINA-V1-Ed25519SignatureBase64..."
           │
           │  (Sent to customer via email upon payment)
           ▼
[ CUSTOMER'S LUMINA APP ]
  Public Key (Hardcoded inside Lumina's main process)
           │
           │  verify("budi@gmail.com", licenseKey, publicKey)
           ▼
       [ VALID? ]
      ├── TRUE  → Unlock Lumina Pro (Write encrypted flag to local storage)
      └── FALSE → "Invalid license key for this email address"
```

### Why This Is Secure

1. **No Keygens Possible:** The public key in Lumina can only **verify** signatures. Only your private key can **create** valid signatures.
2. **Tied to Email:** The key only works for the exact email address purchased. If someone shares their key with a friend, the friend's app must also be registered under the original buyer's email (visible in the app header/settings).
3. **Works 100% Offline:** Great for planes, remote cafes, or users who disconnect from the internet for privacy.

---

## 5. Two Ways to Fulfill Orders

### Method 1: The 100% Zero-Backend Approach (Zero Code, Ready in 1 Hour)
This approach uses Mayar's built-in digital inventory:

1. You run a local Node.js script to pre-generate 500 license keys (e.g. `LUMINA-PRO-BATCH-XXXX...`).
2. You create a **Digital Product** on Mayar: *"Lumina Pro Lifetime License"*.
3. You paste the 500 license keys into Mayar's serial inventory.
4. When a user buys via QRIS / GoPay / DANA:
   * Mayar confirms payment automatically in real-time.
   * Mayar assigns one key from the inventory and emails it to the buyer with the download link.
5. In Lumina, the user enters their email and the issued license key.

### Method 2: Dynamic Signed Keys via Cloudflare Worker (Fully Automated & Personalized)
If you want each key mathematically signed with the buyer's exact email address:

```
[ User pays on Mayar / Midtrans via QRIS ]
                     ↓
        Payment Webhook Triggered
                     ↓
[ Free Cloudflare Worker / Vercel Serverless ]
  • Reads buyer email: budi@gmail.com
  • Generates Ed25519 signature: sign("budi@gmail.com")
  • Emails buyer via Resend.com (free tier)
                     ↓
[ Customer receives personalized key: budi@gmail.com ]
```

---

## 6. Concrete Code Implementation

Here is the exact code needed for Lumina's licensing engine:

### Step 1: Generate Private & Public Key Pair (Run once locally)

Create a developer tool script on your local machine:

```javascript
// scripts/generate-keypair.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Save private key securely (DO NOT COMMIT TO GIT OR BUNDLE IN APP!)
fs.writeFileSync('lumina-private-key.pem', privateKey);

// Public key will be embedded inside Lumina
fs.writeFileSync('lumina-public-key.pem', publicKey);

console.log('✅ Keys generated successfully!');
console.log('Keep lumina-private-key.pem PRIVATE.');
```

---

### Step 2: License Key Issuer Script (For generating keys)

```javascript
// scripts/issue-license.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const privateKeyPem = fs.readFileSync('lumina-private-key.pem', 'utf8');

export function createLicenseKey(email, plan = 'PRO') {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = JSON.stringify({
    app: 'lumina',
    email: normalizedEmail,
    plan: plan,
    v: 1
  });

  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(payload), privateKeyPem).toString('base64url');

  // Format: LUMINA-<payloadBase64>.<signatureBase64>
  return `LUMINA-${payloadBase64}.${signature}`;
}

// Example usage:
const testEmail = 'budi@gmail.com';
console.log(`License for ${testEmail}:`);
console.log(createLicenseKey(testEmail));
```

---

### Step 3: Verification Logic in Lumina (Electron Main Process)

In `src/main/licenseManager.js` (or integrated into your main IPC handlers):

```javascript
// src/main/licenseManager.js
import crypto from 'node:crypto';
import Store from 'electron-store';

const store = new Store({ name: 'lumina-license' });

// Embed your PUBLIC key here (this is safe to include in the app)
const LUMINA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA...YOUR_ED25519_PUBLIC_KEY_HERE...
-----END PUBLIC KEY-----`;

export function verifyLicense(licenseString) {
  try {
    if (!licenseString || !licenseString.startsWith('LUMINA-')) {
      return { valid: false, error: 'Invalid license format' };
    }

    const raw = licenseString.replace('LUMINA-', '');
    const [payloadBase64, signatureBase64] = raw.split('.');

    if (!payloadBase64 || !signatureBase64) {
      return { valid: false, error: 'Malformed license structure' };
    }

    const payloadBuffer = Buffer.from(payloadBase64, 'base64url');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64url');
    const payload = JSON.parse(payloadBuffer.toString('utf8'));

    // Check app identifier
    if (payload.app !== 'lumina') {
      return { valid: false, error: 'License is not for Lumina' };
    }

    // Verify mathematical cryptographic signature
    const isValid = crypto.verify(
      null,
      payloadBuffer,
      LUMINA_PUBLIC_KEY,
      signatureBuffer
    );

    if (!isValid) {
      return { valid: false, error: 'Cryptographic signature verification failed' };
    }

    return {
      valid: true,
      email: payload.email,
      plan: payload.plan
    };
  } catch (err) {
    return { valid: false, error: 'Corrupted license data' };
  }
}

// Save active license securely
export function activateLicense(licenseString) {
  const result = verifyLicense(licenseString);
  if (result.valid) {
    store.set('licenseKey', licenseString);
    store.set('licensedTo', result.email);
    store.set('plan', result.plan);
    return { success: true, licensedTo: result.email, plan: result.plan };
  }
  return { success: false, error: result.error };
}

// Check status on app start
export function getLicenseStatus() {
  const licenseKey = store.get('licenseKey');
  if (!licenseKey) return { isPro: false };
  const verification = verifyLicense(licenseKey);
  return {
    isPro: verification.valid,
    licensedTo: verification.valid ? verification.email : null,
    plan: verification.valid ? verification.plan : null
  };
}
```

---

### Step 4: React UI Component (Settings → License)

Inside your Lumina Settings modal:

```jsx
import React, { useState, useEffect } from 'react';

export function LicenseSettingsTab() {
  const [status, setStatus] = useState({ isPro: false, licensedTo: null });
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('license:getStatus').then(setStatus);
  }, []);

  const handleActivate = async () => {
    setLoading(true);
    setMessage(null);
    const res = await window.electron.ipcRenderer.invoke('license:activate', licenseKeyInput.trim());
    setLoading(false);
    if (res.success) {
      setStatus({ isPro: true, licensedTo: res.licensedTo });
      setMessage({ type: 'success', text: `Activated successfully for ${res.licensedTo}!` });
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to activate.' });
    }
  };

  return (
    <div className="license-settings-panel">
      <h3>License & Activation</h3>
      {status.isPro ? (
        <div className="license-active-card">
          <span className="badge-pro">PRO ACTIVE</span>
          <p>Licensed to: <strong>{status.licensedTo}</strong></p>
          <p className="subtext">Thank you for supporting Lumina development!</p>
        </div>
      ) : (
        <div className="license-inactive-card">
          <p>Enter your Lumina Pro license key to unlock all features:</p>
          <input
            type="text"
            placeholder="LUMINA-..."
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value)}
          />
          <button onClick={handleActivate} disabled={loading || !licenseKeyInput}>
            {loading ? 'Verifying...' : 'Activate License'}
          </button>
          {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
          
          <hr />
          <div className="buy-prompt">
            <p>Don't have a license key yet?</p>
            <a href="https://mayar.link/lumina-pro" target="_blank" rel="noreferrer" className="btn-buy">
              Buy Lumina Pro via QRIS / GoPay / DANA (Rp 199.000)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Security, Cracking & Realistic Protection

### Can this be cracked?
* **Keygen generation:** **IMPOSSIBLE.** Without your private key, no mathematical equation or brute force algorithm can produce a key that passes the Ed25519 verify function.
* **Electron code modification:** Any desktop software (including C++ AAA games or Adobe) can technically be modified with a hex editor or by patching code. For Electron:
  * Don't put license verification in the frontend browser console where a user can type `isPro = true`.
  * Keep all verification in the **Electron Main Process**.
  * Use **Bytenode** (`bytenode.js`) or code obfuscation on `src/main` to compile JavaScript into V8 binary bytecode (`.jsc`), removing readable source code.
  * Enable **ASAR Integrity Verification** in `electron-builder` so altered files fail signature checks.

### The Indie Developer Philosophy
> **Key insight:** You are not fighting Russian state hackers. You are selling to students, developers, writers, and knowledge workers who love Lumina and want to support you. Making purchase easy via QRIS for Rp 199.000 removes 99% of piracy motivation because the friction to buy is lower than searching for a cracked file!

---

## 8. Customer Support & Re-Installation Workflow

### What if the user gets a new computer or formats Windows?
1. The user downloads Lumina installer again from your website or GitHub release.
2. They open their email inbox, search for `"Lumina License"`, and find the key.
3. They paste their email and key into Lumina.
4. Lumina verifies it **instantly offline** and activates.
5. You never have to answer support tickets like *"Please reset my activation counter"*.

---

## 9. Launch Checklist (How to Start Tomorrow)

1. [ ] **Register on Mayar.id** (Individual / Perorangan account with KTP & Bank Account).
2. [ ] **Create Product** titled *"Lumina Pro Lifetime License"* priced at **Rp 199.000**.
3. [ ] **Generate Ed25519 Keypair** locally using `scripts/generate-keypair.mjs`.
4. [ ] **Embed Public Key** in `src/main/licenseManager.js`.
5. [ ] **Add License Tab** in Lumina Settings.
6. [ ] **Pre-generate 100 license keys** and upload them to Mayar's digital inventory.
7. [ ] **Add "Upgrade to Pro" link** inside Lumina pointing to your Mayar checkout link.
8. [ ] **Build production installer** (`npm run build`).
9. [ ] **Post on social media / communities:**
   * Twitter / X tech communities (#IndieHacker, #BuildInPublic)
   * Reddit (`r/indonesia`, `r/productivity`)
   * LinkedIn (Indonesian tech and developer networks)
   * Discord / Telegram productivity groups.

---

## 10. UI & Experience Polish Roadmap

A consolidated wishlist and backlog of candidate polish tasks across Lumina's interface and workflows:

### 1. Media & Viewer Experience (Following PDF Viewer Tab)
* **`ImageViewerTab.jsx` alignment**:
  * Adopt the extracted floating collapsible toolbar pattern (similar to `PDFToolbar.jsx`).
  * Replace hardcoded rgba values with theme tokens (`var(--bg-sidebar)`, `var(--border-dim)`, `var(--text-muted)`).
  * Add zoom presets (25%, 50%, 100%, 200%) and smooth pinch-to-zoom gestures.
* **PDF Navigation & Enhancements**:
  * Add page jump/quick-info indicator inside the toolbar.
  * Add an "Open in Default System Viewer" action alongside the current "Open Containing Folder".

### 2. Modern UI & Theme Consistency
* **Modal Consistency**:
  * Audit modals (`Settings`, `Theme`, `Confirm`, `PromptModal`) in Modern UI mode (`[data-modern-ui='true']`).
  * Ensure uniform `5px` border radius, consistent glassmorphic blur, and padding hierarchy across all dialogs.
* **Status Bar & TabBar Transitions**:
  * Polish tab hover effects and horizontal scroll behavior when 15+ tabs are open.
  * Align right-click tab context menu styling and borders with Modern UI tokens.

### 3. AI Chat & Right Sidebar Polish
* **Composer Interaction Details**:
  * Add quick slash command autocomplete popup inside the sidebar composer (`/summarize`, `/explain`, `/fix`).
  * Add a clear message history button or session switcher right from the sidebar header.
* **Smooth Resizing & Min-Width Enforcements**:
  * Ensure the right sidebar transition between tabs (`details` ↔ `outline` ↔ `chat`) is seamless with zero layout flicker or content jump.

### 4. Keyboard Shortcuts & Command Palette
* **Search Recents & History**:
  * Keep track of recently opened files in the Command Palette so pressing `Ctrl+P` immediately surfaces the last 3–5 visited notes before typing.
* **Action Mode Polish**:
  * When typing `>`, group all available shortcuts, tabs, and workspace commands with clean category badges.

