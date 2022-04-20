import {Wallet} from '@terra-money/terra.js';

// ================================================

export type Uint128 = string;
export type Uint256 = string;
export type Decimal = string;
export type Decimal256 = string;
export type Addr = string;
export type OfBlocksPerEpochPeriod = number;

export type u8 = number;
export type u64 = number;


// ================================================

export const LOCALTERRA_DEFAULT_VALIDATOR_ADDR = "terravaloper1dcegyrekltswvyy0xy69ydgxn9x8x32zdy3ua5";

// ================================================

export interface Cw20Coin {
    address: string,
    amount: string,
}

export interface MinterResponse {
    minter: string,
    cap?: string,
}

export interface EmbeddedLogo {
    svg?: string,
    png?: string,
}

export interface Logo {
    url?: string,
    embedded?: EmbeddedLogo
}

export interface InstantiateMarketingInfo {
    project?: string,
    description?: string,
    marketing?: string,
    logo?: Logo,
}

export interface TokenConfig {
    name: string,
    symbol: string,
    decimals: number,
    initial_balances: Cw20Coin[],
    mint?: MinterResponse,
    marketing?: InstantiateMarketingInfo,
}

// ================================================
// ---ANCHOR---
// ================================================

// Anchor params
// {
//   "quorum": "0.1",
//   "threshold": "0.5",
//   "voting_period": 94097,
//   "timelock_period": 40327,
//   "expiration_period": 13443,
//   "proposal_deposit": "1000000000",
//   "snapshot_period": 13443
// }

export interface AnchorMarkerConfig {
    // Anchor token distribution speed
    anc_emission_rate: Decimal256,
    // Anchor token code ID used to instantiate
    aterra_code_id: number,
    // Maximum allowed borrow rate over deposited stable balance
    max_borrow_factor: Decimal256,
    // Owner address for config update
    owner_addr: Addr,
    // stable coin denom used to borrow & repay
    stable_denom: string,
}

export function AnchorMarkerConfig(
    wallet: Wallet,
    aterra_code_id: number,
): AnchorMarkerConfig {
    return {
        owner_addr: wallet.key.accAddress,
        stable_denom: 'uusd',
        aterra_code_id: aterra_code_id,
        anc_emission_rate: '6793787.950524103374549206',
        max_borrow_factor: '0.95'
    }
}

// ================================================

export interface AnchorOracleConfig {
    base_asset: string,
    owner: Addr,
}

export function AnchorOracleConfig(
    wallet: Wallet
): AnchorOracleConfig {
    return {
        base_asset: 'uusd',
        owner: wallet.key.accAddress
    }
}

// ================================================

export interface AnchorLiquidationConfig {
    // Fee applied to executed bids Sent to Overseer interest buffer
    bid_fee: Decimal256,
    // Liquidation threshold amount in stable denom. When the current collaterals value is smaller than the threshold, all collaterals will be liquidated
    liquidation_threshold: Uint256,
    // Maximum fee applied to liquidated collaterals Sent to liquidator as incentive
    max_premium_rate: Decimal256,
    oracle_contract: Addr,
    owner: Addr,
    // Valid oracle price timeframe
    price_timeframe: number,
    // borrow_amount / borrow_limit must always be bigger than safe_ratio.
    safe_ratio: Decimal256,
    stable_denom: string,
}

export function AnchorLiquidationConfig(
    wallet: Wallet,
    oracle_contract: string,
): AnchorLiquidationConfig {
    return {
        owner: wallet.key.accAddress,
        oracle_contract: oracle_contract,
        stable_denom: 'uusd',
        safe_ratio: '0.8',
        bid_fee: '0.01',
        max_premium_rate: '0.3',
        liquidation_threshold: '500',
        price_timeframe: 60
    }
}

// ================================================

export interface AnchorDistrConfig {
    decrement_multiplier: Decimal256,
    emission_cap: Decimal256,
    emission_floor: Decimal256,
    increment_multiplier: Decimal256,
    owner: Addr,
}

export function AnchorDistrConfig(
    wallet: Wallet,
): AnchorDistrConfig {
    return {
        owner: wallet.key.accAddress,
        emission_cap: '20381363.851572310123647620',
        emission_floor: '6793787.950524103374549206',
        increment_multiplier: '1.007266723782294841',
        decrement_multiplier: '0.997102083349256160',
    }
}

// ================================================

