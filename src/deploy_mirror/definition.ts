import {getContractEvents, LCDClient, Wallet} from '@terra-money/terra.js';
import {
    create_contract,
    create_usd_to_token_terraswap_pair,
    execute_contract,
    get_random_addr,
    init_token,
    store_terraswap_token
} from '../utils';
import {
    Addr,
    Decimal,
    MirrorAdminManagerConfig,
    MirrorCollateralOracleConfig,
    MirrorCollectorConfig,
    MirrorFactoryConfig,
    MirrorGovConfig,
    MirrorInfo,
    MirrorLockConfig,
    MirrorMintConfig,
    MirrorStakingConfig,
    MirrorTokenConfig,
    TeFiOracleHubConfig,
    u64,
} from "../config";
import {
    mirror_admin_manager_wasm,
    mirror_collateral_oracle_wasm,
    mirror_collector_wasm,
    mirror_factory_wasm,
    mirror_gov_wasm,
    mirror_lock_wasm,
    mirror_mint_wasm,
    mirror_short_reward_wasm,
    mirror_staking_wasm,
    tefi_oracle_hub_wasm,
} from '../artifacts_paths';
import {isTxSuccess} from "../transaction";

export async function deploy_mirror(
    lcd_client: LCDClient,
    sender: Wallet,
    cw20_code_id: u64,
    terraswap_factory_addr: Addr,
    anchor_market_addr: Addr,
    aust_addr: Addr,
    bluna_addr: Addr
) {

    const random_addr = await get_random_addr();

    // MIR token initialization
    const terraswap_token_code_id = await store_terraswap_token(lcd_client, sender);
    const mirror_token_config = MirrorTokenConfig(sender.key.accAddress);
    const mirror_token_addr = await init_token(lcd_client, sender, terraswap_token_code_id, mirror_token_config);
    const mir_ust_pair_info = await create_usd_to_token_terraswap_pair(lcd_client, sender, terraswap_factory_addr, mirror_token_addr);
    console.log(`MIR to UST terraswap pair info: ${JSON.stringify(mir_ust_pair_info)}`);

    //gov and admin_manager
    const mirror_admin_manager_config = MirrorAdminManagerConfig(sender.key.accAddress);
    const mirror_admin_manager_addr = await create_contract(lcd_client, sender, "mirror_admin_manager", mirror_admin_manager_wasm, mirror_admin_manager_config);

    const mirror_gov_config = MirrorGovConfig(mirror_token_addr, mirror_admin_manager_addr);
    const mirror_gov_addr = await create_contract(lcd_client, sender, "mirror_gov", mirror_gov_wasm, mirror_gov_config);
    await execute_contract(lcd_client, sender, mirror_admin_manager_addr,
        {
            update_owner: {
                owner: mirror_gov_addr
            }
        }
    );

    //factory pre init
    const mirror_factory_config = MirrorFactoryConfig(cw20_code_id);
    const mirror_factory_addr = await create_contract(lcd_client, sender, "mirror_factory", mirror_factory_wasm, mirror_factory_config);

    const lunax_token = await get_random_addr();
    const mirror_collector_config = MirrorCollectorConfig(mirror_factory_addr, mirror_gov_addr, terraswap_factory_addr, mirror_token_addr, aust_addr, anchor_market_addr, bluna_addr, lunax_token, mir_ust_pair_info.pair_contract_addr);
    const mirror_collector_addr = await create_contract(lcd_client, sender, "mirror_collector", mirror_collector_wasm, mirror_collector_config);

    const tefi_oracle_bub_config = TeFiOracleHubConfig(mirror_factory_addr);
    const tefi_oracle_hub_addr = await create_contract(lcd_client, sender, "tefi_oracle_hub", tefi_oracle_hub_wasm, tefi_oracle_bub_config);

    // mint pre init
    const mirror_mint_config = MirrorMintConfig(mirror_factory_addr, tefi_oracle_hub_addr, mirror_collector_addr, random_addr, random_addr, terraswap_factory_addr, random_addr, cw20_code_id);
    const mirror_mint_addr = await create_contract(lcd_client, sender, "mirror_mint", mirror_mint_wasm, mirror_mint_config);

    const mirror_short_rewards_addr = await create_contract(lcd_client, sender, "mirror_short_rewawrds", mirror_short_reward_wasm, {});
    const mirror_staking_config = MirrorStakingConfig(mirror_factory_addr, mirror_token_addr, mirror_mint_addr, tefi_oracle_hub_addr, terraswap_factory_addr, mirror_short_rewards_addr);
    const mirror_staking_addr = await create_contract(lcd_client, sender, "mirror_staking", mirror_staking_wasm, mirror_staking_config);

    const mirror_collateral_oracle_config = MirrorCollateralOracleConfig(sender.key.accAddress, mirror_mint_addr);
    const mirror_collateral_oracle_addr = await create_contract(lcd_client, sender, "mirror_collateral_oracle", mirror_collateral_oracle_wasm, mirror_collateral_oracle_config);

    const mirror_lock_config = MirrorLockConfig(sender.key.accAddress, mirror_mint_addr);
    const mirror_lock_addr = await create_contract(lcd_client, sender, "mirror_lock", mirror_lock_wasm, mirror_lock_config);

    // factory post init
    await execute_contract(lcd_client, sender, mirror_factory_addr,
        {
            post_initialize: {
                commission_collector: mirror_collector_addr,
                mint_contract: mirror_mint_addr,
                mirror_token: mirror_token_addr,
                oracle_contract: tefi_oracle_hub_addr,
                owner: sender.key.accAddress,
                staking_contract: mirror_staking_addr,
                terraswap_factory: terraswap_factory_addr
            }
        }
    );

    //mint post init
    await pass_command(lcd_client, sender, mirror_factory_addr, mirror_mint_addr,
        {
            update_config: {
                collateral_oracle: mirror_collateral_oracle_addr,
                lock: mirror_lock_addr,
                staking: mirror_staking_addr
            }
        },
    );

    return MirrorInfo(mirror_factory_addr, mirror_mint_addr, tefi_oracle_hub_addr, mirror_collateral_oracle_addr);
}

