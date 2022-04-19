import {Coin, getContractEvents, LCDClient, Wallet} from '@terra-money/terra.js';
import {
    create_contract,
    create_usd_to_token_terraswap_pair,
    execute_contract,
    init_terraswap_factory,
    instantiate_contract,
    instantiate_contract_raw,
    store_contract
} from '../utils';
import {
    Addr,
    AnchorCustodyBassetConfig,
    AnchorDistrConfig,
    AnchorHubBLunaConfig,
    AnchorInterestConfig,
    AnchorLiquidationConfig,
    AnchorMarkerConfig,
    AnchorMarketInfo,
    AnchorOracleConfig,
    AnchorOverseerConfig,
    BassetRewardConfig,
    BLunaTokenConfig,
    TokenConfig,
    u64
} from '../config';
import {
    anchor_basset_hub_wasm,
    anchor_basset_reward_wasm,
    anchor_basset_token_wasm,
    anchor_custody_bluna_wasm,
    anchor_distribution_model_wasm,
    anchor_interest_model_wasm,
    anchor_liquidation_wasm,
    anchor_market_wasm,
    anchor_oracle_wasm,
    anchor_overseer_wasm,
} from '../artifacts_paths';

export async function init_token(lcd_client: LCDClient, sender: Wallet, code_id: number, init_msg: TokenConfig): Promise<string> {
    let contract_addr = await instantiate_contract(lcd_client, sender, sender.key.accAddress, code_id, init_msg);
    return contract_addr;
}

