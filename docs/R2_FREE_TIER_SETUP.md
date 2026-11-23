# Cloudflare R2 Free-Tier Storage Setup & Configuration Guide

**Document Purpose:** Production setup and operational guide for configuring Cloudflare R2 object storage in NyayaSetu.  
**Architecture:** Python 3.12 · FastAPI 0.115 · Boto3 (AWS S3-compatible API with SigV4) · PostgreSQL 16  
**Target Environment:** Production & Staging  

---

## 1. Overview & Cloudflare R2 Free-Tier Benefits

NyayaSetu uses **Cloudflare R2** for production case evidence and document vault storage. R2 is fully compatible with the Amazon S3 API and provides enterprise-grade data durability with substantial cost and security benefits.

### Free-Tier Allowances (Every Month, Forever)
* **Storage:** **10 GB-months** of stored data completely free.
* **Class A Operations (Upload, Mutate, List):** **1,000,000 operations/month** free.
* **Class B Operations (Download, Head):** **10,000,000 operations/month** free.
* **Egress Bandwidth:** **$0 / GB forever.** Unlike AWS S3 (which charges ~$0.09/GB for data transferred out to users), Cloudflare R2 charges **zero egress fees**, allowing citizens and advocates to download evidence and case files without bandwidth cost penalties.

---

## 2. Step-by-Step Cloudflare R2 Setup

Follow these steps in the Cloudflare Dashboard to configure your private R2 bucket and obtain your API credentials.

### Step 1: Access R2 in Cloudflare
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left-hand navigation menu, select **R2 Object Storage**.
3. If this is your first time using R2, click **Purchase R2** or enable the R2 subscription (the free tier requires a payment method on file for fraud prevention, but you are not charged unless you exceed the free-tier thresholds).

---

### Step 2: Create a Dedicated Storage Bucket
1. On the R2 Overview page, click **Create bucket**.
2. **Bucket Name:** Enter a lowercase, unique bucket identifier:
   ```text
   nyayasetu-vault-production
   ```
   *(or `nyayasetu-vault-staging` for staging environments).*
3. **Location:** Select **Automatic** (R2 will automatically locate your bucket in the lowest-latency storage region close to your primary traffic).
4. Click **Create Bucket**.

> [!CAUTION]
> **Keep the Bucket Strictly Private!**  
> Under the bucket's **Settings** tab, **DO NOT** enable **Public access** or connect a **Custom Domain**.  
> The bucket must remain completely private. All file uploads, downloads, and deletions are routed through authenticated backend API permission checks or short-lived (15-minute) SigV4 presigned URLs.

---

### Step 3: Generate S3-Compatible API Credentials
1. In the R2 Object Storage dashboard, click **Manage R2 API Tokens** (found on the right-hand panel of the R2 overview page).
2. Click **Create API Token**.
3. Configure the token permissions:
   * **Token Name:** `nyayasetu-backend-production`
   * **Permissions:** Select **Object Read & Write**.
   * **Specify Bucket(s):** Choose **Apply to specific bucket** and select `nyayasetu-vault-production`.
   * **TTL / Expiry:** Leave blank for a persistent server token, or select an expiry date aligned with your secret rotation policy.
4. Click **Create API Token**.

---

### Step 4: Record Credentials Securely
Cloudflare will display your token credentials **once**. Record them in your secure password manager or production secrets vault:

* **S3 Endpoint URL:** Look for the endpoint URL formatted as:
  ```text
  https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  ```
* **Access Key ID:** A 32-character hexadecimal string.
* **Secret Access Key:** A 64-character hexadecimal string.

> [!WARNING]
> Never commit actual API keys or secrets to Git or share them publicly. Keep them strictly in your server's environment variables or `.env` file (which is git-ignored).

---

## 3. Environment Variables Configuration

NyayaSetu reads storage configuration exclusively from standard environment variables:

| Environment Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `STORAGE_PROVIDER` | Active storage provider backend (`local` or `r2`). | `r2` (in production) |
| `STORAGE_BUCKET` | Name of the private Cloudflare R2 bucket. | `nyayasetu-vault-production` |
| `STORAGE_ENDPOINT_URL` | Cloudflare R2 S3-compatible API endpoint URL. | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | S3 region identifier for Cloudflare R2. | `auto` |
| `STORAGE_ACCESS_KEY_ID` | Cloudflare R2 API Access Key ID. | `<your_access_key_id>` |
| `STORAGE_SECRET_ACCESS_KEY` | Cloudflare R2 API Secret Access Key. | `<your_secret_access_key>` |

### Production Environment (`.env`)
In your production environment or deployment platform (e.g. Docker, Railway, Render, Fly.io, Kubernetes), configure:

```bash
# Storage Provider Selection
STORAGE_PROVIDER=r2

# Cloudflare R2 Bucket & S3 Endpoint
STORAGE_BUCKET=nyayasetu-vault-production
STORAGE_ENDPOINT_URL=https://<your_cloudflare_account_id>.r2.cloudflarestorage.com
STORAGE_REGION=auto

# Cloudflare R2 API Credentials
STORAGE_ACCESS_KEY_ID=0123456789abcdef0123456789abcdef
STORAGE_SECRET_ACCESS_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Development & Automated Test Environment
In local development and automated pytest test suites, no Cloudflare credentials or network access are required:

```bash
# Offline local development & pytest
STORAGE_PROVIDER=local
STORAGE_BUCKET=nyayasetu-vault
STORAGE_REGION=auto
```

---

## 4. Security Architecture & Invariants

1. **Unpredictable Storage Keys:**
   Original filenames (e.g., `cheque_bounce_memo.pdf`, `medical_record.pdf`) are **never** used as object keys in Cloudflare R2 to prevent metadata leakage. The backend generates cryptographically secure, unpredictable keys:
   ```text
   vault/cases/{case_id}/{document_id}_{16_byte_random_token}{ext}
   ```
   The original user-facing filename is stored in PostgreSQL and delivered to authorized clients via the `Content-Disposition` header upon download.

2. **No Browser Credential Exposure:**
   Cloudflare R2 credentials are used exclusively by backend worker threads to sign requests. Frontend clients only receive short-lived (15-minute) HMAC-SHA256 SigV4 presigned URLs.

3. **Strict RBAC Permission Enforcement:**
   Presigned URLs are generated **only after** verifying that the requesting user is the case owner (Citizen), the empanelled lead advocate (Advocate), or a system administrator (Admin).

4. **Production Fail-Safe Startup:**
   If `ENVIRONMENT=production` and `STORAGE_PROVIDER` is set to `local` (or if R2 credentials are missing), the application lifecycle **fails fast on startup** with an actionable `RuntimeError`. The server never silently falls back to local ephemeral storage.

---

## 5. Operational Verification

To verify that the storage abstraction and R2 configuration are functioning correctly:

```bash
cd backend
source ../venv/bin/activate

# Run storage unit and integration test suite (offline mocked S3)
pytest tests/test_storage_r2.py -v

# Run the complete test suite
pytest -v
```