export interface AnchorOverseerConfig {
    // Ratio to be used for purchasing ANC token from the interest buffer
    anc_purchase_factor: Decimal256,
    // Ratio to be distributed from the interest buffer
    buffer_distribution_factor: Decimal256,
    // Collector contract address which is purchasing ANC token
    collector_contract: Addr,
    epoch_period: OfBlocksPerEpochPeriod,
    // Liquidation model contract address to compute liquidation amount
    liquidation_contract: Addr,
    // Market contract address to receive missing interest buffer
    market_contract: Addr,
    // Oracle contract address for collateral tokens
    oracle_contract: Addr,
    // Initial owner address
    owner_addr: Addr,
    //Valid oracle price timeframe
    price_timeframe: number,
    //The base denomination used when fetching oracle price, reward distribution, and borrow
    stable_denom: string,
    // Target deposit rate. When current deposit rate is bigger than this, Custody contracts send rewards to interest buffer
    target_deposit_rate: Decimal256,
    // Distribute interest buffer to market contract, when deposit_rate < threshold_deposit_rate
    threshold_deposit_rate: Decimal256,
}

export function AnchorOverseerConfig(
    wallet: Wallet,
    liquidation_contract: string,
    market_contract: string,
    oracle_contract: string,
): AnchorOverseerConfig {
    return {
        owner_addr: wallet.key.accAddress,
        oracle_contract: oracle_contract,
        market_contract: market_contract,
        liquidation_contract: liquidation_contract,
        collector_contract: wallet.key.accAddress,
        stable_denom: 'uusd',
        epoch_period: 1681,
        threshold_deposit_rate: '0.000000030572045778',
        target_deposit_rate: '0.000000040762727704',
        buffer_distribution_factor: '0.1',
        anc_purchase_factor: '0.1',
        price_timeframe: 60,
    }
}

// ================================================

export interface AnchorInterestConfig {
    base_rate: Decimal256,
    interest_multiplier: Decimal256,
    owner: Addr,
}

export function AnchorInterestConfig(
    wallet: Wallet,
): AnchorInterestConfig {
    return {
        owner: wallet.key.accAddress,
        base_rate: '0.000000004076272770',
        interest_multiplier: '0.000000085601728176',
    }
}

// ================================================

export interface RegisterContractsConfig {
    overseer_contract: Addr,
    interest_model: Addr,
    distribution_model: Addr,
    collector_contract: Addr,
    distributor_contract: Addr,
}

export function RegisterContractsConfig(
    overseer_contract: Addr,
    interest_model: Addr,
    distribution_model: Addr,
    collector_contract: Addr,
    distributor_contract: Addr,
): RegisterContractsConfig {
    return {
        overseer_contract: overseer_contract,
        interest_model: interest_model,
        distribution_model: distribution_model,
        collector_contract: collector_contract,
        distributor_contract: distributor_contract,
    }
}

// ================================================

export interface AnchorHubConfig {
    epoch_period: number,
    underlying_coin_denom: Decimal256,
    unbonding_period: number,
    peg_recovery_fee: Decimal256,
    er_threshold: Decimal256,
    reward_denom: Decimal256,
    validator: Addr,
}

export function AnchorHubBLunaConfig(): AnchorHubConfig {
    return {
        epoch_period: 30,
        underlying_coin_denom: "uluna",
        unbonding_period: 210,
        peg_recovery_fee: "0.001",
        er_threshold: "1",
        reward_denom: "uusd",
        validator: LOCALTERRA_DEFAULT_VALIDATOR_ADDR,
    }
}

// ================================================

export interface BassetRewardConfig {
    hub_contract: Addr,
    reward_denom: String,
}

export function BassetRewardConfig(
    hub_contract: Addr,
): BassetRewardConfig {
    return {
        hub_contract: hub_contract,
        reward_denom: "uusd",
    }
}

// ================================================

export interface BassetTokenConfig {
    name: String,
    symbol: String,
    decimals: number,
    initial_balances: [],
    mint: {
        minter: Addr,
    },
    hub_contract: Addr,
}

export function BLunaTokenConfig(
    hub_contract: Addr,
    minter_addr: Addr,
): BassetTokenConfig {
    return {
        name: "bLuna",
        symbol: "BLUNA",
        decimals: 6,
        initial_balances: [],
        mint: {
            minter: minter_addr,
        },
        hub_contract: hub_contract,
    }
}

// ================================================