export async function deploy_anchor(
    lcd_client: LCDClient,
    sender: Wallet,
    cw20_code_id: u64,
    terraswap_factory_addr: Addr
): Promise<AnchorMarketInfo> {

    let anchor_token_config = {
        name: "Anchor governance token",
        symbol: "ANC",
        decimals: 6,
        initial_balances: [],
        mint: {
            minter: sender.key.accAddress,
        },
    };

    let anchor_token_addr = await init_token(lcd_client, sender, cw20_code_id, anchor_token_config);
    console.log(`anchor_token instantiated\n\taddress: ${anchor_token_addr}`);
    console.log(`=======================`);

    console.log(`Instantiating Anchor contracts...\n\t`);

    let anchor_market_code_id = await store_contract(lcd_client, sender, anchor_market_wasm);
    console.log(`anchor_market uploaded\n\tcode_id: ${anchor_market_code_id}`);
    let anchor_market_config = AnchorMarkerConfig(sender, cw20_code_id);

    let anchor_market_deployment_result = await instantiate_contract_raw(
        lcd_client,
        sender,
        sender.key.accAddress,
        anchor_market_code_id,
        anchor_market_config,
        [new Coin("uusd", 1_000_000)],
    );

    let anchor_market_deployment_events = getContractEvents(anchor_market_deployment_result);

    let anchor_market_addr = '';
    let aterra_token_addr = '';

    for (let contract_event of anchor_market_deployment_events) {
        let contract_addr = contract_event["contract_address"];
        if (anchor_market_addr !== undefined) {
            anchor_market_addr = contract_addr;
        }

        let aterra = contract_event["aterra"];
        if (aterra_token_addr !== undefined) {
            aterra_token_addr = aterra;
        }
    }

    console.log(`Anchor market instantiated\n\taddress: ${anchor_market_addr}`);
    console.log(`=======================`);

    console.log(`Aterra token instantiated\n\taddress: ${aterra_token_addr}`);
    console.log(`=======================`);

    let anchor_oracle_config = AnchorOracleConfig(sender);
    let anchor_oracle_addr = await create_contract(lcd_client, sender, "anchor_oracle", anchor_oracle_wasm, anchor_oracle_config);
    console.log(`=======================`);

    let anchor_liquidation_config = AnchorLiquidationConfig(sender, anchor_oracle_addr);
    let anchor_liquidation_addr = await create_contract(lcd_client, sender, "anchor_liquidation", anchor_liquidation_wasm, anchor_liquidation_config);
    console.log(`=======================`);

    let anchor_distribution_model_config = AnchorDistrConfig(sender);
    let anchor_distribution_model_addr = await create_contract(lcd_client, sender, "anchor_distribution_model", anchor_distribution_model_wasm, anchor_distribution_model_config);
    console.log(`=======================`);

    let anchor_overseer_config = AnchorOverseerConfig(sender, anchor_liquidation_addr, anchor_market_addr, anchor_oracle_addr);
    let anchor_overseer_addr = await create_contract(lcd_client, sender, "anchor_overseer", anchor_overseer_wasm, anchor_overseer_config);
    console.log(`=======================`);

    let anchor_interest_model_config = AnchorInterestConfig(sender);
    let anchor_interest_model_addr = await create_contract(lcd_client, sender, "anchor_interest_model", anchor_interest_model_wasm, anchor_interest_model_config);
    console.log(`=======================`);

    await execute_contract(lcd_client, sender, anchor_market_addr,
        {
            register_contracts: {
                overseer_contract: anchor_overseer_addr,
                interest_model: anchor_interest_model_addr,
                distribution_model: anchor_distribution_model_addr,
                collector_contract: sender.key.accAddress,
                distributor_contract: anchor_distribution_model_addr,
            }
        }
    );
    console.log(`contracts have been registered`);
    console.log(`=======================`);

    await init_terraswap_factory(lcd_client, sender, cw20_code_id);
    let anc_ust_pair_contract = await create_usd_to_token_terraswap_pair(lcd_client, sender, terraswap_factory_addr, anchor_token_addr);
    console.log(`ANC-UST pair contract instantiated\n\taddress: ${anc_ust_pair_contract.pair_contract_addr}\n\tlp token address: ${anc_ust_pair_contract.liquidity_token_addr}`);
    console.log(`=======================`);

    //deploy anchor_custody_contract for bLuna
    let anchor_bluna_hub_bluna_config = AnchorHubBLunaConfig();
    let anchor_bluna_hub_bluna_addr = await create_contract(
        lcd_client,
        sender,
        "basset_hub",
        anchor_basset_hub_wasm,
        anchor_bluna_hub_bluna_config,
        [new Coin("uluna", 100_000_000)]
    );
    console.log(`=======================`);

    let bluna_reward_config = BassetRewardConfig(anchor_bluna_hub_bluna_addr);
    let bluna_reward_addr = await create_contract(
        lcd_client,
        sender,
        "basset_reward",
        anchor_basset_reward_wasm,
        bluna_reward_config
    );
    console.log(`=======================`);

    let bluna_token_config = BLunaTokenConfig(anchor_bluna_hub_bluna_addr, sender.key.accAddress);
    let bluna_token_addr = await create_contract(
        lcd_client,
        sender,
        "bluna_token",
        anchor_basset_token_wasm,
        bluna_token_config
    );
    console.log(`=======================`);

    await execute_contract(lcd_client, sender, anchor_bluna_hub_bluna_addr, {
        update_config: {
            "reward_contract": bluna_reward_addr,
            "token_contract": bluna_token_addr
        }
    });
    console.log(`Basset_reward and basset_token contracts are registered in basset_hub contract`);

    let anchor_custody_bluna_config = AnchorCustodyBassetConfig(
        sender.key.accAddress,
        bluna_token_addr,
        anchor_overseer_addr,
        anchor_market_addr,
        bluna_reward_addr,
        anchor_liquidation_addr,
        "bLuna",
        "BLUNA"
    );
    let anchor_custody_bluna_addr = await create_contract(
        lcd_client,
        sender,
        "bluna_custody",
        anchor_custody_bluna_wasm,
        anchor_custody_bluna_config
    );
    console.log(`=======================`);

    await execute_contract(lcd_client, sender, anchor_overseer_addr, {
        whitelist: {
            name: bluna_token_config.name,
            symbol: bluna_token_config.symbol,
            collateral_token: bluna_token_addr,
            custody_contract: anchor_custody_bluna_addr,
            max_ltv: "0.6",
        }
    });
    console.log(`bLuna has been registered as collateral`);
    console.log(`=======================`);


    return AnchorMarketInfo(
        anchor_market_addr,
        anchor_overseer_addr,
        anchor_oracle_addr,
        anchor_bluna_hub_bluna_addr,
        anchor_token_addr,
        anc_ust_pair_contract.pair_contract_addr,
        aterra_token_addr,
        bluna_token_addr,
        anchor_custody_bluna_addr,
    );
}