export async function pass_command(lcd_client: LCDClient, sender: Wallet, mirror_factory_addr: Addr, contract_addr: Addr, command: Object) {
    let result = await execute_contract(
        lcd_client,
        sender,
        mirror_factory_addr,
        {
            pass_command: {
                contract_addr: contract_addr,
                msg: Buffer.from(JSON.stringify(command)).toString('base64'),
            }
        },
    );
    return result;
}

export async function whitelist_proxy(lcd_client: LCDClient, sender: Wallet, mirror_factory_addr: Addr, oracle_hub_addr: Addr, oracle_proxy: Addr, provider_name: string) {
    const msg = {
        whitelist_proxy: {
            proxy_addr: oracle_proxy,
            provider_name: provider_name,
        }
    };
    return await pass_command(lcd_client, sender, mirror_factory_addr, oracle_hub_addr, msg);
}

export async function whitelist_masset(
    lcd_client: LCDClient,
    sender: Wallet,
    mirror_factory_addr: Addr,
    name: string,
    symbol: string,
    oracle_proxy: Addr,
    min_collateral_ratio: Decimal
): Promise<Addr> {
    const resp = await execute_contract(lcd_client, sender, mirror_factory_addr,
        {
            whitelist: {
                name: name,
                symbol: symbol,
                oracle_proxy: oracle_proxy,
                params:
                    {
                        auction_discount: "0.2", // random number below 1
                        min_collateral_ratio: min_collateral_ratio,
                    }
            }
        }
    );

    let masset_token = '';

    if (resp !== undefined && isTxSuccess(resp)) {
        let contract_events = getContractEvents(resp);
        for (let contract_event of contract_events) {
            let addr = contract_event["asset_token"];
            if (addr !== undefined) {
                masset_token = addr;
                break;
            }
        }
    } else {
        Error("Mirror factory - whitelist failed");
    }
    return masset_token;
}

export async function register_collateral(lcd_client: LCDClient, sender: Wallet, collateral_oracle_addr: Addr, anchor_market_addr: Addr, aust_addr: Addr) {
    let result = await execute_contract(
        lcd_client,
        sender,
        collateral_oracle_addr,
        {
            register_collateral_asset: {
                asset: {
                    token: {
                        contract_addr: aust_addr,
                    }
                },
                price_source: {
                    anchor_market: {
                        anchor_market_addr: anchor_market_addr,
                    },
                },
                multiplier: "1.0"
            }
        });
    return result;
}