export interface AnchorCustodyBlunaConfig {
    // owner address
    owner: Addr,
    // bAsset token address
    collateral_token: Addr,
    overseer_contract: Addr,
    market_contract: Addr,
    reward_contract: Addr,
    liquidation_contract: Addr,
    /// Expected reward denom. If bAsset reward is not same with
    /// it, we try to convert the reward to the `stable_denom`.
    stable_denom: String,
    basset_info: {
        name: String,
        symbol: String,
        decimals: number,
    },
}

export function AnchorCustodyBassetConfig(
    owner: Addr,
    collateral_token: Addr,
    overseer_contract: Addr,
    market_contract: Addr,
    reward_contract: Addr,
    liquidation_contract: Addr,
    basset_name: string,
    basset_symbol: string,
): AnchorCustodyBlunaConfig {
    return {
        owner: owner,
        collateral_token: collateral_token,
        overseer_contract: overseer_contract,
        market_contract: market_contract,
        reward_contract: reward_contract,
        liquidation_contract: liquidation_contract,
        stable_denom: "uusd",
        basset_info: {
            name: basset_name,
            symbol: basset_symbol,
            decimals: 6
        }
    }
}

// ================================================

export interface BethRewardConfig {
    owner: Addr,
    reward_denom: String,
}

export function BethRewardConfig(
    owner: Addr,
): BethRewardConfig {
    return {
        owner: owner,
        reward_denom: "uusd",
    }
}

// ================================================

export interface BethTokenConfig {
    name: String,
    symbol: String,
    decimals: number,
    initial_balances: [],
    reward_contract: Addr,
    mint: {
        minter: Addr
    }
}

export function BethTokenConfig(
    reward_contract: Addr,
    minter_addr: Addr,
): BethTokenConfig {
    return {
        name: "beth",
        symbol: "BETH",
        decimals: 6,
        initial_balances: [],
        mint: {
            minter: minter_addr
        },
        reward_contract: reward_contract,
    }
}

// ================================================

export interface AnchorMarketInfo {
    contract_addr: Addr,
    overseer_addr: Addr,
    oracle_addr: Addr,
    bluna_hub_addr: Addr,
    anchor_token_addr: Addr,
    anc_stable_swap_addr: Addr,
    aterra_token_addr: Addr,
    bluna_token_addr: Addr,
    bluna_custody_addr: Addr,
}

export function AnchorMarketInfo(
    contract_addr: Addr,
    overseer_addr: Addr,
    oracle_addr: Addr,
    bluna_hub_addr: Addr,
    anchor_token_addr: Addr,
    anc_stable_swap_addr: Addr,
    aterra_token_addr: Addr,
    bluna_token_addr: Addr,
    bluna_custody_addr: Addr,
): AnchorMarketInfo {
    return {
        contract_addr: contract_addr,
        overseer_addr: overseer_addr,
        oracle_addr: oracle_addr,
        bluna_hub_addr: bluna_hub_addr,
        anchor_token_addr: anchor_token_addr,
        aterra_token_addr: aterra_token_addr,
        anc_stable_swap_addr: anc_stable_swap_addr,
        bluna_token_addr: bluna_token_addr,
        bluna_custody_addr: bluna_custody_addr,
    }
}

export interface EpochStateResponse {
    exchange_rate: Decimal256,
    aterra_supply: Uint256,
}

// ================================================
// ---Mirror---
// ================================================

// Mirror params
// {
// "quorum": "0.09998",
// "threshold": "0.49989",
// "voting_period": 604800,
// "effective_delay": 86400,
// "expiration_period": 86400,
// "proposal_deposit": "100000000",
// "voter_weight": "0.5",
// "snapshot_period": 86400
// }

//=================================================

export function MirrorTokenConfig(minter: string): TokenConfig {
    return {
        name: "Mirror Governance Token",
        symbol: "MIR",
        decimals: 6,
        initial_balances: [],
        mint: {
            minter: minter,
        }
    }
}

//=================================================

export interface MirrorAdminManagerConfig {
    owner: Addr,
    admin_claim_period: u64,
}

export function MirrorAdminManagerConfig(owner: Addr): MirrorAdminManagerConfig {
    return {
        owner: owner,
        admin_claim_period: 8,
    }
}

//=================================================

export interface MirrorGovConfig {
    mirror_token: Addr,
    effective_delay: u64,
    default_poll_config: PollConfig,
    migration_poll_config: PollConfig,
    auth_admin_poll_config: PollConfig,
    voter_weight: Decimal,
    snapshot_period: u64,
    admin_manager: Addr,
    poll_gas_limit: u64,
}

