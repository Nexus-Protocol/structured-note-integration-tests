// ===================================================
const artifacts_path = "wasm_artifacts";
const path_to_structured_note_artifacts = `${artifacts_path}/nexus/structured_note`
const path_to_cosmwasm_artifacts = `${artifacts_path}/cosmwasm_plus`;
const path_to_tefi_oracle_artifacts = `${artifacts_path}/tefi_oracle`;
const path_to_terraswap_contracts_artifacts = `${artifacts_path}/terraswap`;
const path_to_anchor_artifacts = `${artifacts_path}/anchor`;
const path_to_mirror_artifacts = `${artifacts_path}/mirror`;
// ===================================================
const path_to_anchor_mm_artifacts = `${path_to_anchor_artifacts}/mm`;
const path_to_anchor_basset_artifacts = `${path_to_anchor_artifacts}/basset`;
const path_to_anchor_beth_artifacts = `${path_to_anchor_artifacts}/beth`;
//====================================================
export const structured_note_wasm = `${path_to_structured_note_artifacts}/structured_note.wasm`;
//====================================================
export const cw20_contract_wasm = `${path_to_cosmwasm_artifacts}/cw20_base.wasm`;
export const tefi_oracle_hub_wasm = `${path_to_tefi_oracle_artifacts}/oracle_hub.wasm`;
export const oracle_proxy_wasm = `${path_to_tefi_oracle_artifacts}/oracle_proxy_nsn_mock.wasm`;
export const terraswap_factory_wasm = `${path_to_terraswap_contracts_artifacts}/terraswap_factory.wasm`;
export const terraswap_pair_wasm = `${path_to_terraswap_contracts_artifacts}/terraswap_pair.wasm`;
export const terraswap_token_wasm = `${path_to_terraswap_contracts_artifacts}/terraswap_token.wasm`;
// ===================================================
export const anchor_market_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_market.wasm`;
export const anchor_oracle_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_oracle.wasm`;
export const anchor_liquidation_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_liquidation.wasm`;
export const anchor_distribution_model_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_distribution_model.wasm`;
export const anchor_interest_model_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_interest_model.wasm`;
export const anchor_overseer_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_overseer.wasm`;
export const anchor_custody_bluna_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_custody_bluna.wasm`;
export const anchor_custody_beth_wasm = `${path_to_anchor_mm_artifacts}/moneymarket_custody_beth.wasm`;
// ===================================================
export const anchor_basset_hub_wasm = `${path_to_anchor_basset_artifacts}/anchor_basset_hub.wasm`;
export const anchor_basset_reward_wasm = `${path_to_anchor_basset_artifacts}/anchor_basset_reward.wasm`;
export const anchor_basset_token_wasm = `${path_to_anchor_basset_artifacts}/anchor_basset_token.wasm`;
// ===================================================
export const anchor_beth_reward_wasm = `${path_to_anchor_beth_artifacts}/anchor_beth_reward.wasm`;
export const anchor_beth_token_wasm = `${path_to_anchor_beth_artifacts}/anchor_beth_token.wasm`;
//====================================================
export const mirror_collateral_oracle_wasm = `${path_to_mirror_artifacts}/mirror_collateral_oracle.wasm`;
export const mirror_collector_wasm = `${path_to_mirror_artifacts}/mirror_collector.wasm`;
export const mirror_community_wasm = `${path_to_mirror_artifacts}/mirror_community.wasm`;
export const mirror_factory_wasm = `${path_to_mirror_artifacts}/mirror_factory.wasm`;
export const mirror_gov_wasm = `${path_to_mirror_artifacts}/mirror_gov.wasm`;
export const mirror_limit_order_wasm = `${path_to_mirror_artifacts}/mirror_limit_order.wasm`;
export const mirror_lock_wasm = `${path_to_mirror_artifacts}/mirror_lock.wasm`;
export const mirror_mint_wasm = `${path_to_mirror_artifacts}/mirror_mint.wasm`;
export const mirror_oracle_wasm = `${path_to_mirror_artifacts}/mirror_oracle.wasm`;
export const mirror_short_reward_wasm = `${path_to_mirror_artifacts}/mirror_short_reward.wasm`;
export const mirror_staking_wasm = `${path_to_mirror_artifacts}/mirror_staking.wasm`;
export const mirror_admin_manager_wasm = `${path_to_mirror_artifacts}/mirror_admin_manager.wasm`;

