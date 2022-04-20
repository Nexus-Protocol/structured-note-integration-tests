## Required dependencies

1. https://github.com/Anchor-Protocol/money-market-contracts (`v0.3.1` tag);
2. https://github.com/Anchor-Protocol/anchor-token-contracts (`v0.3.0` tag);
3. https://github.com/Anchor-Protocol/anchor-bAsset-contracts( `v0.2.1` tag);
4. https://github.com/Anchor-Protocol/anchor-bEth-contracts (`v0.2.0` tag);

---

5. https://github.com/Mirror-Protocol/mirror-contracts (`v2.2.0` tag);

---

6. https://github.com/1Zaitsev/tefi-oracle-contracts/tree/oracle_proxy_nsn_mock

## Environment setup

### LocalTerra/config/config.toml

Not obligatory but recommended for same precision where it depends on blocks per second

```toml
[consensus]
timeout_precommit = "200ms"
timeout_propose = "200ms"
timeout_propose_delta = "200ms"
timeout_prevote = "200ms"
timeout_prevote_delta = "200ms"
timeout_precommit_delta = "200ms"
timeout_commit = "200ms"
```

### LocalTerra/config/genesis.json

For 100% predictable tax

```json
{
  "app_state": {
    "treasury": {
      "params": {
        "params": {
          "tax_policy": {
            "rate_min": "0.010000000000000000",
            "rate_max": "0.010000000000000000",
            "change_rate_max": "0.000000000000000000"
          }
        }
      }
    }
  }
}
```