interface PollConfig {
    proposal_deposit: Uint128,
    voting_period: u64,
    quorum: Decimal,
    threshold: Decimal,
}

export function MirrorGovConfig(
    mirror_token: Addr,
    admin_manager: Addr,
): MirrorGovConfig {
    return {
        mirror_token: mirror_token,
        effective_delay: 8,
        default_poll_config: {
            quorum: "0.1",
            threshold: "0.5",
            voting_period: 8,
            proposal_deposit: "100000000"
        },
        migration_poll_config: {
            quorum: "0.1",
            threshold: "0.5",
            voting_period: 8,
            proposal_deposit: "100000000"
        },
        auth_admin_poll_config: {
            quorum: "0.1",
            threshold: "0.5",
            voting_period: 8,
            proposal_deposit: "100000000"
        },
        voter_weight: "0.5",
        snapshot_period: 8,
        admin_manager: admin_manager,
        poll_gas_limit: 8
    }
}

//=================================================

export interface MirrorCommunityConfig {
    owner: Addr,            // mirror gov contract for prod, but my wallet for tests
    mirror_token: Addr,
    spend_limit: Uint128,
}

export function MirrorCommunityConfig(
    owner: Addr,
    mirror_token: Addr,
): MirrorCommunityConfig {
    return {
        owner: owner,
        mirror_token: mirror_token,
        spend_limit: "50000000000000",
    }
}

//=================================================

export interface MirrorCollectorConfig {
    owner: Addr,    // mirror_factory
    distribution_contract: Addr, // collected rewards receiver(mirror_gov)
    terraswap_factory: Addr,
    mirror_token: Addr,
    base_denom: string,
    // aUST params
    aust_token: Addr,
    anchor_market: Addr,
    // bLuna params
    bluna_token: Addr,
    // Lunax params
    lunax_token: Addr,
    mir_ust_pair: Addr,
}

export function MirrorCollectorConfig(
    owner: Addr,
    distribution_contract: Addr,        // mirror gov contract
    terraswap_factory: Addr,
    mirror_token: Addr,
    aust_token: Addr,
    anchor_market: Addr,
    bluna_token: Addr,
    lunax_token: Addr,
    mir_ust_pair: Addr,
): MirrorCollectorConfig {
    return {
        owner: owner,
        distribution_contract: distribution_contract,
        terraswap_factory: terraswap_factory,
        mirror_token: mirror_token,
        base_denom: "uusd",
        aust_token: aust_token,
        anchor_market: anchor_market,
        bluna_token: bluna_token,
        lunax_token: lunax_token,
        mir_ust_pair: mir_ust_pair,
    }
}

//=================================================

export interface MirrorOracleConfig {
    owner: Addr,    //mirror_factory
    base_asset: string,
}

export function MirrorOracleConfig(owner: Addr): MirrorOracleConfig {
    return {
        owner: owner,
        base_asset: "uusd"
    }
}

//=================================================

export interface MirrorMintConfig {
    owner: Addr, //mirror_factory
    oracle: Addr,
    collector: Addr,
    collateral_oracle: Addr,
    staking: Addr,
    terraswap_factory: Addr,
    lock: Addr,
    base_denom: string,
    token_code_id: u64,
    protocol_fee_rate: Decimal,
}

export function MirrorMintConfig(
    owner: Addr, //mirror_factory
    oracle: Addr,
    collector: Addr,
    collateral_oracle: Addr,
    staking: Addr,
    terraswap_factory: Addr,
    lock: Addr,
    token_code_id: u64,
): MirrorMintConfig {
    return {
        owner: owner,
        oracle: oracle,
        collector: collector,
        collateral_oracle: collateral_oracle,
        staking: staking,
        terraswap_factory: terraswap_factory,
        lock: lock,
        base_denom: "uusd",
        token_code_id: token_code_id,
        protocol_fee_rate: "0.15",
    }
}

//=================================================

export interface MirrorLockConfig {
    owner: Addr,
    mint_contract: Addr,
    base_denom: string,
    lockup_period: u64,
}

export function MirrorLockConfig(
    owner: Addr,
    mint_contract: Addr,
): MirrorLockConfig {
    return {
        owner: owner,
        mint_contract: mint_contract,
        base_denom: "uusd",
        lockup_period: 1209600,
    }
}

//=================================================

export interface MirrorStakingConfig {
    owner: Addr,    //mirror_factory
    mirror_token: Addr,
    mint_contract: Addr,
    oracle_contract: Addr,
    terraswap_factory: Addr,
    base_denom: string,
    premium_min_update_interval: u64,
    short_reward_contract: Addr,
}

