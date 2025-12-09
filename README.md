Demo Consent API

A minimal DPDP-style Consent Manager API built using Node.js, Express, JWT (JWS), and RSA signatures.
This project demonstrates how digital consent can be created, validated, signed, revoked, and verified using JSON Web Signatures.

⚠️ This is a demo-only implementation.
Data is stored in-memory and RSA keys rotate on each server restart.

⭐ Features

Create consent artifacts (signed JWS)

Validate consent in real time

Revoke consent with updated signature

Public-key endpoint for verifying JWS externally

Ephemeral RSA keypair auto-generated on each restart

Simple in-memory storage (no database needed)

📁 Project Structure
Demo-consent-api/
│── server.js
│── package.json
│── package-lock.json
└── README.md

🚀 Getting Started
1. Install dependencies
npm install express jsonwebtoken uuid

2. Run the server
node server.js


Server will start at:

http://localhost:3000

🔑 RSA Keypair (Auto Generated)

On every server restart, a fresh RSA keypair is created:

publicKey — returned via /public-keys

privateKey — used to sign consent artifacts (JWS)

Keys rotate on restart (old tokens become invalid)

📡 API Endpoints
▶️ POST /consents — Create Consent

Creates a new signed consent artifact.

Request Body (Required Fields)
{
  "data_principal": { "id": "user:alice", "name": "Alice" },
  "data_fiduciary": { "id": "fid:acme", "name": "Acme Ltd" },
  "purposes": [
    { "purpose_id": "analytics", "description": "Analytics Processing" }
  ],
  "data_types": ["email"],
  "consent_method": "express_click",
  "starts_at": "2025-12-01T00:00:00.000Z",
  "expires_at": "2026-12-01T00:00:00.000Z",
  "metadata": {}
}

Response (201)

Returns a full consent artifact containing:

A unique consent_id

Purpose, principal, fiduciary data

Status: active

A JWS proof signed using RS256

▶️ GET /consents/:id — Fetch Consent

Retrieve a stored consent artifact.

Response
{ ...full artifact... }

404
{ "error": "not found" }

▶️ POST /consents/validate — Validate Consent

Checks if a matching active, unexpired, signature-valid consent exists.

Request Body
{
  "principal_id": "user:alice",
  "fiduciary_id": "fid:acme",
  "purpose_id": "analytics",
  "data_types": ["email"]
}

Success Response
{
  "valid": true,
  "consent_id": "urn:consent:uuid:...",
  "status": "active",
  "granted_at": "...",
  "proof": { "kid": "...", "jws": "..." }
}

No match
{ "valid": false, "reason": "no_matching_consent" }

▶️ POST /consents/:id/revoke — Revoke Consent

Marks consent as revoked and re-signs the updated artifact.

Request Body (Optional)
{
  "reason": "user_revoked"
}

Response

Returns updated artifact with:

status: revoked

revoked_at timestamp

updated proof.jws

▶️ GET /public-keys — Get Signing Keys

Returns the current RSA public key for verifying JWS signatures.

Response
{
  "keys": [
    {
      "kid": "demo-key-<timestamp>",
      "publicKey": "-----BEGIN PUBLIC KEY-----..."
    }
  ]
}

🧠 How It Works (Simplified)
User sends consent input → /consents
Server generates:
UUID-based consent_id
Signed JWS proof using RS256
Consent stored in-memory
Validation route checks:
Status
Expiry
Purpose match

Principal & fiduciary match

Data types subset

JWS verification

Revocation updates artifact + re-signs JWS
