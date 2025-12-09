// demo-consent-api/server.js
// Minimal DPDP-style Consent Manager demo API
// Setup:
// 1) Create package.json with: { "type": "module" }
// 2) npm install express jsonwebtoken uuid
// 3) node server.js

import express from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPairSync } from "crypto";

const app = express();
app.use(express.json());

// Generate ephemeral RSA keypair for demo (rotate on restart)
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const KEY_ID = `demo-key-${Date.now()}`;

// In-memory consent store: Map<consent_id, artifact>
const store = new Map();

// Create consent
app.post("/consents", (req, res) => {
  const body = req.body;
  // minimal validation
  if (!body.data_principal || !body.data_fiduciary || !body.purposes) {
    return res.status(400).json({ error: "data_principal, data_fiduciary, purposes required" });
  }

  const consent_id = `urn:consent:uuid:${uuidv4()}`;
  const now = new Date().toISOString();
  const artifact = {
    consent_id,
    version: "1.0",
    data_principal: body.data_principal,
    data_fiduciary: body.data_fiduciary,
    purposes: body.purposes,
    data_types: body.data_types || [],
    consent_method: body.consent_method || "express_click",
    granted_at: now,
    starts_at: body.starts_at || now,
    expires_at: body.expires_at || null,
    status: "active",
    metadata: body.metadata || {},
  };

  // create JWS (compact) signing the canonicalized artifact as payload
  const payload = { artifact }; // wrap to keep token simple
  const token = jwt.sign(payload, privateKey, { algorithm: "RS256", keyid: KEY_ID });
  artifact.proof = {
    signed_by: "demo-consent-manager",
    signing_algorithm: "RS256",
    kid: KEY_ID,
    jws: token,
  };

  store.set(consent_id, artifact);
  return res.status(201).json(artifact);
});

// Get artifact
app.get("/consents/:id", (req, res) => {
  const id = req.params.id;
  const a = store.get(id);
  if (!a) return res.status(404).json({ error: "not found" });
  return res.json(a);
});

// Validate consent (real-time check)
app.post("/consents/validate", (req, res) => {
  const { principal_id, fiduciary_id, purpose_id, data_types } = req.body;
  if (!principal_id || !fiduciary_id || !purpose_id) {
    return res.status(400).json({ error: "principal_id, fiduciary_id, purpose_id required" });
  }

  // find matching consent: naive linear search in demo
  for (const artifact of store.values()) {
    // Check status
    if (artifact.status !== "active") continue;
    
    // Check expiration
    if (artifact.expires_at && new Date(artifact.expires_at) < new Date()) continue;
    
    // Check principal
    if (artifact.data_principal?.id !== principal_id) continue;
    
    // Check fiduciary
    if (artifact.data_fiduciary?.id !== fiduciary_id) continue;

    // Check purpose match
    const purposeMatch = artifact.purposes.some(p => p.purpose_id === purpose_id);
    if (!purposeMatch) continue;

    // Check data types subset
    if (data_types && data_types.length > 0) {
      const allowed = artifact.data_types || [];
      const allPresent = data_types.every(dt => allowed.includes(dt));
      if (!allPresent) continue;
    }

    // Verify signature
    try {
      jwt.verify(artifact.proof.jws, publicKey, { algorithms: ["RS256"] });
      
      // All checks passed - return valid consent
      return res.json({
        valid: true,
        consent_id: artifact.consent_id,
        status: artifact.status,
        granted_at: artifact.granted_at,
        proof: { kid: artifact.proof.kid, jws: artifact.proof.jws },
      });
    } catch (e) {
      // Signature invalid, continue searching
      console.error("Invalid signature for consent:", artifact.consent_id, e.message);
      continue;
    }
  }

  // No matching consent found
  return res.json({ valid: false, reason: "no_matching_consent" });
});

// Revoke consent
app.post("/consents/:id/revoke", (req, res) => {
  const id = req.params.id;
  const a = store.get(id);
  if (!a) return res.status(404).json({ error: "not found" });
  if (a.status === "revoked") return res.status(400).json({ error: "already revoked" });

  a.status = "revoked";
  a.revoked_at = new Date().toISOString();
  a.revocation_reason = req.body.reason || "user_revoked";

  // re-sign updated artifact
  const payload = { artifact: a };
  const token = jwt.sign(payload, privateKey, { algorithm: "RS256", keyid: KEY_ID });
  a.proof = { signed_by: "demo-consent-manager", signing_algorithm: "RS256", kid: KEY_ID, jws: token };
  store.set(id, a);
  return res.json(a);
});

// Public keys endpoint
app.get("/public-keys", (req, res) => {
  return res.json({ keys: [{ kid: KEY_ID, publicKey }] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Demo Consent API listening on http://localhost:${PORT}`));