export function MirrorStakingConfig(
    owner: Addr,    //mirror_factory
    mirror_token: Addr,
    mint_contract: Addr,
    oracle_contract: Addr,
    terraswap_factory: Addr,
    short_reward_contract: Addr,
): MirrorStakingConfig {
    return {
        owner: owner,
        mirror_token: mirror_token,
        mint_contract: mint_contract,
        oracle_contract: oracle_contract,
        terraswap_factory: terraswap_factory,
        base_denom: "uusd",
        premium_min_update_interval: 360,
        short_reward_contract: short_reward_contract,
    }
}

//=================================================

export interface MirrorCollateralOracleConfig {
    owner: Addr,
    mint_contract: Addr,
    base_denom: string,
}

export function MirrorCollateralOracleConfig(
    owner: Addr,
    mint_contract: Addr,
): MirrorCollateralOracleConfig {
    return {
        owner: owner,
        mint_contract: mint_contract,
        base_denom: "uusd",
    }
}

//=================================================

export interface MirrorFactoryConfig {
    token_code_id: u64,
    base_denom: string,
    distribution_schedule: [u64, u64, Decimal][]
}

export function MirrorFactoryConfig(token_code_id: u64): MirrorFactoryConfig {
    return {
        token_code_id: token_code_id,
        base_denom: "uusd",
        distribution_schedule: [
            [3600, 7200, "1000000"],
            [7200, 10800, "1000000"]
        ]
    }
}

export interface MirrorInfo {
    factory_addr: Addr,
    mint_addr: Addr,
    tefi_oracle_hub_addr: Addr,
    collateral_oracle_addr: Addr,
}

export function MirrorInfo(
    factory_addr: Addr,
    mint_addr: Addr,
    tefi_oracle_hub_addr: Addr,
    collateral_oracle_addr: Addr,
): MirrorInfo {
    return {
        factory_addr: factory_addr,
        mint_addr: mint_addr,
        tefi_oracle_hub_addr: tefi_oracle_hub_addr,
        collateral_oracle_addr: collateral_oracle_addr,
    }
}

// ================================================
// ---TeFi oracle---
// ================================================

export interface TeFiOracleHubConfig {
    owner: Addr,
    base_denom: string,
    max_proxies_per_symbol: u8,
}

export function TeFiOracleHubConfig(
    owner: Addr      // factory
): TeFiOracleHubConfig {
    return {
        owner: owner,
        base_denom: "uusd",
        max_proxies_per_symbol: 8,
    }
}

// ================================================

export interface OracleProxyConfig {
    source_addr: Addr,
}

export function OracleProxyConfig(source_addr: Addr): OracleProxyConfig {
    return {
        source_addr: source_addr,
    }
}

// ================================================
// ---Structured Note---
// ================================================

export interface StructuredNoteConfig {
    stable_denom: String,
    governance_contract: Addr,
    mirror_mint_contract: Addr,
    anchor_market_contract: Addr,
    aterra_addr: Addr,
    nexus_treasury: Addr,
    protocol_fee: Decimal,
    min_over_collateralization: Decimal,
}

export function StructuredNoteConfig(
    governance_contract: Addr,
    mirror_mint_contract: Addr,
    anchor_market_contract: Addr,
    aterra_addr: Addr,
    nexus_treasury: Addr,
): StructuredNoteConfig {
    return {
        stable_denom: "uusd",
        governance_contract: governance_contract,
        mirror_mint_contract: mirror_mint_contract,
        anchor_market_contract: anchor_market_contract,
        aterra_addr: aterra_addr,
        nexus_treasury: nexus_treasury,
        protocol_fee: "0.1",  // There is no logic for protocol profit yet.
        min_over_collateralization: "0.1",
    }
}

export interface FullInitResult {
    terraswap_factory_addr: Addr,
    structured_note_addr: Addr,
    mirror_info: MirrorInfo,
    anchor_info: AnchorMarketInfo,
}

export interface PositionResponse {
    farmer_addr: Addr,
    masset_token: Addr,
    cdp_idx: Uint128,
    leverage: u8,
    loan: Uint128,
    collateral: Uint128,
    aim_collateral_ratio: Decimal,
}

// ================================================
// ---TerraSwap---
// ================================================
export interface PairInfoResponse {
    contract_addr: Addr,
    liquidity_token: Addr,
}